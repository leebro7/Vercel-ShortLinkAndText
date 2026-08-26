import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function desensitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    let domain = urlObj.hostname
    const parts = domain.split('.')
    
    if (parts.length >= 2) {
      const lastTwo = parts.slice(-2).join('.')
      const hidden = parts.slice(0, -2).map(p => p.charAt(0) + '*'.repeat(Math.max(1, p.length - 1))).join('.')
      domain = hidden ? `${hidden}.${lastTwo}` : lastTwo
    }
    
    return `${domain}${urlObj.pathname ? '/...' : ''}`
  } catch {
    return url.substring(0, 20) + (url.length > 20 ? '...' : '')
  }
}

export function desensitizeText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength) + '...'
}

/**
 * 判断当前请求是否 https (Vercel / Cloudflare / EdgeOne 反代后 x-forwarded-proto 是可靠信号)
 * 同时接受 Hono context (c.req.url) 与 NextRequest (nextRequest.url) 两种输入
 */
export function isSecureRequest(input: {
  url: string
  raw?: { headers: { get: (k: string) => string | null } }
  header?: (k: string) => string | undefined
}): boolean {
  const xfp =
    input.raw?.headers.get("x-forwarded-proto") ??
    input.header?.("x-forwarded-proto") ??
    null
  if (xfp) return xfp.toLowerCase() === "https"
  if (process.env.VERCEL === "1") return true
  try {
    return new URL(input.url).protocol === "https:"
  } catch {
    return false
  }
}
