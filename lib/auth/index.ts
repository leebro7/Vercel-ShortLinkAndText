/**
 * 鉴权业务层。
 *
 * 单管理员模型。账号/密码从环境变量读:
 * - ADMIN_USERNAME 默认 "admin"
 * - ADMIN_PASSWORD 默认 "admin123"(仅开发;生产必须显式设置)
 *
 * 改密码时:把密码哈希(用 bcrypt)写入 "admin:password_hash"。
 * 没有该 key 时,启动时按需初始化(env 密码的 bcrypt 哈希)。
 *
 * 启动过程:
 * - 第一次访问任意鉴权接口:若 KV 没 "admin:password_hash",把 env 密码哈希写入。
 *   此后 env 密码不再生效,改密码走 /api/auth/password。
 *   这是简单的"重置一次后即固化"模型。
 */

import { getDataProvider } from "../db/provider"
import { hashPassword, verifyPassword } from "../password"
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSession,
  destroyAllSessions,
  destroySession,
  readSession,
  type SessionInfo,
} from "./session"

export { SESSION_COOKIE, SESSION_TTL_SECONDS, type SessionInfo }

const ADMIN_USERNAME_KEY = "admin:username"
const ADMIN_PASSWORD_HASH_KEY = "admin:password_hash"

function defaultUsername(): string {
  return process.env.ADMIN_USERNAME || "admin"
}

function defaultPassword(): string {
  return process.env.ADMIN_PASSWORD || "admin123"
}

/** 取出当前生效的 username(从 KV 读;若没有则回写默认值)。 */
export async function getAdminUsername(): Promise<string> {
  const provider = await getDataProvider()
  const stored = await provider.getRaw(ADMIN_USERNAME_KEY)
  if (stored) return stored
  const u = defaultUsername()
  await provider.putRaw(ADMIN_USERNAME_KEY, u)
  return u
}

/** 取出当前生效的 password 哈希(从 KV 读;若没有则按 env 计算并回写)。 */
async function getAdminPasswordHash(): Promise<string> {
  const provider = await getDataProvider()
  const stored = await provider.getRaw(ADMIN_PASSWORD_HASH_KEY)
  if (stored) return stored
  const h = await hashPassword(defaultPassword())
  await provider.putRaw(ADMIN_PASSWORD_HASH_KEY, h)
  return h
}

/** 校验用户名 + 密码。 */
export async function verifyAdminCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const expected = await getAdminUsername()
  if (username !== expected) return false
  const hash = await getAdminPasswordHash()
  return verifyPassword(password, hash)
}

/** 修改密码。需要先验证旧密码。 */
export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const hash = await getAdminPasswordHash()
  const ok = await verifyPassword(currentPassword, hash)
  if (!ok) return false
  if (newPassword.length < 6) {
    throw new Error("新密码至少需要 6 个字符")
  }
  const newHash = await hashPassword(newPassword)
  const provider = await getDataProvider()
  await provider.putRaw(ADMIN_PASSWORD_HASH_KEY, newHash)
  await destroyAllSessions()
  return true
}

/**
 * 从 cookie 头里解出 token。
 * 期望格式: "admin_session=<token>; ..."
 */
export function readSessionCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(/;\s*/)
  for (const p of parts) {
    const [k, v] = p.split("=")
    if (k === SESSION_COOKIE && v) return decodeURIComponent(v)
  }
  return null
}

/** 给一个 Response/Headers 设置 session cookie。 */
export function buildSetCookie(token: string, secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ]
  if (secure) attrs.push("Secure")
  return attrs.join("; ")
}

export function buildClearCookie(secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ]
  if (secure) attrs.push("Secure")
  return attrs.join("; ")
}

/** 入口:鉴权 + 写日志由调用方负责。 */
export async function login(
  username: string,
  password: string,
  ctx: { ip?: string; userAgent?: string } = {},
): Promise<{ ok: true; token: string; username: string } | { ok: false }> {
  const valid = await verifyAdminCredentials(username, password)
  if (!valid) return { ok: false }
  const token = await createSession(username)
  return { ok: true, token, username }
}

export async function logout(token: string | null): Promise<void> {
  await destroySession(token)
}

export async function getSessionFromCookie(cookieHeader: string | null): Promise<SessionInfo | null> {
  const token = readSessionCookie(cookieHeader)
  return readSession(token)
}
