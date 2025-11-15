import { cookies } from "next/headers"

const SESSION_COOKIE_NAME = "admin_session"

// Simple hash function (for demo purposes - in production use bcrypt or similar)
function simpleHash(password: string): string {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString(36)
}

function getAdminUsername(): string {
  return process.env.ADMIN_USERNAME || "admin"  // Changed default username from "leebro" to "admin"
}

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "admin123"
}

// Directly verify admin login from environment variables
export async function verifyAdmin(username: string, password: string): Promise<boolean> {
  const expectedUsername = getAdminUsername()
  const expectedPasswordHash = simpleHash(getAdminPassword())
  const inputPasswordHash = simpleHash(password)

  return username === expectedUsername && inputPasswordHash === expectedPasswordHash
}

// Remove password modification functionality
export async function updateAdminPassword(): Promise<never> {
  throw new Error("密码通过环境变量 ADMIN_PASSWORD 配置，无法在应用中修改")
}

// Create session token
function generateToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 16)}`
}

// Create admin session
export async function createAdminSession(username: string): Promise<string> {
  const token = generateToken()

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60, // 24 hours
    path: "/",
  })

  return token
}

// Check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE_NAME)
    return !!token
  } catch (error) {
    console.error("[v0] Error checking authentication:", error)
    return false
  }
}

// Logout admin
export async function logoutAdmin(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}
