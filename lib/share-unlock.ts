/**
 * 短命的"分享解锁"会话:
 * 验证文本分享密码后,生成 5 分钟内有效的 token。
 *
 * 用途:用户输入密码后,服务端发回 token + set-cookie,SSR 页面
 * 在重新请求 /view 时用 cookie 里的 token 证明已授权。
 * 这样 URL 里不会留密码,也不会让密码长期驻留客户端。
 */

import { getDataProvider } from "./db/provider"

const TTL_SECONDS = 5 * 60

function tokenKey(shortCode: string, token: string): string {
  return `share-unlock:${shortCode}:${token}`
}

function randomToken(): string {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("")
}

/** 验证密码,成功则写一个 5 分钟 token 并返回。失败抛 DomainError。 */
export async function verifyAndCreateUnlock(
  shortCode: string,
  password: string,
  verify: (p: string) => Promise<void>,
): Promise<string> {
  await verify(password)
  const token = randomToken()
  const provider = await getDataProvider()
  await provider.putRaw(tokenKey(shortCode, token), "1", { ex: TTL_SECONDS })
  return token
}

/** 读取 token 是否还有效。 */
export async function readShareUnlock(shortCode: string, token: string): Promise<boolean> {
  const provider = await getDataProvider()
  const v = await provider.getRaw(tokenKey(shortCode, token))
  return v !== null
}

/** 这个 shortCode 的 unlock cookie 名。 */
export function shareUnlockCookieName(shortCode: string): string {
  return `share_unlock_${shortCode}`
}

/** 构造 Set-Cookie 头。 */
export function buildShareUnlockCookie(shortCode: string, token: string, secure: boolean): string {
  const attrs = [
    `${shareUnlockCookieName(shortCode)}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${TTL_SECONDS}`,
  ]
  if (secure) attrs.push("Secure")
  return attrs.join("; ")
}

/** 从 cookie 头里读出 unlock token;没有就 null。 */
export function readShareUnlockCookieToken(cookieHeader: string | null | undefined, shortCode: string): string | null {
  if (!cookieHeader) return null
  const name = shareUnlockCookieName(shortCode) + "="
  const parts = cookieHeader.split(/;\s*/)
  for (const p of parts) {
    if (p.startsWith(name)) return decodeURIComponent(p.slice(name.length))
  }
  return null
}
