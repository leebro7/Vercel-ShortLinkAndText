/**
 * 内存版 Data Provider,仅用于开发与测试。
 * 不做持久化,重启即清空。
 */

import type { DataProvider } from "./provider"
import type { Item, ItemStats, LogEntry, LogAction } from "./types"
import { aggregateStats } from "./index"

export class InMemoryProvider implements DataProvider {
  private items = new Map<string, Item>()
  private logs: LogEntry[] = []
  private raw = new Map<string, string>()
  /** key -> expires at (ms) */
  private rawExpiry = new Map<string, number>()

  private gcRaw() {
    const now = Date.now()
    for (const [k, t] of this.rawExpiry) {
      if (t <= now) {
        this.raw.delete(k)
        this.rawExpiry.delete(k)
      }
    }
  }

  async listItems(): Promise<Item[]> {
    return Array.from(this.items.values())
  }

  async getItem(shortCode: string): Promise<Item | null> {
    return this.items.get(shortCode) ?? null
  }

  async putItem(item: Item): Promise<void> {
    this.items.set(item.shortCode, item)
  }

  async deleteItem(shortCode: string): Promise<void> {
    this.items.delete(shortCode)
  }

  async putRaw(key: string, value: string, opts?: { ex?: number }): Promise<void> {
    this.gcRaw()
    this.raw.set(key, value)
    if (opts?.ex) this.rawExpiry.set(key, Date.now() + opts.ex * 1000)
    else this.rawExpiry.delete(key)
  }

  async getRaw(key: string): Promise<string | null> {
    this.gcRaw()
    return this.raw.get(key) ?? null
  }

  async delRaw(key: string): Promise<void> {
    this.raw.delete(key)
    this.rawExpiry.delete(key)
  }

  async getStats(): Promise<ItemStats> {
    return aggregateStats(Array.from(this.items.values()))
  }

  async appendLog(entry: Omit<LogEntry, "id" | "at">): Promise<void> {
    const e: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      at: Date.now(),
      ...entry,
    }
    this.logs.push(e)
  }

  async listLogs(limit = 200): Promise<LogEntry[]> {
    return this.logs.slice(-limit).reverse()
  }

  async listLogsByAction(action: LogAction, limit = 200): Promise<LogEntry[]> {
    return this.logs
      .filter((l) => l.action === action)
      .slice(-limit)
      .reverse()
  }
}
