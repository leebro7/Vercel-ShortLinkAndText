/**
 * /u 入口: 颁发临时访客 session, 重定向到首页。
 *
 * 流程:
 * 1. 读 cookie, 如果已有 admin 或 guest session, 直接 redirect("/")
 * 2. settings.anonymousAccessEnabled=false 时直接 401 (不透露原因)
 * 3. 创建新 guest session, 写 cookie, redirect("/")
 *
 * 临时账号可创建分享, 但仍受 5次/分钟/IP 限流 (admin 不限).
 * /u 入口本身不暴露在 401 文案里.
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

export const dynamic = "force-dynamic"

const UNAUTHORIZED_RESPONSE = new NextResponse("Unauthorized", {
  status: 401,
  headers: { "content-type": "text/plain; charset=utf-8" },
})

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie")

  // 已有 admin session: 跳过发 guest
  const adminToken = readSessionCookie(cookieHeader)
  const admin = await readSession(adminToken)
  if (admin) {
    return NextResponse.redirect(new URL("/", req.url), { status: 303 })
  }

  // 已有 guest session: 跳过重建 (只验证 cookie 存在, 不读 KV; guest 失效
  // 后 cookie 自动过期, 让它自然失效)
  if (readGuestCookie(cookieHeader)) {
    return NextResponse.redirect(new URL("/", req.url), { status: 303 })
  }

  // settings 守门: 匿名访问关闭时直接 401, 不透露 /u 入口
  const settings = await getSettings()
  if (!settings.anonymousAccessEnabled) {
    return UNAUTHORIZED_RESPONSE
  }

  // 颁发新 guest session
  const token = await createGuestSession()
  const res = NextResponse.redirect(new URL("/", req.url), { status: 303 })
  res.headers.append(
    "Set-Cookie",
    buildSetGuestCookie(token, isSecureRequest({ url: req.url, raw: req })),
  )
  return res
}
