/**
 * EdgeOne KV driver(占位)。
 *
 * 与 Cloudflare KV 一样,保留接口形状,不实现。README 阶段
 * 0.4 起会在部署说明里写"未来支持"。
 */

import type { DataProvider } from "./provider"
import type { Item, ItemStats, LogEntry, LogAction } from "./types"

export class EdgeOneKvProvider implements DataProvider {
  private fail(): never {
    throw new Error(
      "EdgeOneKvProvider is not implemented yet. This driver is a reserved seam for future EdgeOne Pages / Functions integration.",
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
