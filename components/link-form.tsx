"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, Check, Link2, FileText, Loader2 } from "lucide-react"

export function LinkForm() {
  const [itemType, setItemType] = useState<"link" | "text">("link")
  const [url, setUrl] = useState("")
  const [textContent, setTextContent] = useState("")
  const [customSuffix, setCustomSuffix] = useState("")
  const [expiresInHours, setExpiresInHours] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [generatedLink, setGeneratedLink] = useState<{
    shortUrl: string
    shortCode: string
    expiresAt?: number
    type: "link" | "text"
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setGeneratedLink(null)
    setIsLoading(true)

    try {
      const content = itemType === "link" ? url : textContent
      if (!content) {
        throw new Error(itemType === "link" ? "请输入链接" : "请输入文本内容")
      }

      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: itemType,
          content,
          customSuffix: customSuffix || undefined,
          expiresInHours: expiresInHours ? Number.parseInt(expiresInHours) : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "创建失败")
      }

      setGeneratedLink({
        shortUrl: data.shortUrl,
        shortCode: data.shortCode,
        expiresAt: data.expiresAt,
        type: itemType,
      })

      // Reset form
      setUrl("")
      setTextContent("")
      setCustomSuffix("")
      setExpiresInHours("")

      // Trigger refresh
      window.dispatchEvent(new Event("linkCreated"))
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (generatedLink) {
      await navigator.clipboard.writeText(generatedLink.shortUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const expirationOptions = [
    { value: "1", label: "1 小时" },
    { value: "2", label: "2 小时" },
    { value: "6", label: "6 小时" },
    { value: "12", label: "12 小时" },
    { value: "24", label: "24 小时" },
    { value: "48", label: "2 天" },
    { value: "168", label: "7 天" },
    { value: "720", label: "30 天" },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            创建短链接或分享文本
          </CardTitle>
          <CardDescription>选择类型，输入内容并配置设置</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>类型选择</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={itemType === "link" ? "default" : "outline"}
                  onClick={() => {
                    setItemType("link")
                    setError("")
                  }}
                  disabled={isLoading}
                  className="flex-1"
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  链接
                </Button>
                <Button
                  type="button"
                  variant={itemType === "text" ? "default" : "outline"}
                  onClick={() => {
                    setItemType("text")
                    setError("")
                  }}
                  disabled={isLoading}
                  className="flex-1"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  文本
                </Button>
              </div>
            </div>

            {/* Link Input */}
            {itemType === "link" && (
              <div className="space-y-2">
                <Label htmlFor="url">原始链接 *</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com/very/long/url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Text Input */}
            {itemType === "text" && (
              <div className="space-y-2">
                <Label htmlFor="text">文本内容 *</Label>
                <Textarea
                  id="text"
                  placeholder="输入要分享的文本内容..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  disabled={isLoading}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">{textContent.length} 字符</p>
              </div>
            )}

            {/* Custom Suffix */}
            <div className="space-y-2">
              <Label htmlFor="suffix">自定义后缀（可选）</Label>
              <Input
                id="suffix"
                type="text"
                placeholder="my-custom-link"
                value={customSuffix}
                onChange={(e) => setCustomSuffix(e.target.value)}
                disabled={isLoading}
                pattern="[a-zA-Z0-9-]+"
                minLength={3}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">3-20个字符，仅支持字母、数字和连字符</p>
            </div>

            {/* Expiration Time */}
            <div className="space-y-2">
              <Label htmlFor="expires">过期时间（可选）</Label>
              <Select value={expiresInHours} onValueChange={setExpiresInHours} disabled={isLoading}>
                <SelectTrigger id="expires">
                  <SelectValue placeholder="永不过期" />
                </SelectTrigger>
                <SelectContent>
                  {expirationOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
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
                `创建${itemType === "link" ? "短链接" : "分享"}`
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Generated Link Display */}
      {generatedLink && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">{generatedLink.type === "link" ? "短链接" : "文本分享"}创建成功！</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input value={generatedLink.shortUrl} readOnly className="font-mono" />
              <Button onClick={handleCopy} variant="outline" size="icon">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            {generatedLink.expiresAt && (
              <p className="text-sm text-muted-foreground">
                过期时间：{new Date(generatedLink.expiresAt).toLocaleString("zh-CN")}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
