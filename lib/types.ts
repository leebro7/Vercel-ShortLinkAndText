export interface Link {
  id: string
  originalUrl: string
  shortCode: string
  customSuffix?: string
  expiresAt?: number // Unix timestamp
  clickCount: number
  createdAt: number // Unix timestamp
  lastClickedAt?: number // Unix timestamp
}

export interface LinkStats {
  totalItems: number
  totalClicks: number
  activeItems: number
  expiredItems: number
}

export interface TextShare {
  id: string
  content: string
  shortCode: string
  expiresAt?: number
  createdAt: number
  viewCount: number
}

export interface Item {
  id: string
  type: "link" | "text"
  shortCode: string
  expiresAt?: number
  clickCount: number
  createdAt: number
  lastClickedAt?: number
  // Link properties
  originalUrl?: string
  customSuffix?: string
  // Text properties
  content?: string
  textPreview?: string
}
