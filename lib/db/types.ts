/**
 * 统一数据模型。
 *
 * 这是阶段 0 的最终形态。字段在阶段 0 全部就位，但部分字段
 * （password / burnAfterReading / contentFormat）的实际读写与
 * 鉴权流程会在阶段 0.4-0.5 接入。提前定义是为了让 Data Provider
 * 抽象一次到位。
 */

export type ItemType = "link" | "text"

export type ContentFormat = "plain" | "markdown"

export interface BaseItem {
  id: string
  type: ItemType
  shortCode: string
  expiresAt?: number
  clickCount: number
  createdAt: number
  lastClickedAt?: number
}

export interface LinkItem extends BaseItem {
  type: "link"
  originalUrl: string
  customSuffix?: string
}

export interface TextItem extends BaseItem {
  type: "text"
  content: string
  textPreview: string
  contentFormat: ContentFormat
  /** bcrypt 哈希;空 = 无密码 */
  passwordHash?: string
  /** true = 首次读取后立即删除 */
  burnAfterReading: boolean
  /** 已阅次数(与 clickCount 等价,仅用于语义) */
  viewCount: number
  /** 是否已阅后即焚已触发(防止并发重复触发) */
  burned?: boolean
}

export type Item = LinkItem | TextItem

export interface ItemStats {
  totalItems: number
  totalClicks: number
  activeItems: number
  expiredItems: number
}

export type LogAction =
  | "create"
  | "view"
  | "burn"
  | "delete"
  | "update"
  | "login_success"
  | "login_fail"
  | "password_change"

export interface LogEntry {
  id: string
  action: LogAction
  shortCode?: string
  ip?: string
  userAgent?: string
  meta?: Record<string, unknown>
  at: number
}
