"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Trash2, ExternalLink, Lock, ArrowUpRight, Pencil } from "lucide-react"
import Link from "next/link"
import type { Item } from "@/lib/db"
import { desensitizeUrl, desensitizeText } from "@/lib/utils"

export function RecentLinks() {
  const [items, setItems] = useState<Item[]>([])
  const [stats, setStats] = useState({
    totalItems: 0,
    totalClicks: 0,
    activeItems: 0,
    expiredItems: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const authRes = await fetch("/api/auth/check", { credentials: "include" })
        const auth = (await authRes.json()) as { authenticated: boolean }
        setIsAuthenticated(auth.authenticated)
        if (!auth.authenticated) {
          setIsLoading(false)
          return
        }
        const res = await fetch("/api/items", { credentials: "include" })
        const data = (await res.json()) as { items: Item[]; stats: typeof stats }
        setItems(data.items || [])
        if (data.stats) setStats(data.stats)
      } catch (error) {
        console.error("Error loading items:", error)
      } finally {
        setIsLoading(false)
      }
    })()

    const onCreated = () => {
      void (async () => {
        const res = await fetch("/api/items", { credentials: "include" })
        if (!res.ok) return
        const data = (await res.json()) as { items: Item[]; stats: typeof stats }
        setItems(data.items || [])
        if (data.stats) setStats(data.stats)
      })()
    }
    window.addEventListener("linkCreated", onCreated)
    return () => window.removeEventListener("linkCreated", onCreated)
  }, [])

  async function handleDelete(shortCode: string) {
    if (!confirm("确定要删除吗?")) return
    const res = await fetch(`/api/items?shortCode=${shortCode}`, {
      method: "DELETE",
      credentials: "include",
    })
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.shortCode !== shortCode))
      setStats((s) => ({ ...s, totalItems: s.totalItems - 1 }))
    }
  }

  if (!isAuthenticated) return null
  if (isLoading) {
    return <p className="font-mono text-xs text-muted-foreground text-center py-8">加载中…</p>
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 border-y py-6">
        {[
          { label: "总项目", v: stats.totalItems },
          { label: "总点击", v: stats.totalClicks },
          { label: "活跃", v: stats.activeItems },
          { label: "已过期", v: stats.expiredItems },
        ].map((s) => (
          <div key={s.label}>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{s.v}</p>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="font-mono text-sm text-muted-foreground text-center py-8">
          还没有任何项目。上面输入点东西试试。
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="py-4 flex items-start gap-4 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono text-sm">/{item.shortCode}</code>
                  <span className="font-mono text-xs text-muted-foreground">
                    {item.type === "link" ? "link" : "text"}
                  </span>
                  {item.type === "link" && item.customSuffix && (
                    <span className="font-mono text-xs text-muted-foreground">· custom</span>
                  )}
                  {item.type === "text" && item.passwordHash && (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  )}
                  {item.type === "text" && item.burnAfterReading && (
                    <span className="font-mono text-xs text-muted-foreground">· burn</span>
                  )}
                </div>
                <p
                  title={item.type === "link" ? item.originalUrl : item.textPreview}
                  className="mt-1 text-sm text-muted-foreground line-clamp-1"
                >
                  {item.type === "link"
                    ? desensitizeUrl(item.originalUrl)
                    : desensitizeText(item.textPreview || "")}
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {item.clickCount} hits · {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button asChild variant="ghost" size="icon" aria-label="打开">
                  <Link href={`/${item.shortCode}`} target="_blank">
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" aria-label="修改" disabled title="阶段 2 提供">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="删除" onClick={() => handleDelete(item.shortCode)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
