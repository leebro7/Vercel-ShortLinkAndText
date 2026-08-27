// Reserved routes that cannot be used as short codes
// ⚠️ 必须与 app/ 下的 Next.js 路由目录保持一致, 否则 shortcode 会撞路由
export const RESERVED_ROUTES = [
  // Pages
  "page",
  "login",
  "settings",
  "analytics",
  "admin",
  "share",
  // View routes (动态短码路由)
  "s",        // app/s/[shortCode]/page.tsx — text 分享查看
  "embed",    // app/embed/[shortCode]/page.tsx — iframe 嵌入
  "u",        // app/u/route.ts — 临时访客入口
  // API routes
  "api",
  // System routes
  "next",
  "_next",
  "public",
  "static",
  // Common reserved words
  "404",
  "500",
  "health",
  "status",
  "robots.txt",
  "sitemap.xml",
  ".well-known",
]
