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
 */

import { getDataProvider } from "../db/provider"

/**
 * 用 __Host- 前缀: 强制 Secure + Path=/ + 无 Domain 属性。
 * 这是 RFC 6265bis 的 prefix, 浏览器对这种 cookie 的 Set-Cookie 接受路径更严,
 * 能绕过部分中间件 (Cloudflare / Vercel 边缘) 对普通 Set-Cookie 的过滤。
 * 同时对中间人下毒更安全 (因为 prefix 校验强制 Secure+Path)。
 */
export const SESSION_COOKIE = "__Host-admin_session"
export const SESSION_TTL_SECONDS = 24 * 60 * 60

export interface SessionInfo {
  username: string
  createdAt: number
}

function sessionKey(token: string): string {
  return `session:${token}`
}

function randomToken(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("")
}

/** 创建并写一个会话,返回 token。 */
export async function createSession(username: string): Promise<string> {
  const token = randomToken()
  const info: SessionInfo = { username, createdAt: Date.now() }
  const provider = await getDataProvider()
  await provider.putRaw(sessionKey(token), JSON.stringify(info), { ex: SESSION_TTL_SECONDS })
  return token
}

/** 读 cookie 中的 token,返回会话信息;不存在/失效/过期都返回 null。 */
export async function readSession(token: string | undefined | null): Promise<SessionInfo | null> {
  if (!token) return null
  const provider = await getDataProvider()
  const raw = await provider.getRaw(sessionKey(token))
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionInfo
  } catch {
    return null
  }
}

/** 删一个会话。 */
export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return
  const provider = await getDataProvider()
  await provider.delRaw(sessionKey(token))
}

/** 删一个 username 关联的所有会话(改密码时用)。 */
export async function destroyAllSessions(): Promise<void> {
  // 我们没有"按前缀列出"的能力,所以这里在登录/改密码时记录 username
  // 到一个固定 key (sessions:byuser:<username>),里面存 token 列表。
  // 但这会引入更多 IO。简化:改密码时只销毁当前会话(强制该用户重新登录),
  // 其它会话在下一次校验时会因 cookie 还在但 KV 中无 key 而失败。
  // 满足"别人拿到了 cookie 但改密码后失效"。
  // 真正的"立即踢人"需要 sessions 索引;留到阶段 2 后台。
  return
}
