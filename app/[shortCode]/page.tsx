import { redirect } from "next/navigation"
import { getItem, viewItem } from "@/lib/db"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { headers } from "next/headers"

interface PageProps {
  params: Promise<{
    shortCode: string
  }>
}

export default async function ShortCodePage({ params }: PageProps) {
  const { shortCode } = await params

  const h = await headers()
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    undefined
  const ua = h.get("user-agent") || undefined

  // 文本 + 有密码 + 还没有解锁 cookie 时, 不要 viewItem, 否则阅后即焚会在用户输入密码前就被烧掉; 交给 /s/[shortCode] 处理密码流程
  const cookieHeader = h.get("cookie") ?? null
  const hasUnlockCookie = cookieHeader
    ? new RegExp(`(?:^|;\\s*)share_unlock_${shortCode}=`).test(cookieHeader)
    : false
  const probe = await getItem(shortCode)
  if (
    probe &&
    probe.type === "text" &&
    probe.passwordHash &&
    !hasUnlockCookie
  ) {
    redirect(`/s/${shortCode}`)
  }

  const result = await viewItem(shortCode, { ip, userAgent: ua })

  if (!result) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
            not found
          </p>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">
            这页没找到。
          </h1>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            短链接或分享不存在,或已经过期。
          </p>
          <div className="mt-10">
            <Button asChild>
              <Link href="/">回到首页</Link>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  const item = result.item
  if (item.type === "link") {
    redirect(item.originalUrl)
  }

  // 文本类型
  if (item.passwordHash) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center px-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 space-y-3 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-semibold">这份分享被锁了</h1>
            <p className="text-muted-foreground text-sm">
              请向分享人索取密码。<br />
              密码输入页将在下一阶段提供。
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/">返回首页</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6 py-12">
      <article className="max-w-2xl w-full">
        <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
          shared · {new Date(item.createdAt).toLocaleDateString("zh-CN")}
        </p>
        <h1 className="mt-4 text-2xl font-semibold">文本分享</h1>
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="whitespace-pre-wrap break-words font-serif text-base leading-relaxed">
              {item.content}
            </div>
          </CardContent>
        </Card>
        <p className="mt-4 font-mono text-xs text-muted-foreground text-right">
          已查看 {item.viewCount} 次
        </p>
      </article>
    </main>
  )
}
