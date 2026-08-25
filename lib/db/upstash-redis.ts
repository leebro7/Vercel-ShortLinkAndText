/**
 * Upstash Redis driver(Vercel Free 计划的主驱动)。
 *
 * 通过 Vercel Marketplace 安装 Upstash Redis 后,环境变量
 * UPSTASH_REDIS_REST_URL 与 UPSTASH_REDIS_REST_TOKEN 会被自动设置。
 * Free 计划下 10K 命令/天、256 MB 存储 —— 自托管短链完全够用。
 *
 * Key 设计:与 Vercel KV driver 保持一致,方便切换。
 * - item:<shortCode>
 * - items:index          // 逗号分隔的 shortCode 列表
 * - session:<token>
 * - admin:username
 * - admin:password_hash
 * - log:<ms>-<rand>
 * - log:index            // 逗号分隔的最近 log id,环形保留
 *
 * 注:不依赖 @vercel/kv(已 deprecated)。@upstash/redis 直接
 * 与 Upstash REST API 通信,Edge 与 Node 都能跑。我们用 Node
 * runtime(见 app/api/[[...route]]/route.ts),所以无问题。
 */

import { Redis } from "@upstash/redis"
import type { DataProvider } from "./provider"
import type { Item, ItemStats, LogEntry, LogAction } from "./types"

const ITEMS_INDEX_KEY = "items:index"
const LOGS_INDEX_KEY = "log:index"
const LOG_RETENTION = 1000

let cachedClient: Redis | null = null

function client(): Redis {
  if (cachedClient) return cachedClient
  // 兼容 Vercel Marketplace 注入的两种命名:
  //   UPSTASH_REDIS_REST_URL/TOKEN (新) 与 KV_REST_API_URL/TOKEN (旧)
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    throw new Error(
      "Upstash Redis is not configured. Set UPSTASH_REDIS_REST_URL+UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL+KV_REST_API_TOKEN as fallback).",
    )
  }
  cachedClient = new Redis({ url, token })
  return cachedClient
}

export class UpstashRedisProvider implements DataProvider {
  async listItems(): Promise<Item[]> {
    const codes = await this.getAllShortCodes()
    if (codes.length === 0) return []
    const keys = codes.map((c) => `item:${c}`)
    const raw = await client().mget<string[]>(...keys)
    const items: Item[] = []
    for (const r of raw) {
      if (!r) continue
      try {
        items.push(typeof r === "string" ? (JSON.parse(r) as Item) : (r as Item))
      } catch {
        // skip corrupted
      }
    }
    return items
  }

  async getItem(shortCode: string): Promise<Item | null> {
    const raw = await client().get<string>(`item:${shortCode}`)
    if (!raw) return null
    try {
      return typeof raw === "string" ? (JSON.parse(raw) as Item) : (raw as Item)
    } catch {
      return null
    }
  }

  async putItem(item: Item): Promise<void> {
    await client().set(`item:${item.shortCode}`, JSON.stringify(item))
    await this.addToIndex(item.shortCode)
  }

  async deleteItem(shortCode: string): Promise<void> {
    await client().del(`item:${shortCode}`)
    await this.removeFromIndex(shortCode)
  }

  async getStats(): Promise<ItemStats> {
    const items = await this.listItems()
    const now = Date.now()
    let totalClicks = 0
    let active = 0
    let expired = 0
    for (const i of items) {
      totalClicks += i.clickCount
      if (i.expiresAt && i.expiresAt <= now) expired++
      else active++
    }
    return {
      totalItems: items.length,
      totalClicks,
      activeItems: active,
      expiredItems: expired,
    }
  }

  async appendLog(entry: Omit<LogEntry, "id" | "at">): Promise<void> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    const log: LogEntry = { id, at: Date.now(), ...entry }
    await client().set(`log:${id}`, JSON.stringify(log))
    await this.pushLogToIndex(id)
  }

  async listLogs(limit = 200): Promise<LogEntry[]> {
    return this.listLogsInternal(undefined, limit)
  }

  async listLogsByAction(action: LogAction, limit = 200): Promise<LogEntry[]> {
    return this.listLogsInternal(action, limit)
  }

  async putRaw(key: string, value: string, opts?: { ex?: number }): Promise<void> {
    if (opts?.ex) {
      await client().set(key, value, { ex: opts.ex })
    } else {
      await client().set(key, value)
    }
  }

  async getRaw(key: string): Promise<string | null> {
    const v = await client().get<string>(key)
    if (v === null || v === undefined) return null
    return typeof v === "string" ? v : String(v)
  }

  async delRaw(key: string): Promise<void> {
    await client().del(key)
  }

  private async listLogsInternal(
    action: LogAction | undefined,
    limit: number,
  ): Promise<LogEntry[]> {
    const ids = await this.getLogIds(limit)
    if (ids.length === 0) return []
    const keys = ids.map((id) => `log:${id}`)
    const raw = await client().mget<string[]>(...keys)
    const out: LogEntry[] = []
    for (const r of raw) {
      if (!r) continue
      try {
        const e = typeof r === "string" ? (JSON.parse(r) as LogEntry) : (r as LogEntry)
        if (!action || e.action === action) out.push(e)
      } catch {
        // skip
      }
    }
    return out
  }

  private async getAllShortCodes(): Promise<string[]> {
    const idx = await client().get<string>(ITEMS_INDEX_KEY)
    if (!idx) return []
    return idx.split(",").filter(Boolean)
  }

  private async addToIndex(shortCode: string): Promise<void> {
    const codes = await this.getAllShortCodes()
    if (codes.includes(shortCode)) return
    codes.push(shortCode)
    await client().set(ITEMS_INDEX_KEY, codes.join(","))
  }

  private async removeFromIndex(shortCode: string): Promise<void> {
    const codes = await this.getAllShortCodes()
    const next = codes.filter((c) => c !== shortCode)
    if (next.length === 0) {
      await client().del(ITEMS_INDEX_KEY)
    } else {
      await client().set(ITEMS_INDEX_KEY, next.join(","))
    }
  }

  private async pushLogToIndex(id: string): Promise<void> {
    const idx = await client().get<string>(LOGS_INDEX_KEY)
    const ids = idx ? idx.split(",").filter(Boolean) : []
    ids.push(id)
    if (ids.length > LOG_RETENTION) {
      const dropped = ids.splice(0, ids.length - LOG_RETENTION)
      for (const d of dropped) {
        await client().del(`log:${d}`)
      }
    }
    await client().set(LOGS_INDEX_KEY, ids.join(","))
  }

  private async getLogIds(limit: number): Promise<string[]> {
    const idx = await client().get<string>(LOGS_INDEX_KEY)
    if (!idx) return []
    const ids = idx.split(",").filter(Boolean)
    return ids.slice(-limit).reverse()
  }
}
