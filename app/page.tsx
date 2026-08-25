import { LinkForm } from "@/components/link-form"
import { RecentLinks } from "@/components/recent-links"
import { getSessionFromCookie, getAdminUsername } from "@/lib/auth"
import { LogOut, LogIn } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { headers } from "next/headers"

function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <Button type="submit" variant="ghost" size="icon" aria-label="登出">
        <LogOut className="h-4 w-4" />
      </Button>
    </form>
  )
}

export default async function HomePage() {
  const h = await headers()
  const session = await getSessionFromCookie(h.get("cookie"))
  const authenticated = Boolean(session)
  const username = authenticated ? session!.username : await getAdminUsername().catch(() => "admin")

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-mono text-sm tracking-tight text-muted-foreground hover:text-foreground">
          ~/short-link
        </Link>
        <nav className="flex items-center gap-1">
          <ThemeToggle />
          {authenticated ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/analytics">数据</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/settings">设置</Link>
              </Button>
              <LogoutButton />
            </>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">
                <LogIn className="mr-1.5 h-3.5 w-3.5" />
                登录
              </Link>
            </Button>
          )}
        </nav>
      </header>

      <main className="flex-1 flex flex-col">
        <section className="px-6 pt-16 pb-10 md:pt-24 md:pb-16">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              短链接 · 文本分享
            </p>
            <h1 className="mt-6 text-balance text-4xl md:text-5xl font-semibold tracking-tight">
              把一行字,<br />
              写成一封小纸条。
            </h1>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              {authenticated
                ? `欢迎回来,${username}。`
                : "登录后可以管理历史、查看日志。"}
            </p>
          </div>
        </section>

        <section className="px-6">
          <div className="mx-auto max-w-2xl">
            <LinkForm />
          </div>
        </section>

        {authenticated && (
          <section className="px-6 mt-16">
            <div className="mx-auto max-w-3xl">
              <RecentLinks />
            </div>
          </section>
        )}
      </main>

      <footer className="px-6 py-8 mt-12 text-center">
        <p className="font-mono text-xs text-muted-foreground">
          self-hosted · Vercel + Upstash
        </p>
      </footer>
    </div>
  )
}
