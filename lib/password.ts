/**
 * 密码哈希与校验。
 *
 * 用 bcryptjs 而不是 node 的 bcrypt:在 edge runtime 也能跑,
 * 不需要 native binding。代价是比 bcrypt 慢 3-5 倍;
 * 管理员场景下完全可接受。
 */

import bcrypt from "bcryptjs"

const SALT_ROUNDS = 10

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
