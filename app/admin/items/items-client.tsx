"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Trash2, Pencil, Search, ArrowUpRight, Lock, Flame, Sparkles } from "lucide-react"
import type { Item, LinkItem, TextItem } from "@/lib/db"
import { Markdown } from "@/components/markdown"

export function ItemsClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems)
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<Item | null>(null)
  const [previewing, setPreviewing] = useState<TextItem | null>(null)

  const filtered = items.filter((i) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      i.shortCode.toLowerCase().includes(q) ||
      (i.type === "link" && i.originalUrl.toLowerCase().includes(q)) ||
      (i.type === "text" && (i.textPreview || "").toLowerCase().includes(q))
    )
  })

  async function refresh() {
    const res = await fetch("/api/items", { credentials: "include" })
    if (!res.ok) return
    const data = (await res.json()) as { items: Item[] }
    setItems(data.items || [])
  }

  async function handleDelete(shortCode: string) {
    if (!confirm(`确定要删除 /${shortCode} 吗?`)) return
    const res = await fetch(`/api/items?shortCode=${shortCode}`, {
      method: "DELETE",
      credentials: "include",
    })
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.shortCode !== shortCode))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">条目</h1>
          <p className="mt-1 text-sm text-muted-foreground">共 {items.length} 条</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索短码或内容…"
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="font-mono text-sm text-muted-foreground py-8 text-center">
          {query ? "没找到匹配" : "还没有条目"}
        </p>
      ) : (
        <ul className="divide-y border-y">
          {filtered.map((item) => (
            <li key={item.id} className="py-4 flex items-start gap-4 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono text-sm">/{item.shortCode}</code>
                  <span className="font-mono text-xs text-muted-foreground">{item.type}</span>
                  {item.type === "link" && item.customSuffix && (
                    <span className="font-mono text-xs text-muted-foreground">· custom</span>
                  )}
                  {item.type === "text" && item.passwordHash && (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  )}
                  {item.type === "text" && item.burnAfterReading && (
                    <span className="font-mono text-xs text-muted-foreground">· burn</span>
                  )}
                  {item.type === "text" && item.contentFormat === "markdown" && (
                    <span className="font-mono text-xs text-muted-foreground">· md</span>
                  )}
                </div>
                <p
                  title={item.type === "link" ? item.originalUrl : item.textPreview}
                  className="mt-1 text-sm text-muted-foreground line-clamp-1"
                >
                  {item.type === "link" ? item.originalUrl : item.textPreview}
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {item.clickCount} hits ·{" "}
                  {new Date(item.createdAt).toLocaleString("zh-CN")}
                  {item.expiresAt && (
                    <> · 过期 {new Date(item.expiresAt).toLocaleString("zh-CN")}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {item.type === "text" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="预览"
                    onClick={() => setPreviewing(item as TextItem)}
                  >
                    <Sparkles className="h-4 w-4" />
                  </Button>
                )}
                <Button asChild variant="ghost" size="icon" aria-label="打开">
                  <Link href={`/${item.shortCode}`} target="_blank">
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="编辑"
                  onClick={() => setEditing(item)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="删除"
                  onClick={() => handleDelete(item.shortCode)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await refresh()
          }}
        />
      )}

      {previewing && (
        <Dialog open onOpenChange={() => setPreviewing(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-mono">/{previewing.shortCode}</DialogTitle>
              <DialogDescription>仅管理员可见</DialogDescription>
            </DialogHeader>
            <div className="mt-2">
              {previewing.contentFormat === "markdown" ? (
                <Markdown>{previewing.content}</Markdown>
              ) : (
                <pre className="whitespace-pre-wrap font-serif text-sm">
                  {previewing.content}
                </pre>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

interface EditDialogProps {
  item: Item
  onClose: () => void
  onSaved: () => void
}

function EditDialog({ item, onClose, onSaved }: EditDialogProps) {
  const [content, setContent] = useState(
    item.type === "link" ? item.originalUrl : item.content,
  )
  const [shortCode, setShortCode] = useState(item.shortCode)
  const [expiresAt, setExpiresAt] = useState<number | "">(
    item.expiresAt ?? "",
  )
  const [password, setPassword] = useState("")
  const [clearPassword, setClearPassword] = useState(false)
  const [burnAfterReading, setBurn] = useState(
    item.type === "text" ? item.burnAfterReading : false,
  )
  const [contentFormat, setContentFormat] = useState<"plain" | "markdown">(
    item.type === "text" ? item.contentFormat : "plain",
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleSave() {
    setSaving(true)
    setError("")
    try {
      const patch: Record<string, unknown> = {
        content,
        shortCode,
      }
      if (expiresAt === "") patch.expiresAt = null
      else patch.expiresAt = expiresAt
      if (item.type === "text") {
        if (clearPassword) patch.password = ""
        else if (password) patch.password = password
        patch.burnAfterReading = burnAfterReading
        patch.contentFormat = contentFormat
      }
      const res = await fetch(`/api/items/${item.shortCode}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "保存失败")
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑 /{item.shortCode}</DialogTitle>
          <DialogDescription>
            修改会立刻生效,并记入操作日志。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {item.type === "link" ? "目标 URL" : "内容"}
            </Label>
            {item.type === "link" ? (
              <Input value={content} onChange={(e) => setContent(e.target.value)} className="font-mono text-sm" />
            ) : (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="font-mono text-sm"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">短码</Label>
            <Input
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value)}
              className="font-mono text-sm"
              pattern="[a-zA-Z0-9-]+"
              minLength={3}
              maxLength={20}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">过期时间</Label>
            <div className="flex gap-2">
              <Input
                type="datetime-local"
                value={
                  expiresAt
                    ? new Date(expiresAt).toISOString().slice(0, 16)
                    : ""
                }
                onChange={(e) => {
                  if (!e.target.value) setExpiresAt("")
                  else setExpiresAt(new Date(e.target.value).getTime())
                }}
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExpiresAt("")}
              >
                清除
              </Button>
            </div>
          </div>

          {item.type === "text" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3" /> 密码
                </Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setClearPassword(false)
                  }}
                  placeholder="留空则不修改"
                  className="font-mono text-sm"
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={clearPassword}
                    onChange={(e) => {
                      setClearPassword(e.target.checked)
                      if (e.target.checked) setPassword("")
                    }}
                  />
                  清除现有密码
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={burnAfterReading}
                  onChange={(e) => setBurn(e.target.checked)}
                />
                <Flame className="h-3.5 w-3.5 text-muted-foreground" /> 阅后即焚
              </label>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">格式</Label>
                <div className="flex gap-2 text-sm">
                  {(["plain", "markdown"] as const).map((f) => (
                    <Button
                      key={f}
                      type="button"
                      variant={contentFormat === f ? "default" : "outline"}
                      size="sm"
                      onClick={() => setContentFormat(f)}
                    >
                      {f}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
