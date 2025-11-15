import { redirect } from "next/navigation"
import { getItemByShortCode, incrementClickCount } from "@/lib/db"
import { Link2, AlertCircle, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

interface PageProps {
  params: Promise<{
    shortCode: string
  }>
}

export default async function RedirectPage({ params }: PageProps) {
  const { shortCode } = await params

  const item = await getItemByShortCode(shortCode)

  // If item not found or expired, show 404 page
  if (!item) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">不存在或已过期</CardTitle>
            <CardDescription>该短链接或分享不存在或已过期</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/">
              <Button className="w-full">
                <Link2 className="mr-2 h-4 w-4" />
                创建新的短链接
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Increment click count (fire and forget)
  incrementClickCount(shortCode).catch((error) => {
    console.error("[v0] Error incrementing click count:", error)
  })

  if (item.type === "text") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle>文本分享</CardTitle>
            </div>
            <CardDescription>创建于 {new Date(item.createdAt).toLocaleString("zh-CN")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted p-4 min-h-32 max-h-96 overflow-auto whitespace-pre-wrap break-words">
              {item.content}
            </div>
            <div className="mt-4 text-sm text-muted-foreground">已查看 {item.clickCount} 次</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Redirect to original URL for links
  redirect(item.originalUrl!)
}
