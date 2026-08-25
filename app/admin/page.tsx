import { getStats, listItems } from "@/lib/db"
import { FileText, Link2, ScrollText, ArrowUpRight } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AdminOverview() {
  const [items, stats] = await Promise.all([listItems(), getStats()])
  const recent = [...items].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)
  const expiring = items
    .filter((i) => i.expiresAt)
    .sort((a, b) => a.expiresAt! - b.expiresAt!)
    .slice(0, 5)

  return (
    <div className="space-y-10">
      <div>
        <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
          admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold">总览</h1>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-6 border-y py-6">
        {[
          { label: "总项目", v: stats.totalItems, icon: FileText },
          { label: "活跃", v: stats.activeItems, icon: Link2 },
          { label: "已过期", v: stats.expiredItems, icon: ScrollText },
          { label: "总点击", v: stats.totalClicks, icon: ArrowUpRight },
        ].map((s) => (
          <div key={s.label}>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <s.icon className="h-3 w-3" /> {s.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{s.v}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
          最近创建
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有数据</p>
        ) : (
          <ul className="divide-y border-y">
            {recent.map((item) => (
              <li key={item.id} className="py-3 flex items-center gap-3 text-sm">
                <code className="font-mono">/{item.shortCode}</code>
                <span className="font-mono text-xs text-muted-foreground">
                  {item.type}
                </span>
                <span className="flex-1 truncate text-muted-foreground">
                  {item.type === "link" ? item.originalUrl : item.textPreview}
                </span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {new Date(item.createdAt).toLocaleString("zh-CN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
          即将过期
        </h2>
        {expiring.length === 0 ? (
          <p className="text-sm text-muted-foreground">没有设过期时间的条目</p>
        ) : (
          <ul className="divide-y border-y">
            {expiring.map((item) => (
              <li key={item.id} className="py-3 flex items-center gap-3 text-sm">
                <code className="font-mono">/{item.shortCode}</code>
                <span className="flex-1 text-muted-foreground">
                  {item.expiresAt && new Date(item.expiresAt).toLocaleString("zh-CN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
