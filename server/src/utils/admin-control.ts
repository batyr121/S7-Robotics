import type { Response } from "express"
import type { AuthenticatedRequest } from "../types"
import { generateVerificationCode, sendVerificationEmail } from "./email"
import { hashPassword, verifyPassword } from "./password"

export const ADMIN_PERMISSIONS = [
  "dashboard.view",
  "risk.read",
  "users.read",
  "users.write",
  "users.roles",
  "users.ban",
  "users.bulk",
  "users.classes",
  "classes.read",
  "classes.write",
  "classes.schedule",
  "enrollments.read",
  "enrollments.review",
  "payments.review",
  "waitlist.read",
  "waitlist.manage",
  "audit.read",
  "permissions.manage",
  "notifications.templates",
  "settings.manage",
] as const

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]

export const FULL_ADMIN_PERMISSION_SET = new Set<string>(ADMIN_PERMISSIONS)

export function hasPermission(req: AuthenticatedRequest, permission: string) {
  if (!req.user) return false
  if (req.user.role !== "ADMIN") return false
  const permissions = req.user.permissions || []
  return permissions.includes(permission)
}

export function requirePermission(req: AuthenticatedRequest, res: Response, permission: string) {
  if (hasPermission(req, permission)) return true
  res.status(403).json({ error: "Forbidden", code: "PERMISSION_DENIED", permission })
  return false
}

export function getEffectivePermissionsForAdmin(grants: Array<{ permission: string; allowed: boolean }> = []) {
  const set = new Set<string>(FULL_ADMIN_PERMISSION_SET)
  for (const grant of grants) {
    if (!grant?.permission) continue
    if (grant.allowed === false) set.delete(grant.permission)
    else set.add(grant.permission)
  }
  return Array.from(set.values()).sort()
}

export async function writeAdminAuditLog(
  db: any,
  params: {
    actorId?: string | null
    action: string
    entityType: string
    entityId?: string | null
    targetUserId?: string | null
    reason?: string | null
    metadata?: any
  }
) {
  return db.adminAuditLog.create({
    data: {
      actorId: params.actorId || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      targetUserId: params.targetUserId || null,
      reason: params.reason || null,
      metadata: params.metadata ?? null,
    },
  }).catch(() => null)
}

const CHALLENGE_TTL_MINUTES = 10

export async function createSensitiveActionChallenge(
  db: any,
  params: {
    adminId: string
    adminEmail?: string
    action: string
    entityType?: string
    entityId?: string
    reason?: string
  }
) {
  const code = generateVerificationCode()
  const codeHash = await hashPassword(code)
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60 * 1000)

  const challenge = await db.adminActionChallenge.create({
    data: {
      adminId: params.adminId,
      action: params.action,
      entityType: params.entityType || null,
      entityId: params.entityId || null,
      reason: params.reason || null,
      codeHash,
      expiresAt,
    },
    select: { id: true, expiresAt: true },
  })

  const message = `Код подтверждения действия "${params.action}": ${code}. Срок: ${CHALLENGE_TTL_MINUTES} мин.`
  const title = "Код подтверждения админ-действия"

  if (params.adminEmail) {
    await sendVerificationEmail(params.adminEmail, code).catch(async () => {
      await db.notification.create({
        data: {
          userId: params.adminId,
          title,
          message,
          type: "ADMIN_ACTION_CHALLENGE",
          metadata: { challengeId: challenge.id, action: params.action },
        },
      }).catch(() => null)
    })
  } else {
    await db.notification.create({
      data: {
        userId: params.adminId,
        title,
        message,
        type: "ADMIN_ACTION_CHALLENGE",
        metadata: { challengeId: challenge.id, action: params.action },
      },
    }).catch(() => null)
  }

  return challenge
}

export async function verifySensitiveActionConfirmation(
  db: any,
  params: {
    adminId: string
    action: string
    challengeId?: string
    code?: string
  }
) {
  if (!params.challengeId || !params.code) {
    const error: any = new Error("Sensitive action confirmation is required")
    error.status = 428
    error.code = "CHALLENGE_REQUIRED"
    throw error
  }

  const challenge = await db.adminActionChallenge.findFirst({
    where: {
      id: params.challengeId,
      adminId: params.adminId,
      action: params.action,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, codeHash: true },
  })

  if (!challenge) {
    const error: any = new Error("Confirmation challenge not found or expired")
    error.status = 400
    error.code = "CHALLENGE_INVALID"
    throw error
  }

  const valid = await verifyPassword(params.code, challenge.codeHash)
  if (!valid) {
    const error: any = new Error("Invalid confirmation code")
    error.status = 400
    error.code = "CHALLENGE_CODE_INVALID"
    throw error
  }

  await db.adminActionChallenge.update({
    where: { id: challenge.id },
    data: { usedAt: new Date() },
  })
}

export function renderTemplateString(template: string, variables: Record<string, string | number | null | undefined>) {
  let output = String(template || "")
  for (const [key, rawValue] of Object.entries(variables || {})) {
    const value = rawValue === null || typeof rawValue === "undefined" ? "" : String(rawValue)
    output = output.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), value)
  }
  return output
}
