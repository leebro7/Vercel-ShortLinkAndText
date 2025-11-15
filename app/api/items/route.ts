import { type NextRequest, NextResponse } from "next/server"
import { createItem, getAllItems, deleteItem, getItemStats } from "@/lib/db"

export async function GET() {
  try {
    const [items, stats] = await Promise.all([getAllItems(), getItemStats()])

    // Filter out expired items
    const now = Date.now()
    const activeItems = items.filter((item) => !item.expiresAt || item.expiresAt > now)

    return NextResponse.json({
      items: activeItems,
      stats,
    })
  } catch (error) {
    console.error("[v0] Error fetching items:", error)
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, content, customSuffix, expiresInHours } = body

    // Validate type
    if (!type || !["link", "text"].includes(type)) {
      return NextResponse.json({ error: "Valid type is required (link or text)" }, { status: 400 })
    }

    // Validate content
    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Validate URL format if it's a link
    if (type === "link") {
      try {
        new URL(content)
      } catch {
        return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
      }
    }

    // Validate custom suffix if provided
    if (customSuffix) {
      if (typeof customSuffix !== "string" || customSuffix.length < 3 || customSuffix.length > 20) {
        return NextResponse.json({ error: "Custom suffix must be between 3 and 20 characters" }, { status: 400 })
      }

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

    // Create the item
    const item = await createItem(type, content, customSuffix, expiresInHours)

    // Get the base URL for the short link
    const baseUrl = request.nextUrl.origin
    const shortUrl = `${baseUrl}/${item.shortCode}`

    return NextResponse.json(
      {
        ...item,
        shortUrl,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("[v0] Error creating item:", error)

    if (error instanceof Error && error.message === "该短代码是系统保留字段，无法使用") {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (error instanceof Error && error.message === "短代码已被占用") {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to create item" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const shortCode = searchParams.get("shortCode")

    if (!shortCode) {
      return NextResponse.json({ error: "Short code is required" }, { status: 400 })
    }

    const deleted = await deleteItem(shortCode)

    if (!deleted) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting item:", error)
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 })
  }
}
