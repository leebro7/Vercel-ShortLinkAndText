"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, Check, Loader2, ChevronDown, Lock, Flame, QrCode } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

type ItemType = "link" | "text"

function detectType(input: string): ItemType {
  const trimmed = input.trim()
  if (!trimmed) return "link"
  // 多行,或者明显不是 URL -> 文本
  if (trimmed.includes("\n") || /\s{2,}/.test(trimmed)) return "text"
  // URL? 试着 new URL
  try {
    const u = new URL(trimmed)
    if (u.protocol === "http:" || u.protocol === "https:") return "link"
  } catch {
    /* not a url */
  }
  return "text"
}

const EXPIRES: Array<{ v: string; label: string }> = [
  { v: "0", label: "永不过期" },
  { v: "1", label: "1 小时" },
  { v: "24", label: "24 小时" },
  { v: "168", label: "7 天" },
  { v: "720", label: "30 天" },
]

export function LinkForm() {
  const [input, setInput] = useState("")
  const [customSuffix, setCustomSuffix] = useState("")
  const [expiresInHours, setExpiresInHours] = useState("0")
  const [password, setPassword] = useState("")
  const [burnAfterReading, setBurnAfterReading] = useState(false)
  const [maxClicks, setMaxClicks] = useState<string>("0") // 0 = 无限
  const [contentFormat, setContentFormat] = useState<"plain" | "markdown">("markdown")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<{
    shortUrl: string
    shortCode: string
    expiresAt?: number
    type: ItemType
    hasPassword: boolean
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)

  const detectedType: ItemType = detectType(input)
  const isText = detectedType === "text"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) {
      setError(isText ? "请输入要分享的文本" : "请输入链接")
      return
    }
    setError("")
    setResult(null)
    setIsLoading(true)
    try {
      const body: Record<string, unknown> = {
        type: detectedType,
        content: input.trim(),
      }
      if (customSuffix) body.customSuffix = customSuffix
      if (expiresInHours && expiresInHours !== "0") body.expiresInHours = Number(expiresInHours)
      if (isText && password) body.password = password
      if (isText) body.contentFormat = contentFormat
      // maxClicks: "0" = 无限, 正整数 = 限制次数
      // 兼容旧 burnAfterReading (text 阅后即焚 = maxClicks: 1)
      if (maxClicks && maxClicks !== "0") {
        body.maxClicks = Number(maxClicks)
      } else if (isText && burnAfterReading) {
        body.maxClicks = 1
      }

      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      })
      // [DEBUG] 复制 response 一次, 用来读 body 一次给日志, 一次给原流程
      const cloned = response.clone()
      const data = await response.json().catch(() => ({} as Record<string, unknown>))
      console.log("[items/create]", {
        status: response.status,
        ok: response.ok,
        body: await cloned.json().catch(() => null),
        cookies: document.cookie,
        sentAt: new Date().toISOString(),
      })
      if (!response.ok) throw new Error(data.error || "创建失败")
      setResult({
        shortUrl: data.shortUrl,
        shortCode: data.shortCode,
        expiresAt: data.expiresAt,
        type: detectedType,
        hasPassword: Boolean(data.hasPassword),
      })
      setInput("")
      setCustomSuffix("")
      setExpiresInHours("")
      setPassword("")
      setBurnAfterReading(false)
      window.dispatchEvent(new Event("linkCreated"))
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCopy() {
    if (!result) return
    await navigator.clipboard.writeText(result.shortUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleQrToggle() {
    setShowQr((s) => !s)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isText ? "把要分享的文本贴在这里…" : "https://example.com/very/long/url"}
              disabled={isLoading}
              className="font-mono text-sm field-sizing-content min-h-16 resize-y max-h-96"
              autoFocus
            />
            <div className="flex items-center justify-between gap-2 -mt-2">
              <p className="font-mono text-xs text-muted-foreground">
                {isText
                  ? "检测为:文本分享"
                  : input.trim()
                  ? "检测为:短链接"
                  : "自动识别:链接 / 文本"}
              </p>
              {isText && (
                <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5 text-xs">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => setContentFormat("plain")}
                    className={`px-2 py-0.5 rounded font-mono transition-colors ${
                      contentFormat === "plain"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    纯文本
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => setContentFormat("markdown")}
                    className={`px-2 py-0.5 rounded font-mono transition-colors ${
                      contentFormat === "markdown"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    MD
                  </button>
                </div>
              )}
            </div>

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground -ml-2"
                >
                  <ChevronDown className="mr-1 h-3 w-3" />
                  高级选项
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="suffix" className="text-xs text-muted-foreground">
                      自定义后缀
                    </Label>
                    <Input
                      id="suffix"
                      value={customSuffix}
                      onChange={(e) => setCustomSuffix(e.target.value)}
                      placeholder="my-link"
                      disabled={isLoading}
                      pattern="[-a-zA-Z0-9]+"
                      minLength={3}
                      maxLength={20}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="expires" className="text-xs text-muted-foreground">
                      过期时间
                    </Label>
                    <Select value={expiresInHours} onValueChange={setExpiresInHours} disabled={isLoading}>
                      <SelectTrigger id="expires" className="font-mono text-sm">
                        <SelectValue placeholder="永不过期" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPIRES.map((o) => (
                          <SelectItem key={o.v} value={o.v}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {isText && (
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-xs text-muted-foreground flex items-center gap-1">
                      <Lock className="h-3 w-3" /> 访问密码
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="不填则无密码"
                      disabled={isLoading}
                      minLength={4}
                      className="font-mono text-sm"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="maxClicks" className="text-xs text-muted-foreground flex items-center gap-1">
                    <Flame className="h-3 w-3" /> 访问次数限制
                  </Label>
                  <Select value={maxClicks} onValueChange={setMaxClicks} disabled={isLoading}>
                    <SelectTrigger id="maxClicks" className="font-mono text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">不限制</SelectItem>
                      <SelectItem value="1">1 次(阅后即焚)</SelectItem>
                      <SelectItem value="3">3 次</SelectItem>
                      <SelectItem value="5">5 次</SelectItem>
                      <SelectItem value="10">10 次</SelectItem>
                      <SelectItem value="50">50 次</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="font-mono text-xs text-muted-foreground">
                    达到次数后链接自动失效
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中…
                </>
              ) : (
                "生成"
              )}
            </Button>
          </CardContent>
        </Card>
      </form>

      {result && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              {result.type === "link" ? "短链接已就绪" : "分享已就绪"}
              {result.hasPassword ? " · 受密码保护" : ""}
              {result.expiresAt
                ? ` · ${new Date(result.expiresAt).toLocaleString("zh-CN")} 过期`
                : ""}
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={result.shortUrl}
                readOnly
                className="font-mono text-sm"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button onClick={handleCopy} variant="outline" size="icon" aria-label="复制">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button onClick={handleQrToggle} variant="outline" size="icon" aria-label="QR 码">
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              /{result.shortCode}
            </p>
            {showQr && (
              <div className="pt-2 flex justify-center">
                <div className="rounded-md bg-background p-3 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/qr?url=${encodeURIComponent(result.shortUrl)}&format=png`}
                    alt="QR"
                    width={192}
                    height={192}
                    className="block"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
