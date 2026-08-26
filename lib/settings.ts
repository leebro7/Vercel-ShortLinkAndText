/**
 * 设置存储: KV 单 key, JSON 值.
 *
 * 默认值通过 getOrInit 提供 (第一次访问时回写).
 *
 * 现阶段只支持一个开关: anonymousAccessEnabled
 *   - true (默认): 未登录访客可访问 /api/items (但被 5/min/IP 限流)
 *   - false: 关闭 /u 入口与 5/min 限流, 没人能匿名创建, 只能登录
 */

import { getDataProvider } from "./db/provider"

const SETTINGS_KEY = "settings:global"

export interface GlobalSettings {
  anonymousAccessEnabled: boolean
}

const DEFAULT_SETTINGS: GlobalSettings = {
  anonymousAccessEnabled: true,
}

export async function getSettings(): Promise<GlobalSettings> {
  const provider = await getDataProvider()
  const raw = await provider.getRaw(SETTINGS_KEY)
  if (!raw) {
    await provider.putRaw(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS))
    return { ...DEFAULT_SETTINGS }
  }
  try {
    const parsed = JSON.parse(raw) as Partial<GlobalSettings>
    return {
      anonymousAccessEnabled:
        parsed.anonymousAccessEnabled ?? DEFAULT_SETTINGS.anonymousAccessEnabled,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function updateSettings(
  patch: Partial<GlobalSettings>,
): Promise<GlobalSettings> {
  const current = await getSettings()
  const next = { ...current, ...patch }
  const provider = await getDataProvider()
  await provider.putRaw(SETTINGS_KEY, JSON.stringify(next))
  return next
}
