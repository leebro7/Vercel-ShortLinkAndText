/**
 * 限流: 基于 KV 的固定窗口
 *
 * 键格式: `rl:<bucket>:<ip>:<minuteEpoch>`
 * 值: 当前窗口的计数 (字符串数字)
 * TTL: 60s (自动过期)
 *
 * 简单非原子实现: 读 -> +1 -> 写. 极小竞态会丢一次计数 (1-2% 误差),
 * 对防滥用限流足够, 不需要引入 INCR.
 */

import { getDataProvider } from "./db/provider"

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  limit: number
  resetAt: number
}

function clientKey(bucket: string, ip: string, minute: number): string {
  return `rl:${bucket}:${ip}:${minute}`
}

export async function checkRateLimit(
  bucket: string,
  ip: string,
  limit: number,
  windowSeconds = 60,
): Promise<RateLimitResult> {
  const now = Date.now()
  const minute = Math.floor(now / (windowSeconds * 1000))
  const resetAt = (minute + 1) * windowSeconds * 1000
  const key = clientKey(bucket, ip, minute)
  const provider = await getDataProvider()
  const raw = await provider.getRaw(key)
  const current = raw ? Number.parseInt(raw, 10) || 0 : 0
  const next = current + 1
  await provider.putRaw(key, String(next), { ex: windowSeconds })
  return {
    allowed: next <= limit,
    remaining: Math.max(0, limit - next),
    limit,
    resetAt,
  }
}
