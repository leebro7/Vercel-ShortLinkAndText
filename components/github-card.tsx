"use client"

import { Star, GitFork, ExternalLink, Loader2, Github } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export interface GithubRepoMeta {
  owner: string
  repo: string
  url: string
  title: string
  description: string
  image: string | null
  avatar: string | null
  language: string | null
  stars: string | null
  forks: string | null
}

interface Props {
  meta: GithubRepoMeta
  /**
   * 整张卡片点击后行为:
   * - "external":直接新窗口打开 github URL(适合详情/预览场景)
   * - "fill":点击不跳转(适合表单输入时只是看眼预览, 提交是单独的"生成"按钮)
   */
  onClick?: "external" | "fill"
}

export function GithubCard({ meta, onClick = "external" }: Props) {
  const Wrapper = onClick === "external" ? "a" : "div"
  const wrapperProps =
    onClick === "external"
      ? {
          href: meta.url,
          target: "_blank",
          rel: "noopener noreferrer",
        }
      : {}

  return (
    <Card className="overflow-hidden border-border/60 hover:border-primary/40 transition-colors group">
      <Wrapper
        {...wrapperProps}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
      >
        <CardContent className="p-0">
          <div className="flex">
            {/* 左侧图标区 */}
            <div className="flex items-center justify-center px-4 py-5 bg-muted/40 border-r border-border/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={meta.avatar ?? `https://github.com/${meta.owner}.png?size=80`}
                alt={`${meta.owner} avatar`}
                width={56}
                height={56}
                className="rounded-md bg-background"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  // avatar 404 时降级到 lucide 图标
                  const el = e.currentTarget
                  el.style.display = "none"
                  el.nextElementSibling?.classList.remove("hidden")
                }}
              />
              <Github
                aria-hidden
                className="hidden h-7 w-7 text-muted-foreground"
              />
            </div>

            {/* 右侧元数据 */}
            <div className="flex-1 min-w-0 px-4 py-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    GitHub 仓库预览
                  </p>
                  <h3 className="mt-0.5 text-base font-semibold truncate" title={meta.title}>
                    <span className="text-muted-foreground">{meta.owner}</span>
                    <span className="text-muted-foreground/60"> / </span>
                    <span>{meta.repo}</span>
                  </h3>
                </div>
                {onClick === "external" && (
                  <ExternalLink
                    aria-hidden
                    className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary shrink-0 mt-1 transition-colors"
                  />
                )}
              </div>

              {meta.description && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                  {meta.description}
                </p>
              )}

              <div className="mt-3 flex items-center gap-3 font-mono text-xs text-muted-foreground flex-wrap">
                {meta.language && (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 rounded-full bg-primary/70"
                    />
                    {meta.language}
                  </span>
                )}
                {meta.stars && (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3 w-3" aria-hidden />
                    {formatCount(meta.stars)}
                  </span>
                )}
                {meta.forks && (
                  <span className="inline-flex items-center gap-1">
                    <GitFork className="h-3 w-3" aria-hidden />
                    {formatCount(meta.forks)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Wrapper>
    </Card>
  )
}

/** 把 "1.2k" / "3,456" / "12.3k" / "1M" 等统一展示成 "1.2k" */
function formatCount(raw: string): string {
  const t = raw.trim().replace(/,/g, "")
  if (!t) return raw
  const n = Number(t)
  if (!Number.isFinite(n)) return raw
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`
  return String(n)
}

export function GithubCardSkeleton() {
  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="p-0">
        <div className="flex">
          <div className="flex items-center justify-center px-4 py-5 bg-muted/40 border-r border-border/40">
            <Skeleton className="h-14 w-14 rounded-md" />
          </div>
          <div className="flex-1 min-w-0 px-4 py-4 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full max-w-md" />
            <div className="flex gap-3 pt-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function GithubCardError({ reason }: { reason: string }) {
  const msg =
    reason === "rate-limited"
      ? "GitHub 限流了,稍后再试"
      : reason === "not-found"
      ? "仓库不存在或为私有"
      : reason === "fetch-failed"
      ? "抓取失败,检查网络"
      : "无法预览"
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs font-mono text-muted-foreground">
      <Github className="h-3.5 w-3.5" aria-hidden />
      <span>{msg}</span>
    </div>
  )
}

export function GithubCardLoading() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs font-mono text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      <span>正在抓取 GitHub 元数据…</span>
    </div>
  )
}