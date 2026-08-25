import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
          Error · 404
        </p>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight">
          这页没找到。
        </h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          也许它从来没被写下,<br />
          也许它被风吹走了。
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Button asChild>
            <Link href="/">回到首页</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
