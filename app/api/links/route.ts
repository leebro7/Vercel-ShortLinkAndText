import { type NextRequest, NextResponse } from "next/server"
import { createLink, getAllLinks, deleteLink, getLinkStats } from "@/lib/db"

// GET /api/links - Get all links and stats
export async function GET() {
  try {
    const [links, stats] = await Promise.all([getAllLinks(), getLinkStats()])

    // Filter out expired links
    const now = Date.now()
    const activeLinks = links.filter((link) => !link.expiresAt || link.expiresAt > now)

    return NextResponse.json({
      links: activeLinks,
      stats,
    })
  } catch (error) {
    console.error("[v0] Error fetching links:", error)
    return NextResponse.json({ error: "Failed to fetch links" }, { status: 500 })
  }
}

// POST /api/links - Create a new short link
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, customSuffix, expiresInHours } = body

    // Validate URL
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Valid URL is required" }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
    }

    // Validate custom suffix if provided
    if (customSuffix) {
      if (typeof customSuffix !== "string" || customSuffix.length < 3 || customSuffix.length > 20) {
        return NextResponse.json({ error: "Custom suffix must be between 3 and 20 characters" }, { status: 400 })
      }

      // Only allow alphanumeric characters and hyphens
      if (!/^[a-zA-Z0-9-]+$/.test(customSuffix)) {
        return NextResponse.json(
          { error: "Custom suffix can only contain letters, numbers, and hyphens" },
          { status: 400 },
        )
      }
    }

    // Validate expiration time if provided
    if (expiresInHours !== undefined && expiresInHours !== null) {
      if (typeof expiresInHours !== "number" || expiresInHours <= 0) {
        return NextResponse.json({ error: "Expiration time must be a positive number" }, { status: 400 })
      }
    }

    // Create the link
    const link = await createLink(url, customSuffix, expiresInHours)

    // Get the base URL for the short link
    const baseUrl = request.nextUrl.origin
    const shortUrl = `${baseUrl}/${link.shortCode}`

    return NextResponse.json(
      {
        ...link,
        shortUrl,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("[v0] Error creating link:", error)

    if (error instanceof Error && error.message === "Short code already exists") {
      return NextResponse.json({ error: "This custom suffix is already taken" }, { status: 409 })
    }

    return NextResponse.json({ error: "Failed to create link" }, { status: 500 })
  }
}

// DELETE /api/links - Delete a link
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const shortCode = searchParams.get("shortCode")

    if (!shortCode) {
      return NextResponse.json({ error: "Short code is required" }, { status: 400 })
    }

    const deleted = await deleteLink(shortCode)

    if (!deleted) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting link:", error)
    return NextResponse.json({ error: "Failed to delete link" }, { status: 500 })
  }
}
