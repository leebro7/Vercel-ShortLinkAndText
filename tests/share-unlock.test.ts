import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { __setDataProviderForTests } from "@/lib/db/provider"
import { InMemoryProvider } from "@/lib/db/memory"
import { hashPassword } from "@/lib/password"
import { readShareUnlock, verifyAndCreateUnlock } from "@/lib/share-unlock"

beforeEach(() => {
  __setDataProviderForTests(new InMemoryProvider())
})

afterEach(() => {
  __setDataProviderForTests(null)
})

describe("share-unlock", () => {
  it("verifyAndCreateUnlock returns a token on correct password", async () => {
    const hash = await hashPassword("secret")
    const token = await verifyAndCreateUnlock("abc", "secret", async (p) => {
      // 模拟业务校验
      if (p !== "secret") throw new Error("wrong")
      if (!hash) throw new Error("no hash")
    })
    expect(token).toMatch(/^[a-f0-9]{32}$/)
    expect(await readShareUnlock("abc", token)).toBe(true)
  })

  it("verifyAndCreateUnlock throws on wrong password", async () => {
    await expect(
      verifyAndCreateUnlock("abc", "wrong", async (p) => {
        if (p !== "secret") throw new Error("wrong")
      }),
    ).rejects.toThrow(/wrong/)
  })

  it("readShareUnlock returns false for unknown token", async () => {
    expect(await readShareUnlock("abc", "nope")).toBe(false)
  })

  it("readShareUnlock returns false for different shortCode", async () => {
    const token = await verifyAndCreateUnlock("abc", "secret", async (p) => {
      if (p !== "secret") throw new Error("wrong")
    })
    expect(await readShareUnlock("xyz", token)).toBe(false)
  })
})
