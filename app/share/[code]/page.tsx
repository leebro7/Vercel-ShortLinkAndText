"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Check, FileText, Loader2 } from "lucide-react"
import Link from "next/link"

export default function SharePage() {
  const params = useParams()
  const code = params.code as string
  const [content, setContent] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchShare = async () => {
      try {
        const response = await fetch(`/api/text-share?code=${code}`)
        const data = await response.json()

        if (!response.ok) {
          if (response.status === 410) {
            setError("该分享已过期")
          } else {
            setError("分享不存在")
          }
        } else {
          setContent(data.content)
        }
      } catch (err) {
        setError("加载失败，请稍后重试")
      } finally {
        setIsLoading(false)
      }
    }

    fetchShare()
  }, [code])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>错误</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <Link href="/">
              <Button className="w-full">返回首页</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold mb-2">
            <FileText className="h-8 w-8 text-primary" />
            <span>文本分享</span>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              分享内容
            </CardTitle>
            <CardDescription>此分享内容由管理员共享</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative bg-muted/50 rounded-lg p-4 min-h-[200px] max-h-[600px] overflow-auto whitespace-pre-wrap break-words">
              {content}
            </div>

            <Button onClick={handleCopy} className="w-full bg-transparent" variant="outline">
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  复制内容
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
