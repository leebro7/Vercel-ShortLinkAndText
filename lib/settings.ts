/**
 * 设置存储: KV 单 key, JSON 值.
 *
 * 默认值通过 getOrInit 提供 (第一次访问时回写).
 *
 * 现阶段只支持一个开关: anonymousAccessEnabled
 *   - true (默认): 未登录访客可访问 /api/items (但被 5/min/guest-token 限流)
 *   - false: 关闭 /u 入口与 guest 创建, 没人能匿名创建, 只能登录
 *
 * in-process 缓存: 5s TTL, 减少对 KV 的读压力 (Vercel Free 计划 10K cmd/day).
 * PATCH /api/settings 主动失效缓存, 所以 admin 改完立即生效.
 */

import { getDataProvider } from "./db/provider"

const SETTINGS_KEY = "settings:global"
const CACHE_TTL_MS = 5_000

export interface GlobalSettings {
  anonymousAccessEnabled: boolean
}

const DEFAULT_SETTINGS: GlobalSettings = {
  anonymousAccessEnabled: true,
}

let cached: { value: GlobalSettings; expiresAt: number } | null = null

export async function getSettings(): Promise<GlobalSettings> {
  const now = Date.now()
  if (cached && cached.expiresAt > now) {
    return cached.value
  }
  const provider = await getDataProvider()
  const raw = await provider.getRaw(SETTINGS_KEY)
  let value: GlobalSettings
  if (!raw) {
    await provider.putRaw(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS))
    value = { ...DEFAULT_SETTINGS }
  } else {
    try {
      const parsed = JSON.parse(raw) as Partial<GlobalSettings>
      value = {
        anonymousAccessEnabled:
          parsed.anonymousAccessEnabled ?? DEFAULT_SETTINGS.anonymousAccessEnabled,
      }
    } catch {
      value = { ...DEFAULT_SETTINGS }
    }
  }
  cached = { value, expiresAt: now + CACHE_TTL_MS }
  return value
}

export async function updateSettings(
  patch: Partial<GlobalSettings>,
): Promise<GlobalSettings> {
  const current = await getSettings()
  const next = { ...current, ...patch }
  const provider = await getDataProvider()
  await provider.putRaw(SETTINGS_KEY, JSON.stringify(next))
  // 主动失效缓存, 下一个读立即拿新值
  cached = { value: next, expiresAt: Date.now() + CACHE_TTL_MS }
  return next
}

/** 测试用: 清空缓存, 避免跨 test 污染。 */
export function __resetSettingsCacheForTests(): void {
  cached = null
}
