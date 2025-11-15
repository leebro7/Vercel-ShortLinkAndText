"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, Check, FileText, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"

export function TextShareForm() {
  const [content, setContent] = useState("")
  const [expiresInHours, setExpiresInHours] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setShareUrl(null)
    setIsLoading(true)

    try {
      const response = await fetch("/api/text-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          expiresInHours: expiresInHours ? Number.parseInt(expiresInHours) : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "分享失败")
      }

      setShareUrl(data.shareUrl)
      setContent("")
      setExpiresInHours("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建分享失败")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            文本分享
          </CardTitle>
          <CardDescription>分享文本内容，可设置过期时间</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Text Content */}
            <div className="space-y-2">
              <Label htmlFor="content">分享内容 *</Label>
              <Textarea
                id="content"
                placeholder="输入要分享的文本内容..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                disabled={isLoading}
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">{content.length} / 10000 字符</p>
            </div>

            {/* Expiration Time */}
            <div className="space-y-2">
              <Label htmlFor="expires">过期时间（可选）</Label>
              <Select value={expiresInHours} onValueChange={setExpiresInHours} disabled={isLoading}>
                <SelectTrigger id="expires">
                  <SelectValue placeholder="永不过期" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 小时</SelectItem>
                  <SelectItem value="6">6 小时</SelectItem>
                  <SelectItem value="24">24 小时</SelectItem>
                  <SelectItem value="72">3 天</SelectItem>
                  <SelectItem value="168">7 天</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                "创建分享"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Share URL Display */}
      {shareUrl && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">分享创建成功！</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input value={shareUrl} readOnly className="font-mono" />
              <Button onClick={handleCopy} variant="outline" size="icon">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">分享链接已复制，您可以分享给其他人</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
