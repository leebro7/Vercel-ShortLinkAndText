/**
 * Cloudflare KV driver(占位)。
 *
 * 不实现。设置 DATA_PROVIDER=cloudflare-kv 才会被加载,
 * 此时抛错提示用户补全。
 *
 * 阶段目标:保留接口形状,使以后能无痛接入。具体的实现是
 * "把 bindings(KVNamespace) 通过 env 注入,在 list 时用
 * kv.list({prefix:'item:'}) + kv.get(key),在 mget 时手动
 * Promise.all(kv.get(k))"。
 */

import type { DataProvider } from "./provider"
import type { Item, ItemStats, LogEntry, LogAction } from "./types"

export class CloudflareKvProvider implements DataProvider {
  private fail(): never {
    throw new Error(
      "CloudflareKvProvider is not implemented yet. This driver is a reserved seam — implement using env.SHORT_LINK_KV (KVNamespace) from your Worker fetch handler.",
    )
  }

  listItems(): Promise<Item[]> {
    this.fail()
  }
  getItem(_shortCode: string): Promise<Item | null> {
    this.fail()
  }
  putItem(_item: Item): Promise<void> {
    this.fail()
  }
  deleteItem(_shortCode: string): Promise<void> {
    this.fail()
  }
  getStats(): Promise<ItemStats> {
    this.fail()
  }
  appendLog(_entry: Omit<LogEntry, "id" | "at">): Promise<void> {
    this.fail()
  }
  listLogs(_limit?: number): Promise<LogEntry[]> {
    this.fail()
  }
  listLogsByAction(_action: LogAction, _limit?: number): Promise<LogEntry[]> {
    this.fail()
  }
  putRaw(_key: string, _value: string, _opts?: { ex?: number }): Promise<void> {
    this.fail()
  }
  getRaw(_key: string): Promise<string | null> {
    this.fail()
  }
  delRaw(_key: string): Promise<void> {
    this.fail()
  }
}
