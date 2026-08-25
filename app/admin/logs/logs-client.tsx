"use client"

import { useEffect, useState } from "react"
import type { LogEntry } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download } from "lucide-react"

const ACTIONS = [
  "all",
  "create",
  "view",
  "burn",
  "delete",
  "update",
  "login_success",
  "login_fail",
  "password_change",
] as const

export function LogsClient({ initialLogs }: { initialLogs: LogEntry[] }) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs)
  const [filter, setFilter] = useState<(typeof ACTIONS)[number]>("all")
  const [search, setSearch] = useState("")

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/logs?limit=500")
      if (!res.ok) return
      const data = (await res.json()) as { logs: LogEntry[] }
      setLogs(data.logs || [])
    })()
  }, [])

  const filtered = logs.filter((l) => {
    if (filter !== "all" && l.action !== filter) return false
    if (search) {
      const s = search.toLowerCase()
      return (
        (l.shortCode || "").toLowerCase().includes(s) ||
        (l.ip || "").toLowerCase().includes(s) ||
        (l.userAgent || "").toLowerCase().includes(s)
      )
    }
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold">操作日志</h1>
          <p className="mt-1 text-sm text-muted-foreground">最近 500 条</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/api/logs.csv" download>
              <Download className="mr-1.5 h-3.5 w-3.5" /> 导出 CSV
            </a>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">搜索</Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="短码 / IP / UA"
            className="font-mono text-sm"
          />
        </div>
        <div className="w-48">
          <Label className="text-xs text-muted-foreground">动作</Label>
          <Select value={filter} onValueChange={(v) => setFilter(v as (typeof ACTIONS)[number])}>
            <SelectTrigger className="font-mono text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="font-mono text-sm text-muted-foreground py-8 text-center">
          没有匹配的日志
        </p>
      ) : (
        <div className="border-y overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left font-mono text-xs uppercase tracking-widest text-muted-foreground">
                <th className="py-2 pr-4">时间</th>
                <th className="py-2 pr-4">动作</th>
                <th className="py-2 pr-4">短码</th>
                <th className="py-2 pr-4">IP</th>
                <th className="py-2 pr-4">UA</th>
                <th className="py-2 pr-4">Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((l) => (
                <tr key={l.id} className="font-mono text-xs">
                  <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                    {new Date(l.at).toLocaleString("zh-CN")}
                  </td>
                  <td className="py-2 pr-4">{l.action}</td>
                  <td className="py-2 pr-4">{l.shortCode ?? "—"}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{l.ip ?? "—"}</td>
                  <td className="py-2 pr-4 text-muted-foreground max-w-xs truncate">
                    {l.userAgent ?? "—"}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground max-w-md truncate">
                    {l.meta ? JSON.stringify(l.meta) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
