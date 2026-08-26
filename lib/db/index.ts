/**
 * 业务层:统一的 Item CRUD + 鉴权/阅后即焚/密码。
 *
 * 设计:
 * - 路由(handler)只调用本文件,不直接接触 provider。
 * - 业务规则集中:短码生成、保留字、过期、密码、阅后即焚、增量计数。
 * - 日志集中:所有"写操作"与"查看"都打日志(除 text 自身外)。
 */

import { getDataProvider } from "./provider"
import { RESERVED_ROUTES } from "../constants"
import type {
  ContentFormat,
  Item,
  ItemType,
  LinkItem,
  TextItem,
  ItemStats,
  LogAction,
} from "./types"
import { hashPassword, verifyPassword } from "../password"

export * from "./types"

const SHORT_CODE_LEN = 6
const CHARSET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

export class DomainError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = "DomainError"
  }
}

function randomShortCode(): string {
  let s = ""
  for (let i = 0; i < SHORT_CODE_LEN; i++) {
    s += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  }
  return s
}

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function isExpired(item: Item, now: number = Date.now()): boolean {
  return Boolean(item.expiresAt) && (item.expiresAt as number) <= now
}

export interface CreateItemInput {
  type: ItemType
  content: string
  customSuffix?: string
  expiresInHours?: number
  contentFormat?: ContentFormat
  password?: string
  burnAfterReading?: boolean
}

export interface CreateItemResult {
  item: Item
  shortUrl: string
  /** 仅当带密码时返回,用于在结果页提示"已设密码" */
  hasPassword: boolean
}

/**
 * 创建一条 item。冲突规则:
 * - 自定义后缀只能是 [a-z0-9-], 3-20 字符
 * - 不能命中保留字
 * - 不能与已存在的 shortCode 冲突(过期也算冲突,避免链接被复活)
 */
export async function createItem(
  input: CreateItemInput,
  ctx: { baseUrl: string; ip?: string; userAgent?: string } = { baseUrl: "" },
): Promise<CreateItemResult> {
  if (!["link", "text"].includes(input.type)) {
    throw new DomainError("Valid type is required (link or text)", 400)
  }
  if (!input.content || typeof input.content !== "string") {
    throw new DomainError("Content is required", 400)
  }

  if (input.type === "link") {
    try {
      new URL(input.content)
    } catch {
      throw new DomainError("Invalid URL format", 400)
    }
  }

  if (input.customSuffix) {
    if (
      typeof input.customSuffix !== "string" ||
      input.customSuffix.length < 3 ||
      input.customSuffix.length > 20
    ) {
      throw new DomainError("Custom suffix must be between 3 and 20 characters", 400)
    }
    if (!/^[a-zA-Z0-9-]+$/.test(input.customSuffix)) {
      throw new DomainError("Custom suffix can only contain letters, numbers, and hyphens", 400)
    }
  }

  if (input.expiresInHours !== undefined && input.expiresInHours !== null) {
    if (typeof input.expiresInHours !== "number" || input.expiresInHours <= 0) {
      throw new DomainError("Expiration time must be a positive number", 400)
    }
  }

  const provider = await getDataProvider()
  const existing = await provider.listItems()

  let shortCode = input.customSuffix || randomShortCode()
  let attempts = 0
  while (
    existing.some((i) => i.shortCode === shortCode) ||
    RESERVED_ROUTES.includes(shortCode.toLowerCase())
  ) {
    if (input.customSuffix) {
      throw new DomainError(
        RESERVED_ROUTES.includes(input.customSuffix.toLowerCase())
          ? "该短代码是系统保留字段,无法使用"
          : "短代码已被占用",
        RESERVED_ROUTES.includes(input.customSuffix.toLowerCase()) ? 400 : 409,
      )
    }
    shortCode = randomShortCode()
    if (++attempts > 10) {
      throw new DomainError("短代码生成失败,请重试", 500)
    }
  }

  const expiresAt = input.expiresInHours
    ? Date.now() + input.expiresInHours * 60 * 60 * 1000
    : undefined

  const base = {
    id: randomId(),
    shortCode,
    expiresAt,
    clickCount: 0,
    createdAt: Date.now(),
  } as const

  let item: Item
  if (input.type === "link") {
    item = {
      ...base,
      type: "link",
      originalUrl: input.content,
      customSuffix: input.customSuffix,
    } satisfies LinkItem
  } else {
    item = {
      ...base,
      type: "text",
      content: input.content,
      textPreview: input.content.slice(0, 100),
      contentFormat: input.contentFormat ?? "plain",
      burnAfterReading: Boolean(input.burnAfterReading),
      viewCount: 0,
      passwordHash: input.password ? await hashPassword(input.password) : undefined,
    } satisfies TextItem
  }

  await provider.putItem(item)
  await log(
    { action: "create", shortCode, ip: ctx.ip, userAgent: ctx.userAgent },
    { type: item.type },
  )

  return {
    item,
    shortUrl: ctx.baseUrl ? `${ctx.baseUrl}/${shortCode}` : `/${shortCode}`,
    hasPassword: Boolean(input.password),
  }
}

/**
 * 取一条 item 并判断过期。返回的是"原始"item,
 * 不负责 viewCount 累加(那是 viewItem 的事)。
 */
export async function getItem(shortCode: string): Promise<Item | null> {
  const provider = await getDataProvider()
  const item = await provider.getItem(shortCode)
  if (!item) return null
  if (isExpired(item)) return null
  return item
}

export async function listItems(): Promise<Item[]> {
  const provider = await getDataProvider()
  const items = await provider.listItems()
  const now = Date.now()
  return items.filter((i) => !isExpired(i, now))
}

export async function deleteItem(
  shortCode: string,
  ctx: { ip?: string; userAgent?: string } = {},
): Promise<boolean> {
  const provider = await getDataProvider()
  const before = await provider.getItem(shortCode)
  if (!before) return false
  await provider.deleteItem(shortCode)
  await log(
    { action: "delete", shortCode, ip: ctx.ip, userAgent: ctx.userAgent },
    { type: before.type },
  )
  return true
}

export interface UpdateItemInput {
  /** 修改原 URL(link) / 原文本(text) */
  content?: string
  /** 修改过期时间(null 表示取消过期,undefined 表示不动) */
  expiresAt?: number | null
  /** 修改密码(text)。空字符串 = 取消密码。undefined = 不动 */
  password?: string | null
  /** 改阅后即焚 */
  burnAfterReading?: boolean
  /** 改内容格式(text) */
  contentFormat?: ContentFormat
  /** 重命名 shortCode */
  shortCode?: string
}

/**
 * 修改一条 item 的可改字段。返回更新后的 item;
 * 任何不合规都抛 DomainError。
 */
export async function updateItem(
  shortCode: string,
  patch: UpdateItemInput,
  ctx: { ip?: string; userAgent?: string } = {},
): Promise<Item> {
  const provider = await getDataProvider()
  const before = await provider.getItem(shortCode)
  if (!before) throw new DomainError("Item not found", 404)
  if (isExpired(before)) throw new DomainError("Item has expired", 410)

  // 按类型 narrow,分别构造 next
  let next: Item
  if (before.type === "link") {
    const linkPatch = patch as UpdateItemInput
    let originalUrl = before.originalUrl
    if (linkPatch.content !== undefined) {
      try {
        new URL(linkPatch.content)
      } catch {
        throw new DomainError("Invalid URL format", 400)
      }
      originalUrl = linkPatch.content
    }
    const expiresAt = linkPatch.expiresAt === undefined ? before.expiresAt : (linkPatch.expiresAt ?? undefined)
    next = {
      ...before,
      originalUrl,
      expiresAt,
    } as LinkItem
  } else {
    const textPatch = patch as UpdateItemInput
    let content = before.content
    let textPreview = before.textPreview
    if (textPatch.content !== undefined) {
      content = textPatch.content
      textPreview = textPatch.content.slice(0, 100)
    }
    const expiresAt = textPatch.expiresAt === undefined ? before.expiresAt : (textPatch.expiresAt ?? undefined)
    let passwordHash: string | undefined = before.passwordHash
    if (textPatch.password !== undefined) {
      if (textPatch.password === null || textPatch.password === "") {
        passwordHash = undefined
      } else {
        if (textPatch.password.length < 4) {
          throw new DomainError("Password must be at least 4 characters", 400)
        }
        passwordHash = await hashPassword(textPatch.password)
      }
    }
    const burnAfterReading =
      textPatch.burnAfterReading === undefined ? before.burnAfterReading : textPatch.burnAfterReading
    const contentFormat =
      textPatch.contentFormat === undefined ? before.contentFormat : textPatch.contentFormat
    next = {
      ...before,
      content,
      textPreview,
      expiresAt,
      passwordHash,
      burnAfterReading,
      contentFormat,
    } as TextItem
  }

  if (patch.shortCode && patch.shortCode !== shortCode) {
    if (!/^[a-zA-Z0-9-]+$/.test(patch.shortCode) || patch.shortCode.length < 3 || patch.shortCode.length > 20) {
      throw new DomainError("Custom suffix must be between 3 and 20 characters", 400)
    }
    if (RESERVED_ROUTES.includes(patch.shortCode.toLowerCase())) {
      throw new DomainError("该短代码是系统保留字段,无法使用", 400)
    }
    const collision = await provider.getItem(patch.shortCode)
    if (collision) throw new DomainError("短代码已被占用", 409)
    next = { ...next, shortCode: patch.shortCode }
    await provider.deleteItem(shortCode)
    await provider.putItem(next)
  } else {
    await provider.putItem(next)
  }

  await log(
    { action: "update", shortCode: next.shortCode, ip: ctx.ip, userAgent: ctx.userAgent },
    { type: next.type, changed: Object.keys(patch) },
  )

  return next
}

export async function getStats(): Promise<ItemStats> {
  const provider = await getDataProvider()
  return provider.getStats()
}

/**
 * 一次"查看":用于 /[shortCode] 的访问路径。
 * - link: 累加 clickCount + lastClickedAt,不删。
 * - text: 累加 viewCount;如果设置了 burnAfterReading,看完立即删除。
 * - 不返回密码哈希。
 */
export interface ViewResult {
  item: Item
  /** 阅后即焚是否触发了删除(给前端提示用) */
  burned: boolean
}

export async function viewItem(
  shortCode: string,
  ctx: { ip?: string; userAgent?: string } = {},
): Promise<ViewResult | null> {
  const provider = await getDataProvider()
  const before = await provider.getItem(shortCode)
  if (!before) return null
  if (isExpired(before)) return null

  const now = Date.now()
  let burned = false
  let result: Item

  if (before.type === "link") {
    result = { ...before, clickCount: before.clickCount + 1, lastClickedAt: now } as LinkItem
    await provider.putItem(result)
  } else {
    if (before.burnAfterReading && !before.burned) {
      // 阅后即焚: 累加 viewCount, 然后立即从 KV 中删除。
      // 把"带原始内容"的快照返回, 让前端能渲染一次; 之后访问就是 404。
      burned = true
      result = {
        ...before,
        viewCount: before.viewCount + 1,
        lastClickedAt: now,
      } as TextItem
      await provider.deleteItem(shortCode)
    } else {
      result = {
        ...before,
        clickCount: before.clickCount + 1,
        viewCount: before.viewCount + 1,
        lastClickedAt: now,
      } as TextItem
      await provider.putItem(result)
    }
  }

  await log(
    { action: burned ? "burn" : "view", shortCode, ip: ctx.ip, userAgent: ctx.userAgent },
    { type: before.type, hadPassword: before.type === "text" && Boolean(before.passwordHash) },
  )

  return { item: redacted(result), burned }
}

/** 给非管理员 / 公共查看用:把密码哈希清掉。 */
export function redacted(item: Item): Item {
  if (item.type === "text" && item.passwordHash) {
    return { ...item, passwordHash: undefined } as TextItem
  }
  return item
}

/** 管理员用:返回完整 item(含密码哈希)。 */
export function asAdmin(item: Item): Item {
  return item
}

/**
 * 校验一段分享密码。如果 item 没设密码,直接返回 true。
 * 抛 DomainError(401) 表示密码错。
 */
export async function checkSharePassword(item: TextItem, password: string | undefined): Promise<boolean> {
  if (!item.passwordHash) return true
  if (!password) throw new DomainError("Password required", 401)
  const ok = await verifyPassword(password, item.passwordHash)
  if (!ok) throw new DomainError("Wrong password", 401)
  return true
}

async function log(
  partial: { action: LogAction; shortCode?: string; ip?: string; userAgent?: string },
  meta?: Record<string, unknown>,
): Promise<void> {
  const provider = await getDataProvider()
  await provider.appendLog({ ...partial, meta })
}

export async function listRecentLogs(limit = 200) {
  const provider = await getDataProvider()
  return provider.listLogs(limit)
}
