import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { randomBytes } from "crypto"
import { hashPassword, verifyPassword } from "../utils/password"
import { signAccessToken, signRefreshToken, verifyToken } from "../utils/jwt"
import { requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"
import { generateVerificationCode, sendVerificationEmail, sendPasswordResetEmail } from "../utils/email"

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(3),
  age: z.number().int().min(10).max(100).optional(),
  educationalInstitution: z.string().optional(),
  role: z.enum(["student", "mentor", "parent"]).optional(),
})


const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6), // 6-digit format
})

const passwordResetRequestSchema = z.object({
  email: z.string().email(),
})

const passwordResetSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6), // 6-digit format
  newPassword: z.string().min(8),
})

const verifyResetSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6), // 6-digit format
})

const passwordResetConfirmSchema = z.object({
  email: z.string().email(),
  resetToken: z.string().min(16),
  newPassword: z.string().min(8),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

export const router = Router()

// Store verification codes in memory (in production, use Redis or database)
const verificationCodes = new Map<string, { code: string; expiresAt: Date; type: 'verification' | 'password-reset'; attempts: number }>()
// Store short-lived reset tokens issued after code verification
const passwordResetTokens = new Map<string, { token: string; expiresAt: Date }>()

// Очистка истекших кодов каждые 10 минут
setInterval(() => {
  const now = new Date()
  for (const [email, data] of verificationCodes.entries()) {
    if (data.expiresAt < now) {
      verificationCodes.delete(email)
    }
  }
  for (const [email, data] of passwordResetTokens.entries()) {
    if (data.expiresAt < now) {
      passwordResetTokens.delete(email)
    }
  }
}, 10 * 60 * 1000)

const DEV_AUTH = process.env.DEV_AUTH === "1"

if (DEV_AUTH) {
  router.post("/login", async (req: Request, res: Response) => {
    const { email, password } = (req.body || {}) as { email?: string; password?: string }
    if (email === "1" && password === "1") {
      try {
        const existing = await prisma.user.findUnique({ where: { id: "dev-admin" }, select: { id: true } })
        if (!existing) {
          const pw = await hashPassword("dev")
          await prisma.user.create({
            data: {
              id: "dev-admin",
              email: "dev-admin@dev.local",
              passwordHash: pw,
              fullName: "Dev Admin",
              role: "ADMIN",
              emailVerified: true,
              profile: { create: {} },
            },
          })
        }
      } catch (e) {
      }
      const accessToken = signAccessToken("dev-admin", "ADMIN")
      const refreshToken = signRefreshToken("dev-admin", "ADMIN")
      return res.json({
        accessToken,
        refreshToken,
        user: {
          id: "dev-admin",
          email: "admin@dev.local",
          role: "ADMIN",
          fullName: "Dev Admin",
          xp: 0,
        },
      })
    }
    return res.status(401).json({ error: "Invalid credentials" })
  })

  router.post("/refresh", async (req: Request, res: Response) => {
    const { refreshToken } = (req.body || {}) as { refreshToken?: string }
    if (!refreshToken) return res.status(400).json({ error: "Missing refresh token" })
    try {
      const payload = verifyToken(refreshToken)
      const accessToken = signAccessToken(payload.sub, payload.role)
      const newRefreshToken = signRefreshToken(payload.sub, payload.role)
      return res.json({ accessToken, refreshToken: newRefreshToken })
    } catch {
      return res.status(401).json({ error: "Invalid refresh token" })
    }
  })

  router.post("/logout", async (_req: Request, res: Response) => {
    return res.json({ success: true })
  })

  router.get("/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" })
    return res.json({
      id: "dev-admin",
      email: "admin@dev.local",
      role: "ADMIN",
      fullName: "Dev Admin",
      xp: 0,
      profile: null,
    })
  })
}

router.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { email, password, fullName, age, educationalInstitution, role } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(409).json({ error: "Email already registered" })

  const passwordHash = await hashPassword(password)
  const anyAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } })
  const isBootstrapAdmin = !anyAdmin
  const isSpecialAdmin = email.trim().toLowerCase() === "qynon@mail.ru"

  // Map role string to UserRole enum
  let userRole: "USER" | "STUDENT" | "PARENT" | "MENTOR" | "ADMIN" = "STUDENT"
  if (isBootstrapAdmin || isSpecialAdmin) {
    userRole = "ADMIN"
  } else if (role === "mentor") {
    userRole = "MENTOR"
  } else if (role === "parent") {
    userRole = "PARENT"
  } else {
    userRole = "STUDENT"
  }

  // Create user but don't automatically log them in
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      age: age ? parseInt(age as any) : undefined,
      educationalInstitution,
      role: userRole,
      profile: { create: {} },
    },
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      experiencePoints: true,
    },
  })

  // Check if there's already a recent code (rate limiting)
  const existingCode = verificationCodes.get(email)
  if (!existingCode || existingCode.expiresAt < new Date() || existingCode.type !== 'verification') {
    // Send verification email
    try {
      const code = generateVerificationCode()

      // Store code with expiration (5 minutes) and attempt counter
      verificationCodes.set(email, {
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        type: 'verification',
        attempts: 0
      })

      // Send email
      await sendVerificationEmail(email, code)
    } catch (error) {
      console.error("Failed to send verification email:", error)
      // Don't block registration if email fails
    }
  }

  // Return response indicating email verification is required
  res.status(201).json({
    requiresEmailVerification: true,
    email: user.email,
    message: "Registration successful. Please check your email for verification code."
  })
})

router.post("/send-verification", async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string }

  if (!email) {
    return res.status(400).json({ error: "Email is required" })
  }

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    // Check if there's already a recent code (rate limiting)
    const existing = verificationCodes.get(email)
    if (existing && existing.expiresAt > new Date()) {
      const timeLeft = Math.ceil((existing.expiresAt.getTime() - Date.now()) / 1000)
      return res.status(429).json({
        error: `Please wait ${timeLeft} seconds before requesting a new code`,
        retryAfter: timeLeft
      })
    }

    // Generate verification code
    const code = generateVerificationCode()

    // Store code with expiration (5 minutes) and attempt counter
    verificationCodes.set(email, {
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      type: 'verification',
      attempts: 0
    })

    // Send email
    await sendVerificationEmail(email, code)

    res.json({ success: true, message: "Verification code sent" })
  } catch (error) {
    console.error("Failed to send verification email:", error)
    res.status(500).json({ error: "Failed to send verification email" })
  }
})

router.post("/verify-email", async (req: Request, res: Response) => {
  const parsed = verifyEmailSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { email, code } = parsed.data

  try {
    // Check if code exists and is valid
    const stored = verificationCodes.get(email)
    if (!stored || stored.type !== 'verification') {
      return res.status(400).json({ error: "Verification code not found" })
    }

    // Check if code is expired
    if (stored.expiresAt < new Date()) {
      verificationCodes.delete(email)
      return res.status(400).json({ error: "Verification code expired" })
    }

    // Check attempts (max 3 attempts)
    if (stored.attempts >= 3) {
      verificationCodes.delete(email)
      return res.status(400).json({ error: "Too many failed attempts. Please request a new code." })
    }

    // Increment attempts
    stored.attempts += 1
    verificationCodes.set(email, stored)

    // Check if code matches
    if (stored.code !== code) {
      return res.status(400).json({ error: "Invalid verification code" })
    }

    // Code is valid, remove it
    verificationCodes.delete(email)

    // Mark user's email as verified
    await prisma.user.update({
      where: { email },
      data: { emailVerified: true }
    })

    res.json({ success: true, message: "Email verified successfully" })
  } catch (error) {
    console.error("Failed to verify email:", error)
    res.status(500).json({ error: "Failed to verify email" })
  }
})

router.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { email, password } = parsed.data

  const user = await (prisma as any).user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      passwordHash: true,
      experiencePoints: true,
      banned: true,
      bannedReason: true,
      emailVerified: true,
      coinBalance: true,
    } as any,
  })
  if (!user) return res.status(401).json({ error: "Invalid credentials" })
  if ((user as any).banned) {
    const reason = (user as any).bannedReason || "Напишите в службу поддержки."
    return res.status(403).json({ error: `Ваш аккаунт заблокирован. ${reason}` })
  }
  const valid = await verifyPassword(password, (user as any).passwordHash)
  if (!valid) return res.status(401).json({ error: "Invalid credentials" })

  // If email is not verified — do not auto-send verification on login.
  // Require using the explicit verification flow (registration/send-verification).
  if (!user.emailVerified && user.role !== "ADMIN") {
    return res.status(403).json({ error: "Email не подтверждён. Пожалуйста, подтвердите почту через процесс верификации." })
  }

  // Proceed with login for verified users
  const accessToken = signAccessToken(user.id, user.role)
  const refreshToken = signRefreshToken(user.id, user.role)

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  })

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      xp: Number((user as any).experiencePoints || 0),
      coinBalance: Number((user as any).coinBalance || 0),
    },
  })
})

router.post("/login-verify", async (req: Request, res: Response) => {
  const parsed = verifyEmailSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { email, code } = parsed.data

  try {
    // Check if code exists and is valid
    const stored = verificationCodes.get(email)
    if (!stored || stored.type !== 'verification') {
      return res.status(400).json({ error: "Verification code not found" })
    }

    // Check if code is expired
    if (stored.expiresAt < new Date()) {
      verificationCodes.delete(email)
      return res.status(400).json({ error: "Verification code expired" })
    }

    // Check attempts (max 3 attempts)
    if (stored.attempts >= 3) {
      verificationCodes.delete(email)
      return res.status(400).json({ error: "Too many failed attempts. Please request a new code." })
    }

    // Increment attempts
    stored.attempts += 1
    verificationCodes.set(email, stored)

    // Check if code matches
    if (stored.code !== code) {
      return res.status(400).json({ error: "Invalid verification code" })
    }

    // Code is valid, remove it
    verificationCodes.delete(email)

    // Mark user's email as verified
    await prisma.user.update({
      where: { email },
      data: { emailVerified: true }
    })

    // Proceed with login
    const user = await (prisma as any).user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        fullName: true,
        experiencePoints: true,
        banned: true,
        bannedReason: true,
        educationalInstitution: true,
        primaryRole: true,
        age: true,
      } as any,
    })

    if (!user) return res.status(401).json({ error: "Invalid credentials" })
    if ((user as any).banned) {
      const reason = (user as any).bannedReason || "Напишите в службу поддержки."
      return res.status(403).json({ error: `Ваш аккаунт заблокирован. ${reason}` })
    }

    const accessToken = signAccessToken(user.id, user.role)
    const refreshToken = signRefreshToken(user.id, user.role)

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    })

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        xp: Number((user as any).experiencePoints || 0),
        coinBalance: Number((user as any).coinBalance || 0),
        educationalInstitution: user.educationalInstitution,
        primaryRole: user.primaryRole,
        age: typeof user.age === 'number' ? user.age : undefined,
      },
    })
  } catch (error) {
    console.error("Failed to verify email:", error)
    res.status(500).json({ error: "Failed to verify email" })
  }
})

// Password reset request with rate limiting
router.post("/forgot-password", async (req: Request, res: Response) => {
  const parsed = passwordResetRequestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { email } = parsed.data

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ success: true, message: "If email exists, reset code sent" })
    }

    // Check if there's already a recent code (rate limiting)
    const existing = verificationCodes.get(email)
    if (existing && existing.type === 'password-reset' && existing.expiresAt > new Date()) {
      const timeLeft = Math.ceil((existing.expiresAt.getTime() - Date.now()) / 1000)
      return res.status(429).json({
        error: `Please wait ${timeLeft} seconds before requesting a new code`,
        retryAfter: timeLeft
      })
    }

    // Generate reset code
    const code = generateVerificationCode()

    // Store code with expiration (15 minutes) and attempt counter
    verificationCodes.set(email, {
      code,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      type: 'password-reset',
      attempts: 0
    })

    // Send email
    await sendPasswordResetEmail(email, code)

    res.json({ success: true, message: "If email exists, reset code sent" })
  } catch (error) {
    console.error("Failed to send password reset email:", error)
    res.status(500).json({ error: "Failed to process password reset request" })
  }
})

// Verify 6-digit reset code and issue short-lived reset token
router.post("/verify-reset-code", async (req: Request, res: Response) => {
  const parsed = verifyResetSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { email, code } = parsed.data

  try {
    // Check if code exists and is valid
    const stored = verificationCodes.get(email)
    if (!stored || stored.type !== 'password-reset') {
      return res.status(400).json({ error: "Reset code not found or expired" })
    }

    // Check if code is expired
    if (stored.expiresAt < new Date()) {
      verificationCodes.delete(email)
      return res.status(400).json({ error: "Reset code expired" })
    }

    // Check attempts (max 3 attempts)
    if (stored.attempts >= 3) {
      verificationCodes.delete(email)
      return res.status(400).json({ error: "Too many failed attempts. Please request a new code." })
    }

    // Increment attempts
    stored.attempts += 1
    verificationCodes.set(email, stored)

    // Check if code matches
    if (stored.code !== code) {
      return res.status(400).json({ error: "Invalid reset code" })
    }

    // Code is valid, remove it and issue reset token
    verificationCodes.delete(email)
    const token = randomBytes(24).toString("hex")
    passwordResetTokens.set(email, { token, expiresAt: new Date(Date.now() + 15 * 60 * 1000) })

    res.json({ success: true, resetToken: token, expiresInSeconds: 15 * 60 })
  } catch (error) {
    console.error("Failed to verify reset code:", error)
    res.status(500).json({ error: "Failed to verify reset code" })
  }
})

// Password reset with attempt limiting
router.post("/reset-password", async (req: Request, res: Response) => {
  const parsed = passwordResetSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { email, code, newPassword } = parsed.data

  try {
    // Check if code exists and is valid
    const stored = verificationCodes.get(email)
    if (!stored || stored.type !== 'password-reset') {
      return res.status(400).json({ error: "Reset code not found or expired" })
    }

    // Check if code is expired
    if (stored.expiresAt < new Date()) {
      verificationCodes.delete(email)
      return res.status(400).json({ error: "Reset code expired" })
    }

    // Check attempts (max 3 attempts)
    if (stored.attempts >= 3) {
      verificationCodes.delete(email)
      return res.status(400).json({ error: "Too many failed attempts. Please request a new code." })
    }

    // Increment attempts
    stored.attempts += 1
    verificationCodes.set(email, stored)

    // Check if code matches
    if (stored.code !== code) {
      return res.status(400).json({ error: "Invalid reset code" })
    }

    // Code is valid, remove it
    verificationCodes.delete(email)

    // Update password
    const passwordHash = await hashPassword(newPassword)
    await prisma.user.update({
      where: { email },
      data: { passwordHash }
    })

    res.json({ success: true, message: "Password reset successfully" })
  } catch (error) {
    console.error("Failed to reset password:", error)
    res.status(500).json({ error: "Failed to reset password" })
  }
})

// Confirm password reset with short-lived reset token
router.post("/reset-password/confirm", async (req: Request, res: Response) => {
  const parsed = passwordResetConfirmSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { email, resetToken, newPassword } = parsed.data

  try {
    const stored = passwordResetTokens.get(email)
    if (!stored) return res.status(400).json({ error: "Reset token not found or expired" })
    if (stored.expiresAt < new Date()) {
      passwordResetTokens.delete(email)
      return res.status(400).json({ error: "Reset token expired" })
    }
    if (stored.token !== resetToken) return res.status(400).json({ error: "Invalid reset token" })

    passwordResetTokens.delete(email)

    const passwordHash = await hashPassword(newPassword)
    await prisma.user.update({ where: { email }, data: { passwordHash } })
    res.json({ success: true, message: "Password reset successfully" })
  } catch (error) {
    console.error("Failed to reset password:", error)
    res.status(500).json({ error: "Failed to reset password" })
  }
})

// Change password (authenticated users)
router.post("/change-password", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" })

  const parsed = changePasswordSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { currentPassword, newPassword } = parsed.data

  try {
    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { passwordHash: true }
    })

    if (!user) return res.status(404).json({ error: "User not found" })

    // Verify current password
    const valid = await verifyPassword(currentPassword, user.passwordHash)
    if (!valid) return res.status(400).json({ error: "Current password is incorrect" })

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword)

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: newPasswordHash }
    })

    res.json({ success: true, message: "Password changed successfully" })
  } catch (error) {
    console.error("Failed to change password:", error)
    res.status(500).json({ error: "Failed to change password" })
  }
})

router.post("/refresh", async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { refreshToken } = parsed.data

  const stored = await prisma.session.findUnique({ where: { refreshToken } })
  if (!stored || stored.expiresAt < new Date()) return res.status(401).json({ error: "Invalid refresh token" })

  let payload
  try {
    payload = verifyToken(refreshToken)
  } catch (error) {
    return res.status(401).json({ error: "Invalid refresh token" })
  }

  const accessToken = signAccessToken(payload.sub, payload.role)
  const newRefreshToken = signRefreshToken(payload.sub, payload.role)

  await prisma.session.update({
    where: { refreshToken },
    data: {
      refreshToken: newRefreshToken,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  })

  res.json({ accessToken, refreshToken: newRefreshToken })
})

router.post("/logout", async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { refreshToken } = parsed.data
  await prisma.session.delete({ where: { refreshToken }, select: { id: true } }).catch(() => null)
  res.json({ success: true })
})

router.get("/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" })
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { profile: true },
  })
  if (!user) return res.status(404).json({ error: "User not found" })
  if ((user as any).banned) {
    const reason = (user as any).bannedReason || "Напишите в службу поддержки."
    return res.status(403).json({ error: `Аккаунт заблокирован. ${reason}` })
  }
  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    xp: Number((user as any).experiencePoints || 0),
    coinBalance: Number((user as any).coinBalance || 0),
    educationalInstitution: (user as any).educationalInstitution,
    primaryRole: (user as any).primaryRole,
    age: typeof (user as any).age === 'number' ? (user as any).age : undefined,
    profile: user.profile,
  })
})

const profileUpdateSchema = z.object({
  fullName: z.string().min(1).optional(),
  age: z.number().int().min(10).max(100).optional(),
  educationalInstitution: z.string().optional(),
  primaryRole: z.string().optional(),
})

router.put("/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" })
  const parsed = profileUpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = parsed.data
  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        fullName: data.fullName,
        age: data.age,
        educationalInstitution: data.educationalInstitution,
        primaryRole: data.primaryRole,
      },
      select: { id: true, email: true, role: true, fullName: true, educationalInstitution: true, primaryRole: true, age: true },
    })
    return res.json(updated)
  } catch (e) {
    return res.status(500).json({ error: "Failed to update profile" })
  }
})
