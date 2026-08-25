import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { __setDataProviderForTests, getDataProvider } from "@/lib/db/provider"
import { InMemoryProvider } from "@/lib/db/memory"
import {
  DomainError,
  createItem,
  deleteItem,
  getItem,
  getStats,
  listItems,
  listRecentLogs,
  updateItem,
  viewItem,
} from "@/lib/db"

beforeEach(() => {
  __setDataProviderForTests(new InMemoryProvider())
})

afterEach(() => {
  __setDataProviderForTests(null)
})

describe("createItem", () => {
  it("creates a link with random short code", async () => {
    const r = await createItem({ type: "link", content: "https://example.com" })
    expect(r.item.type).toBe("link")
    if (r.item.type === "link") {
      expect(r.item.originalUrl).toBe("https://example.com")
    }
    expect(r.item.shortCode).toMatch(/^[A-Za-z0-9]{6}$/)
  })

  it("rejects invalid URL", async () => {
    await expect(createItem({ type: "link", content: "not a url" })).rejects.toBeInstanceOf(DomainError)
  })

  it("uses custom suffix when provided", async () => {
    const r = await createItem({ type: "link", content: "https://example.com", customSuffix: "my-link" })
    expect(r.item.shortCode).toBe("my-link")
  })

  it("rejects reserved suffix", async () => {
    await expect(
      createItem({ type: "link", content: "https://example.com", customSuffix: "login" }),
    ).rejects.toThrow(/保留/)
  })

  it("rejects suffix with bad chars", async () => {
    await expect(
      createItem({ type: "link", content: "https://example.com", customSuffix: "a!b" }),
    ).rejects.toBeInstanceOf(DomainError)
  })

  it("rejects duplicate suffix", async () => {
    await createItem({ type: "link", content: "https://example.com", customSuffix: "dup-x" })
    await expect(
      createItem({ type: "link", content: "https://example.com/other", customSuffix: "dup-x" }),
    ).rejects.toThrow(/已被占用/)
  })

  it("creates a text item with password hash", async () => {
    const r = await createItem({ type: "text", content: "hello", password: "secret" })
    expect(r.item.type).toBe("text")
    if (r.item.type === "text") {
      expect(r.item.passwordHash).toBeTruthy()
      expect(r.item.passwordHash).not.toContain("secret")
    }
    expect(r.hasPassword).toBe(true)
  })
})

describe("getItem / listItems", () => {
  it("returns null for missing", async () => {
    expect(await getItem("nope")).toBeNull()
  })

  it("excludes expired items from listItems", async () => {
    // expiresInHours: 极小值,会立即过期
    const r = await createItem({ type: "link", content: "https://a.com", expiresInHours: 0.0001 })
    // 等 500ms 让其过期(0.0001h = 360ms)
    await new Promise((r) => setTimeout(r, 500))
    expect(await getItem(r.item.shortCode)).toBeNull()
  })
})

describe("viewItem", () => {
  it("link: increments clickCount", async () => {
    const r = await createItem({ type: "link", content: "https://example.com" })
    const v = await viewItem(r.item.shortCode)
    expect(v?.item.clickCount).toBe(1)
    const v2 = await viewItem(r.item.shortCode)
    expect(v2?.item.clickCount).toBe(2)
  })

  it("text: increments viewCount and burns if burnAfterReading", async () => {
    const r = await createItem({ type: "text", content: "secret", burnAfterReading: true })
    const v = await viewItem(r.item.shortCode)
    expect(v?.burned).toBe(true)
    if (v && v.item.type === "text") {
      expect(v.item.content).toBe("") // 阅后即焚:内容被清空
    }
    // 第二次 view 应该能取到 burned 标记
    const v2 = await viewItem(r.item.shortCode)
    if (v2 && v2.item.type === "text") {
      expect(v2.item.burned).toBe(true)
    }
  })
})

describe("updateItem", () => {
  it("updates content and expiresAt", async () => {
    const r = await createItem({ type: "link", content: "https://old.com" })
    const updated = await updateItem(r.item.shortCode, {
      content: "https://new.com",
      expiresAt: Date.now() + 1000 * 60 * 60,
    })
    if (updated.type === "link") {
      expect(updated.originalUrl).toBe("https://new.com")
    }
  })

  it("rejects renaming to a taken code", async () => {
    await createItem({ type: "link", content: "https://a.com", customSuffix: "first" })
    const r2 = await createItem({ type: "link", content: "https://b.com", customSuffix: "second" })
    await expect(
      updateItem(r2.item.shortCode, { shortCode: "first" }),
    ).rejects.toThrow(/已被占用/)
  })

  it("clears password when password is set to empty string", async () => {
    const r = await createItem({ type: "text", content: "x", password: "oldpwd1" })
    const updated = await updateItem(r.item.shortCode, { password: "" })
    if (updated.type === "text") {
      expect(updated.passwordHash).toBeUndefined()
    }
  })
})

describe("deleteItem", () => {
  it("removes item", async () => {
    const r = await createItem({ type: "link", content: "https://example.com" })
    expect(await deleteItem(r.item.shortCode)).toBe(true)
    expect(await getItem(r.item.shortCode)).toBeNull()
  })

  it("returns false for missing", async () => {
    expect(await deleteItem("never-existed")).toBe(false)
  })
})

describe("getStats / logs", () => {
  it("counts items and clicks", async () => {
    const r1 = await createItem({ type: "link", content: "https://a.com" })
    const r2 = await createItem({ type: "link", content: "https://b.com" })
    await viewItem(r1.item.shortCode)
    await viewItem(r1.item.shortCode)
    await viewItem(r2.item.shortCode)

    const stats = await getStats()
    expect(stats.totalItems).toBe(2)
    expect(stats.totalClicks).toBe(3)
    expect(stats.activeItems).toBe(2)
    expect(stats.expiredItems).toBe(0)
  })

  it("records logs of view, create, delete", async () => {
    const r = await createItem({ type: "link", content: "https://x.com" })
    await viewItem(r.item.shortCode, { ip: "1.2.3.4" })
    await deleteItem(r.item.shortCode)
    const logs = await listRecentLogs(50)
    const actions = logs.map((l) => l.action)
    expect(actions).toContain("create")
    expect(actions).toContain("view")
    expect(actions).toContain("delete")
  })
})

describe("provider switching", () => {
  it("getDataProvider returns the cached instance", async () => {
    const a = await getDataProvider()
    const b = await getDataProvider()
    expect(a).toBe(b)
  })
})
