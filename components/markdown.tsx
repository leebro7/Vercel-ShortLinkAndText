"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"

interface Props {
  children: string
}

/**
 * 受限 Markdown 渲染:GitHub Flavored + 数学公式。
 * - 禁用 raw HTML(避免 XSS):react-markdown 默认行为。
 * - 样式通过 .md-prose 工具类定义于 globals.css。
 */
export function Markdown({ children }: Props) {
  return (
    <div className="md-prose font-serif text-base leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: (props) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
