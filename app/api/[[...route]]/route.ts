import { handle } from "hono/vercel"
import { apiApp } from "@/server/api"

// 必须 Node runtime:
// 1. bcryptjs 跑在 Edge 会被 25ms CPU 限制直接超时。
// 2. Vercel KV / Upstash Redis REST 客户端都跑 Node。
// 3. Hono on Vercel 同样要求 Node (hono/vercel 用 @vercel/node 适配)。
// 在 Vercel Free 计划下 Node 函数 10s 超时, 100 GB-hr/月, 满足本作品。
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = handle(apiApp)
export const POST = handle(apiApp)
export const PATCH = handle(apiApp)
export const PUT = handle(apiApp)
export const DELETE = handle(apiApp)
export const OPTIONS = handle(apiApp)
