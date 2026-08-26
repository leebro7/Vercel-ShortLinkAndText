"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * 夜间 / 白天 双按钮切换
 *
 * 状态: 'time' | 'light' | 'dark'
 * - 'time'  (默认, 首次进入): 按当前时间自动 18:00-06:00 暗, 其余亮, 每分钟重评
 * - 'light' / 'dark': 用户手动锁定, 写 localStorage
 *
 * 两个按钮: [🌙 夜间] [☀ 白天]
 *   - time 模式:  当前时间对应的主题高亮 (用户视觉反馈)
 *   - 手动模式:  用户点过的按钮高亮
 *
 * 视觉: 当前选中按钮用 bg-accent + text-accent-foreground; 未选用 text-muted-foreground
 */

const KEY = "shortlink-theme-mode"

type Mode = "time" | "light" | "dark"

function getStored(): Mode | null {
  if (typeof window === "undefined") return null
  const v = localStorage.getItem(KEY)
  if (v === "time" || v === "light" || v === "dark") return v
  return null
}

function store(mode: Mode) {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // ignore
  }
}

function isNight(date: Date = new Date()): boolean {
  const h = date.getHours()
  return h >= 18 || h < 6
}

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [mode, setMode] = React.useState<Mode>("time")

  React.useEffect(() => {
    setMode(getStored() ?? "time")
    setMounted(true)
  }, [])

  // time 模式: 每分钟根据时间切 light/dark
  React.useEffect(() => {
    if (!mounted || mode !== "time") return
    function apply() {
      setTheme(isNight() ? "dark" : "light")
    }
    apply()
    const id = setInterval(apply, 60_000)
    return () => clearInterval(id)
  }, [mode, mounted, setTheme])

  function pick(next: "light" | "dark") {
    setMode(next)
    store(next)
    setTheme(next)
  }

  // time 模式: 视觉高亮跟随当前时间; 手动模式: 高亮跟随用户选择
  const effectiveDark =
    mode === "dark" || (mode === "time" && isNight())
  const effectiveLight =
    mode === "light" || (mode === "time" && !isNight())

  if (!mounted) {
    return (
      <div className="flex items-center gap-1" aria-label="切换主题">
        <Button variant="ghost" size="sm" disabled aria-label="夜间">
          <Moon className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" disabled aria-label="白天">
          <Sun className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  // 视觉用 resolvedTheme 保证 SSR/CSR 一致 (用 isNight + mode 已经够, 但读 resolvedTheme 兜底)
  const isDark = resolvedTheme === "dark"

  return (
    <div className="flex items-center gap-1" aria-label="切换主题">
      <Button
        variant="ghost"
        size="sm"
        aria-label="夜间模式"
        aria-pressed={effectiveDark}
        title="夜间模式"
        onClick={() => pick("dark")}
        className={cn(
          "h-7 px-2 text-xs",
          effectiveDark && "bg-accent text-accent-foreground",
        )}
      >
        <Moon className="mr-1 h-3.5 w-3.5" /> 夜间
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label="白天模式"
        aria-pressed={effectiveLight}
        title="白天模式"
        onClick={() => pick("light")}
        className={cn(
          "h-7 px-2 text-xs",
          effectiveLight && "bg-accent text-accent-foreground",
        )}
      >
        <Sun className="mr-1 h-3.5 w-3.5" /> 白天
      </Button>
    </div>
  )
}
