"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Lock, Loader2, AlertCircle, FileText, Flame, Copy, Check, Eye } from "lucide-react"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { Markdown } from "@/components/markdown"
import type { ContentFormat } from "@/lib/db/types"
import { cn } from "@/lib/utils"

interface Meta {
  type: "link" | "text"
  shortCode: string
  hasPassword: boolean
  burnAfterReading: boolean
  burned?: boolean
  contentFormat: ContentFormat
  textPreview: string
  expiresAt?: number
  createdAt: number
}

interface ViewPayload {
  item: {
    type: "text"
    content: string
    textPreview: string
    viewCount: number
    contentFormat: ContentFormat
    createdAt: number
    burned?: boolean
  }
  burned: boolean
}

/**
 * 文本分享查看页
 * - 主题切换: 顶部 ThemeToggle 按钮
 * - MD/plain 切换: 顶部 select; 切换时更新 ?format= query 持久化(支持刷新/分享)
 * - 阅后即焚: 服务端删除后, 再次访问 404
 */
export default function TextSharePage({
  params,
}: {
  params: Promise<{ shortCode: string }>
}) {
  const [shortCode, setShortCode] = useState<string>("")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [view, setView] = useState<ViewPayload | null>(null)
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)
  // ?format=md|plain 持久化: URL 优先; 缺省用原文 contentFormat (plain 分享冷启动就按 plain 渲染)
  const urlFormat = searchParams.get("format")
  const viewFormat: ContentFormat =
    urlFormat === "plain" || urlFormat === "markdown"
      ? urlFormat
      : (meta?.contentFormat ?? "markdown")
  // 原文是 plain 时, 不让用户切到 MD (plain 没法 MD 渲染)
  const canToggleFormat = !!meta && meta.contentFormat === "markdown"

  useEffect(() => {
    void params.then((p) => setShortCode(p.shortCode))
  }, [params])

  useEffect(() => {
    if (!shortCode) return
    void (async () => {
      try {
        const res = await fetch(`/api/items/${shortCode}/meta`)
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        const data = (await res.json()) as Meta
        setMeta(data)
        if (!data.hasPassword) {
          await loadView()
        }
      } catch {
        setError("加载失败")
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortCode])

  async function loadView() {
    const res = await fetch(`/api/items/${shortCode}/view`, {
      credentials: "include",
    })
    if (res.status === 401) return
    if (!res.ok) {
      setError("加载失败")
      return
    }
    const data = (await res.json()) as ViewPayload
    setView(data)
  }

  function handleFormatChange(next: ContentFormat) {
    const params = new URLSearchParams(searchParams.toString())
    // 与原文 contentFormat 相同则删 format (URL 干净); 否则记入 query
    if (meta && next === meta.contentFormat) {
      params.delete("format")
    } else {
      params.set("format", next)
    }
    const qs = params.toString()
    // 永远带 pathname, 避免 router.push("") 触发未定义行为
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password) {
      setError("请输入密码")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch(`/api/items/${shortCode}/unlock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "include",
      })
      if (res.status === 401) {
        setError("密码不对")
        return
      }
      if (!res.ok) {
        setError("验证失败")
        return
      }
      await loadView()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopy() {
    if (!view) return
    await navigator.clipboard.writeText(view.item.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (notFound) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            not found
          </p>
          <h1 className="mt-6 text-3xl font-semibold">没找到这份分享</h1>
          <Button asChild className="mt-10">
            <Link href="/">回到首页</Link>
          </Button>
        </div>
      </main>
    )
  }

  if (view) {
    return (
      <main className="min-h-[100dvh] flex flex-col">
        <header className="px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="link-quiet font-mono text-sm tracking-tight text-muted-foreground hover:text-foreground"
          >
            ~/short-link
          </Link>
          <div className="flex items-center gap-3">
            <FormatToggle
              format={viewFormat}
              onChange={handleFormatChange}
              disabled={!canToggleFormat}
            />
            <span aria-hidden className="w-px h-4 bg-border" />
            <ThemeToggle />
          </div>
        </header>
        <article className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              shared note
            </p>
            <p className="font-mono text-xs text-muted-foreground/70">
              {new Date(view.item.createdAt).toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-3 font-mono text-xs flex-wrap">
            {meta?.burnAfterReading && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                <Flame className="h-3 w-3" /> 阅后即焚
              </span>
            )}
            <span className="text-muted-foreground">已查看 {view.item.viewCount} 次</span>
          </div>
          <Card className="mt-6 shadow-[0_1px_2px_oklch(0.22_0.015_60/0.04),0_8px_24px_-12px_oklch(0.22_0.015_60/0.08)] border-border/60">
            <CardContent className="px-6 py-7 sm:px-8 sm:py-8">
              {viewFormat === "markdown" ? (
                <Markdown>{view.item.content}</Markdown>
              ) : (
                <div className="whitespace-pre-wrap break-words font-serif text-base leading-relaxed">
                  {view.item.content}
                </div>
              )}
              {view.burned && (
                <div className="mt-8 pt-6 border-t border-dashed border-border flex items-start gap-2.5">
                  <Flame className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground italic">
                    这条分享已被阅后即焚。再次访问将显示 404。
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="mt-4 flex items-center justify-end gap-2">
            {canToggleFormat && viewFormat === "plain" && (
              <Button
                onClick={() => handleFormatChange("markdown")}
                variant="outline"
                size="sm"
                className="border-primary/30 text-primary hover:bg-primary/5 hover:text-primary hover:border-primary/50"
              >
                <Eye className="mr-1.5 h-3.5 w-3.5" /> 看 MD 预览
              </Button>
            )}
            <Button
              onClick={handleCopy}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              {copied ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" /> 已复制
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> 复制
                </>
              )}
            </Button>
          </div>
        </article>
      </main>
    )
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-mono text-sm tracking-tight text-muted-foreground hover:text-foreground">
          ~/short-link
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              shared note
            </p>
            <h1 className="mt-4 text-2xl font-semibold">需要密码</h1>
            <p className="mt-2 text-sm text-muted-foreground">这份分享被锁了。</p>
          </div>

          {meta && (
            <div className="mb-6 flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <p className="line-clamp-2 text-muted-foreground">{meta.textPreview}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground flex items-center gap-2">
                  <span>创建于 {new Date(meta.createdAt).toLocaleDateString("zh-CN")}</span>
                  {meta.burnAfterReading && (
                    <span className="flex items-center gap-1">
                      <Flame className="h-3 w-3" /> 阅后即焚
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-muted-foreground">
                密码
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 font-mono"
                  autoFocus
                  disabled={submitting}
                />
              </div>
            </div>
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={submitting || !password}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  验证中…
                </>
              ) : (
                "查看"
              )}
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}

function FormatToggle({
  format,
  onChange,
  disabled,
}: {
  format: ContentFormat
  onChange: (format: ContentFormat) => void
  disabled: boolean
}) {
  return (
    <div
      role="group"
      aria-label="渲染格式"
      className="inline-flex items-center rounded-md border bg-background/60 p-0.5"
    >
      <button
        type="button"
        onClick={() => onChange("markdown")}
        disabled={disabled}
        aria-pressed={format === "markdown"}
        className={cn(
          "h-6 px-2.5 text-xs font-mono rounded-sm transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          format === "markdown"
            ? "bg-foreground text-background shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        MD
      </button>
      <button
        type="button"
        onClick={() => onChange("plain")}
        disabled={disabled}
        aria-pressed={format === "plain"}
        className={cn(
          "h-6 px-2.5 text-xs font-mono rounded-sm transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          format === "plain"
            ? "bg-foreground text-background shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        纯文本
      </button>
    </div>
  )
}
