import { NextResponse, type NextRequest } from "next/server"
import { getSessionFromCookie } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * 备用的鉴权检查端点, 不走 Hono。
 * 用于对比诊断 cookie / session 是否真的能跨端点保留。
 */
export async function GET(request: NextRequest) {
  const cookie = request.headers.get("cookie")
  const session = await getSessionFromCookie(cookie)
  return NextResponse.json({
    authenticated: Boolean(session),
    username: session?.username ?? null,
    debug: {
      hasCookie: Boolean(cookie),
      cookiePreview: cookie ? cookie.slice(0, 120) : null,
    },
  })
}
