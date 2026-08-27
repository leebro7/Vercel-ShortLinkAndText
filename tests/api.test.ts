import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { __setDataProviderForTests } from "@/lib/db/provider"
import { InMemoryProvider } from "@/lib/db/memory"
import { createItem, viewItem } from "@/lib/db"
import { buildSetCookie, getAdminUsername, login } from "@/lib/auth"
import { apiApp } from "@/server/api"

function call(path: string, init: RequestInit = {}): Promise<Response> {
  return Promise.resolve(apiApp.request(new Request(`http://localhost${path}`, init)))
}

beforeEach(() => {
  __setDataProviderForTests(new InMemoryProvider())
  process.env.ADMIN_PASSWORD = "test1234"
  process.env.ADMIN_USERNAME = "admin"
})

afterEach(() => {
  __setDataProviderForTests(null)
  delete process.env.ADMIN_PASSWORD
  delete process.env.ADMIN_USERNAME
})

async function loginAndCookie(): Promise<string> {
  await getAdminUsername()
  const r = await login("admin", "test1234")
  if (!r.ok) throw new Error("login failed")
  return buildSetCookie(r.token, false)
}

describe("/api/auth", () => {
  it("login with right creds returns 200 + set-cookie", async () => {
    const res = await call("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "test1234" }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("set-cookie")).toMatch(/admin_session=/)
  })

  it("login with wrong creds returns 401", async () => {
    const res = await call("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "wrong" }),
    })
    expect(res.status).toBe(401)
  })

  it("auth/check returns authenticated=true with valid cookie", async () => {
    const cookie = await loginAndCookie()
    const res = await call("/api/auth/check", { headers: { cookie } })
    const j = (await res.json()) as { authenticated: boolean }
    expect(j.authenticated).toBe(true)
  })
})

describe("/api/items", () => {
  it("GET requires auth", async () => {
    const res = await call("/api/items")
    expect(res.status).toBe(401)
  })

  it("POST requires auth", async () => {
    const res = await call("/api/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "link", content: "https://x.com" }),
    })
    expect(res.status).toBe(401)
  })

  it("POST with auth creates a link", async () => {
    const cookie = await loginAndCookie()
    const res = await call("/api/items", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ type: "link", content: "https://x.com" }),
    })
    expect(res.status).toBe(201)
    const j = (await res.json()) as { shortCode: string; shortUrl: string }
    expect(j.shortCode).toMatch(/^[A-Za-z0-9]{6}$/)
  })

  it("POST rejects reserved suffix", async () => {
    const cookie = await loginAndCookie()
    const res = await call("/api/items", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ type: "link", content: "https://x.com", customSuffix: "login" }),
    })
    expect(res.status).toBe(400)
  })

  it("DELETE requires auth", async () => {
    const res = await call("/api/items?shortCode=anything", { method: "DELETE" })
    expect(res.status).toBe(401)
  })

  it("DELETE with auth removes the item", async () => {
    const cookie = await loginAndCookie()
    const r = await createItem({ type: "link", content: "https://x.com" })
    const res = await call(`/api/items?shortCode=${r.item.shortCode}`, {
      method: "DELETE",
      headers: { cookie },
    })
    expect(res.status).toBe(200)
  })
})

describe("/api/items/:shortCode/view", () => {
  it("returns 404 for missing", async () => {
    const res = await call("/api/items/nope/view")
    expect(res.status).toBe(404)
  })

  it("link view increments clickCount", async () => {
    const r = await createItem({ type: "link", content: "https://x.com" })
    const res = await call(`/api/items/${r.item.shortCode}/view`)
    expect(res.status).toBe(200)
    const j = (await res.json()) as { item: { clickCount: number }; burned: boolean }
    expect(j.item.clickCount).toBe(1)
    expect(j.burned).toBe(false)
  })

  it("text view without password works when no password set", async () => {
    const r = await createItem({ type: "text", content: "hi" })
    const res = await call(`/api/items/${r.item.shortCode}/view`)
    expect(res.status).toBe(200)
  })

  it("text view with password requires it", async () => {
    const r = await createItem({ type: "text", content: "hi", password: "secret" })
    const noPwd = await call(`/api/items/${r.item.shortCode}/view`)
    expect(noPwd.status).toBe(401)
    const wrong = await call(`/api/items/${r.item.shortCode}/view?password=nope`)
    expect(wrong.status).toBe(401)
    const ok = await call(`/api/items/${r.item.shortCode}/view?password=secret`)
    expect(ok.status).toBe(200)
  })
})

describe("/api/items/:shortCode/unlock", () => {
  it("returns set-cookie and grants view access via token", async () => {
    const r = await createItem({ type: "text", content: "locked", password: "secret" })

    const unlockRes = await call(`/api/items/${r.item.shortCode}/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "secret" }),
    })
    expect(unlockRes.status).toBe(200)
    const cookie = unlockRes.headers.get("set-cookie")
    expect(cookie).toMatch(new RegExp(`share_unlock_${r.item.shortCode}=`))

    const viewRes = await call(`/api/items/${r.item.shortCode}/view`, {
      headers: { cookie: cookie! },
    })
    expect(viewRes.status).toBe(200)
  })

  it("rejects wrong password with 401", async () => {
    const r = await createItem({ type: "text", content: "locked", password: "secret" })
    const res = await call(`/api/items/${r.item.shortCode}/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "nope" }),
    })
    expect(res.status).toBe(401)
  })

  it("rejects unlock on non-passworded share with 400", async () => {
    const r = await createItem({ type: "text", content: "open" })
    const res = await call(`/api/items/${r.item.shortCode}/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "anything" }),
    })
    expect(res.status).toBe(400)
  })
})

describe("/api/qr", () => {
  it("returns SVG by default", async () => {
    const res = await call("/api/qr?url=https://example.com")
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toMatch(/svg/)
    const body = await res.text()
    expect(body).toContain("<svg")
  })

  it("returns PNG when format=png", async () => {
    const res = await call("/api/qr?url=https://example.com&format=png")
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toMatch(/png/)
  })

  it("returns 400 for missing url", async () => {
    const res = await call("/api/qr")
    expect(res.status).toBe(400)
  })
})

describe("/api/oembed", () => {
  it("returns 400 for missing url", async () => {
    const res = await call("/api/oembed")
    expect(res.status).toBe(400)
  })

  it("returns oembed JSON for plain text share", async () => {
    const r = await createItem({ type: "text", content: "embed me" })
    const res = await call(`/api/oembed?url=http://localhost/${r.item.shortCode}`)
    expect(res.status).toBe(200)
    const j = (await res.json()) as { type: string; html: string }
    expect(j.type).toBe("rich")
    expect(j.html).toContain("/embed/")
  })

  it("refuses embed for passworded share", async () => {
    const r = await createItem({ type: "text", content: "secret", password: "p" })
    const res = await call(`/api/oembed?url=http://localhost/${r.item.shortCode}`)
    expect(res.status).toBe(403)
  })
})

describe("legacy paths", () => {
  it("/api/links returns 410", async () => {
    const res = await call("/api/links")
    expect(res.status).toBe(410)
  })
  it("/api/text-share returns 410", async () => {
    const res = await call("/api/text-share")
    expect(res.status).toBe(410)
  })
})

describe("expired shortcode cleanup", () => {
  it("getItem releases expired entry and returns null", async () => {
    const { getDataProvider } = await import("@/lib/db/provider")
    const provider = await getDataProvider()
    const past = Date.now() - 1000
    await provider.putItem({
      id: "x",
      shortCode: "expired1",
      expiresAt: past,
      clickCount: 0,
      maxClicks: undefined,
      createdAt: past - 1000,
      type: "link",
      originalUrl: "https://example.com",
      customSuffix: undefined,
    } as never)
    const { getItem } = await import("@/lib/db")
    const found = await getItem("expired1")
    expect(found).toBeNull()
    // 过期条目应被释放
    const after = await provider.getItem("expired1")
    expect(after).toBeNull()
  })

  it("listItems releases expired entries", async () => {
    const { getDataProvider } = await import("@/lib/db/provider")
    const provider = await getDataProvider()
    const past = Date.now() - 1000
    await provider.putItem({
      id: "x",
      shortCode: "expired2",
      expiresAt: past,
      clickCount: 0,
      maxClicks: undefined,
      createdAt: past - 1000,
      type: "link",
      originalUrl: "https://example.com",
      customSuffix: undefined,
    } as never)
    const { listItems } = await import("@/lib/db")
    const items = await listItems()
    expect(items.find((i) => i.shortCode === "expired2")).toBeUndefined()
    const after = await provider.getItem("expired2")
    expect(after).toBeNull()
  })

  it("custom suffix can be reused after expiry", async () => {
    const { getDataProvider } = await import("@/lib/db/provider")
    const provider = await getDataProvider()
    const past = Date.now() - 1000
    // 直接放一个过期条目占住 "reuse"
    await provider.putItem({
      id: "x",
      shortCode: "reuse",
      expiresAt: past,
      clickCount: 0,
      maxClicks: undefined,
      createdAt: past - 1000,
      type: "link",
      originalUrl: "https://example.com",
      customSuffix: "reuse",
    } as never)
    // 创建一个新条目并指定 customSuffix: "reuse"
    const r = await createItem({ type: "link", content: "https://new.com", customSuffix: "reuse" })
    expect(r.item.shortCode).toBe("reuse")
    // 旧过期条目应被释放, 新条目占用
    const after = await provider.getItem("reuse")
    expect(after).not.toBeNull()
    expect(after?.type).toBe("link")
    if (after?.type === "link") {
      expect(after.originalUrl).toBe("https://new.com")
    }
  })

  it("viewItem releases expired entry", async () => {
    const { getDataProvider } = await import("@/lib/db/provider")
    const provider = await getDataProvider()
    const past = Date.now() - 1000
    await provider.putItem({
      id: "x",
      shortCode: "expired3",
      expiresAt: past,
      clickCount: 0,
      maxClicks: undefined,
      createdAt: past - 1000,
      type: "text",
      content: "x",
      textPreview: "x",
      contentFormat: "plain",
      burnAfterReading: false,
      viewCount: 0,
    } as never)
    const v = await viewItem("expired3")
    expect(v).toBeNull()
    const after = await provider.getItem("expired3")
    expect(after).toBeNull()
  })
})
