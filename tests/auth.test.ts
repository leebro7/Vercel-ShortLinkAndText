import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { __setDataProviderForTests } from "@/lib/db/provider"
import { InMemoryProvider } from "@/lib/db/memory"
import {
  SESSION_COOKIE,
  buildClearCookie,
  buildSetCookie,
  changeAdminPassword,
  getAdminUsername,
  getSessionFromCookie,
  login,
  logout,
  readSessionCookie,
} from "@/lib/auth"

beforeEach(() => {
  __setDataProviderForTests(new InMemoryProvider())
  delete process.env.ADMIN_PASSWORD
  delete process.env.ADMIN_USERNAME
})

afterEach(() => {
  __setDataProviderForTests(null)
})

describe("admin credentials", () => {
  it("uses default username when env is unset", async () => {
    expect(await getAdminUsername()).toBe("admin")
  })

  it("reads ADMIN_USERNAME from env", async () => {
    process.env.ADMIN_USERNAME = "alice"
    expect(await getAdminUsername()).toBe("alice")
  })

  it("verifies correct password", async () => {
    process.env.ADMIN_PASSWORD = "topsecret"
    // 通过 getAdminUsername 触发 KV 初始化
    await getAdminUsername()
    // 现在再走 login
    const r = await login("admin", "topsecret")
    expect(r.ok).toBe(true)
  })

  it("rejects wrong password", async () => {
    process.env.ADMIN_PASSWORD = "topsecret"
    await getAdminUsername()
    const r = await login("admin", "wrong")
    expect(r.ok).toBe(false)
  })
})

describe("session cookie round-trip", () => {
  it("login returns a token; readSessionFromCookie returns user", async () => {
    process.env.ADMIN_PASSWORD = "topsecret"
    await getAdminUsername()
    const r = await login("admin", "topsecret")
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const cookie = buildSetCookie(r.token, true)
    const session = await getSessionFromCookie(cookie)
    expect(session?.username).toBe("admin")
  })

  it("readSessionCookie parses the cookie header", () => {
    const c = `${SESSION_COOKIE}=abc123; Path=/; HttpOnly`
    expect(readSessionCookie(c)).toBe("abc123")
  })

  it("readSessionCookie returns null on missing", () => {
    expect(readSessionCookie(null)).toBeNull()
    expect(readSessionCookie("")).toBeNull()
    expect(readSessionCookie("other=1")).toBeNull()
  })

  it("logout invalidates session", async () => {
    process.env.ADMIN_PASSWORD = "topsecret"
    await getAdminUsername()
    const r = await login("admin", "topsecret")
    if (!r.ok) throw new Error("login failed")
    const cookie = buildSetCookie(r.token, true)
    expect((await getSessionFromCookie(cookie))?.username).toBe("admin")
    await logout(r.token)
    expect(await getSessionFromCookie(cookie)).toBeNull()
  })

  it("buildClearCookie has Max-Age=0", () => {
    expect(buildClearCookie(true)).toContain("Max-Age=0")
  })

  it("buildSetCookie includes HttpOnly and SameSite", () => {
    expect(buildSetCookie("xyz", true)).toMatch(/HttpOnly/)
    expect(buildSetCookie("xyz", true)).toMatch(/SameSite=Lax/)
  })
})

describe("changeAdminPassword", () => {
  it("accepts correct current password and rotates", async () => {
    process.env.ADMIN_PASSWORD = "oldpwd1"
    await getAdminUsername()
    await login("admin", "oldpwd1")
    const ok = await changeAdminPassword("oldpwd1", "newpwd2")
    expect(ok).toBe(true)
    // 旧密码不再有效
    const r1 = await login("admin", "oldpwd1")
    expect(r1.ok).toBe(false)
    // 新密码有效
    const r2 = await login("admin", "newpwd2")
    expect(r2.ok).toBe(true)
  })

  it("rejects wrong current password", async () => {
    process.env.ADMIN_PASSWORD = "oldpwd1"
    await getAdminUsername()
    const ok = await changeAdminPassword("wrong", "newpwd2")
    expect(ok).toBe(false)
  })

  it("rejects too-short new password", async () => {
    process.env.ADMIN_PASSWORD = "oldpwd1"
    await getAdminUsername()
    await expect(changeAdminPassword("oldpwd1", "123")).rejects.toThrow(/6/)
  })
})
