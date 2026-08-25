import { viewItem } from "@/lib/db"
import { headers } from "next/headers"
import type { TextItem } from "@/lib/db"
import { Markdown } from "@/components/markdown"

interface PageProps {
  params: Promise<{ shortCode: string }>
}

export const dynamic = "force-dynamic"

// 允许任何站点嵌入。
// embed.js 用 iframe + sandbox;此页本身只读,无 form / fetch from client,无 cookie。
export async function generateMetadata() {
  return {
    other: {
      "Content-Security-Policy": "frame-ancestors *",
    },
  }
}

export default async function EmbedPage({ params }: PageProps) {
  const { shortCode } = await params
  const h = await headers()
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    undefined
  const ua = h.get("user-agent") || undefined

  const result = await viewItem(shortCode, { ip, userAgent: ua })

  const autoResize = `
    (function() {
      function send() {
        var h = document.documentElement.scrollHeight;
        parent.postMessage({ type: "shortlink:resize", height: h }, "*");
      }
      send();
      setTimeout(send, 50);
      setTimeout(send, 250);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(send);
      }
      window.addEventListener("load", send);
    })();
  `

  if (!result || result.item.type !== "text") {
    return (
      <main style={{ padding: 16, color: "#666", fontFamily: "system-ui" }}>
        Not available
        <script dangerouslySetInnerHTML={{ __html: autoResize }} />
      </main>
    )
  }
  const item = result.item as TextItem

  return (
    <main
      style={{
        padding: 16,
        fontFamily:
          "'Source Serif 4', 'Source Serif Pro', ui-serif, Georgia, serif",
        color: "#222",
        background: "transparent",
      }}
    >
      {item.passwordHash ? (
        <p style={{ color: "#666", fontStyle: "italic" }}>受密码保护</p>
      ) : item.burned || result.burned ? (
        <p style={{ color: "#666", fontStyle: "italic" }}>内容已被阅后即焚</p>
      ) : item.contentFormat === "markdown" ? (
        <Markdown>{item.content}</Markdown>
      ) : (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            font: "inherit",
            margin: 0,
          }}
        >
          {item.content}
        </pre>
      )}
      <p
        style={{
          marginTop: 12,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 11,
          color: "#999",
        }}
      >
        via ~/short-link · {item.viewCount} views
      </p>
      <script dangerouslySetInnerHTML={{ __html: autoResize }} />
    </main>
  )
}
