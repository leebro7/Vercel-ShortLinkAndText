import { afterEach, describe, expect, it } from "vitest"
import { __setDataProviderForTests, getDataProvider } from "@/lib/db/provider"
import { InMemoryProvider } from "@/lib/db/memory"
import { UpstashRedisProvider } from "@/lib/db/upstash-redis"
import { VercelKvProvider } from "@/lib/db/vercel-kv"
import { CloudflareKvProvider } from "@/lib/db/cloudflare"
import { EdgeOneKvProvider } from "@/lib/db/edgeone"

afterEach(() => {
  __setDataProviderForTests(null)
  delete process.env.DATA_PROVIDER
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
})

describe("getDataProvider", () => {
  it("DATA_PROVIDER=memory returns InMemoryProvider", async () => {
    process.env.DATA_PROVIDER = "memory"
    expect(await getDataProvider()).toBeInstanceOf(InMemoryProvider)
  })

  it("DATA_PROVIDER=upstash-redis returns UpstashRedisProvider", async () => {
    process.env.DATA_PROVIDER = "upstash-redis"
    process.env.UPSTASH_REDIS_REST_URL = "https://example.com"
    process.env.UPSTASH_REDIS_REST_TOKEN = "token"
    expect(await getDataProvider()).toBeInstanceOf(UpstashRedisProvider)
  })

  it("DATA_PROVIDER=vercel-kv returns VercelKvProvider", async () => {
    process.env.DATA_PROVIDER = "vercel-kv"
    process.env.KV_REST_API_URL = "https://example.com"
    process.env.KV_REST_API_TOKEN = "token"
    expect(await getDataProvider()).toBeInstanceOf(VercelKvProvider)
  })

  it("DATA_PROVIDER=cloudflare-kv returns CloudflareKvProvider", async () => {
    process.env.DATA_PROVIDER = "cloudflare-kv"
    expect(await getDataProvider()).toBeInstanceOf(CloudflareKvProvider)
  })

  it("DATA_PROVIDER=edgeone-kv returns EdgeOneKvProvider", async () => {
    process.env.DATA_PROVIDER = "edgeone-kv"
    expect(await getDataProvider()).toBeInstanceOf(EdgeOneKvProvider)
  })

  it("picks Upstash Redis by default when env present", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.com"
    process.env.UPSTASH_REDIS_REST_TOKEN = "token"
    expect(await getDataProvider()).toBeInstanceOf(UpstashRedisProvider)
  })

  it("falls back to Vercel KV when no Upstash env", async () => {
    process.env.KV_REST_API_URL = "https://example.com"
    process.env.KV_REST_API_TOKEN = "token"
    expect(await getDataProvider()).toBeInstanceOf(VercelKvProvider)
  })

  it("throws when no provider configured", async () => {
    await expect(getDataProvider()).rejects.toThrow(/No DataProvider/)
  })

  it("caches the provider across calls", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.com"
    process.env.UPSTASH_REDIS_REST_TOKEN = "token"
    const a = await getDataProvider()
    const b = await getDataProvider()
    expect(a).toBe(b)
  })
})

describe("reserved driver placeholders", () => {
  it("CloudflareKvProvider throws on every method", async () => {
    const p = new CloudflareKvProvider()
    const errors: unknown[] = []
    try { await p.listItems() } catch (e) { errors.push(e) }
    try { await p.getItem("x") } catch (e) { errors.push(e) }
    try { await p.putItem({} as never) } catch (e) { errors.push(e) }
    expect(errors).toHaveLength(3)
    for (const e of errors) {
      expect(e).toBeInstanceOf(Error)
      expect((e as Error).message).toMatch(/reserved seam/)
    }
  })

  it("EdgeOneKvProvider throws on every method", async () => {
    const p = new EdgeOneKvProvider()
    const errors: unknown[] = []
    try { await p.listItems() } catch (e) { errors.push(e) }
    try { await p.appendLog({ action: "view" } as never) } catch (e) { errors.push(e) }
    expect(errors).toHaveLength(2)
    for (const e of errors) {
      expect(e).toBeInstanceOf(Error)
      expect((e as Error).message).toMatch(/reserved seam/)
    }
  })
})
