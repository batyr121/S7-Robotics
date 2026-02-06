import { NextFunction, Response } from "express"
import { verifyToken } from "../utils/jwt"
import type { AuthenticatedRequest } from "../types"
import { prisma } from "../db"
import { getEffectivePermissionsForAdmin } from "../utils/admin-control"

export async function protect(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.get("authorization") || ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: "Unauthorized" })

  try {
    const payload = verifyToken(token)
    // Fetch user details for fullName and email
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        fullName: true,
        email: true,
        permissionGrants: { select: { permission: true, allowed: true } },
      },
    })
    if (!user) return res.status(401).json({ error: "User not found" })
    const permissions = user.role === "ADMIN"
      ? getEffectivePermissionsForAdmin(user.permissionGrants || [])
      : []
    req.user = {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      permissions,
    }
    return next()
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" })
  }
}

export function isAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" })
  if (req.user.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" })
  return next()
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const header = req.get("authorization") || ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : null
  if (!token) return next()
  try {
    const payload = verifyToken(token)
    req.user = { id: payload.sub, role: payload.role, permissions: payload.role === "ADMIN" ? [] : [] }
  } catch (error) {
  }
  return next()
}

// Backward-compatible alias used by some routers
export const requireAuth = protect
export { isAdmin as requireAdmin }
