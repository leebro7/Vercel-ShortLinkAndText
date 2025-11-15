import { type NextRequest, NextResponse } from "next/server"
import { verifyAdmin, createAdminSession } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 })
    }

    const isValid = await verifyAdmin(username, password)

    if (!isValid) {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 })
    }

    await createAdminSession(username)

    return NextResponse.json({ success: true, message: "登录成功" })
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: "登录失败" }, { status: 500 })
  }
}
