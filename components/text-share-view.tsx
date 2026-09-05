"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Check, Flame } from "lucide-react"
import { Markdown } from "@/components/markdown"
import type { ContentFormat } from "@/lib/db/types"

interface Props {
  content: string
  burned?: boolean
  format?: ContentFormat
}

/**
 * 文本分享的展示组件 —— 包含内容区与一键复制按钮。
 * 客户端组件,因为复制按钮依赖 navigator.clipboard。
 * 两条查看路径共用:
 * - /<code>            短链直达,服务端预取后渲染,仅 plain
 * - /s/<code>          /s 入口,支持 ?format=md|plain 切换
 */
export function TextShareView({ content, burned, format = "plain" }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <Card className="mt-6 shadow-[0_1px_2px_oklch(0.22_0.015_60/0.04),0_8px_24px_-12px_oklch(0.22_0.015_60/0.08)] border-border/60">
        <CardContent className="px-6 py-7 sm:px-8 sm:py-8">
          {format === "markdown" ? (
            <Markdown>{content}</Markdown>
          ) : (
            <div className="whitespace-pre-wrap break-words font-serif text-base leading-relaxed">
              {content}
            </div>
          )}
          {burned && (
            <div className="mt-8 pt-6 border-t border-dashed border-border flex items-start gap-2.5">
              <Flame className="h-4 w-4 text-primary mt-0.5 shrink-0 animate-flame" />
              <p className="text-sm text-muted-foreground italic">
                这条分享已被阅后即焚。再次访问将显示 404。
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button
          onClick={handleCopy}
          variant="outline"
          size="sm"
          className="border-primary/30 text-primary hover:bg-primary/5 hover:text-primary hover:border-primary/50"
        >
          {copied ? (
            <>
              <Check className="mr-1.5 h-3.5 w-3.5" /> 已复制
            </>
          ) : (
            <>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> 复制
            </>
          )}
        </Button>
      </div>
    </>
  )
}
