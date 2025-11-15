import { NextResponse } from "next/server"
import { isAuthenticated } from "@/lib/auth"

export async function GET() {
  try {
    const authenticated = await isAuthenticated()
    return NextResponse.json({ authenticated })
  } catch (error) {
    console.error("[v0] Auth check error:", error)
    return NextResponse.json({ authenticated: false }, { status: 500 })
  }
}
