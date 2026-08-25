"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[app/error.tsx]", error)
  }, [error])

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
          Error · 500
        </p>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight">
          出了点状况。
        </h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          看起来有一行代码打了个哈欠。<br />
          我们已经记下,你可以再试一次。
        </p>
        {error.digest && (
          <p className="mt-4 font-mono text-xs text-muted-foreground">
            {error.digest}
          </p>
        )}
        <div className="mt-10 flex items-center justify-center gap-3">
          <Button onClick={() => reset()}>再试一次</Button>
          <Button asChild variant="outline">
            <Link href="/">回到首页</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
