import { getAllLinks, getLinkStats } from "@/lib/db"
import { isAuthenticated } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BarChart3, TrendingUp, Link2, Clock, MousePointerClick, ArrowLeft } from 'lucide-react'
import Link from "next/link"
import { redirect } from 'next/navigation'
import { desensitizeUrl } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
  const authenticated = await isAuthenticated()

  if (!authenticated) {
    redirect("/login")
  }

  const [links, stats] = await Promise.all([getAllLinks(), getLinkStats()])

  // Sort links by click count
  const topLinks = [...links].sort((a, b) => b.clickCount - a.clickCount).slice(0, 10)

  // Sort links by creation date (most recent first)
  const recentLinks = [...links].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)

  // Calculate average clicks per link
  const avgClicksPerLink = stats.totalLinks > 0 ? (stats.totalClicks / stats.totalLinks).toFixed(1) : "0"

  // Get links with custom suffixes
  const customSuffixLinks = links.filter((link) => link.customSuffix).length

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">数据分析</h1>
            </div>
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回首页
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Overview Statistics */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-bold">总览</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">总链接数</CardTitle>
                <Link2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalLinks}</div>
                <p className="text-xs text-muted-foreground">{customSuffixLinks} 个自定义后缀</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">总点击数</CardTitle>
                <MousePointerClick className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalClicks}</div>
                <p className="text-xs text-muted-foreground">平均 {avgClicksPerLink} 次/链接</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">活跃链接</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{stats.activeLinks}</div>
                <p className="text-xs text-muted-foreground">
                  {((stats.activeLinks / stats.totalLinks) * 100 || 0).toFixed(0)}% 活跃率
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">已过期</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-muted-foreground">{stats.expiredLinks}</div>
                <p className="text-xs text-muted-foreground">
                  {((stats.expiredLinks / stats.totalLinks) * 100 || 0).toFixed(0)}% 过期率
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Top Performing Links */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-bold">热门链接</h2>
          <Card>
            <CardHeader>
              <CardTitle>点击量排行榜</CardTitle>
              <CardDescription>按点击次数排序的前 10 个链接</CardDescription>
            </CardHeader>
            <CardContent>
              {topLinks.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">暂无数据</div>
              ) : (
                <div className="space-y-4">
                  {topLinks.map((link, index) => (
                    <div
                      key={link.id}
                      className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                        {index + 1}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-muted px-2 py-1 text-sm font-semibold">/{link.shortCode}</code>
                          {link.customSuffix && <Badge variant="secondary">自定义</Badge>}
                          {link.expiresAt && link.expiresAt < Date.now() && <Badge variant="outline">已过期</Badge>}
                        </div>
                        <p title={link.originalUrl} className="text-sm text-muted-foreground line-clamp-1">
                          {desensitizeUrl(link.originalUrl)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{link.clickCount}</div>
                        <div className="text-xs text-muted-foreground">点击</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="mb-4 text-2xl font-bold">最近活动</h2>
          <Card>
            <CardHeader>
              <CardTitle>最新创建的链接</CardTitle>
              <CardDescription>最近创建的 5 个短链接</CardDescription>
            </CardHeader>
            <CardContent>
              {recentLinks.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">暂无数据</div>
              ) : (
                <div className="space-y-4">
                  {recentLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-muted px-2 py-1 text-sm font-semibold">/{link.shortCode}</code>
                          {link.customSuffix && <Badge variant="secondary">自定义</Badge>}
                        </div>
                        <p title={link.originalUrl} className="text-sm text-muted-foreground line-clamp-1">
                          {desensitizeUrl(link.originalUrl)}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>点击: {link.clickCount}</span>
                          <span>创建: {new Date(link.createdAt).toLocaleString("zh-CN")}</span>
                          {link.lastClickedAt && (
                            <span>最后点击: {new Date(link.lastClickedAt).toLocaleString("zh-CN")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
