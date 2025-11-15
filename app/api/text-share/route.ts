import { type NextRequest, NextResponse } from "next/server"
import { put, list, del } from "@vercel/blob"
import { isAuthenticated } from "@/lib/auth"

const TEXT_SHARE_FILENAME = "text-shares.json"

interface TextShare {
  id: string
  content: string
  shortCode: string
  expiresAt?: number
  createdAt: number
  viewCount: number
}

async function getAllTextShares(): Promise<TextShare[]> {
  try {
    const { blobs } = await list({ prefix: TEXT_SHARE_FILENAME })

    if (blobs.length === 0) {
      return []
    }

    const response = await fetch(blobs[0].url)
    if (!response.ok) {
      return []
    }

    const data = await response.json()
    return data.shares || []
  } catch (error) {
    console.error("[v0] Error fetching text shares:", error)
    return []
  }
}

async function saveAllTextShares(shares: TextShare[]): Promise<void> {
  try {
    const { blobs } = await list({ prefix: TEXT_SHARE_FILENAME })

    if (blobs.length > 0) {
      await del(blobs[0].url)
    }

    const data = JSON.stringify({ shares, updatedAt: Date.now() })
    const blob = new Blob([data], { type: "application/json" })

    await put(TEXT_SHARE_FILENAME, blob, {
      access: "public",
      addRandomSuffix: false,
    })
  } catch (error) {
    console.error("[v0] Error saving text shares:", error)
    throw new Error("Failed to save text shares")
  }
}

function generateShortCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export async function GET(request: NextRequest) {
  try {
    const shortCode = request.nextUrl.searchParams.get("code")

    if (!shortCode) {
      return NextResponse.json({ error: "Missing code parameter" }, { status: 400 })
    }

    const shares = await getAllTextShares()
    const share = shares.find((s) => s.shortCode === shortCode)

    if (!share) {
      return NextResponse.json({ error: "Text share not found" }, { status: 404 })
    }

    if (share.expiresAt && share.expiresAt < Date.now()) {
      return NextResponse.json({ error: "Text share has expired" }, { status: 410 })
    }

    share.viewCount++
    await saveAllTextShares(shares)

    return NextResponse.json({ content: share.content })
  } catch (error) {
    console.error("[v0] Error fetching text share:", error)
    return NextResponse.json({ error: "Failed to fetch text share" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated()
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { content, expiresInHours } = await request.json()

    if (!content) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 })
    }

    const shares = await getAllTextShares()
    const shortCode = generateShortCode()
    const expiresAt = expiresInHours ? Date.now() + expiresInHours * 60 * 60 * 1000 : undefined

    const newShare: TextShare = {
      id: generateId(),
      content,
      shortCode,
      expiresAt,
      createdAt: Date.now(),
      viewCount: 0,
    }

    shares.push(newShare)
    await saveAllTextShares(shares)

    const shareUrl = `${request.nextUrl.origin}/share/${shortCode}`

    return NextResponse.json({
      success: true,
      shareUrl,
      shortCode,
      expiresAt,
    })
  } catch (error) {
    console.error("[v0] Error creating text share:", error)
    return NextResponse.json({ error: "Failed to create text share" }, { status: 500 })
  }
}
