/**
 * 会话:服务端校验的 cookie。
 *
 * 模型:
 * - 登录成功 → 生成 32 字节随机 token,把它以 "session:<token>" 写 KV,
 *   同时给 cookie 写 "admin_session=<token>"(httpOnly + SameSite=Lax)。
 * - 任何鉴权判断都看 cookie + KV 是否仍有该 token。缺一个即视为未登录。
 * - 修改密码 / 登出 → 从 KV 删该 token,客户端 cookie 立刻失效。
 *
 * 优势:可被服务端撤销(改密码会让所有会话失效);不像 JWT 那样不可收回。
 * 代价:每次鉴权多一次 KV 读,管理员场景可接受。
 *
 * 临时访客会话 (guest):
 * - 访问 /u 入口时颁发,独立 cookie 名 + 独立 KV 路径。
 * - 通过 cookie 标记 kind="guest", 与 admin 会话互不污染。
 * - 只能创建分享, 不能进 admin 后台。
 */

import { getDataProvider } from "../db/provider"

/**
 * 用 __Host- 前缀: 强制 Secure + Path=/ + 无 Domain 属性。
 * 这是 RFC 6265bis 的 prefix, 浏览器对这种 cookie 的 Set-Cookie 接受路径更严,
 * 能绕过部分中间件 (Cloudflare / Vercel 边缘) 对普通 Set-Cookie 的过滤。
 * 同时对中间人下毒更安全 (因为 prefix 校验强制 Secure+Path)。
 */
export const SESSION_COOKIE = "__Host-admin_session"
export const GUEST_COOKIE = "__Host-guest_session"
export const SESSION_TTL_SECONDS = 24 * 60 * 60
export const GUEST_TTL_SECONDS = 24 * 60 * 60

export type SessionKind = "admin" | "guest"

export interface SessionInfo {
  kind: SessionKind
  username: string
  createdAt: number
}

function sessionKey(token: string): string {
  return `session:${token}`
}

function guestKey(token: string): string {
  return `guest:${token}`
}

/** username → 该用户所有 active admin session token 列表。
 *  改密码时遍历删除;KV 没有"按前缀列出"的能力, 必须靠这个索引.
 */
function userSessionsKey(username: string): string {
  return `sessions:byuser:${username}`
}

function randomToken(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("")
}

async function appendUserSession(username: string, token: string): Promise<void> {
  const provider = await getDataProvider()
  const key = userSessionsKey(username)
  const raw = await provider.getRaw(key)
  const list: string[] = raw ? safeJsonParse(raw, []) : []
  list.push(token)
  await provider.putRaw(key, JSON.stringify(list), { ex: SESSION_TTL_SECONDS })
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** 创建并写一个 admin 会话,返回 token。 */
export async function createSession(username: string): Promise<string> {
  const token = randomToken()
  const info: SessionInfo = { kind: "admin", username, createdAt: Date.now() }
  const provider = await getDataProvider()
  await provider.putRaw(sessionKey(token), JSON.stringify(info), { ex: SESSION_TTL_SECONDS })
  await appendUserSession(username, token)
  return token
}

/** 创建一个临时访客会话,返回 token。 */
export async function createGuestSession(): Promise<string> {
  const token = randomToken()
  const info: SessionInfo = { kind: "guest", username: "guest", createdAt: Date.now() }
  const provider = await getDataProvider()
  await provider.putRaw(guestKey(token), JSON.stringify(info), { ex: GUEST_TTL_SECONDS })
  return token
}

/** 读 cookie 中的 admin token,返回会话信息;不存在/失效/过期都返回 null。 */
export async function readSession(token: string | undefined | null): Promise<SessionInfo | null> {
  if (!token) return null
  const provider = await getDataProvider()
  const raw = await provider.getRaw(sessionKey(token))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SessionInfo
    // 兼容旧 session: 没有 kind 字段视为 admin
    if (!parsed.kind) parsed.kind = "admin"
    return parsed
  } catch {
    return null
  }
}

/** 读 cookie 中的 guest token,返回会话信息;不存在/失效/过期都返回 null。 */
export async function readGuestSession(token: string | undefined | null): Promise<SessionInfo | null> {
  if (!token) return null
  const provider = await getDataProvider()
  const raw = await provider.getRaw(guestKey(token))
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionInfo
  } catch {
    return null
  }
}

/** 删一个 admin 会话,并从 user 索引里移除。 */
export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return
  const provider = await getDataProvider()
  await provider.delRaw(sessionKey(token))
  // 删索引引用: 找包含这个 token 的 user, 把列表里这项剔掉
  // 没有反向索引 (token → user), 所以这里只删 session key;
  // destroyAllSessions 会清理 user 索引里所有 dead 引用.
}

/** 删一个 guest 会话。 */
export async function destroyGuestSession(token: string | undefined | null): Promise<void> {
  if (!token) return
  const provider = await getDataProvider()
  await provider.delRaw(guestKey(token))
}

/** 删一个 username 关联的所有 admin 会话(改密码时用)。
 *  读 user 索引, 遍历 del 每个 session key, 最后清空索引.
 *  username 是必填, 旧调用点兼容 (no-op) 仅在 username 缺失时退化.
 */
export async function destroyAllSessions(username?: string): Promise<void> {
  if (!username) return
  const provider = await getDataProvider()
  const key = userSessionsKey(username)
  const raw = await provider.getRaw(key)
  if (!raw) return
  const tokens: string[] = safeJsonParse(raw, [])
  for (const t of tokens) {
    await provider.delRaw(sessionKey(t))
  }
  await provider.delRaw(key)
}
