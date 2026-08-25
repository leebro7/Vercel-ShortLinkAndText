import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionFromCookie } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"

export const dynamic = "force-dynamic"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 任何 /admin/* 都要鉴权
  const h = await headers()
  const session = await getSessionFromCookie(h.get("cookie"))
  if (!session) redirect("/login")

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="font-mono text-sm tracking-tight">
            ~/admin
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin">总览</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/items">条目</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/logs">日志</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/settings">设置</Link>
            </Button>
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">前台</Link>
          </Button>
        </div>
      </header>
      <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full">{children}</main>
    </div>
  )
}
