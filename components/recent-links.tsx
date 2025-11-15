"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trash2, ExternalLink, BarChart3, Lock } from 'lucide-react'
import Link from "next/link"
import type { Item } from "@/lib/types"
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

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/check")
      const data = await response.json()
      setIsAuthenticated(data.authenticated)
    } catch (error) {
      console.error("[v0] Error checking auth:", error)
      setIsAuthenticated(false)
    }
  }

  const fetchItems = async () => {
    try {
      const response = await fetch("/api/items")
      const data = await response.json()
      setItems(data.items || [])
      setStats(data.stats || stats)
    } catch (error) {
      console.error("[v0] Error fetching items:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkAuth().then(() => {
      fetchItems()
    })

    const handleLinkCreated = () => {
      fetchItems()
    }
    window.addEventListener("linkCreated", handleLinkCreated)

    return () => {
      window.removeEventListener("linkCreated", handleLinkCreated)
    }
  }, [])

  const handleDelete = async (shortCode: string) => {
    if (!confirm("确定要删除吗？")) return

    try {
      const response = await fetch(`/api/items?shortCode=${shortCode}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchItems()
      }
    } catch (error) {
      console.error("[v0] Error deleting item:", error)
    }
  }

  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Lock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">需要管理员权限</h3>
          <p className="text-muted-foreground mb-4">请登录以查看和管理</p>
          <Link href="/login">
            <Button>前往登录</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">加载中...</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>总项目数</CardDescription>
            <CardTitle className="text-3xl">{stats.totalItems}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>总点击数</CardDescription>
            <CardTitle className="text-3xl">{stats.totalClicks}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>活跃项目</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.activeItems}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>已过期</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">{stats.expiredItems}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Items List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            最近创建的项目
          </CardTitle>
          <CardDescription>查看和管理你的短链接和文本分享</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">还没有创建任何项目</div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-2 py-1 text-sm font-semibold">/{item.shortCode}</code>
                      <Badge variant={item.type === "link" ? "default" : "secondary"}>
                        {item.type === "link" ? "链接" : "文本"}
                      </Badge>
                      {item.customSuffix && <Badge variant="outline">自定义</Badge>}
                    </div>
                    {item.type === "link" ? (
                      <div title={item.originalUrl} className="text-sm text-muted-foreground line-clamp-1">
                        {desensitizeUrl(item.originalUrl)}
                      </div>
                    ) : (
                      <div title={item.textPreview} className="text-sm text-muted-foreground line-clamp-2">
                        {desensitizeText(item.textPreview || '')}
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>点击: {item.clickCount}</span>
                      <span>创建: {new Date(item.createdAt).toLocaleDateString("zh-CN")}</span>
                      {item.expiresAt && <span>过期: {new Date(item.expiresAt).toLocaleDateString("zh-CN")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.open(`/${item.shortCode}`, "_blank")}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(item.shortCode)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
