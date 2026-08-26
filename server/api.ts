/**
 * Hono 路由:整个 /api/*。
 *
 * 设计:
 * - 一个 Hono app,挂载到 /api
 * - 在 Next 16 里通过 app/api/[[...route]]/route.ts 适配。
 *   即"所有非 /api/static 的请求都走 Hono"。
 * - 这样后期迁 Workers/D1 时,Hono 这份代码原样带走,
 *   只需要换 fetch handler 入口与 KV bindings。
 */

import { Hono } from "hono"
import QRCode from "qrcode"
import { DomainError, createItem, deleteItem, getItem, getStats, listItems, listRecentLogs, updateItem, viewItem } from "../lib/db"
import { checkSharePassword } from "../lib/db"
import { type Item } from "../lib/db"
import {
  SESSION_COOKIE,
  buildClearCookie,
  buildSetCookie,
  buildSetGuestCookie,
  buildClearGuestCookie,
  changeAdminPassword,
  createGuestSession,
  getSessionFromCookie,
  getAdminUsername,
  login,
  logout,
  readSessionCookie,
  readGuestCookie,
} from "../lib/auth"
import { checkRateLimit } from "../lib/ratelimit"
import { getDataProvider } from "../lib/db/provider"
import { isSecureRequest } from "../lib/utils"
import { getSettings, updateSettings } from "../lib/settings"

export const apiApp = new Hono()

/* ──────────────── helpers ──────────────── */

function getCookie(c: { req: { raw?: Request; header: (k: string) => string | undefined } }): string | null {
  // Hono on Vercel: c.req.header 在某些版本下不读 raw.headers。
  // 两路都试, 优先 raw.Request.headers (Hono 不会拦截)。
  return c.req.raw?.headers.get("cookie") ?? c.req.header("cookie") ?? null
}

function clientIp(c: { req: { raw?: Request; header: (k: string) => string | undefined } }): string | undefined {
  return (
    c.req.raw?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.raw?.headers.get("x-real-ip") ||
    c.req.header("x-real-ip") ||
    undefined
  )
}

function clientUa(c: { req: { raw?: Request; header: (k: string) => string | undefined } }): string | undefined {
  return c.req.raw?.headers.get("user-agent") ?? c.req.header("user-agent") ?? undefined
}

function isSecure(c: { req: { url: string; raw?: Request; header: (k: string) => string | undefined } }): boolean {
  return isSecureRequest({
    url: c.req.url,
    raw: c.req.raw,
    header: c.req.header,
  })
}

function shareUnlockCookieName(shortCode: string): string {
  return `share_unlock_${shortCode}`
}

function buildShareUnlockCookie(shortCode: string, token: string, secure: boolean): string {
  const attrs = [
    `${shareUnlockCookieName(shortCode)}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${5 * 60}`,
  ]
  if (secure) attrs.push("Secure")
  return attrs.join("; ")
}

function errToResponse(err: unknown): { status: number; body: { error: string } } {
  if (err instanceof DomainError) {
    return { status: err.status, body: { error: err.message } }
  }
  if (err instanceof Error) {
    // eslint-disable-next-line no-console
    console.error("[api]", err)
    return { status: 400, body: { error: err.message } }
  }
  // eslint-disable-next-line no-console
  console.error("[api] unknown error", err)
  return { status: 500, body: { error: "Internal error" } }
}

/**
 * 要求 admin 会话 (排除 guest)。
 * guest 拿同样的 401 提示, 让前端走 /u 入口或登录。
 */
async function requireAdmin(
  c: { req: { raw?: Request; path?: string; method?: string; header: (k: string) => string | undefined } },
): Promise<{ ok: true } | { ok: false; res: Response }> {
  const cookie = getCookie(c)
  const session = await getSessionFromCookie(cookie)
  if (!session || session.kind !== "admin") {
    console.log("[api/requireAdmin FAIL]", {
      path: c.req.path,
      method: c.req.method,
      hasCookie: Boolean(cookie),
      cookiePreview: cookie ? cookie.slice(0, 120) : null,
      kind: session?.kind ?? null,
    })
    return {
      ok: false,
      res: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    }
  }
  return { ok: true }
}

/**
 * 要求任何 "能创建" 的会话 (admin 或 guest)。
 * 无 session 陌生人 401, 不暴露 /u 入口或限流细节。
 */
async function requireCreator(
  c: { req: { raw?: Request; path?: string; method?: string; header: (k: string) => string | undefined } },
): Promise<{ ok: true; session: import("@/lib/auth").SessionInfo } | { ok: false; res: Response }> {
  const cookie = getCookie(c)
  const session = await getSessionFromCookie(cookie)
  if (!session) {
    return {
      ok: false,
      res: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    }
  }
  return { ok: true, session }
}

async function logCtx(c: { req: { raw?: Request; header: (k: string) => string | undefined } }) {
  return { ip: clientIp(c), userAgent: clientUa(c) }
}

/* ──────────────── auth ──────────────── */

apiApp.post("/api/auth/login", async (c) => {
  try {
    const body = (await c.req.json().catch(() => null)) as { username?: string; password?: string } | null
    if (!body?.username || !body?.password) {
      return c.json({ error: "用户名和密码不能为空" }, 400)
    }
    const result = await login(body.username, body.password, await logCtx(c))
    // [DEBUG]
    console.log("[api/auth/login]", {
      username: body.username,
      loginOk: result.ok,
      isSecure: isSecure(c),
      xfp: c.req.header("x-forwarded-proto"),
      url: c.req.url,
    })
    if (!result.ok) {
      return c.json({ error: "用户名或密码错误" }, 401)
    }
    const setCookie = buildSetCookie(result.token, isSecure(c))
    console.log("[api/auth/login] set-cookie:", setCookie)
    // [DEBUG] 显式验证 raw headers 看到 cookie
    const rawCookie = c.req.raw?.headers.get("cookie")
    const honoCookie = c.req.header("cookie")
    console.log("[api/auth/login] incoming cookies:", {
      raw: rawCookie ? rawCookie.slice(0, 80) : null,
      hono: honoCookie ? honoCookie.slice(0, 80) : null,
    })
    return new Response(JSON.stringify({ success: true, message: "登录成功", username: result.username }), {
      status: 200,
      headers: { "content-type": "application/json", "set-cookie": setCookie },
    })
  } catch (err) {
    const e = errToResponse(err)
    return c.json(e.body, e.status as 400)
  }
})

apiApp.post("/api/__debug/force-session", async (c) => {
  // [DEBUG ONLY] 当环境变量 DEBUG_AUTH=1 启用, 接受任何 username,
  // 写一个 valid session, 返回 Set-Cookie。用于诊断 cookie 链路。
  if (process.env.DEBUG_AUTH !== "1") {
    return c.json({ error: "Not enabled" }, 403)
  }
  const body = (await c.req.json().catch(() => null)) as { username?: string } | null
  const username = body?.username || "admin"
  const { createSession } = await import("../lib/auth/session")
  const token = await createSession(username)
  const setCookie = buildSetCookie(token, isSecure(c))
  return new Response(JSON.stringify({ ok: true, username, setCookiePreview: setCookie.slice(0, 60) + "..." }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": setCookie },
  })
})

apiApp.post("/api/auth/logout", async (c) => {
  const token = readSessionCookie(getCookie(c))
  await logout(token)
  const clear = buildClearCookie(isSecure(c))
  return new Response(JSON.stringify({ success: true, message: "登出成功" }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": clear },
  })
})

apiApp.get("/api/auth/check", async (c) => {
  const cookie = getCookie(c)
  const session = await getSessionFromCookie(cookie)
  // [DEBUG]
  console.log("[api/auth/check]", {
    hasCookie: Boolean(cookie),
    cookiePreview: cookie ? cookie.slice(0, 80) : null,
    session: session ? { username: session.username } : null,
  })
  return c.json({ authenticated: Boolean(session), username: session?.username })
})

apiApp.post("/api/auth/password", async (c) => {
  const guard = await requireAdmin(c)
  if (!guard.ok) return guard.res
  const body = (await c.req.json().catch(() => null)) as { currentPassword?: string; newPassword?: string } | null
  if (!body?.currentPassword || !body?.newPassword) {
    return c.json({ error: "Missing required fields" }, 400)
  }
  if (body.newPassword.length < 6) {
    return c.json({ error: "Password must be at least 6 characters" }, 400)
  }
  try {
    const ok = await changeAdminPassword(body.currentPassword, body.newPassword)
    if (!ok) return c.json({ error: "Current password is incorrect" }, 401)
    return c.json({ success: true })
  } catch (err) {
    if (err instanceof Error) return c.json({ error: err.message }, 400)
    return c.json({ error: "Failed to update password" }, 500)
  }
})

/* ──────────────── settings ──────────────── */

apiApp.get("/api/settings", async (c) => {
  const guard = await requireAdmin(c)
  if (!guard.ok) return guard.res
  const settings = await getSettings()
  return c.json(settings)
})

apiApp.patch("/api/settings", async (c) => {
  const guard = await requireAdmin(c)
  if (!guard.ok) return guard.res
  const body = (await c.req.json().catch(() => null)) as
    | { anonymousAccessEnabled?: boolean }
    | null
  if (!body || typeof body.anonymousAccessEnabled !== "boolean") {
    return c.json({ error: "anonymousAccessEnabled (boolean) required" }, 400)
  }
  const next = await updateSettings({ anonymousAccessEnabled: body.anonymousAccessEnabled })
  return c.json(next)
})

/* ──────────────── items ──────────────── */

apiApp.get("/api/items", async (c) => {
  try {
    const guard = await requireAdmin(c)
    if (!guard.ok) return guard.res
    const [items, stats] = await Promise.all([listItems(), getStats()])
    return c.json({ items, stats })
  } catch (err) {
    const e = errToResponse(err)
    return c.json(e.body, e.status as 400)
  }
})

apiApp.post("/api/items", async (c) => {
  try {
    // 三种身份: admin (登录) / guest (/u 入口) / 陌生人 (无 cookie)
    // admin 不限流; guest + 陌生人 都走 5/min/IP 限流
    const guard = await requireCreator(c)
    if (!guard.ok) return guard.res

    const session = guard.session
    const isAdmin = session?.kind === "admin"

    if (!isAdmin) {
      // guest / 陌生人: 5 次/分钟/IP, 不暴露具体原因
      const ip = clientIp(c) || "unknown"
      const rl = await checkRateLimit("create", ip, 5)
      if (!rl.allowed) {
        c.header("X-RateLimit-Limit", String(rl.limit))
        c.header("X-RateLimit-Remaining", "0")
        c.header("X-RateLimit-Reset", String(Math.floor(rl.resetAt / 1000)))
        return c.json({ error: "Unauthorized" }, 401)
      }
      c.header("X-RateLimit-Limit", String(rl.limit))
      c.header("X-RateLimit-Remaining", String(rl.remaining))
    }

    const body = (await c.req.json().catch(() => null)) as
      | {
          type?: "link" | "text"
          content?: string
          customSuffix?: string
          expiresInHours?: number
          contentFormat?: "plain" | "markdown"
          password?: string
          burnAfterReading?: boolean
          maxClicks?: number
        }
      | null
    if (!body) return c.json({ error: "Invalid JSON body" }, 400)

    const baseUrl = new URL(c.req.url).origin
    const result = await createItem(
      {
        type: body.type as "link" | "text",
        content: body.content ?? "",
        customSuffix: body.customSuffix,
        expiresInHours: body.expiresInHours,
        contentFormat: body.contentFormat,
        password: body.password,
        burnAfterReading: body.burnAfterReading,
        maxClicks: body.maxClicks,
      },
      { baseUrl, ...(await logCtx(c)) },
    )
    return c.json(
      { ...result.item, shortUrl: result.shortUrl, hasPassword: result.hasPassword },
      201,
    )
  } catch (err) {
    const e = errToResponse(err)
    return c.json(e.body, e.status as 400)
  }
})

apiApp.delete("/api/items", async (c) => {
  const guard = await requireAdmin(c)
  if (!guard.ok) return guard.res
  const shortCode = c.req.query("shortCode")
  if (!shortCode) return c.json({ error: "Short code is required" }, 400)
  const ok = await deleteItem(shortCode, await logCtx(c))
  if (!ok) return c.json({ error: "Item not found" }, 404)
  return c.json({ success: true })
})

apiApp.patch("/api/items/:shortCode", async (c) => {
  const guard = await requireAdmin(c)
  if (!guard.ok) return guard.res
  const shortCode = c.req.param("shortCode")
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return c.json({ error: "Invalid JSON body" }, 400)
  try {
    const updated = await updateItem(shortCode, body as never, await logCtx(c))
    return c.json(updated)
  } catch (err) {
    const e = errToResponse(err)
    return c.json(e.body, e.status as 400)
  }
})

/**
 * GET /api/items/:shortCode/view
 * 用于"前端想先看元信息(有没有密码/格式)"再决定怎么展示。
 * 不算"已阅",不算 viewCount。
 */
apiApp.get("/api/items/:shortCode/meta", async (c) => {
  const item = await getItem(c.req.param("shortCode"))
  if (!item) return c.json({ error: "Not found" }, 404)
  if (item.type === "text") {
    return c.json({
      type: item.type,
      shortCode: item.shortCode,
      hasPassword: Boolean(item.passwordHash),
      burnAfterReading: item.burnAfterReading,
      burned: Boolean(item.burned),
      contentFormat: item.contentFormat,
      textPreview: item.textPreview,
      expiresAt: item.expiresAt,
      createdAt: item.createdAt,
    })
  }
  return c.json({
    type: item.type,
    shortCode: item.shortCode,
    originalUrl: item.originalUrl,
    clickCount: item.clickCount,
    expiresAt: item.expiresAt,
    createdAt: item.createdAt,
  })
})

/**
 * GET /api/items/:shortCode/view?password=...
 * 真正"查看":text 算 viewCount(阅后即焚立即删内容);link 累加 clickCount。
 * 若 text 有密码且未传 / 传错 → 401。
 */
apiApp.get("/api/items/:shortCode/view", async (c) => {
  const shortCode = c.req.param("shortCode")
  const item = await getItem(shortCode)
  if (!item) return c.json({ error: "Not found" }, 404)
  if (item.type === "text" && item.passwordHash) {
    // 两种解锁方式:
    // 1) ?password=... (一次性,embed 场景)
    // 2) ?token=... (cookie 模式,5 分钟有效,SSR 页面)
    const token = c.req.query("token") ?? readShareUnlockCookieToken(getCookie(c), shortCode)
    const password = c.req.query("password")
    let ok = false
    if (token) {
      const { readShareUnlock } = await import("../lib/share-unlock")
      ok = await readShareUnlock(shortCode, token)
    } else if (password !== undefined) {
      try {
        await checkSharePassword(item, password)
        ok = true
      } catch (err) {
        if (err instanceof DomainError) {
          return c.json({ error: err.message }, err.status as 401)
        }
        throw err
      }
    } else {
      return c.json({ error: "Password required" }, 401)
    }
    if (!ok) return c.json({ error: "Invalid or expired unlock token" }, 401)
  }
  const result = await viewItem(shortCode, await logCtx(c))
  if (!result) return c.json({ error: "Not found" }, 404)
  return c.json({ item: result.item, burned: result.burned })
})

function readShareUnlockCookieToken(cookieHeader: string | null, shortCode: string): string | null {
  if (!cookieHeader) return null
  const name = shareUnlockCookieName(shortCode) + "="
  const parts = cookieHeader.split(/;\s*/)
  for (const p of parts) {
    if (p.startsWith(name)) return decodeURIComponent(p.slice(name.length))
  }
  return null
}

/**
 * POST /api/items/:shortCode/unlock
 * body: { password }
 * 验证密码,成功返回 token(5 分钟)并下发 set-cookie,后续 /view 用 ?token=... 即可。
 */
apiApp.post("/api/items/:shortCode/unlock", async (c) => {
  const shortCode = c.req.param("shortCode")
  const body = (await c.req.json().catch(() => null)) as { password?: string } | null
  if (!body?.password) return c.json({ error: "Password required" }, 400)
  const item = await getItem(shortCode)
  if (!item) return c.json({ error: "Not found" }, 404)
  if (item.type !== "text" || !item.passwordHash) {
    return c.json({ error: "This share is not password-protected" }, 400)
  }
  try {
    const { verifyAndCreateUnlock } = await import("../lib/share-unlock")
    const token = await verifyAndCreateUnlock(shortCode, body.password, async (p) => {
      await checkSharePassword(item, p)
    })
    const cookie = buildShareUnlockCookie(shortCode, token, isSecure(c))
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json", "set-cookie": cookie },
    })
  } catch (err) {
    if (err instanceof DomainError) {
      return c.json({ error: err.message }, err.status as 401)
    }
    throw err
  }
})

/* ──────────────── analytics ──────────────── */

apiApp.get("/api/analytics", async (c) => {
  const guard = await requireAdmin(c)
  if (!guard.ok) return guard.res
  const stats = await getStats()
  const items = await listItems()
  return c.json({ stats, items })
})

/* ──────────────── logs ──────────────── */

apiApp.get("/api/logs", async (c) => {
  const guard = await requireAdmin(c)
  if (!guard.ok) return guard.res
  const limit = Number(c.req.query("limit") ?? 200)
  const logs = await listRecentLogs(Number.isFinite(limit) ? limit : 200)
  return c.json({ logs })
})

apiApp.get("/api/logs.csv", async (c) => {
  const guard = await requireAdmin(c)
  if (!guard.ok) return guard.res
  const logs = await listRecentLogs(1000)
  const header = ["at", "action", "shortCode", "ip", "userAgent", "meta"]
  const rows = logs.map((l) =>
    [
      new Date(l.at).toISOString(),
      l.action,
      l.shortCode ?? "",
      l.ip ?? "",
      JSON.stringify(l.userAgent ?? ""),
      JSON.stringify(l.meta ?? {}),
    ]
      .map((v) => csvCell(v))
      .join(","),
  )
  const csv = [header.join(","), ...rows].join("\n")
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="logs-${Date.now()}.csv"`,
    },
  })
})

function csvCell(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

/* ──────────────── oEmbed / blog interface ──────────────── */

/**
 * oEmbed: blog 在嵌入卡片时可拉这个端点拿 HTML/作者/缩略图。
 * 协议:https://oembed.com/
 * 路径:/api/oembed?url=<shortCode 完整链接或 /[shortCode]>&format=json
 */
apiApp.get("/api/oembed", async (c) => {
  const url = c.req.query("url")
  if (!url) return c.json({ error: "Missing url" }, 400)
  const shortCode = extractShortCodeFromUrl(url)
  if (!shortCode) return c.json({ error: "Invalid url" }, 400)
  const item = await getItem(shortCode)
  if (!item) return c.json({ error: "Not found" }, 404)
  if (item.type !== "text" || item.passwordHash || item.burnAfterReading) {
    return c.json({ error: "Not embeddable" }, 403)
  }
  const origin = new URL(c.req.url).origin
  const width = 600
  const height = 400
  return c.json({
    version: "1.0",
    type: "rich",
    width,
    height,
    title: `Share ${item.shortCode}`,
    author_name: "anonymous",
    html: `<iframe src="${origin}/embed/${item.shortCode}" width="${width}" height="${height}" frameborder="0" loading="lazy"></iframe>`,
  })
})

function extractShortCodeFromUrl(input: string): string | null {
  try {
    const u = new URL(input, "http://placeholder.local")
    const path = u.pathname.replace(/^\/+|\/+$/g, "")
    if (!path) return null
    const seg = path.split("/").filter(Boolean)
    if (seg.length === 1) return seg[0]
    if (seg[0] === "share" && seg[1]) return seg[1]
    if (seg[0] === "embed" && seg[1]) return seg[1]
    return null
  } catch {
    return null
  }
}

/* ──────────────── QR ──────────────── */

/**
 * GET /api/qr?url=<encoded>&format=svg|png
 * 给短链生成 QR。Free / 完全开放;只把 url 编码成图片,不存数据。
 */
apiApp.get("/api/qr", async (c) => {
  const url = c.req.query("url")
  if (!url) return c.json({ error: "Missing url" }, 400)
  if (url.length > 2048) return c.json({ error: "URL too long" }, 400)
  const format = c.req.query("format") ?? "svg"
  try {
    if (format === "png") {
      const buf = await QRCode.toBuffer(url, { type: "png", margin: 1, width: 256 })
      return new Response(new Uint8Array(buf), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "cache-control": "public, max-age=86400",
        },
      })
    }
    const svg = await QRCode.toString(url, { type: "svg", margin: 1 })
    return new Response(svg, {
      status: 200,
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=86400",
      },
    })
  } catch {
    return c.json({ error: "Failed to generate QR" }, 500)
  }
})

/* ──────────────── diagnostic ──────────────── */

apiApp.get("/api/health", async (c) => {
  // 真正能"通"代表 KV 在线
  try {
    const provider = await getDataProvider()
    await provider.listItems()
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ ok: false, error: err instanceof Error ? err.message : "Unknown" }, 500)
  }
})

/**
 * [DEBUG ONLY] 把请求里所有 header 完整 dump 出来
 * 用于诊断 cookie / auth / IP 等问题
 */
apiApp.get("/api/__debug/headers", async (c) => {
  const headers: Record<string, string> = {}
  const raw = c.req.raw
  if (raw) {
    raw.headers.forEach((v, k) => {
      headers[k] = v
    })
  }
  // 与 c.req.header 对比
  const viaHono: Record<string, string | undefined> = {
    cookie: c.req.header("cookie"),
    "x-forwarded-proto": c.req.header("x-forwarded-proto"),
    "x-forwarded-for": c.req.header("x-forwarded-for"),
    "user-agent": c.req.header("user-agent"),
    host: c.req.header("host"),
  }
  return c.json({ viaRaw: headers, viaHono })
})

/**
 * [DEBUG ONLY] 测试一个最简单的 cookie: 设个 test=ok, 再读回来
 * 不依赖任何业务逻辑, 用于隔离"Set-Cookie 是不是真的被浏览器接受"
 */
apiApp.get("/api/__debug/set-test-cookie", async (c) => {
  const cookie = `debug_test=ok; Path=/; HttpOnly; SameSite=Lax; Max-Age=300${isSecure(c) ? "; Secure" : ""}`
  return new Response(JSON.stringify({ set: cookie, secure: isSecure(c) }), {
    status: 200,
    headers: { "content-type": "application/json", "set-cookie": cookie },
  })
})

apiApp.get("/api/__debug/check-test-cookie", async (c) => {
  const cookie = getCookie(c)
  return c.json({
    hasDebugTestCookie: Boolean(cookie?.includes("debug_test=ok")),
    cookiePreview: cookie ? cookie.slice(0, 200) : null,
    secure: isSecure(c),
    xfp: c.req.raw?.headers.get("x-forwarded-proto") ?? c.req.header("x-forwarded-proto"),
  })
})

/**
 * [DEBUG ONLY] 写一个固定 key, 再读回, 看 Upstash 是否 round-trip 字符串 OK。
 * 用于诊断 "session 写成功但读失败" 的情况。
 */
apiApp.get("/api/__debug/kv-roundtrip", async (c) => {
  try {
    const provider = await getDataProvider()
    const driver = provider.constructor.name
    const testKey = "__debug:roundtrip"
    const testValue = "hello-" + Date.now()
    await provider.putRaw(testKey, testValue, { ex: 60 })
    const readBack = await provider.getRaw(testKey)
    await provider.delRaw(testKey)
    return c.json({
      driver,
      wrote: testValue,
      readBack,
      match: readBack === testValue,
      typeOfReadBack: typeof readBack,
    })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

/**
 * [DEBUG ONLY] 模拟完整 session 生命周期: 写, 立刻读, 多次读。
 * 这才是 force-session 真实路径的镜像 (Hono 端点 → session.ts → provider.putRaw)。
 */
apiApp.get("/api/__debug/session-roundtrip", async (c) => {
  try {
    const { createSession, readSession } = await import("../lib/auth/session")
    const provider = await getDataProvider()
    const token = await createSession("admin")
    const sessionKey = `session:${token}`
    // 通过 createSession 写后, 立刻读
    const r1 = await readSession(token)
    const r2 = await readSession(token)
    const r3 = await readSession(token)
    // 同时直接 putRaw + getRaw, 排除 readSession 内的 JSON.parse
    const directSessionValue = JSON.stringify({ username: "admin-direct", createdAt: Date.now() })
    await provider.putRaw(sessionKey, directSessionValue, { ex: 60 })
    const directRead = await provider.getRaw(sessionKey)
    // 用一个独立 key 再测一次
    const isolatedKey = "isolated:" + token
    const isolatedValue = "isolated-test-string"
    await provider.putRaw(isolatedKey, isolatedValue, { ex: 60 })
    const isolatedRead = await provider.getRaw(isolatedKey)
    return c.json({
      token,
      tokenLen: token.length,
      sessionKey,
      viaCreateSession: [r1, r2, r3],
      viaCreateSessionAllNull: r1 === null && r2 === null && r3 === null,
      directWrite: directSessionValue,
      directRead,
      directReadEqual: directRead === directSessionValue,
      directReadType: typeof directRead,
      isolatedKey,
      isolatedWrite: isolatedValue,
      isolatedRead,
      isolatedReadEqual: isolatedRead === isolatedValue,
      isolatedReadType: typeof isolatedRead,
    })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

/* ──────────────── legacy redirect ──────────────── */

/**
 * 旧的 /api/links 与 /api/text-share 路径在新版已合并到 /api/items。
 * 为不破坏外部分享链接,保留 410 Gone 提示。
 */
apiApp.all("/api/links", (c) =>
  c.json({ error: "/api/links has been merged into /api/items" }, 410),
)
apiApp.all("/api/text-share", (c) =>
  c.json({ error: "/api/text-share has been merged into /api/items" }, 410),
)

export type ApiAppType = typeof apiApp
// 重新导出供 server 使用
export { SESSION_COOKIE }
export { getAdminUsername }
