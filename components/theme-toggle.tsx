"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Moon, Sun, Monitor, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * 四态主题切换: 浅色 / 深色 / 跟随系统 / 跟随时间
 *
 * - light / dark: 用户手动锁定
 * - system: 跟 OS 设置 (prefers-color-scheme, 多数系统不会随时间变)
 * - time: 跟当前时间 —— 18:00-06:00 暗, 其余亮, 每分钟重新评估
 *
 * 状态存 localStorage, 跨会话保留。
 */

const TIME_KEY = "shortlink-theme-mode"

type Mode = "light" | "dark" | "system" | "time"

function getStored(): Mode {
  if (typeof window === "undefined") return "time"
  const v = localStorage.getItem(TIME_KEY)
  if (v === "light" || v === "dark" || v === "system" || v === "time") return v
  return "time"
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
    setMode(getStored())
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

  function changeMode(next: Mode) {
    setMode(next)
    try {
      localStorage.setItem(TIME_KEY, next)
    } catch {
      // ignore
    }
    if (next === "light") setTheme("light")
    else if (next === "dark") setTheme("dark")
    else if (next === "time") setTheme(isNight() ? "dark" : "light")
    // system 留 next-themes 自己处理, 不显式 set
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="切换主题" disabled>
        <Monitor className="h-4 w-4" />
      </Button>
    )
  }

  const isDark = resolvedTheme === "dark"

  function nextMode(): Mode {
    if (mode === "light") return "dark"
    if (mode === "dark") return "system"
    if (mode === "system") return "time"
    return "light"
  }

  const labelMap: Record<Mode, string> = {
    light: "浅色(已锁定)",
    dark: "深色(已锁定)",
    system: "跟随系统",
    time: "跟随时间(自动)",
  }
  const iconMap: Record<Mode, React.ReactNode> = {
    light: <Moon className="h-4 w-4" />,
    dark: <Sun className="h-4 w-4" />,
    system: <Monitor className="h-4 w-4" />,
    time: <Clock className="h-4 w-4" />,
  }

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`当前: ${labelMap[mode]}, 点击切换到 ${labelMap[nextMode()]}`}
        title={`${labelMap[mode]} (点击切换)`}
        onClick={() => changeMode(nextMode())}
      >
        {iconMap[mode]}
      </Button>
    </div>
  )
}
