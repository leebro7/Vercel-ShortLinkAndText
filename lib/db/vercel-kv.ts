/**
 * Vercel KV driver(主驱动)。
 *
 * 用法:在 Vercel 控制台创建 KV,设置环境变量
 * KV_REST_API_URL 与 KV_REST_API_TOKEN 后即被自动选中。
 *
 * Key 设计:
 * - item:<shortCode>   字符串,存 JSON
 * - items:index        字符串,存 "shortCode1,shortCode2,..."(只用于方便遍历;主源是 item:*)
 * - log:<ms>-<rand>    字符串,存 JSON
 * - log:index          字符串,存 "logId1,logId2,..."(最近 1000 条,环形)
 *
 * 读 list 时通过 keys(prefix) + mget 批量取,避免 N 次 RTT。
 */

import { kv } from "@vercel/kv"
import type { DataProvider } from "./provider"
import type { Item, ItemStats, LogEntry, LogAction } from "./types"
import { aggregateStats } from "./index"

const ITEMS_INDEX_KEY = "items:index"
const LOGS_INDEX_KEY = "log:index"
const LOG_RETENTION = 1000

export class VercelKvProvider implements DataProvider {
  async listItems(): Promise<Item[]> {
    const codes = await this.getAllShortCodes()
    if (codes.length === 0) return []
    const keys = codes.map((c) => `item:${c}`)
    const raw = (await kv.mget<string[]>(...keys)) as Array<string | null>
    const items: Item[] = []
    for (const r of raw) {
      if (!r) continue
      try {
        items.push(JSON.parse(r) as Item)
      } catch {
        // 跳过损坏数据
      }
    }
    return items
  }

  async getItem(shortCode: string): Promise<Item | null> {
    const raw = await kv.get<string>(`item:${shortCode}`)
    if (!raw) return null
    try {
      return JSON.parse(raw) as Item
    } catch {
      return null
    }
  }

  async putItem(item: Item): Promise<void> {
    await kv.set(`item:${item.shortCode}`, JSON.stringify(item))
    await this.addToIndex(item.shortCode)
  }

  async deleteItem(shortCode: string): Promise<void> {
    await kv.del(`item:${shortCode}`)
    await this.removeFromIndex(shortCode)
  }

  async getStats(): Promise<ItemStats> {
    return aggregateStats(await this.listItems())
  }

  async appendLog(entry: Omit<LogEntry, "id" | "at">): Promise<void> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    const log: LogEntry = { id, at: Date.now(), ...entry }
    await kv.set(`log:${id}`, JSON.stringify(log))
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
      await kv.set(key, value, { ex: opts.ex })
    } else {
      await kv.set(key, value)
    }
  }

  async getRaw(key: string): Promise<string | null> {
    const v = await kv.get<string>(key)
    return v ?? null
  }

  async delRaw(key: string): Promise<void> {
    await kv.del(key)
  }

  private async listLogsInternal(
    action: LogAction | undefined,
    limit: number,
  ): Promise<LogEntry[]> {
    const ids = await this.getLogIds(limit)
    if (ids.length === 0) return []
    const keys = ids.map((id) => `log:${id}`)
    const raw = (await kv.mget<string[]>(...keys)) as Array<string | null>
    const out: LogEntry[] = []
    for (const r of raw) {
      if (!r) continue
      try {
        const e = JSON.parse(r) as LogEntry
        if (!action || e.action === action) out.push(e)
      } catch {
        // skip
      }
    }
    return out
  }

  private async getAllShortCodes(): Promise<string[]> {
    const idx = await kv.get<string>(ITEMS_INDEX_KEY)
    if (!idx) return []
    return idx.split(",").filter(Boolean)
  }

  private async addToIndex(shortCode: string): Promise<void> {
    const codes = await this.getAllShortCodes()
    if (codes.includes(shortCode)) return
    codes.push(shortCode)
    await kv.set(ITEMS_INDEX_KEY, codes.join(","))
  }

  private async removeFromIndex(shortCode: string): Promise<void> {
    const codes = await this.getAllShortCodes()
    const next = codes.filter((c) => c !== shortCode)
    if (next.length === 0) {
      await kv.del(ITEMS_INDEX_KEY)
    } else {
      await kv.set(ITEMS_INDEX_KEY, next.join(","))
    }
  }

  private async pushLogToIndex(id: string): Promise<void> {
    const idx = await kv.get<string>(LOGS_INDEX_KEY)
    const ids = idx ? idx.split(",").filter(Boolean) : []
    ids.push(id)
    if (ids.length > LOG_RETENTION) {
      const dropped = ids.splice(0, ids.length - LOG_RETENTION)
      for (const d of dropped) {
        await kv.del(`log:${d}`)
      }
    }
    await kv.set(LOGS_INDEX_KEY, ids.join(","))
  }

  private async getLogIds(limit: number): Promise<string[]> {
    const idx = await kv.get<string>(LOGS_INDEX_KEY)
    if (!idx) return []
    const ids = idx.split(",").filter(Boolean)
    return ids.slice(-limit).reverse()
  }
}
