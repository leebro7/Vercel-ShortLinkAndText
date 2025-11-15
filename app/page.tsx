import { LinkForm } from "@/components/link-form"
import { RecentLinks } from "@/components/recent-links"
import { isAuthenticated } from "@/lib/auth"
import { Link2, BarChart3, LogOut, LogIn, FileText, Settings } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <Button type="submit" variant="outline" size="sm">
        <LogOut className="mr-2 h-4 w-4" />
        登出
      </Button>
    </form>
  )
}

export default async function HomePage() {
  const authenticated = await isAuthenticated()

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">短链接服务</h1>
            </div>
            <div className="flex items-center gap-2">
              {authenticated ? (
                <>
                  <Link href="/analytics">
                    <Button variant="outline" size="sm">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      数据分析
                    </Button>
                  </Link>
                  <Link href="/settings">
                    <Button variant="outline" size="sm">
                      <Settings className="mr-2 h-4 w-4" />
                      设置
                    </Button>
                  </Link>
                  <LogoutButton />
                </>
              ) : (
                <Link href="/login">
                  <Button variant="outline" size="sm">
                    <LogIn className="mr-2 h-4 w-4" />
                    管理员登录
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-12 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-balance text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            简洁优雅的
            <span className="text-primary"> 短链接服务</span>
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground md:text-xl">
            快速创建短链接，支持自定义后缀、过期时间和详细的点击统计
          </p>
        </div>

        {/* Link Creation Form */}
        <div className="mx-auto mt-12 max-w-2xl">
          <LinkForm />
        </div>

        {authenticated && (
          <div className="mx-auto mt-12 max-w-2xl">
            <div className="rounded-lg border bg-card p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
                <FileText className="h-5 w-5" />
                快速导航
              </h3>
              <Link href="/admin/text-share">
                <Button className="w-full bg-transparent" variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  创建文本分享
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Recent Links */}
        <div className="mx-auto mt-16 max-w-4xl">
          <RecentLinks />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>使用 Vercel Blob 构建 · 高性能 · 安全可靠</p>
        </div>
      </footer>
    </div>
  )
}
