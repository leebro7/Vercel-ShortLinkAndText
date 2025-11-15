import { NextResponse } from "next/server"
import { logoutAdmin } from "@/lib/auth"

export async function POST() {
  try {
    await logoutAdmin()
    return NextResponse.json({ success: true, message: "登出成功" })
  } catch (error) {
    console.error("[v0] Logout error:", error)
    return NextResponse.json({ error: "登出失败" }, { status: 500 })
  }
}
