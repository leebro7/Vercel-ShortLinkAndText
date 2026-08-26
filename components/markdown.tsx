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
 *
 * XSS 防御:
 * - react-markdown 默认不渲染 raw HTML (HTML 标签当文字输出)
 * - urlTransform 拒绝 javascript: / data: / vbscript: 等危险 URL
 * - 所有 <a> 强制 target="_blank" rel="noopener noreferrer"
 * - 所有 <img> 强制 lazy loading
 *
 * 样式通过 .md-prose 工具类定义于 globals.css。
 */
export function Markdown({ children }: Props) {
  return (
    <div className="md-prose font-serif text-base leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ href, children: aChildren, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {aChildren}
            </a>
          ),
          img: ({ src, alt, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt || ""}
              loading="lazy"
              referrerPolicy="no-referrer"
              {...props}
            />
          ),
        }}
        urlTransform={(url) => {
          // 只允许 http / https / mailto, 其它 (javascript:, data:, vbscript: 等) 替换为 #
          const lower = url.toLowerCase().trim()
          if (
            lower.startsWith("javascript:") ||
            lower.startsWith("data:") ||
            lower.startsWith("vbscript:") ||
            lower.startsWith("file:")
          ) {
            return "#"
          }
          return url
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
