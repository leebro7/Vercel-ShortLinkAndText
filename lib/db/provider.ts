/**
 * Data Provider 抽象。
 *
 * 设计目标:同一份业务代码可以在 Vercel KV / Cloudflare KV /
 * EdgeOne KV 之间切换,以及在测试中用 InMemory。
 *
 * 每个 driver 只需要实现 6 个方法;不要让 driver 知道 cookie、
 * 鉴权、Hono、Next 等上层概念。
 */

import type { Item, ItemStats, LogEntry, LogAction } from "./types"

export interface DataProvider {
  /** 列出所有 item。已过期的也返回,过期判断由业务层做。 */
  listItems(): Promise<Item[]>
  /** 按 shortCode 取一条;不存在返回 null。 */
  getItem(shortCode: string): Promise<Item | null>
  /** 新建/覆盖一条。 */
  putItem(item: Item): Promise<void>
  /** 删除一条;不存在静默成功。 */
  deleteItem(shortCode: string): Promise<void>
  /** 聚合统计。 */
  getStats(): Promise<ItemStats>
  /** 写一条日志。 */
  appendLog(entry: Omit<LogEntry, "id" | "at">): Promise<void>
  /** 读最近的 N 条日志(默认 200)。 */
  listLogs(limit?: number): Promise<LogEntry[]>
  /** 按 action 过滤(可选)。 */
  listLogsByAction(action: LogAction, limit?: number): Promise<LogEntry[]>
  /** 通用 KV 写入(用于 session 等非 item 数据)。 */
  putRaw(key: string, value: string, opts?: { ex?: number }): Promise<void>
  /** 通用 KV 读取。不存在返回 null。 */
  getRaw(key: string): Promise<string | null>
  /** 通用 KV 删除。 */
  delRaw(key: string): Promise<void>
}

/**
 * 单进程内选择 provider 的 key。读取顺序:
 * 1. process.env.DATA_PROVIDER(显式覆盖,例如 "memory" 用于测试)
 * 2. UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN(Vercel Marketplace,
 *    Free 计划推荐路径)
 * 3. KV_REST_API_URL + KV_REST_API_TOKEN(已 deprecated 的 Vercel KV,
 *    旧部署的兼容路径)
 * 4. 抛错
 */
let cached: DataProvider | null = null

export async function getDataProvider(): Promise<DataProvider> {
  if (cached) return cached

  const explicit = process.env.DATA_PROVIDER
  if (explicit === "memory") {
    const { InMemoryProvider } = await import("./memory")
    cached = new InMemoryProvider()
    return cached
  }
  if (explicit === "upstash-redis") {
    const { UpstashRedisProvider } = await import("./upstash-redis")
    cached = new UpstashRedisProvider()
    return cached
  }
  if (explicit === "vercel-kv") {
    const { VercelKvProvider } = await import("./vercel-kv")
    cached = new VercelKvProvider()
    return cached
  }
  if (explicit === "cloudflare-kv") {
    const { CloudflareKvProvider } = await import("./cloudflare")
    cached = new CloudflareKvProvider()
    return cached
  }
  if (explicit === "edgeone-kv") {
    const { EdgeOneKvProvider } = await import("./edgeone")
    cached = new EdgeOneKvProvider()
    return cached
  }

  // 默认路径:Upstash Redis(Vercel Marketplace,Free 计划可用)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { UpstashRedisProvider } = await import("./upstash-redis")
    cached = new UpstashRedisProvider()
    return cached
  }

  // 兼容旧 Vercel KV 部署
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { VercelKvProvider } = await import("./vercel-kv")
    cached = new VercelKvProvider()
    return cached
  }

  throw new Error(
    "No DataProvider configured. Install Upstash Redis from Vercel Marketplace, or set DATA_PROVIDER=memory for tests.",
  )
}

/** 仅供测试使用:替换单例。 */
export function __setDataProviderForTests(p: DataProvider | null): void {
  cached = p
}
