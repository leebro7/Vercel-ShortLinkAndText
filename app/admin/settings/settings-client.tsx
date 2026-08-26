"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock, Loader2, Check, AlertTriangle, Eye, EyeOff } from "lucide-react"

export function SettingsClient() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  // Anonymous access toggle
  const [anonEnabled, setAnonEnabled] = useState<boolean | null>(null)
  const [anonSaving, setAnonSaving] = useState(false)
  const [anonError, setAnonError] = useState("")
  const [anonSuccess, setAnonSuccess] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings", { credentials: "include" })
        if (!res.ok) return
        const data = (await res.json()) as { anonymousAccessEnabled: boolean }
        setAnonEnabled(data.anonymousAccessEnabled)
      } catch {
        // ignore
      }
    })()
  }, [])

  async function handleAnonToggle(next: boolean) {
    setAnonSaving(true)
    setAnonError("")
    setAnonSuccess(false)
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonymousAccessEnabled: next }),
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "保存失败")
      }
      const data = (await res.json()) as { anonymousAccessEnabled: boolean }
      setAnonEnabled(data.anonymousAccessEnabled)
      setAnonSuccess(true)
      setTimeout(() => setAnonSuccess(false), 2000)
    } catch (err) {
      setAnonError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setAnonSaving(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess(false)
    if (newPassword.length < 6) {
      setError("新密码至少需要 6 个字符")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的密码不一致")
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: "include",
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "修改密码失败")
      setSuccess(true)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => router.push("/admin"), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "修改密码失败")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-10 max-w-md">
      {/* Anonymous access toggle */}
      <section>
        <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
          access
        </p>
        <h1 className="mt-3 text-3xl font-semibold">匿名访问</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          控制是否允许未登录访客创建分享。关闭后,只有登录的管理员能创建分享。
        </p>

        <div className="mt-5 rounded-md border border-border/60 bg-card p-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {anonEnabled ? (
                <Eye className="h-4 w-4 text-primary" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="font-medium">
                {anonEnabled ? "允许匿名访客创建" : "仅管理员可创建"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {anonEnabled
                ? "5 次/分钟/IP 限流, 超限返回 429"
                : "所有创建请求被拒, 访客看到登录入口"}
            </p>
            {anonSuccess && (
              <p className="mt-2 text-xs text-primary flex items-center gap-1">
                <Check className="h-3 w-3" /> 已保存
              </p>
            )}
            {anonError && (
              <p className="mt-2 text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {anonError}
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!anonEnabled}
            disabled={anonEnabled === null || anonSaving}
            onClick={() => handleAnonToggle(!anonEnabled)}
            className={
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 " +
              (anonEnabled ? "bg-primary" : "bg-muted")
            }
          >
            <span
              className={
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition-transform mt-0.5 " +
                (anonEnabled ? "translate-x-[22px]" : "translate-x-0.5")
              }
            />
          </button>
        </div>
      </section>

      <div className="border-t border-border/60" />

      {/* Password change */}
      <section>
        <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
          password
        </p>
        <h1 className="mt-3 text-3xl font-semibold">修改密码</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          修改后所有会话会立即失效,需要重新登录。
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {[
            { id: "current", label: "当前密码", v: currentPassword, set: setCurrentPassword },
            { id: "new", label: "新密码", v: newPassword, set: setNewPassword },
            { id: "confirm", label: "再次输入新密码", v: confirmPassword, set: setConfirmPassword },
          ].map((f) => (
            <div key={f.id} className="space-y-1.5">
              <Label htmlFor={f.id} className="text-xs text-muted-foreground">
                {f.label}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id={f.id}
                  type="password"
                  value={f.v}
                  onChange={(e) => f.set(e.target.value)}
                  className="pl-9 font-mono"
                  required
                  minLength={6}
                  disabled={isLoading}
                />
              </div>
            </div>
          ))}

          {success && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              <span>已修改。</span>
            </div>
          )}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                修改中…
              </>
            ) : (
              "保存"
            )}
          </Button>
        </form>
      </section>
    </div>
  )
}
