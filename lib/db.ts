import { put, list, del } from "@vercel/blob"
import type { Item } from "./types"
import { RESERVED_ROUTES } from "./constants"

const BLOB_FILENAME = "items-data.json"

export async function getAllItems(): Promise<Item[]> {
  try {
    const { blobs } = await list({ prefix: BLOB_FILENAME })

    if (blobs.length === 0) {
      console.log("[v0] Items file doesn't exist yet, initializing empty array")
      return []
    }

    const blobUrl = blobs[0].url
    const response = await fetch(blobUrl)

    if (!response.ok) {
      console.error("[v0] Failed to fetch items:", response.status)
      return []
    }

    const data = await response.json()
    return data.items || []
  } catch (error) {
    console.error("[v0] Error fetching items:", error)
    return []
  }
}

async function saveAllItems(items: Item[]): Promise<void> {
  try {
    const { blobs } = await list({ prefix: BLOB_FILENAME })

    if (blobs.length > 0) {
      await del(blobs[0].url)
      console.log("[v0] Deleted existing items file before update")
    }

    const data = JSON.stringify({ items, updatedAt: Date.now() })
    const blob = new Blob([data], { type: "application/json" })

    await put(BLOB_FILENAME, blob, {
      access: "public",
      addRandomSuffix: false,
    })

    console.log("[v0] Successfully saved items to Blob storage")
  } catch (error) {
    console.error("[v0] Error saving items:", error)
    throw new Error("Failed to save items")
  }
}

export async function getItemByShortCode(shortCode: string): Promise<Item | null> {
  const items = await getAllItems()
  const item = items.find((i) => i.shortCode === shortCode)

  if (item && item.expiresAt && item.expiresAt < Date.now()) {
    return null
  }

  return item || null
}

export async function checkItemExists(
  identifier: string,
  shortCode: string,
  type: "link" | "text",
): Promise<{ identifierExists: boolean; shortCodeExists: boolean; isReserved: boolean }> {
  const items = await getAllItems()

  const identifierExists =
    type === "link" ? items.some((i) => i.type === "link" && i.originalUrl === identifier) : false

  const shortCodeExists = items.some((i) => i.shortCode === shortCode)

  const isReserved = RESERVED_ROUTES.includes(shortCode.toLowerCase())

  return { identifierExists, shortCodeExists, isReserved }
}

export async function createItem(
  type: "link" | "text",
  content: string,
  customSuffix?: string,
  expiresInHours?: number,
): Promise<Item> {
  const items = await getAllItems()
  const shortCode = customSuffix || generateShortCode()

  const { identifierExists, shortCodeExists, isReserved } = await checkItemExists(content, shortCode, type)

  if (type === "link" && identifierExists) {
    throw new Error("该链接已存在，请勿重复添加")
  }

  if (shortCodeExists) {
    throw new Error("短代码已被占用")
  }

  if (isReserved) {
    throw new Error("该短代码是系统保留字段，无法使用")
  }

  // Validate URL if it's a link
  if (type === "link") {
    try {
      new URL(content)
    } catch {
      throw new Error("Invalid URL format")
    }
  }

  const expiresAt = expiresInHours ? Date.now() + expiresInHours * 60 * 60 * 1000 : undefined

  const newItem: Item = {
    id: generateId(),
    type,
    shortCode,
    expiresAt,
    clickCount: 0,
    createdAt: Date.now(),
    ...(type === "link"
      ? {
          originalUrl: content,
          customSuffix,
        }
      : {
          content,
          textPreview: content.substring(0, 100),
        }),
  }

  items.push(newItem)
  await saveAllItems(items)

  return newItem
}

export async function incrementClickCount(shortCode: string): Promise<void> {
  const items = await getAllItems()
  const itemIndex = items.findIndex((i) => i.shortCode === shortCode)

  if (itemIndex !== -1) {
    items[itemIndex].clickCount++
    items[itemIndex].lastClickedAt = Date.now()
    await saveAllItems(items)
  }
}

export async function deleteItem(shortCode: string): Promise<boolean> {
  const items = await getAllItems()
  const filteredItems = items.filter((i) => i.shortCode !== shortCode)

  if (filteredItems.length === items.length) {
    return false
  }

  await saveAllItems(filteredItems)
  return true
}

export async function getItemStats(): Promise<{
  totalItems: number
  totalClicks: number
  activeItems: number
  expiredItems: number
}> {
  const items = await getAllItems()
  const now = Date.now()

  const activeItems = items.filter((i) => !i.expiresAt || i.expiresAt > now)
  const expiredItems = items.filter((i) => i.expiresAt && i.expiresAt <= now)
  const totalClicks = items.reduce((sum, i) => sum + i.clickCount, 0)

  return {
    totalItems: items.length,
    totalClicks,
    activeItems: activeItems.length,
    expiredItems: expiredItems.length,
  }
}

// Keep legacy functions for backward compatibility
export async function getAllLinks() {
  const items = await getAllItems()
  return items.filter((i) => i.type === "link")
}

export async function getLinkByShortCode(shortCode: string) {
  const item = await getItemByShortCode(shortCode)
  return item && item.type === "link" ? item : null
}

export async function createLink(originalUrl: string, customSuffix?: string, expiresInHours?: number) {
  return createItem("link", originalUrl, customSuffix, expiresInHours)
}

export async function deleteLink(shortCode: string): Promise<boolean> {
  return deleteItem(shortCode)
}

export async function getLinkStats() {
  return getItemStats()
}

function generateShortCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
