import { getStats, listItems, type LinkItem } from "@/lib/db"
import { getSessionFromCookie } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { redirect } from "next/navigation"
import { desensitizeUrl } from "@/lib/utils"
import { headers } from "next/headers"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
  const h = await headers()
  const session = await getSessionFromCookie(h.get("cookie"))
  if (!session) redirect("/login")

  const [items, stats] = await Promise.all([listItems(), getStats()])
  const linkItems = items.filter((i): i is LinkItem => i.type === "link")
  const topLinks = [...linkItems].sort((a, b) => b.clickCount - a.clickCount).slice(0, 10)
  const recent = [...items].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8)

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-mono text-sm tracking-tight text-muted-foreground hover:text-foreground">
          ~/short-link
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">返回</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-3xl mx-auto w-full space-y-12">
        <div>
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            analytics
          </p>
          <h1 className="mt-3 text-3xl font-semibold">数据</h1>
        </div>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-6 border-y py-6">
          {[
            { label: "总项目", v: stats.totalItems },
            { label: "总点击", v: stats.totalClicks },
            { label: "活跃", v: stats.activeItems },
            { label: "过期", v: stats.expiredItems },
          ].map((s) => (
            <div key={s.label}>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{s.v}</p>
            </div>
          ))}
        </section>

        <section>
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">
            热门
          </h2>
          {topLinks.length === 0 ? (
            <p className="font-mono text-sm text-muted-foreground">还没有数据</p>
          ) : (
            <ol className="divide-y">
              {topLinks.map((link, i) => (
                <li key={link.id} className="py-3 flex items-center gap-4">
                  <span className="font-mono text-xs text-muted-foreground w-6 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <code className="font-mono text-sm">/{link.shortCode}</code>
                  <span className="flex-1 truncate text-sm text-muted-foreground">
                    {desensitizeUrl(link.originalUrl)}
                  </span>
                  <span className="font-mono text-sm tabular-nums">{link.clickCount}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">
            最近
          </h2>
          <ul className="divide-y">
            {recent.map((item) => (
              <li key={item.id} className="py-3 flex items-center gap-3">
                <code className="font-mono text-sm">/{item.shortCode}</code>
                <span className="font-mono text-xs text-muted-foreground">
                  {item.type === "link" ? "link" : "text"}
                </span>
                <span className="flex-1 truncate text-sm text-muted-foreground">
                  {item.type === "link" ? desensitizeUrl(item.originalUrl) : item.textPreview}
                </span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
