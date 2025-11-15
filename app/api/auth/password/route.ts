import { type NextRequest, NextResponse } from "next/server"
import { updateAdminPassword, isAuthenticated } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    const success = await updateAdminPassword(currentPassword, newPassword)

    if (!success) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error updating password:", error)
    return NextResponse.json({ error: "Failed to update password" }, { status: 500 })
  }
}
