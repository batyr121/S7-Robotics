import jwt from "jsonwebtoken"
import { env } from "../env"
import type { AppRole } from "../types"

interface TokenPayload {
  sub: string
  role: AppRole
}

export function signAccessToken(userId: string, role: AppRole) {
  const payload: TokenPayload = { sub: userId, role }
  return jwt.sign(payload, env.APP_SECRET, { expiresIn: "1h" })
}

export function signRefreshToken(userId: string, role: AppRole) {
  const payload: TokenPayload = { sub: userId, role }
  return jwt.sign(payload, env.APP_SECRET, { expiresIn: "30d" })
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.APP_SECRET) as TokenPayload
}
