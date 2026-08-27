/**
 * /u 入口: 颁发临时访客 session, 重定向到首页。
 *
 * 流程:
 * 1. 已有 admin session: 直接 redirect("/")
 * 2. settings.anonymousAccessEnabled=false: 直接 401 (不透露原因)
 * 3. 已有有效 guest session: 跳过重建, redirect("/")
 * 4. 否则: 颁发新 guest session, 写 cookie, redirect("/")
 *
 * 安全约束:
 * - settings 关闭时即使有 stale guest cookie 也 401, 防止 UI 上仍有创建入口的暗示
 * - /u 本身每 IP 每分钟最多 10 次, 防止攻击者循环 mint 新 token 绕开 /api/items 的 5/min 限流
 */

import { NextRequest, NextResponse } from "next/server"
import {
  buildSetGuestCookie,
  createGuestSession,
  readGuestCookie,
  readSession,
  readSessionCookie,
} from "../../lib/auth"
import { getSettings } from "../../lib/settings"
import { isSecureRequest } from "../../lib/utils"
import { checkRateLimit } from "../../lib/ratelimit"

export const dynamic = "force-dynamic"

const UNAUTHORIZED_RESPONSE = new NextResponse("Unauthorized", {
  status: 401,
  headers: { "content-type": "text/plain; charset=utf-8" },
})

const TOO_MANY_RESPONSE = new NextResponse("Too Many Requests", {
  status: 429,
  headers: { "content-type": "text/plain; charset=utf-8" },
})

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  )
}

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie")

  // 1. admin 优先: 已有 admin session 跳过整个 guest 流程
  const adminToken = readSessionCookie(cookieHeader)
  const admin = await readSession(adminToken)
  if (admin) {
    return NextResponse.redirect(new URL("/", req.url), { status: 303 })
  }

  // 2. settings 守门: 优先于 cookie 检查, 保证关闭时无论有无 cookie 都 401
  const settings = await getSettings()
  if (!settings.anonymousAccessEnabled) {
    return UNAUTHORIZED_RESPONSE
  }

  // 3. 已有 guest session: 跳过重建
  if (readGuestCookie(cookieHeader)) {
    return NextResponse.redirect(new URL("/", req.url), { status: 303 })
  }

  // 4. 限流: 防止攻击者循环 mint 新 token 绕开 /api/items 的限流
  const ip = clientIp(req)
  const rl = await checkRateLimit("u-mint", ip, 10)
  if (!rl.allowed) {
    return TOO_MANY_RESPONSE
  }

  // 5. 颁发新 guest session
  const token = await createGuestSession()
  const res = NextResponse.redirect(new URL("/", req.url), { status: 303 })
  res.headers.append(
    "Set-Cookie",
    buildSetGuestCookie(token, isSecureRequest({ url: req.url, raw: req })),
  )
  return res
}
