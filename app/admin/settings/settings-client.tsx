"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock, Loader2, Check, AlertTriangle } from "lucide-react"

export function SettingsClient() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

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
    <div className="space-y-6 max-w-md">
      <div>
        <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
          settings
        </p>
        <h1 className="mt-3 text-3xl font-semibold">修改密码</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          修改后所有会话会立即失效,需要重新登录。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
    </div>
  )
}
