import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth, requireAdmin } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"
import { sendEnrollmentApprovedParentEmail, sendEnrollmentApprovedStudentEmail } from "../utils/email"
import { hashPassword } from "../utils/password"
import {
  ADMIN_PERMISSIONS,
  createSensitiveActionChallenge,
  renderTemplateString,
  requirePermission,
  verifySensitiveActionConfirmation,
  writeAdminAuditLog,
} from "../utils/admin-control"

export const router = Router()
const db = prisma as any

const toAmount = (value: any) => {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value) || 0
  if (value && typeof value.toNumber === "function") return value.toNumber()
  if (value && typeof value.toString === "function") return Number(value.toString()) || 0
  return 0
}

const formatCurrency = (amount: number, currency = "KZT") => {
  const label = currency === "KZT" ? "тг" : currency
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount || 0)} ${label}`
}

const addOneMonth = (date: Date) => {
  const next = new Date(date)
  next.setMonth(next.getMonth() + 1)
  return next
}

// All routes require Admin role
router.use(requireAuth)
router.use(requireAdmin)

const sensitiveConfirmationSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().trim().min(4).max(16),
  reason: z.string().trim().max(300).optional(),
})

const ensurePermission = (req: AuthenticatedRequest, res: Response, permission: string) =>
  requirePermission(req, res, permission)

const ensureSensitiveConfirmation = async (
  req: AuthenticatedRequest,
  res: Response,
  action: string,
  confirmation: { challengeId?: string; code?: string } | undefined
) => {
  try {
    await verifySensitiveActionConfirmation(db, {
      adminId: req.user!.id,
      action,
      challengeId: confirmation?.challengeId,
      code: confirmation?.code,
    })
    return true
  } catch (error: any) {
    const status = Number(error?.status || 400)
    res.status(status).json({
      error: error?.message || "Sensitive action confirmation failed",
      code: error?.code || "CHALLENGE_FAILED",
      action,
    })
    return false
  }
}

const maybeEnsureSensitiveConfirmation = async (
  req: AuthenticatedRequest,
  res: Response,
  action: string,
  confirmation: { challengeId?: string; code?: string } | undefined
) => {
  if (!confirmation?.challengeId || !confirmation?.code) return true
  return ensureSensitiveConfirmation(req, res, action, confirmation)
}

const upsertNotificationTemplateSchema = z.object({
  key: z.string().min(3).max(120),
  channel: z.string().trim().min(2).max(32).optional(),
  titleTemplate: z.string().min(1),
  messageTemplate: z.string().min(1),
  description: z.string().max(600).optional(),
  isActive: z.boolean().optional(),
})

const challengeRequestSchema = z.object({
  action: z.string().min(3).max(120),
  entityType: z.string().max(80).optional(),
  entityId: z.string().max(120).optional(),
  reason: z.string().trim().max(300).optional(),
})

const bulkUsersSchema = z.object({
  operation: z.enum(["BAN", "UNBAN", "SET_ROLE", "ASSIGN_CLASS", "REMOVE_CLASS"]),
  userIds: z.array(z.string().min(1)).min(1),
  role: z.enum(["USER", "STUDENT", "PARENT", "MENTOR", "ADMIN", "GUEST"]).optional(),
  classId: z.string().optional(),
  reason: z.string().trim().max(300).optional(),
  confirmation: sensitiveConfirmationSchema.optional(),
})

const waitlistContactSchema = z.object({
  note: z.string().trim().max(400).optional(),
  confirmation: sensitiveConfirmationSchema.optional(),
})

const waitlistPromoteSchema = z.object({
  classId: z.string().min(1),
  note: z.string().trim().max(400).optional(),
  confirmation: sensitiveConfirmationSchema.optional(),
})

const permissionGrantSchema = z.object({
  permission: z.string().min(3),
  allowed: z.boolean(),
  confirmation: sensitiveConfirmationSchema.optional(),
})

const notificationTemplateSeedData = [
  {
    key: "ENROLLMENT_APPROVED_PARENT",
    channel: "IN_APP",
    titleTemplate: "Оплата подтверждена",
    messageTemplate:
      "Оплата подтверждена. Сумма: {{amount}}. Ученики: {{students}}. План: \"{{planTitle}}\". Расписание: {{scheduleSummary}}. Вопросы: {{contactPhone}}.",
    description: "Уведомление родителю после одобрения заявки.",
  },
  {
    key: "ENROLLMENT_APPROVED_STUDENT",
    channel: "IN_APP",
    titleTemplate: "Ты записан(а) на занятия",
    messageTemplate:
      "{{parentName}} записал(а) тебя на \"{{planTitle}}\". Класс: {{className}}. Расписание: {{schedule}}. Ментор: {{mentorName}}. Вопросы: {{contactPhone}}.",
    description: "Уведомление ученику после одобрения заявки.",
  },
  {
    key: "WAITLIST_CONTACT",
    channel: "IN_APP",
    titleTemplate: "Обновление по листу ожидания",
    messageTemplate:
      "Появились новости по листу ожидания для {{studentName}}. {{note}} Свяжитесь с нами: {{contactPhone}}.",
    description: "Контакт с родителем по листу ожидания.",
  },
]

async function getTemplateByKey(key: string) {
  const template = await db.notificationTemplate.findFirst({
    where: { key, isActive: true },
    orderBy: { version: "desc" },
  }).catch(() => null)
  return template || null
}

// GET /api/admin/analytics
router.get("/analytics", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "dashboard.view")) return
    const now = new Date()
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

    const registrationsByDay = await Promise.all(
      Array.from({ length: 7 }).map((_, index) => {
        const day = new Date(now)
        day.setDate(now.getDate() - (6 - index))
        const start = startOfDay(day)
        const end = new Date(start)
        end.setDate(start.getDate() + 1)
        return db.user.count({ where: { createdAt: { gte: start, lt: end } } })
          .then((count: number) => ({ date: start.toISOString().slice(0, 10), count }))
      })
    )

    const [
      usersCount,
      studentsCount,
      parentsCount,
      mentorsCount,
      newsCount,
      publishedNewsCount,
      bytesizeCount,
      eventsCount,
      eventsPendingCount,
      eventsPublishedCount,
      shopItemsCount,
      groupsCount,
      schedulesCount,
      coinsAgg,
      attendanceAgg,
      gradeAgg,
      ratingAgg,
      mentors,
      reviewGroup,
      lessonGroup
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { role: "STUDENT" } }),
      db.user.count({ where: { role: "PARENT" } }),
      db.user.count({ where: { role: "MENTOR" } }),
      db.news.count(),
      db.news.count({ where: { published: true } }),
      db.byteSizeItem.count().catch(() => 0),
      db.event.count(),
      db.event.count({ where: { status: "pending" } }),
      db.event.count({ where: { status: "published" } }),
      db.shopItem.count(),
      db.clubClass.count(),
      db.schedule.count(),
      db.user.aggregate({ _sum: { coinBalance: true } }),
      db.attendance.groupBy({ by: ["status"], _count: { _all: true } }).catch(() => []),
      db.attendance.aggregate({ _avg: { grade: true } }).catch(() => ({ _avg: { grade: null } })),
      db.mentorReview.aggregate({ _avg: { rating: true }, _count: { rating: true } }).catch(() => ({ _avg: { rating: null }, _count: { rating: 0 } })),
      db.user.findMany({ where: { role: "MENTOR" }, select: { id: true, fullName: true, email: true } }),
      db.mentorReview.groupBy({ by: ["mentorId"], _avg: { rating: true }, _count: { rating: true } }).catch(() => []),
      db.schedule.groupBy({ by: ["createdById"], where: { status: "COMPLETED" }, _count: { _all: true } }).catch(() => [])
    ])

    const attendanceMap = new Map((attendanceAgg || []).map((row: any) => [row.status, row._count?._all || 0]))
    const presentCount = Number(attendanceMap.get("PRESENT") || 0)
    const lateCount = Number(attendanceMap.get("LATE") || 0)
    const absentCount = Number(attendanceMap.get("ABSENT") || 0)
    const totalAttendance = presentCount + lateCount + absentCount

    const reviewMap = new Map<string, { avg: number; count: number }>((reviewGroup || []).map((row: any) => [
      row.mentorId,
      { avg: Number(row._avg?.rating || 0), count: Number(row._count?.rating || 0) }
    ]))
    const lessonMap = new Map((lessonGroup || []).map((row: any) => [row.createdById, Number(row._count?._all || 0)]))

    const mentorRatings = (mentors || []).map((mentor: any) => {
      const review = reviewMap.get(mentor.id) || { avg: 0, count: 0 }
      return {
        id: mentor.id,
        fullName: mentor.fullName,
        email: mentor.email,
        ratingAvg: review.avg,
        ratingCount: review.count,
        lessonsCompleted: lessonMap.get(mentor.id) || 0
      }
    }).sort((a: any, b: any) => {
      if (b.ratingAvg !== a.ratingAvg) return b.ratingAvg - a.ratingAvg
      if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount
      return b.lessonsCompleted - a.lessonsCompleted
    })

    res.json({
      usersCount,
      studentsCount,
      parentsCount,
      mentorsCount,
      groupsCount,
      schedulesCount,
      totalCoins: Number(coinsAgg?._sum?.coinBalance || 0),
      registrationsByDay,
      attendance: {
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        total: totalAttendance
      },
      performance: {
        averageGrade: Number(gradeAgg?._avg?.grade || 0),
        averageRating: Number(ratingAgg?._avg?.rating || 0),
        ratingCount: Number(ratingAgg?._count?.rating || 0)
      },
      content: {
        newsTotal: newsCount,
        newsPublished: publishedNewsCount,
        newsDrafts: Math.max(newsCount - publishedNewsCount, 0),
        bytesizeTotal: bytesizeCount,
        shopItemsTotal: shopItemsCount,
        eventsTotal: eventsCount,
        eventsPending: eventsPendingCount,
        eventsPublished: eventsPublishedCount
      },
      mentorRatings
    })
  } catch (error) {
    console.error("Admin Analytics Error:", error)
    res.status(500).json({ error: "Failed to load analytics" })
  }
})

const actionPermissionMap: Record<string, string> = {
  USER_BAN: "users.ban",
  USER_UNBAN: "users.ban",
  USER_ROLE_CHANGE: "users.roles",
  ENROLLMENT_APPROVE: "enrollments.review",
  ENROLLMENT_REJECT: "enrollments.review",
  USERS_BULK: "users.bulk",
  WAITLIST_CONTACT: "waitlist.manage",
  WAITLIST_PROMOTE: "waitlist.manage",
  PERMISSION_UPDATE: "permissions.manage",
}

router.get("/permissions/me", async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    userId: req.user!.id,
    role: req.user!.role,
    permissions: req.user!.permissions || [],
  })
})

router.get("/permissions/catalog", async (req: AuthenticatedRequest, res: Response) => {
  if (!ensurePermission(req, res, "permissions.manage")) return
  res.json({ permissions: ADMIN_PERMISSIONS })
})

router.get("/permissions/users", async (req: AuthenticatedRequest, res: Response) => {
  if (!ensurePermission(req, res, "permissions.manage")) return
  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: {
      id: true,
      fullName: true,
      email: true,
      permissionGrants: { select: { permission: true, allowed: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const result = admins.map((a: any) => {
    const denied = (a.permissionGrants || []).filter((g: any) => g.allowed === false).map((g: any) => g.permission)
    return {
      id: a.id,
      fullName: a.fullName,
      email: a.email,
      deniedPermissions: denied,
      effectiveCount: Math.max(0, ADMIN_PERMISSIONS.length - denied.length),
    }
  })
  res.json({ users: result })
})

router.get("/permissions/users/:id", async (req: AuthenticatedRequest, res: Response) => {
  if (!ensurePermission(req, res, "permissions.manage")) return
  const { id } = req.params
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      permissionGrants: { select: { id: true, permission: true, allowed: true, createdAt: true, updatedAt: true } },
    },
  })
  if (!user) return res.status(404).json({ error: "User not found" })
  if (user.role !== "ADMIN") return res.status(400).json({ error: "Permissions are available only for admins" })

  const deniedSet = new Set((user.permissionGrants || []).filter((g: any) => g.allowed === false).map((g: any) => g.permission))
  const effectivePermissions = ADMIN_PERMISSIONS.filter((p) => !deniedSet.has(p))
  res.json({
    user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
    grants: user.permissionGrants,
    effectivePermissions,
    deniedPermissions: Array.from(deniedSet),
  })
})

router.post("/permissions/users/:id/grants", async (req: AuthenticatedRequest, res: Response) => {
  if (!ensurePermission(req, res, "permissions.manage")) return
  const { id } = req.params
  const parsed = permissionGrantSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = parsed.data

  if (!ADMIN_PERMISSIONS.includes(data.permission as any)) {
    return res.status(400).json({ error: "Unknown permission" })
  }
  const confirmed = await ensureSensitiveConfirmation(req, res, "PERMISSION_UPDATE", data.confirmation)
  if (!confirmed) return

  const target = await db.user.findUnique({ where: { id }, select: { id: true, role: true } })
  if (!target) return res.status(404).json({ error: "User not found" })
  if (target.role !== "ADMIN") return res.status(400).json({ error: "Target user must be admin" })

  const grant = await db.adminPermissionGrant.upsert({
    where: { userId_permission: { userId: id, permission: data.permission } },
    create: {
      userId: id,
      permission: data.permission,
      allowed: data.allowed,
      createdById: req.user!.id,
    },
    update: {
      allowed: data.allowed,
      createdById: req.user!.id,
    },
  })

  await writeAdminAuditLog(db, {
    actorId: req.user!.id,
    action: "PERMISSION_UPDATE",
    entityType: "ADMIN_PERMISSION_GRANT",
    entityId: grant.id,
    targetUserId: id,
    reason: data.confirmation?.reason || null,
    metadata: { permission: data.permission, allowed: data.allowed },
  })

  res.json({ success: true, grant })
})

router.post("/sensitive-actions/challenge", async (req: AuthenticatedRequest, res: Response) => {
  const parsed = challengeRequestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = parsed.data

  const permissionForAction = actionPermissionMap[data.action] || "settings.manage"
  if (!ensurePermission(req, res, permissionForAction)) return

  const challenge = await createSensitiveActionChallenge(db, {
    adminId: req.user!.id,
    adminEmail: req.user!.email,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId,
    reason: data.reason,
  })

  await writeAdminAuditLog(db, {
    actorId: req.user!.id,
    action: "CHALLENGE_CREATED",
    entityType: data.entityType || "SENSITIVE_ACTION",
    entityId: data.entityId || null,
    reason: data.reason || null,
    metadata: { challengeId: challenge.id, action: data.action },
  })

  res.status(201).json({ challengeId: challenge.id, expiresAt: challenge.expiresAt })
})

router.get("/audit-logs", async (req: AuthenticatedRequest, res: Response) => {
  if (!ensurePermission(req, res, "audit.read")) return
  const { action, entityType, actorId, targetUserId, limit = "100" } = req.query as any
  const take = Math.min(300, Math.max(1, Number(limit) || 100))
  const where: any = {}
  if (action) where.action = String(action)
  if (entityType) where.entityType = String(entityType)
  if (actorId) where.actorId = String(actorId)
  if (targetUserId) where.targetUserId = String(targetUserId)

  const logs = await db.adminAuditLog.findMany({
    where,
    take,
    orderBy: { createdAt: "desc" },
    include: {
      actor: { select: { id: true, fullName: true, email: true } },
      targetUser: { select: { id: true, fullName: true, email: true } },
    },
  })
  res.json({ logs })
})

router.get("/payment-queue", async (req: AuthenticatedRequest, res: Response) => {
  if (!ensurePermission(req, res, "payments.review")) return
  const { status = "PENDING", limit = "200" } = req.query as any
  const take = Math.min(500, Math.max(1, Number(limit) || 200))
  const where: any = {}
  if (status && status !== "ALL") where.status = String(status).toUpperCase()

  const requests = await db.enrollmentRequest.findMany({
    where,
    take,
    orderBy: { requestedAt: "asc" },
    include: {
      parent: { select: { id: true, fullName: true, email: true } },
      plan: { select: { id: true, title: true, priceMonthly: true } },
      students: { select: { id: true } },
    },
  })

  const now = Date.now()
  const items = (requests || []).map((r: any) => {
    const requestedAt = new Date(r.requestedAt).getTime()
    const ageMinutes = Math.max(0, Math.floor((now - requestedAt) / 60000))
    const slaLimitMinutes = 120
    const slaWarningMinutes = 60
    const slaStatus = ageMinutes >= slaLimitMinutes ? "OVERDUE" : ageMinutes >= slaWarningMinutes ? "AT_RISK" : "NORMAL"
    const studentsCount = r.students?.length || 0
    const expectedAmount = toAmount(r.plan?.priceMonthly) * studentsCount
    const actualAmount = toAmount(r.paymentAmount)
    const suspicious = actualAmount <= 0 || studentsCount <= 0 || Math.abs(expectedAmount - actualAmount) > 1
    return {
      id: r.id,
      status: r.status,
      parent: r.parent,
      planTitle: r.plan?.title || "Абонемент",
      paymentCode: r.paymentCode,
      amount: actualAmount,
      expectedAmount,
      currency: r.currency || "KZT",
      studentsCount,
      requestedAt: r.requestedAt,
      reviewedAt: r.reviewedAt,
      ageMinutes,
      slaStatus,
      minutesToDeadline: Math.max(0, slaLimitMinutes - ageMinutes),
      suspicious,
    }
  })
  res.json({ items })
})

router.get("/risk-dashboard", async (req: AuthenticatedRequest, res: Response) => {
  if (!ensurePermission(req, res, "risk.read")) return
  const now = new Date()
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [pendingOverdue, pendingAll, waitlistOpen, expiringSubs, classes] = await Promise.all([
    db.enrollmentRequest.count({ where: { status: "PENDING", requestedAt: { lt: twoHoursAgo } } }),
    db.enrollmentRequest.count({ where: { status: "PENDING" } }),
    db.waitlistEntry.count({ where: { status: { in: ["WAITING", "CONTACTED"] } } }),
    db.parentSubscription.count({
      where: { status: "ACTIVE", endDate: { gte: now, lte: sevenDaysLater } },
    }),
    db.clubClass.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        maxStudents: true,
        _count: { select: { enrollments: true } },
      },
    }),
  ])

  const classesNearCapacity = (classes || [])
    .map((c: any) => {
      const seatsTaken = c._count?.enrollments || 0
      const maxStudents = c.maxStudents || 0
      const load = maxStudents > 0 ? seatsTaken / maxStudents : 0
      return { id: c.id, name: c.name, seatsTaken, maxStudents, load }
    })
    .filter((c: any) => c.maxStudents > 0 && c.load >= 0.8)
    .sort((a: any, b: any) => b.load - a.load)
    .slice(0, 10)

  res.json({
    kpis: {
      pendingRequests: pendingAll,
      overdueRequests: pendingOverdue,
      waitlistOpen,
      expiringSubscriptions7d: expiringSubs,
      classesNearCapacity: classesNearCapacity.length,
    },
    classesNearCapacity,
  })
})

router.get("/waitlist", async (req: AuthenticatedRequest, res: Response) => {
  if (!ensurePermission(req, res, "waitlist.read")) return
  const { status, limit = "200" } = req.query as any
  const take = Math.min(500, Math.max(1, Number(limit) || 200))
  const where: any = {}
  if (status && status !== "ALL") where.status = String(status).toUpperCase()

  const entries = await db.waitlistEntry.findMany({
    where,
    take,
    orderBy: { createdAt: "asc" },
    include: {
      parent: { select: { id: true, fullName: true, email: true } },
      student: { select: { id: true, fullName: true, email: true } },
      plan: { select: { id: true, title: true } },
      class: { select: { id: true, name: true } },
    },
  })
  res.json({ entries })
})

router.post("/waitlist/:id/contact", async (req: AuthenticatedRequest, res: Response) => {
  if (!ensurePermission(req, res, "waitlist.manage")) return
  const { id } = req.params
  const parsed = waitlistContactSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = parsed.data
  const confirmed = await ensureSensitiveConfirmation(req, res, "WAITLIST_CONTACT", data.confirmation)
  if (!confirmed) return

  const entry = await db.waitlistEntry.findUnique({
    where: { id },
    include: { parent: { select: { id: true } }, student: { select: { fullName: true } } },
  })
  if (!entry) return res.status(404).json({ error: "Waitlist entry not found" })

  const note = data.note?.trim() || "Мы нашли подходящий слот и хотим согласовать детали."
  const template = await getTemplateByKey("WAITLIST_CONTACT")
  const templateVars = {
    studentName: entry.student?.fullName || "ученика",
    note,
    contactPhone: "+7 776 045 7776",
  }
  const title = template
    ? renderTemplateString(template.titleTemplate, templateVars)
    : "Обновление по листу ожидания"
  const message = template
    ? renderTemplateString(template.messageTemplate, templateVars)
    : `Новости по листу ожидания для ${entry.student?.fullName || "ученика"}: ${note}`

  await db.$transaction(async (tx: any) => {
    await tx.waitlistEntry.update({
      where: { id },
      data: { status: "CONTACTED", notifiedAt: new Date(), note },
    })
    await tx.notification.create({
      data: {
        userId: entry.parentId,
        title,
        message,
        type: "WAITLIST_CONTACT",
        metadata: { waitlistEntryId: id },
      },
    }).catch(() => null)
  })

  await writeAdminAuditLog(db, {
    actorId: req.user!.id,
    action: "WAITLIST_CONTACT",
    entityType: "WAITLIST_ENTRY",
    entityId: id,
    targetUserId: entry.parentId,
    reason: data.confirmation?.reason || data.note || null,
  })

  res.json({ success: true })
})

router.post("/waitlist/:id/promote", async (req: AuthenticatedRequest, res: Response) => {
  if (!ensurePermission(req, res, "waitlist.manage")) return
  const { id } = req.params
  const parsed = waitlistPromoteSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = parsed.data
  const confirmed = await ensureSensitiveConfirmation(req, res, "WAITLIST_PROMOTE", data.confirmation)
  if (!confirmed) return

  const entry = await db.waitlistEntry.findUnique({
    where: { id },
    select: { id: true, studentId: true, parentId: true, status: true },
  })
  if (!entry) return res.status(404).json({ error: "Waitlist entry not found" })

  const cls = await db.clubClass.findUnique({
    where: { id: data.classId },
    select: { id: true, name: true, maxStudents: true, _count: { select: { enrollments: true } } },
  })
  if (!cls) return res.status(404).json({ error: "Class not found" })
  const seatsLeft = Math.max(0, (cls.maxStudents || 0) - (cls._count?.enrollments || 0))
  if (seatsLeft <= 0) return res.status(400).json({ error: "No seats left in class" })

  await db.$transaction(async (tx: any) => {
    await tx.classEnrollment.upsert({
      where: { classId_userId: { classId: data.classId, userId: entry.studentId } },
      create: { classId: data.classId, userId: entry.studentId, status: "active" },
      update: { status: "active" },
    })
    await tx.waitlistEntry.update({
      where: { id },
      data: { status: "PROMOTED", classId: data.classId, note: data.note || null, notifiedAt: new Date() },
    })
    await tx.notification.create({
      data: {
        userId: entry.parentId,
        title: "Место в группе подтверждено",
        message: `Мы записали ученика в класс "${cls.name}".`,
        type: "WAITLIST_PROMOTED",
        metadata: { waitlistEntryId: id, classId: data.classId },
      },
    }).catch(() => null)
  })

  await writeAdminAuditLog(db, {
    actorId: req.user!.id,
    action: "WAITLIST_PROMOTE",
    entityType: "WAITLIST_ENTRY",
    entityId: id,
    targetUserId: entry.studentId,
    reason: data.confirmation?.reason || data.note || null,
    metadata: { classId: data.classId },
  })

  res.json({ success: true })
})

router.post("/users/bulk", async (req: AuthenticatedRequest, res: Response) => {
  if (!ensurePermission(req, res, "users.bulk")) return
  const parsed = bulkUsersSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = parsed.data
  const confirmed = await ensureSensitiveConfirmation(req, res, "USERS_BULK", data.confirmation)
  if (!confirmed) return

  const uniqueUserIds = Array.from(new Set(data.userIds.filter(Boolean)))
  if (uniqueUserIds.length === 0) return res.status(400).json({ error: "No users selected" })

  let affected = 0
  await db.$transaction(async (tx: any) => {
    if (data.operation === "BAN") {
      const result = await tx.user.updateMany({
        where: { id: { in: uniqueUserIds } },
        data: { banned: true, bannedReason: data.reason || "Bulk action by administrator" },
      })
      affected = result.count || 0
    } else if (data.operation === "UNBAN") {
      const result = await tx.user.updateMany({
        where: { id: { in: uniqueUserIds } },
        data: { banned: false, bannedReason: null },
      })
      affected = result.count || 0
    } else if (data.operation === "SET_ROLE") {
      if (!data.role) throw new Error("Role is required for SET_ROLE")
      const result = await tx.user.updateMany({
        where: { id: { in: uniqueUserIds } },
        data: { role: data.role },
      })
      affected = result.count || 0
    } else if (data.operation === "ASSIGN_CLASS") {
      if (!data.classId) throw new Error("classId is required for ASSIGN_CLASS")
      for (const userId of uniqueUserIds) {
        await tx.classEnrollment.upsert({
          where: { classId_userId: { classId: data.classId, userId } },
          create: { classId: data.classId, userId, status: "active" },
          update: { status: "active" },
        })
        affected += 1
      }
    } else if (data.operation === "REMOVE_CLASS") {
      if (!data.classId) throw new Error("classId is required for REMOVE_CLASS")
      const result = await tx.classEnrollment.deleteMany({
        where: { classId: data.classId, userId: { in: uniqueUserIds } },
      })
      affected = result.count || 0
    }
  }).catch((error: any) => {
    res.status(400).json({ error: error?.message || "Bulk operation failed" })
  })
  if (res.headersSent) return

  await writeAdminAuditLog(db, {
    actorId: req.user!.id,
    action: "USERS_BULK",
    entityType: "USER",
    reason: data.confirmation?.reason || data.reason || null,
    metadata: { operation: data.operation, affected, userIds: uniqueUserIds, role: data.role, classId: data.classId },
  })

  res.json({ success: true, affected })
})

router.get("/notification-templates", async (req: AuthenticatedRequest, res: Response) => {
  if (!ensurePermission(req, res, "notifications.templates")) return
  const templates = await db.notificationTemplate.findMany({
    orderBy: [{ key: "asc" }, { version: "desc" }],
    take: 200,
  })
  res.json({ templates })
})

router.post("/notification-templates/seed-defaults", async (req: AuthenticatedRequest, res: Response) => {
  if (!ensurePermission(req, res, "notifications.templates")) return
  const created: any[] = []
  for (const item of notificationTemplateSeedData) {
    const row = await db.notificationTemplate.upsert({
      where: { key: item.key },
      create: {
        key: item.key,
        channel: item.channel,
        titleTemplate: item.titleTemplate,
        messageTemplate: item.messageTemplate,
        description: item.description,
        isActive: true,
        createdById: req.user!.id,
        updatedById: req.user!.id,
      },
      update: {
        channel: item.channel,
        titleTemplate: item.titleTemplate,
        messageTemplate: item.messageTemplate,
        description: item.description,
        isActive: true,
        updatedById: req.user!.id,
        version: { increment: 1 },
      },
    })
    created.push(row)
  }

  await writeAdminAuditLog(db, {
    actorId: req.user!.id,
    action: "NOTIFICATION_TEMPLATE_SEEDED",
    entityType: "NOTIFICATION_TEMPLATE",
    metadata: { count: created.length, keys: created.map((t: any) => t.key) },
  })

  res.json({ success: true, templates: created })
})

router.post("/notification-templates", async (req: AuthenticatedRequest, res: Response) => {
  if (!ensurePermission(req, res, "notifications.templates")) return
  const parsed = upsertNotificationTemplateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = parsed.data

  const created = await db.notificationTemplate.create({
    data: {
      key: data.key,
      channel: data.channel || "IN_APP",
      titleTemplate: data.titleTemplate,
      messageTemplate: data.messageTemplate,
      description: data.description || null,
      isActive: data.isActive ?? true,
      createdById: req.user!.id,
      updatedById: req.user!.id,
    },
  }).catch((error: any) => {
    if (error?.code === "P2002") return null
    throw error
  })
  if (!created) return res.status(409).json({ error: "Template key already exists" })

  await writeAdminAuditLog(db, {
    actorId: req.user!.id,
    action: "NOTIFICATION_TEMPLATE_CREATE",
    entityType: "NOTIFICATION_TEMPLATE",
    entityId: created.id,
    metadata: { key: created.key },
  })

  res.status(201).json({ success: true, template: created })
})

router.put("/notification-templates/:id", async (req: AuthenticatedRequest, res: Response) => {
  if (!ensurePermission(req, res, "notifications.templates")) return
  const { id } = req.params
  const parsed = upsertNotificationTemplateSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = parsed.data

  const updated = await db.notificationTemplate.update({
    where: { id },
    data: {
      channel: data.channel,
      titleTemplate: data.titleTemplate,
      messageTemplate: data.messageTemplate,
      description: data.description,
      isActive: data.isActive,
      updatedById: req.user!.id,
      version: { increment: 1 },
    },
  }).catch(() => null)
  if (!updated) return res.status(404).json({ error: "Template not found" })

  await writeAdminAuditLog(db, {
    actorId: req.user!.id,
    action: "NOTIFICATION_TEMPLATE_UPDATE",
    entityType: "NOTIFICATION_TEMPLATE",
    entityId: updated.id,
    metadata: { key: updated.key, version: updated.version },
  })

  res.json({ success: true, template: updated })
})

router.post("/notification-templates/:id/render", async (req: AuthenticatedRequest, res: Response) => {
  if (!ensurePermission(req, res, "notifications.templates")) return
  const { id } = req.params
  const vars = (req.body?.variables || {}) as Record<string, any>
  const template = await db.notificationTemplate.findUnique({ where: { id } })
  if (!template) return res.status(404).json({ error: "Template not found" })

  const title = renderTemplateString(template.titleTemplate, vars)
  const message = renderTemplateString(template.messageTemplate, vars)
  res.json({ title, message })
})

const userRoleEnum = z.enum(["USER", "STUDENT", "PARENT", "MENTOR", "ADMIN", "GUEST"])

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  role: userRoleEnum.optional(),
  parentId: z.string().nullable().optional(),
  phone: z.string().trim().max(32).optional()
})

const updateUserSchema = z.object({
  role: userRoleEnum.optional(),
  parentId: z.string().nullable().optional(),
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  banned: z.boolean().optional(),
  bannedReason: z.string().nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  confirmation: sensitiveConfirmationSchema.optional(),
})

const updateUserRoleSchema = z.object({
  role: userRoleEnum,
  confirmation: sensitiveConfirmationSchema.optional(),
})

const banUserSchema = z.object({
  reason: z.string().trim().max(300).optional(),
  confirmation: sensitiveConfirmationSchema.optional(),
})

const assignUserClassSchema = z.object({
  classId: z.string().min(1),
  status: z.string().optional(),
  confirmation: sensitiveConfirmationSchema.optional(),
})

const ensureParentCandidate = async (parentId: string | null | undefined, userIdToExclude?: string) => {
  if (!parentId) return null
  if (userIdToExclude && parentId === userIdToExclude) {
    throw new Error("User cannot be their own parent")
  }
  const parentUser = await db.user.findUnique({
    where: { id: parentId },
    select: { id: true, role: true }
  })
  if (!parentUser) {
    throw new Error("Parent user not found")
  }
  if (parentUser.role !== "PARENT") {
    throw new Error("Linked parent must have PARENT role")
  }
  return parentUser
}

// GET /api/admin/users
// Query: search, role, page, limit
router.get("/users", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "users.read")) return
    const { search, role, page = "1", limit = "20" } = req.query as any
    const skip = (Number(page) - 1) * Number(limit)
    const take = Number(limit)

    const where: any = {}

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ]
    }

    if (role) {
      where.role = role.toUpperCase()
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          banned: true,
          bannedReason: true,
          createdAt: true,
          parentId: true,
          profile: { select: { phone: true } },
          parent: {
            select: { id: true, fullName: true, email: true }
          },
          children: {
            select: { id: true, fullName: true, email: true }
          }
        }
      }),
      db.user.count({ where })
    ])

    res.json({ users, total, page: Number(page), totalPages: Math.ceil(total / take) })
  } catch (error) {
    console.error("Admin Users Error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /api/admin/users
// Create user by admin
router.post("/users", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "users.write")) return
    const parsed = createUserSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const data = parsed.data

    const existing = await db.user.findUnique({ where: { email: data.email }, select: { id: true } })
    if (existing) return res.status(409).json({ error: "Email already in use" })

    await ensureParentCandidate(data.parentId)

    const passwordHash = await hashPassword(data.password)
    const created = await db.user.create({
      data: {
        email: data.email,
        passwordHash,
        fullName: data.fullName.trim(),
        role: data.role || "USER",
        parentId: data.parentId || null,
        emailVerified: true,
        profile: { create: { phone: data.phone || null } }
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        banned: true,
        bannedReason: true,
        parentId: true,
        profile: { select: { phone: true } },
        createdAt: true
      }
    })

    await writeAdminAuditLog(db, {
      actorId: req.user!.id,
      action: "USER_CREATE",
      entityType: "USER",
      entityId: created.id,
      targetUserId: created.id,
      metadata: { role: created.role, email: created.email },
    })

    res.status(201).json({ success: true, user: created })
  } catch (error: any) {
    if (error?.message === "Parent user not found" || error?.message === "Linked parent must have PARENT role") {
      return res.status(400).json({ error: error.message })
    }
    console.error("Admin Create User Error:", error)
    res.status(500).json({ error: "Failed to create user" })
  }
})

// PUT /api/admin/users/:id
// Update role, parentId, profile fields
router.put("/users/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "users.write")) return
    const { id } = req.params
    const parsed = updateUserSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const data = parsed.data

    if (typeof data.role !== "undefined") {
      if (!ensurePermission(req, res, "users.roles")) return
      const confirmed = await maybeEnsureSensitiveConfirmation(req, res, "USER_ROLE_CHANGE", data.confirmation)
      if (!confirmed) return
    }

    if (typeof data.banned === "boolean") {
      if (!ensurePermission(req, res, "users.ban")) return
      const confirmed = await maybeEnsureSensitiveConfirmation(
        req,
        res,
        data.banned ? "USER_BAN" : "USER_UNBAN",
        data.confirmation
      )
      if (!confirmed) return
    }

    await ensureParentCandidate(data.parentId, id)

    const updateData: any = {}
    if (data.role) updateData.role = data.role
    if (typeof data.parentId !== "undefined") updateData.parentId = data.parentId
    if (data.fullName) updateData.fullName = data.fullName.trim()
    if (data.email) updateData.email = data.email
    if (typeof data.banned === "boolean") updateData.banned = data.banned
    if (typeof data.bannedReason !== "undefined") updateData.bannedReason = data.bannedReason || null

    const user = await db.$transaction(async (tx: any) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          banned: true,
          bannedReason: true,
          parentId: true
        }
      })
      if (typeof data.phone !== "undefined") {
        await tx.userProfile.upsert({
          where: { userId: id },
          update: { phone: data.phone || null },
          create: { userId: id, phone: data.phone || null }
        })
      }
      return updatedUser
    })

    await writeAdminAuditLog(db, {
      actorId: req.user!.id,
      action: "USER_UPDATE",
      entityType: "USER",
      entityId: id,
      targetUserId: id,
      reason: data.confirmation?.reason || null,
      metadata: {
        fullName: data.fullName,
        email: data.email,
        role: data.role,
        parentId: data.parentId,
        banned: data.banned,
      },
    })

    res.json({ success: true, user })
  } catch (error: any) {
    if (error?.message === "Parent user not found" || error?.message === "Linked parent must have PARENT role" || error?.message === "User cannot be their own parent") {
      return res.status(400).json({ error: error.message })
    }
    if (error?.code === "P2002") {
      return res.status(409).json({ error: "Email already in use" })
    }
    console.error("Admin Update User Error:", error)
    res.status(500).json({ error: "Failed to update user" })
  }
})

// POST /api/admin/users/:id/role
router.post("/users/:id/role", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "users.roles")) return
    const { id } = req.params
    const parsed = updateUserRoleSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const confirmed = await maybeEnsureSensitiveConfirmation(req, res, "USER_ROLE_CHANGE", parsed.data.confirmation)
    if (!confirmed) return

    const user = await db.user.update({
      where: { id },
      data: { role: parsed.data.role },
      select: { id: true, role: true }
    })

    await writeAdminAuditLog(db, {
      actorId: req.user!.id,
      action: "USER_ROLE_CHANGE",
      entityType: "USER",
      entityId: id,
      targetUserId: id,
      reason: parsed.data.confirmation?.reason || null,
      metadata: { role: parsed.data.role },
    })

    res.json({ success: true, user })
  } catch (error) {
    console.error("Admin Update User Role Error:", error)
    res.status(500).json({ error: "Failed to update role" })
  }
})

// POST /api/admin/users/:id/ban
router.post("/users/:id/ban", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "users.ban")) return
    const { id } = req.params
    const parsed = banUserSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const confirmed = await maybeEnsureSensitiveConfirmation(req, res, "USER_BAN", parsed.data.confirmation)
    if (!confirmed) return
    const reason = parsed.data.reason || "Banned by administrator"

    const user = await db.user.update({
      where: { id },
      data: { banned: true, bannedReason: reason },
      select: { id: true, banned: true, bannedReason: true }
    })

    await writeAdminAuditLog(db, {
      actorId: req.user!.id,
      action: "USER_BAN",
      entityType: "USER",
      entityId: id,
      targetUserId: id,
      reason: parsed.data.confirmation?.reason || reason,
    })

    res.json({ success: true, user })
  } catch (error) {
    console.error("Admin Ban User Error:", error)
    res.status(500).json({ error: "Failed to ban user" })
  }
})

// POST /api/admin/users/:id/unban
router.post("/users/:id/unban", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "users.ban")) return
    const { id } = req.params
    const parsed = banUserSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const confirmed = await maybeEnsureSensitiveConfirmation(req, res, "USER_UNBAN", parsed.data.confirmation)
    if (!confirmed) return
    const user = await db.user.update({
      where: { id },
      data: { banned: false, bannedReason: null },
      select: { id: true, banned: true, bannedReason: true }
    })

    await writeAdminAuditLog(db, {
      actorId: req.user!.id,
      action: "USER_UNBAN",
      entityType: "USER",
      entityId: id,
      targetUserId: id,
      reason: parsed.data.confirmation?.reason || null,
    })

    res.json({ success: true, user })
  } catch (error) {
    console.error("Admin Unban User Error:", error)
    res.status(500).json({ error: "Failed to unban user" })
  }
})

// POST /api/admin/users/:id/classes
router.post("/users/:id/classes", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "users.classes")) return
    const { id } = req.params
    const parsed = assignUserClassSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const data = parsed.data

    const [user, cls] = await Promise.all([
      db.user.findUnique({ where: { id }, select: { id: true } }),
      db.clubClass.findUnique({ where: { id: data.classId }, select: { id: true, isActive: true } })
    ])
    if (!user) return res.status(404).json({ error: "User not found" })
    if (!cls) return res.status(404).json({ error: "Class not found" })

    const enrollment = await db.classEnrollment.upsert({
      where: { classId_userId: { classId: data.classId, userId: id } },
      create: { classId: data.classId, userId: id, status: data.status || "active" },
      update: { status: data.status || "active" }
    })

    await writeAdminAuditLog(db, {
      actorId: req.user!.id,
      action: "USER_CLASS_ASSIGN",
      entityType: "CLASS_ENROLLMENT",
      entityId: enrollment.id,
      targetUserId: id,
      reason: data.confirmation?.reason || null,
      metadata: { classId: data.classId, status: data.status || "active" },
    })

    res.status(201).json({ success: true, enrollment })
  } catch (error) {
    console.error("Admin Assign User Class Error:", error)
    res.status(500).json({ error: "Failed to assign class" })
  }
})

// DELETE /api/admin/users/:id/classes/:classId
router.delete("/users/:id/classes/:classId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "users.classes")) return
    const { id, classId } = req.params
    await db.classEnrollment.deleteMany({ where: { userId: id, classId } })

    await writeAdminAuditLog(db, {
      actorId: req.user!.id,
      action: "USER_CLASS_REMOVE",
      entityType: "CLASS_ENROLLMENT",
      entityId: classId,
      targetUserId: id,
      metadata: { classId },
    })

    res.json({ success: true })
  } catch (error) {
    console.error("Admin Remove User Class Error:", error)
    res.status(500).json({ error: "Failed to remove class enrollment" })
  }
})

const adminGroupSchema = z.object({
  kruzhokId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  maxStudents: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  mentorId: z.string().optional(), // New field
  wagePerLesson: z.number().int().optional(),
  scheduleDescription: z.string().optional()
})

const adminGroupUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  maxStudents: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  mentorId: z.string().optional(), // New field
  wagePerLesson: z.number().int().optional(),
  scheduleDescription: z.string().optional()
})

// ============ KRUZHOK (CLUBS) CRUD ============

const kruzhokSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  programId: z.string().optional(),
  isActive: z.boolean().optional(),
  isFree: z.boolean().optional(),
  price: z.number().optional()
})

// GET /api/admin/kruzhoks - List all kruzhoks
router.get("/kruzhoks", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const kruzhoks = await db.kruzhok.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        programId: true,
        program: { select: { id: true, title: true } },
        isActive: true,
        isFree: true,
        price: true,
        ownerId: true,
        owner: { select: { id: true, fullName: true, email: true } },
        _count: { select: { classes: true, subscriptions: true } },
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    })
    res.json(kruzhoks)
  } catch (error) {
    console.error("Admin Kruzhoks Error:", error)
    res.status(500).json({ error: "Failed to load kruzhoks" })
  }
})

// GET /api/admin/kruzhoks/:id - Get single kruzhok
router.get("/kruzhoks/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const kruzhok = await db.kruzhok.findUnique({
      where: { id },
      include: {
        program: { select: { id: true, title: true } },
        owner: { select: { id: true, fullName: true, email: true } },
        classes: {
          select: { id: true, name: true, isActive: true, _count: { select: { enrollments: true } } }
        }
      }
    })
    if (!kruzhok) return res.status(404).json({ error: "Kruzhok not found" })
    res.json(kruzhok)
  } catch (error) {
    console.error("Admin Kruzhok Detail Error:", error)
    res.status(500).json({ error: "Failed to load kruzhok" })
  }
})

// POST /api/admin/kruzhoks - Create kruzhok
router.post("/kruzhoks", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = kruzhokSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const data = parsed.data
    const created = await db.kruzhok.create({
      data: {
        title: data.title,
        description: data.description,
        programId: data.programId || null,
        isActive: data.isActive ?? true,
        isFree: data.isFree ?? false,
        price: data.price ?? 0,
        ownerId: req.user!.id // Admin becomes owner by default
      },
      include: {
        program: { select: { id: true, title: true } },
        owner: { select: { id: true, fullName: true } }
      }
    })
    res.status(201).json(created)
  } catch (error) {
    console.error("Admin Kruzhok Create Error:", error)
    res.status(500).json({ error: "Failed to create kruzhok" })
  }
})

// PUT /api/admin/kruzhoks/:id - Update kruzhok
router.put("/kruzhoks/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const parsed = kruzhokSchema.partial().safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const data = parsed.data
    const updated = await db.kruzhok.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        programId: data.programId,
        isActive: data.isActive,
        isFree: data.isFree,
        price: data.price
      },
      include: {
        program: { select: { id: true, title: true } },
        owner: { select: { id: true, fullName: true } }
      }
    })
    res.json(updated)
  } catch (error) {
    console.error("Admin Kruzhok Update Error:", error)
    res.status(500).json({ error: "Failed to update kruzhok" })
  }
})

// DELETE /api/admin/kruzhoks/:id - Delete kruzhok
router.delete("/kruzhoks/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    await db.kruzhok.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    console.error("Admin Kruzhok Delete Error:", error)
    res.status(500).json({ error: "Failed to delete kruzhok. It may have related classes or schedules." })
  }
})

// ============ PROGRAMS CRUD ============

const programSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional()
})

// GET /api/admin/programs - List all programs
router.get("/programs", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const programs = await db.kruzhokProgram.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        isActive: true,
        _count: { select: { kruzhoks: true, lessons: true } },
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    })
    res.json(programs)
  } catch (error) {
    console.error("Admin Programs Error:", error)
    res.status(500).json({ error: "Failed to load programs" })
  }
})

// GET /api/admin/programs/:id - Get single program with lesson templates
router.get("/programs/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const program = await db.kruzhokProgram.findUnique({
      where: { id },
      include: {
        lessons: {
          orderBy: { orderIndex: "asc" },
          select: { id: true, title: true, orderIndex: true, content: true }
        },
        kruzhoks: {
          select: { id: true, title: true, isActive: true }
        }
      }
    })
    if (!program) return res.status(404).json({ error: "Program not found" })
    res.json(program)
  } catch (error) {
    console.error("Admin Program Detail Error:", error)
    res.status(500).json({ error: "Failed to load program" })
  }
})

// POST /api/admin/programs - Create program
router.post("/programs", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = programSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const data = parsed.data
    const created = await db.kruzhokProgram.create({
      data: {
        title: data.title,
        description: data.description,
        isActive: data.isActive ?? true
      }
    })
    res.status(201).json(created)
  } catch (error) {
    console.error("Admin Program Create Error:", error)
    res.status(500).json({ error: "Failed to create program" })
  }
})

// PUT /api/admin/programs/:id - Update program
router.put("/programs/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const parsed = programSchema.partial().safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const data = parsed.data
    const updated = await db.kruzhokProgram.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        isActive: data.isActive
      }
    })
    res.json(updated)
  } catch (error) {
    console.error("Admin Program Update Error:", error)
    res.status(500).json({ error: "Failed to update program" })
  }
})

// DELETE /api/admin/programs/:id - Delete program
router.delete("/programs/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    await db.kruzhokProgram.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    console.error("Admin Program Delete Error:", error)
    res.status(500).json({ error: "Failed to delete program. It may be used by kruzhoks." })
  }
})

// GET /api/admin/groups
// List classes
router.get("/groups", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const groups = await db.clubClass.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        maxStudents: true,
        isActive: true,
        kruzhokId: true,
        kruzhok: { select: { id: true, title: true } },
        mentorId: true,
        mentor: { select: { id: true, fullName: true, email: true } },
        wagePerLesson: true,
        scheduleDescription: true,
        _count: { select: { enrollments: true } }
      },
      orderBy: { createdAt: "desc" }
    })

    res.json({ groups })
  } catch (error) {
    console.error("Admin Groups Error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/admin/groups/:id
// Group details with students
router.get("/groups/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const group = await db.clubClass.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        maxStudents: true,
        isActive: true,
        kruzhokId: true,
        kruzhok: { select: { id: true, title: true } },
        mentorId: true,
        wagePerLesson: true,
        scheduleDescription: true,
        mentor: { select: { id: true, fullName: true, email: true } },
        enrollments: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            user: { select: { id: true, fullName: true, email: true } }
          }
        }
      }
    })

    if (!group) return res.status(404).json({ error: "Group not found" })
    res.json(group)
  } catch (error) {
    console.error("Admin Group Detail Error:", error)
    res.status(500).json({ error: "Failed to load group detail" })
  }
})

// POST /api/admin/groups
// Create group
router.post("/groups", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = adminGroupSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const data = parsed.data
    const last = await db.clubClass.findFirst({
      where: { kruzhokId: data.kruzhokId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true }
    })
    const orderIndex = (last?.orderIndex ?? -1) + 1
    const created = await db.clubClass.create({
      data: {
        kruzhokId: data.kruzhokId,
        name: data.name,
        description: data.description,
        maxStudents: data.maxStudents ?? 30,
        isActive: data.isActive ?? true,
        orderIndex,
        createdById: req.user!.id,
        mentorId: data.mentorId,
        wagePerLesson: data.wagePerLesson ?? 0,
        scheduleDescription: data.scheduleDescription
      },
      select: {
        id: true,
        name: true,
        description: true,
        maxStudents: true,
        isActive: true,
        kruzhokId: true,
        kruzhok: { select: { id: true, title: true } },
        mentorId: true,
        mentor: { select: { id: true, fullName: true } },
        wagePerLesson: true,
        scheduleDescription: true,
        _count: { select: { enrollments: true } }
      }
    })
    res.status(201).json(created)
  } catch (error) {
    console.error("Admin Group Create Error:", error)
    res.status(500).json({ error: "Failed to create group" })
  }
})

// PUT /api/admin/groups/:id
// Update group
router.put("/groups/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const parsed = adminGroupUpdateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const data = parsed.data
    if (!Object.keys(data).length) return res.status(400).json({ error: "No updates provided" })

    const existing = await db.clubClass.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        scheduleDescription: true,
        enrollments: {
          select: {
            userId: true,
            user: { select: { id: true, fullName: true, parentId: true } }
          }
        }
      }
    })

    const updated = await db.clubClass.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        maxStudents: data.maxStudents,
        isActive: data.isActive,
        mentorId: data.mentorId,
        wagePerLesson: data.wagePerLesson,
        scheduleDescription: data.scheduleDescription
      },
      select: {
        id: true,
        name: true,
        description: true,
        maxStudents: true,
        isActive: true,
        kruzhokId: true,
        kruzhok: { select: { id: true, title: true } },
        mentorId: true,
        mentor: { select: { id: true, fullName: true } },
        wagePerLesson: true,
        scheduleDescription: true,
        _count: { select: { enrollments: true } }
      }
    })

    try {
      const scheduleWasProvided = Object.prototype.hasOwnProperty.call(data, "scheduleDescription")
      const prevSchedule = existing?.scheduleDescription || ""
      const nextSchedule = scheduleWasProvided ? (data.scheduleDescription || "") : prevSchedule
      const scheduleChanged = scheduleWasProvided && prevSchedule !== nextSchedule
      if (scheduleChanged && existing?.enrollments?.length) {
        const nextLabel = nextSchedule || "СѓС‚РѕС‡РЅСЏРµС‚СЃСЏ"
        const notifications: Array<{ userId: string; title: string; message: string; type: string }> = []
        existing.enrollments.forEach((enr: any) => {
          if (enr.userId) {
            notifications.push({
              userId: enr.userId,
              title: "РР·РјРµРЅРёР»РѕСЃСЊ СЂР°СЃРїРёСЃР°РЅРёРµ",
              message: `Р“СЂСѓРїРїР° "${existing.name}" С‚РµРїРµСЂСЊ: ${nextLabel}.`,
              type: "schedule"
            })
          }
          const parentId = enr.user?.parentId
          if (parentId) {
            const studentName = enr.user?.fullName || "Р’Р°С€ СЂРµР±С‘РЅРѕРє"
            notifications.push({
              userId: parentId,
              title: "РР·РјРµРЅРёР»РѕСЃСЊ СЂР°СЃРїРёСЃР°РЅРёРµ СЂРµР±С‘РЅРєР°",
              message: `${studentName}: РіСЂСѓРїРїР° "${existing.name}" С‚РµРїРµСЂСЊ ${nextLabel}.`,
              type: "schedule"
            })
          }
        })
        if (notifications.length) {
          await db.notification.createMany({ data: notifications })
        }
      }
    } catch (notifyError) {
      console.error("Admin Group Schedule Notify Error:", notifyError)
    }

    res.json(updated)
  } catch (error) {
    console.error("Admin Group Update Error:", error)
    res.status(500).json({ error: "Failed to update group" })
  }
})

// DELETE /api/admin/groups/:id
router.delete("/groups/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    await db.clubClass.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    console.error("Admin Group Delete Error:", error)
    res.status(500).json({ error: "Failed to delete group" })
  }
})

// POST /api/admin/groups/:id/assign
// Add student
router.post("/groups/:id/assign", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const { studentId } = req.body

    if (!studentId) return res.status(400).json({ error: "Missing studentId" })

    const student = await db.user.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, parentId: true }
    })
    if (!student) return res.status(404).json({ error: "Student not found" })

    const group = await db.clubClass.findUnique({
      where: { id },
      select: { id: true, name: true }
    })

    await db.classEnrollment.upsert({
      where: { classId_userId: { classId: id, userId: studentId } },
      create: { classId: id, userId: studentId, status: "active" },
      update: { status: "active" }
    })

    try {
      if (group) {
        const notifications: Array<{ userId: string; title: string; message: string; type: string }> = [
          {
            userId: student.id,
            title: "Р’С‹ РґРѕР±Р°РІР»РµРЅС‹ РІ РіСЂСѓРїРїСѓ",
            message: `Р’С‹ РґРѕР±Р°РІР»РµРЅС‹ РІ РіСЂСѓРїРїСѓ "${group.name}".`,
            type: "group"
          }
        ]
        if (student.parentId) {
          notifications.push({
            userId: student.parentId,
            title: "Р РµР±С‘РЅРѕРє РґРѕР±Р°РІР»РµРЅ РІ РіСЂСѓРїРїСѓ",
            message: `${student.fullName || "Р’Р°С€ СЂРµР±С‘РЅРѕРє"} РґРѕР±Р°РІР»РµРЅ(Р°) РІ РіСЂСѓРїРїСѓ "${group.name}".`,
            type: "group"
          })
        }
        await db.notification.createMany({ data: notifications })
      }
    } catch (notifyError) {
      console.error("Assign Student Notify Error:", notifyError)
    }

    res.json({ success: true })
  } catch (error) {
    console.error("Assign Student Error:", error)
    res.status(500).json({ error: "Failed to assign student" })
  }
})

// POST /api/admin/groups/:id/remove
// Remove student
router.post("/groups/:id/remove", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const { studentId } = req.body

    if (!studentId) return res.status(400).json({ error: "Missing studentId" })

    const student = await db.user.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, parentId: true }
    })
    const group = await db.clubClass.findUnique({
      where: { id },
      select: { id: true, name: true }
    })

    await db.classEnrollment.deleteMany({
      where: { classId: id, userId: studentId }
    })

    try {
      if (student && group) {
        const notifications: Array<{ userId: string; title: string; message: string; type: string }> = [
          {
            userId: student.id,
            title: "Р’С‹ РёСЃРєР»СЋС‡РµРЅС‹ РёР· РіСЂСѓРїРїС‹",
            message: `Р’С‹ Р±РѕР»СЊС€Рµ РЅРµ СЃРѕСЃС‚РѕРёС‚Рµ РІ РіСЂСѓРїРїРµ "${group.name}".`,
            type: "group"
          }
        ]
        if (student.parentId) {
          notifications.push({
            userId: student.parentId,
            title: "Р РµР±С‘РЅРѕРє РёСЃРєР»СЋС‡С‘РЅ РёР· РіСЂСѓРїРїС‹",
            message: `${student.fullName || "Р’Р°С€ СЂРµР±С‘РЅРѕРє"} Р±РѕР»СЊС€Рµ РЅРµ РІ РіСЂСѓРїРїРµ "${group.name}".`,
            type: "group"
          })
        }
        await db.notification.createMany({ data: notifications })
      }
    } catch (notifyError) {
      console.error("Remove Student Notify Error:", notifyError)
    }

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Failed to remove student" })
  }
})

// POST /api/admin/groups/:id/set-mentor
router.post("/groups/:id/set-mentor", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const { mentorId } = req.body

    const group = await db.clubClass.update({
      where: { id },
      data: { mentorId: mentorId || null },
      select: { id: true, mentorId: true, mentor: { select: { id: true, fullName: true } } }
    })

    res.json(group)
  } catch (error) {
    console.error("Admin Group Set Mentor Error:", error)
    res.status(500).json({ error: "Failed to set mentor" })
  }
})

// POST /api/admin/groups/:id/migrate-student
router.post("/groups/:id/migrate-student", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const payload = z.object({
      studentId: z.string().min(1),
      targetClassId: z.string().min(1)
    }).safeParse(req.body)
    if (!payload.success) return res.status(400).json({ error: payload.error.flatten() })
    const { studentId, targetClassId } = payload.data
    if (targetClassId === id) return res.status(400).json({ error: "Target class must be different." })

    const student = await db.user.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, parentId: true }
    })
    if (!student) return res.status(404).json({ error: "Student not found" })

    const sourceGroup = await db.clubClass.findUnique({
      where: { id },
      select: { id: true, name: true }
    })
    if (!sourceGroup) return res.status(404).json({ error: "Source group not found" })

    const targetGroup = await db.clubClass.findUnique({
      where: { id: targetClassId },
      select: { id: true, name: true, kruzhok: { select: { title: true } } }
    })
    if (!targetGroup) return res.status(404).json({ error: "Target group not found" })

    const existing = await db.classEnrollment.findUnique({
      where: { classId_userId: { classId: id, userId: studentId } }
    })
    if (!existing) return res.status(404).json({ error: "Student is not enrolled in the source group" })

    await db.$transaction([
      db.classEnrollment.delete({ where: { classId_userId: { classId: id, userId: studentId } } }),
      db.classEnrollment.upsert({
        where: { classId_userId: { classId: targetClassId, userId: studentId } },
        create: { classId: targetClassId, userId: studentId, status: "active" },
        update: { status: "active" }
      })
    ])

    if (student.parentId) {
      await db.notification.create({
        data: {
          userId: student.parentId,
          title: "Student moved to a new group",
          message: `${student.fullName} moved from "${sourceGroup.name}" to "${targetGroup.name}" (${targetGroup.kruzhok?.title || "Club"}).`,
          type: "migration"
        }
      })
    }

    res.json({ success: true })
  } catch (error) {
    console.error("Admin Migrate Student Error:", error)
    res.status(500).json({ error: "Failed to migrate student" })
  }
})

// GET /api/admin/analytics/groups - Group attendance/performance drilldown
router.get("/analytics/groups", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date()
    const fromRaw = String(req.query.from || "")
    const toRaw = String(req.query.to || "")
    const from = fromRaw ? new Date(fromRaw) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const to = toRaw ? new Date(toRaw) : now

    const schedules = await db.schedule.findMany({
      where: {
        classId: { not: null },
        scheduledDate: { gte: from, lte: to }
      },
      select: {
        id: true,
        classId: true,
        status: true,
        scheduledDate: true,
        scheduledTime: true,
        completedAt: true,
        class: {
          select: {
            id: true,
            name: true,
            isActive: true,
            kruzhok: { select: { title: true } }
          }
        },
        attendances: { select: { status: true, grade: true } }
      }
    })

    const groupMap = new Map<string, any>()
    for (const s of schedules || []) {
      if (!s.classId || !s.class) continue
      const key = s.classId
      const entry = groupMap.get(key) || {
        id: s.class.id,
        name: s.class.name,
        kruzhokTitle: s.class.kruzhok?.title || "",
        isActive: s.class.isActive !== false,
        lessonsTotal: 0,
        lessonsCompleted: 0,
        attendanceTotal: 0,
        present: 0,
        late: 0,
        absent: 0,
        gradeSum: 0,
        gradeCount: 0,
        lastLessonDate: null as Date | null
      }

      entry.lessonsTotal += 1
      if (s.status === "COMPLETED") entry.lessonsCompleted += 1
      const lessonDate = s.completedAt || s.scheduledDate
      if (!entry.lastLessonDate || (lessonDate && lessonDate > entry.lastLessonDate)) {
        entry.lastLessonDate = lessonDate || entry.lastLessonDate
      }

      for (const a of s.attendances || []) {
        entry.attendanceTotal += 1
        if (a.status === "PRESENT") entry.present += 1
        if (a.status === "LATE") entry.late += 1
        if (a.status === "ABSENT") entry.absent += 1
        if (typeof a.grade === "number") {
          entry.gradeSum += a.grade
          entry.gradeCount += 1
        }
      }

      groupMap.set(key, entry)
    }

    const groups = Array.from(groupMap.values()).map((g: any) => ({
      id: g.id,
      name: g.name,
      kruzhokTitle: g.kruzhokTitle,
      isActive: g.isActive,
      lessonsTotal: g.lessonsTotal,
      lessonsCompleted: g.lessonsCompleted,
      attendanceTotal: g.attendanceTotal,
      present: g.present,
      late: g.late,
      absent: g.absent,
      averageGrade: g.gradeCount ? Number((g.gradeSum / g.gradeCount).toFixed(2)) : 0,
      lastLessonDate: g.lastLessonDate
    }))

    const scheduleEvents = (schedules || [])
      .filter((s: any) => s.classId && s.class)
      .map((s: any) => ({
        id: s.id,
        classId: s.classId,
        className: s.class?.name || "",
        kruzhokTitle: s.class?.kruzhok?.title || "",
        scheduledDate: s.scheduledDate,
        scheduledTime: s.scheduledTime || "00:00",
        status: s.status
      }))

    res.json({ from, to, groups, schedules: scheduleEvents })
  } catch (error) {
    console.error("Admin Groups Analytics Error:", error)
    res.status(500).json({ error: "Failed to load group analytics" })
  }
})

// GET /api/admin/analytics/groups/:id - Group details with lesson attendance
router.get("/analytics/groups/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const now = new Date()
    const fromRaw = String(req.query.from || "")
    const toRaw = String(req.query.to || "")
    const from = fromRaw ? new Date(fromRaw) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const to = toRaw ? new Date(toRaw) : now

    const cls = await db.clubClass.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true, kruzhok: { select: { title: true } } }
    })
    if (!cls) return res.status(404).json({ error: "Group not found" })

    const schedules = await db.schedule.findMany({
      where: { classId: id, scheduledDate: { gte: from, lte: to } },
      orderBy: { scheduledDate: "desc" },
      select: {
        id: true,
        title: true,
        scheduledDate: true,
        scheduledTime: true,
        status: true,
        attendances: { select: { status: true, grade: true } }
      }
    })

    let present = 0
    let late = 0
    let absent = 0
    let gradeSum = 0
    let gradeCount = 0

    const lessons = (schedules || []).map((s: any) => {
      let lessonPresent = 0
      let lessonLate = 0
      let lessonAbsent = 0
      let lessonGradeSum = 0
      let lessonGradeCount = 0
      for (const a of s.attendances || []) {
        if (a.status === "PRESENT") lessonPresent += 1
        if (a.status === "LATE") lessonLate += 1
        if (a.status === "ABSENT") lessonAbsent += 1
        if (typeof a.grade === "number") {
          lessonGradeSum += a.grade
          lessonGradeCount += 1
        }
      }
      present += lessonPresent
      late += lessonLate
      absent += lessonAbsent
      gradeSum += lessonGradeSum
      gradeCount += lessonGradeCount
      const total = lessonPresent + lessonLate + lessonAbsent
      return {
        id: s.id,
        title: s.title,
        scheduledDate: s.scheduledDate,
        scheduledTime: s.scheduledTime,
        status: s.status,
        attendance: {
          present: lessonPresent,
          late: lessonLate,
          absent: lessonAbsent,
          total,
          averageGrade: lessonGradeCount ? Number((lessonGradeSum / lessonGradeCount).toFixed(2)) : 0
        }
      }
    })

    res.json({
      group: {
        id: cls.id,
        name: cls.name,
        kruzhokTitle: cls.kruzhok?.title || "",
        isActive: cls.isActive !== false
      },
      summary: {
        lessonsTotal: schedules.length,
        lessonsCompleted: schedules.filter((s: any) => s.status === "COMPLETED").length,
        attendanceTotal: present + late + absent,
        present,
        late,
        absent,
        averageGrade: gradeCount ? Number((gradeSum / gradeCount).toFixed(2)) : 0
      },
      lessons
    })
  } catch (error) {
    console.error("Admin Group Detail Error:", error)
    res.status(500).json({ error: "Failed to load group detail" })
  }
})

// GET /api/admin/users/:id/overview - Admin user overview
router.get("/users/:id/overview", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "users.read")) return
    const { id } = req.params
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        banned: true,
        bannedReason: true,
        createdAt: true,
        parentId: true,
        profile: { select: { phone: true } },
        parent: { select: { id: true, fullName: true, email: true, role: true, createdAt: true } },
        children: { select: { id: true, fullName: true, email: true, role: true, createdAt: true } },
      }
    })
    if (!user) return res.status(404).json({ error: "User not found" })

    const registrations = await db.eventRegistration.findMany({
      where: { userId: id },
      include: { event: { select: { id: true, title: true, date: true } } },
      orderBy: { createdAt: "desc" }
    })

    const enrollments = await db.classEnrollment.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        classId: true,
        status: true,
        createdAt: true,
        class: {
          select: {
            id: true,
            name: true,
            isActive: true,
            scheduleDescription: true,
            kruzhok: { select: { id: true, title: true } },
            mentor: { select: { id: true, fullName: true, email: true } },
            _count: { select: { enrollments: true } }
          }
        }
      }
    })

    const attendanceAgg = await db.attendance.groupBy({
      by: ["status"],
      where: { studentId: id },
      _count: { _all: true }
    }).catch(() => [])
    const attendanceMap = new Map((attendanceAgg || []).map((row: any) => [row.status, row._count?._all || 0]))
    const presentCount = Number(attendanceMap.get("PRESENT") || 0)
    const lateCount = Number(attendanceMap.get("LATE") || 0)
    const absentCount = Number(attendanceMap.get("ABSENT") || 0)
    const totalAttendance = presentCount + lateCount + absentCount

    const gradeAgg = await db.attendance.aggregate({
      where: { studentId: id },
      _avg: { grade: true },
      _count: { grade: true }
    }).catch(() => ({ _avg: { grade: null }, _count: { grade: 0 } }))

    const recentAttendance = await db.attendance.findMany({
      where: { studentId: id },
      orderBy: { markedAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        grade: true,
        workSummary: true,
        notes: true,
        markedAt: true,
        schedule: {
          select: {
            id: true,
            title: true,
            scheduledDate: true,
            scheduledTime: true,
            status: true,
            class: {
              select: {
                id: true,
                name: true,
                kruzhok: { select: { id: true, title: true } }
              }
            }
          }
        },
        markedBy: { select: { id: true, fullName: true, email: true } }
      }
    }).catch(() => [])

    let childrenOverview: any[] = []
    if (user.role === "PARENT" && user.children?.length) {
      const childIds = user.children.map((c: any) => c.id)
      const childEnrollments = await db.classEnrollment.findMany({
        where: { userId: { in: childIds } },
        orderBy: { createdAt: "desc" },
        select: {
          userId: true,
          createdAt: true,
          status: true,
          class: {
            select: {
              id: true,
              name: true,
              isActive: true,
              scheduleDescription: true,
              kruzhok: { select: { id: true, title: true } },
              mentor: { select: { id: true, fullName: true } }
            }
          }
        }
      }).catch(() => [])

      const attendanceByChild = await db.attendance.groupBy({
        by: ["studentId", "status"],
        where: { studentId: { in: childIds } },
        _count: { _all: true }
      }).catch(() => [])

      const gradeByChild = await db.attendance.groupBy({
        by: ["studentId"],
        where: { studentId: { in: childIds } },
        _avg: { grade: true },
        _count: { grade: true }
      }).catch(() => [])

      const attendanceMapByChild = new Map<string, { present: number; late: number; absent: number }>()
      for (const row of attendanceByChild || []) {
        const current = attendanceMapByChild.get(row.studentId) || { present: 0, late: 0, absent: 0 }
        if (row.status === "PRESENT") current.present = Number(row._count?._all || 0)
        if (row.status === "LATE") current.late = Number(row._count?._all || 0)
        if (row.status === "ABSENT") current.absent = Number(row._count?._all || 0)
        attendanceMapByChild.set(row.studentId, current)
      }

      const gradeMapByChild = new Map<string, { avg: number; count: number }>()
      for (const row of gradeByChild || []) {
        gradeMapByChild.set(row.studentId, {
          avg: Number(row._avg?.grade || 0),
          count: Number(row._count?.grade || 0)
        })
      }

      const enrollmentsByChild = new Map<string, any[]>()
      for (const enr of childEnrollments || []) {
        const list = enrollmentsByChild.get(enr.userId) || []
        list.push(enr)
        enrollmentsByChild.set(enr.userId, list)
      }

      childrenOverview = user.children.map((child: any) => {
        const attendance = attendanceMapByChild.get(child.id) || { present: 0, late: 0, absent: 0 }
        const grades = gradeMapByChild.get(child.id) || { avg: 0, count: 0 }
        const childClasses = enrollmentsByChild.get(child.id) || []
        const total = attendance.present + attendance.late + attendance.absent
        return {
          child,
          classes: childClasses,
          attendance: { ...attendance, total },
          grades
        }
      })
    }

    let mentorStats: any = null
    if (user.role === "MENTOR") {
      const [reviewAgg, reviews, lessonsCompleted, classesMentored] = await Promise.all([
        db.mentorReview.aggregate({ where: { mentorId: id }, _avg: { rating: true }, _count: { rating: true } }),
        db.mentorReview.findMany({
          where: { mentorId: id },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            student: { select: { id: true, fullName: true } },
            schedule: { select: { id: true, title: true, scheduledDate: true } }
          }
        }),
        db.schedule.count({ where: { createdById: id, status: "COMPLETED" } }),
        db.clubClass.findMany({
          where: { mentorId: id },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            isActive: true,
            scheduleDescription: true,
            kruzhok: { select: { id: true, title: true } },
            _count: { select: { enrollments: true } }
          }
        }).catch(() => [])
      ])
      mentorStats = {
        ratingAvg: Number(reviewAgg?._avg?.rating || 0),
        ratingCount: Number(reviewAgg?._count?.rating || 0),
        lessonsCompleted,
        recentReviews: reviews,
        classesMentored
      }
    }

    res.json({
      user,
      registrations,
      enrollments,
      attendance: {
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        total: totalAttendance,
        averageGrade: Number(gradeAgg?._avg?.grade || 0),
        gradedCount: Number(gradeAgg?._count?.grade || 0)
      },
      recentAttendance,
      childrenOverview,
      mentorStats
    })
  } catch (error) {
    console.error("Admin User Overview Error:", error)
    res.status(500).json({ error: "Failed to load overview" })
  }
})

// ============ ADMIN BYTESIZE ============ 
const bytesizeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  videoUrl: z.string().min(1),
  coverImageUrl: z.string().optional(),
  tags: z.array(z.string()).optional()
})

router.get("/bytesize", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const items = await db.byteSizeItem.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { likes: true } } }
    })
    res.json(items)
  } catch (error) {
    console.error("Admin ByteSize Error:", error)
    res.status(500).json({ error: "Failed to load bytesize items" })
  }
})

router.post("/bytesize", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = bytesizeSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const created = await db.byteSizeItem.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        videoUrl: parsed.data.videoUrl,
        coverImageUrl: parsed.data.coverImageUrl,
        tags: parsed.data.tags || []
      }
    })
    res.status(201).json(created)
  } catch (error) {
    console.error("Admin ByteSize Create Error:", error)
    res.status(500).json({ error: "Failed to create bytesize item" })
  }
})

router.delete("/bytesize/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    await db.byteSizeItem.delete({ where: { id } })
    res.json({ ok: true })
  } catch (error) {
    console.error("Admin ByteSize Delete Error:", error)
    res.status(500).json({ error: "Failed to delete bytesize item" })
  }
})



// ============ ADMIN CLASS PLANS & ENROLLMENTS ============
const classPlanSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  ageMin: z.coerce.number().int().optional().nullable(),
  ageMax: z.coerce.number().int().optional().nullable(),
  priceMonthly: z.coerce.number().min(0),
  currency: z.string().optional(),
  isActive: z.boolean().optional(),
  classIds: z.array(z.string()).optional()
})

const classPlanUpdateSchema = classPlanSchema.partial()

router.get("/class-plans", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "classes.read")) return
    const plans = await db.classPlan.findMany({
      include: {
        classes: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                description: true,
                scheduleDescription: true,
                maxStudents: true,
                isActive: true,
                kruzhok: { select: { id: true, title: true } },
                _count: { select: { enrollments: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    const result = (plans || []).map((plan: any) => ({
      id: plan.id,
      title: plan.title,
      description: plan.description || "",
      ageMin: plan.ageMin ?? null,
      ageMax: plan.ageMax ?? null,
      priceMonthly: toAmount(plan.priceMonthly),
      currency: plan.currency || "KZT",
      isActive: plan.isActive !== false,
      classes: (plan.classes || []).map((pc: any) => ({
        id: pc.class?.id,
        name: pc.class?.name || "",
        kruzhokTitle: pc.class?.kruzhok?.title || "",
        scheduleDescription: pc.class?.scheduleDescription || "",
        maxStudents: pc.class?.maxStudents || 0,
        seatsTaken: pc.class?._count?.enrollments || 0,
        isActive: pc.class?.isActive !== false
      }))
    }))

    res.json(result)
  } catch (error) {
    console.error("[admin/class-plans] Error:", error)
    res.status(500).json({ error: "Failed to load class plans" })
  }
})

router.post("/class-plans", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "classes.write")) return
    const parsed = classPlanSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const data = parsed.data

    const created = await db.classPlan.create({
      data: {
        title: data.title,
        description: data.description || null,
        ageMin: data.ageMin ?? null,
        ageMax: data.ageMax ?? null,
        priceMonthly: data.priceMonthly,
        currency: data.currency || "KZT",
        isActive: data.isActive ?? true,
        classes: data.classIds && data.classIds.length > 0
          ? {
            create: data.classIds.map((id) => ({ classId: id }))
          }
          : undefined
      }
    })

    await writeAdminAuditLog(db, {
      actorId: req.user!.id,
      action: "CLASS_PLAN_CREATE",
      entityType: "CLASS_PLAN",
      entityId: created.id,
      metadata: {
        title: created.title,
        priceMonthly: toAmount(created.priceMonthly),
        classIds: data.classIds || [],
      },
    })

    res.status(201).json(created)
  } catch (error) {
    console.error("[admin/class-plans create] Error:", error)
    res.status(500).json({ error: "Failed to create class plan" })
  }
})

router.put("/class-plans/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "classes.write")) return
    const { id } = req.params
    const parsed = classPlanUpdateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const data = parsed.data

    const existing = await db.classPlan.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: "Class plan not found" })

    const updated = await db.classPlan.update({
      where: { id },
      data: {
        title: data.title ?? undefined,
        description: data.description ?? undefined,
        ageMin: data.ageMin ?? undefined,
        ageMax: data.ageMax ?? undefined,
        priceMonthly: typeof data.priceMonthly === "number" ? data.priceMonthly : undefined,
        currency: data.currency ?? undefined,
        isActive: typeof data.isActive === "boolean" ? data.isActive : undefined
      }
    })

    if (Array.isArray(data.classIds)) {
      await db.classPlanClass.deleteMany({ where: { planId: id } })
      if (data.classIds.length > 0) {
        await db.classPlanClass.createMany({
          data: data.classIds.map((classId) => ({ planId: id, classId }))
        })
      }
    }

    await writeAdminAuditLog(db, {
      actorId: req.user!.id,
      action: "CLASS_PLAN_UPDATE",
      entityType: "CLASS_PLAN",
      entityId: id,
      metadata: {
        title: data.title,
        priceMonthly: data.priceMonthly,
        isActive: data.isActive,
        classIds: Array.isArray(data.classIds) ? data.classIds : undefined,
      },
    })

    res.json(updated)
  } catch (error) {
    console.error("[admin/class-plans update] Error:", error)
    res.status(500).json({ error: "Failed to update class plan" })
  }
})

router.post("/class-plans/seed-defaults", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "classes.write")) return
    const defaults = [
      { title: "WeDo 2.0", ageMin: 4, ageMax: 9, priceMonthly: 17100 },
      { title: "Spike + Project Work", ageMin: 9, ageMax: 12, priceMonthly: 18900 },
      { title: "Arduino + 3D Modeling + Project Work", ageMin: 12, ageMax: 16, priceMonthly: 21600 }
    ]

    const created: any[] = []
    for (const plan of defaults) {
      const exists = await db.classPlan.findFirst({ where: { title: plan.title } })
      if (exists) continue
      const item = await db.classPlan.create({
        data: {
          title: plan.title,
          ageMin: plan.ageMin,
          ageMax: plan.ageMax,
          priceMonthly: plan.priceMonthly,
          currency: "KZT",
          isActive: true
        }
      })
      created.push(item)
    }

    await writeAdminAuditLog(db, {
      actorId: req.user!.id,
      action: "CLASS_PLAN_SEED_DEFAULTS",
      entityType: "CLASS_PLAN",
      metadata: { createdCount: created.length, titles: created.map((item) => item.title) },
    })

    res.json({ created })
  } catch (error) {
    console.error("[admin/class-plans seed] Error:", error)
    res.status(500).json({ error: "Failed to seed class plans" })
  }
})

// Enrollment requests
router.get("/enrollment-requests", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "enrollments.read")) return
    const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : undefined
    const where = status ? { status } : {}

    const requests = await db.enrollmentRequest.findMany({
      where,
      include: {
        parent: { select: { id: true, fullName: true, email: true } },
        plan: { select: { id: true, title: true } },
        students: { select: { id: true } }
      },
      orderBy: { requestedAt: "desc" }
    })

    const result = (requests || []).map((r: any) => ({
      id: r.id,
      status: r.status,
      parent: r.parent,
      planTitle: r.plan?.title || "Абонемент",
      paymentCode: r.paymentCode,
      paymentAmount: toAmount(r.paymentAmount),
      currency: r.currency || "KZT",
      studentsCount: r.students?.length || 0,
      requestedAt: r.requestedAt?.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() || null
    }))

    res.json(result)
  } catch (error) {
    console.error("[admin/enrollment-requests] Error:", error)
    res.status(500).json({ error: "Failed to load enrollment requests" })
  }
})

router.get("/enrollment-requests/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "enrollments.read")) return
    const { id } = req.params
    const request = await db.enrollmentRequest.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profile: { select: { phone: true } }
          }
        },
        plan: { select: { id: true, title: true, priceMonthly: true, currency: true } },
        students: {
          include: {
            student: { select: { id: true, fullName: true, email: true, profile: { select: { phone: true } } } },
            desiredClass: { select: { id: true, name: true } },
            assignedClass: { select: { id: true, name: true } }
          }
        }
      }
    })

    if (!request) return res.status(404).json({ error: "Request not found" })

    const planClasses = await db.classPlanClass.findMany({
      where: { planId: request.planId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            scheduleDescription: true,
            maxStudents: true,
            isActive: true,
            kruzhok: { select: { title: true } },
            _count: { select: { enrollments: true } }
          }
        }
      }
    })

    const availableClasses = (planClasses || []).map((pc: any) => {
      const cls = pc.class
      const seatsTaken = cls?._count?.enrollments || 0
      const maxStudents = cls?.maxStudents || 0
      const seatsAvailable = Math.max(0, maxStudents - seatsTaken)
      return {
        id: cls?.id,
        name: cls?.name || "",
        kruzhokTitle: cls?.kruzhok?.title || "",
        scheduleDescription: cls?.scheduleDescription || "",
        maxStudents,
        seatsTaken,
        seatsAvailable,
        isFull: seatsAvailable <= 0,
        isActive: cls?.isActive !== false
      }
    })

    res.json({
      id: request.id,
      status: request.status,
      paymentCode: request.paymentCode,
      paymentAmount: toAmount(request.paymentAmount),
      currency: request.currency || "KZT",
      comment: request.comment || "",
      preferredSchedule: request.preferredSchedule || "",
      requestedAt: request.requestedAt?.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString() || null,
      adminNotes: request.adminNotes || "",
      parent: request.parent,
      plan: {
        id: request.plan?.id,
        title: request.plan?.title || "",
        priceMonthly: toAmount(request.plan?.priceMonthly),
        currency: request.plan?.currency || "KZT"
      },
      students: (request.students || []).map((s: any) => ({
        id: s.id,
        studentId: s.studentId,
        fullName: s.student?.fullName || "",
        email: s.student?.email || "",
        phone: s.student?.profile?.phone || "",
        desiredClassId: s.desiredClass?.id || null,
        desiredClassName: s.desiredClass?.name || "",
        assignedClassId: s.assignedClass?.id || null,
        assignedClassName: s.assignedClass?.name || "",
        status: s.status
      })),
      availableClasses
    })
  } catch (error) {
    console.error("[admin/enrollment-request detail] Error:", error)
    res.status(500).json({ error: "Failed to load request detail" })
  }
})

const approveSchema = z.object({
  adminNotes: z.string().optional(),
  paymentConfirmed: z.literal(true),
  paymentConfirmationNote: z.string().trim().max(300).optional(),
  startDate: z.string().datetime().optional(),
  assignments: z.array(z.object({
    requestStudentId: z.string().min(1),
    assignedClassId: z.string().min(1)
  })).min(1)
})

router.post("/enrollment-requests/:id/approve", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "enrollments.review")) return
    const { id } = req.params
    const parsed = approveSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const data = parsed.data

    const request = await db.enrollmentRequest.findUnique({
      where: { id },
      include: {
        plan: { include: { classes: { select: { classId: true } } } },
        students: { select: { id: true, studentId: true } }
      }
    })

    if (!request) return res.status(404).json({ error: "Request not found" })
    if (request.status !== "PENDING") return res.status(400).json({ error: "Request already processed" })

    const requestStudentIds = new Set((request.students || []).map((s: any) => s.id))
    if (data.assignments.length !== requestStudentIds.size) {
      return res.status(400).json({ error: "Нужно назначить класс каждому ученику" })
    }

    for (const a of data.assignments) {
      if (!requestStudentIds.has(a.requestStudentId)) {
        return res.status(400).json({ error: "Передан неизвестный ученик из заявки" })
      }
    }

    const allowedClassIds = new Set((request.plan?.classes || []).map((c: any) => c.classId))
    const assignedClassIds = data.assignments.map((a) => a.assignedClassId)

    for (const classId of assignedClassIds) {
      if (!allowedClassIds.has(classId)) {
        return res.status(400).json({ error: "Класс не входит в выбранный абонемент" })
      }
    }

    const assignmentCounts = new Map<string, number>()
    for (const classId of assignedClassIds) {
      assignmentCounts.set(classId, (assignmentCounts.get(classId) || 0) + 1)
    }

    const classRows = await db.clubClass.findMany({
      where: { id: { in: Array.from(new Set(assignedClassIds)) } },
      select: { id: true, maxStudents: true, isActive: true, _count: { select: { enrollments: true } } }
    })

    const classMap = new Map<string, any>(classRows.map((c: any) => [c.id, c]))
    for (const [classId, count] of assignmentCounts.entries()) {
      const cls = classMap.get(classId)
      if (!cls || cls.isActive === false) {
        return res.status(400).json({ error: "Класс недоступен" })
      }
      const seatsLeft = Math.max(0, (cls.maxStudents || 0) - (cls._count?.enrollments || 0))
      if (seatsLeft < count) {
        return res.status(400).json({ error: "Недостаточно мест в выбранном классе" })
      }
    }

    const startDate = data.startDate ? new Date(data.startDate) : new Date()
    const endDate = addOneMonth(startDate)
    const planPrice = toAmount(request.plan?.priceMonthly)
    const totalPaymentAmount = toAmount(request.paymentAmount)
    const now = new Date()
    const paymentAuditRecord = `PAYMENT_CONFIRMED:${now.toISOString()}:${req.user!.id}${data.paymentConfirmationNote ? `:${data.paymentConfirmationNote}` : ""}`
    const mergedAdminNotes = [data.adminNotes?.trim(), paymentAuditRecord].filter(Boolean).join("\n")

    const studentIdByRequestStudentId = new Map((request.students || []).map((s: any) => [s.id, s.studentId]))

    await db.$transaction(async (tx: any) => {
      await tx.enrollmentRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedAt: now,
          reviewedById: req.user!.id,
          adminNotes: mergedAdminNotes || null
        }
      })

      for (const assignment of data.assignments) {
        const studentId = studentIdByRequestStudentId.get(assignment.requestStudentId)
        if (!studentId) continue

        await tx.enrollmentRequestStudent.update({
          where: { id: assignment.requestStudentId },
          data: {
            assignedClassId: assignment.assignedClassId,
            status: "APPROVED"
          }
        })

        await tx.classEnrollment.upsert({
          where: { classId_userId: { classId: assignment.assignedClassId, userId: studentId } },
          create: { classId: assignment.assignedClassId, userId: studentId, status: "active" },
          update: { status: "active" }
        })

        await tx.parentSubscription.create({
          data: {
            parentId: request.parentId,
            studentId,
            planId: request.planId,
            requestId: request.id,
            status: "ACTIVE",
            amount: planPrice,
            currency: request.plan?.currency || "KZT",
            startDate,
            endDate
          }
        })
      }
    })

    const detailed = await db.enrollmentRequest.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, fullName: true, email: true } },
        plan: { select: { id: true, title: true, currency: true } },
        students: {
          include: {
            student: { select: { id: true, fullName: true, email: true } },
            assignedClass: {
              include: {
                mentor: { select: { fullName: true, email: true } }
              }
            }
          }
        }
      }
    })

    if (detailed) {
      const parent = detailed.parent
      const students = detailed.students || []
      const studentNames = students.map((s: any) => s.student?.fullName || "").filter(Boolean).join(", ") || "ученики"
      const planTitle = detailed.plan?.title || "абонемент"
      const totalAmountLabel = formatCurrency(totalPaymentAmount, request.currency || "KZT")

      const classIds = Array.from(new Set(students.map((s: any) => s.assignedClassId).filter((cid: any) => typeof cid === "string" && cid.length > 0)))
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const upcomingRows = classIds.length > 0
        ? await db.schedule.findMany({
          where: {
            classId: { in: classIds },
            scheduledDate: { gte: today },
            status: { in: ["SCHEDULED", "IN_PROGRESS"] }
          },
          select: { classId: true, scheduledDate: true, scheduledTime: true },
          orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }]
        })
        : []

      const scheduleByClassId = new Map<string, string[]>()
      for (const row of upcomingRows || []) {
        if (!row?.classId) continue
        const dateLabel = new Date(row.scheduledDate).toLocaleDateString("ru-RU")
        const slot = `${dateLabel}${row.scheduledTime ? ` ${row.scheduledTime}` : ""}`.trim()
        const existing = scheduleByClassId.get(row.classId) || []
        if (existing.length >= 3) continue
        existing.push(slot)
        scheduleByClassId.set(row.classId, existing)
      }

      const scheduleLabelForStudent = (s: any) => {
        const slots = s.assignedClassId ? (scheduleByClassId.get(s.assignedClassId) || []) : []
        if (slots.length > 0) return slots.join(", ")
        return s.assignedClass?.scheduleDescription || "уточняется"
      }

      const parentScheduleSummary = students
        .map((s: any) => {
          const studentName = s.student?.fullName || "Ученик"
          const className = s.assignedClass?.name || "Класс"
          return `${studentName}: ${className} (${scheduleLabelForStudent(s)})`
        })
        .join("; ")

      const [parentTemplate, studentTemplate] = await Promise.all([
        getTemplateByKey("ENROLLMENT_APPROVED_PARENT"),
        getTemplateByKey("ENROLLMENT_APPROVED_STUDENT"),
      ])

      const parentVariables = {
        amount: totalAmountLabel,
        students: studentNames,
        planTitle,
        scheduleSummary: parentScheduleSummary || "уточняется",
        contactPhone: "+7 776 045 7776",
      }
      const fallbackParentMessage = `Оплата подтверждена. Сумма: ${totalAmountLabel}. Ваши ученики: ${studentNames}. План: "${planTitle}".${parentScheduleSummary ? ` Расписание: ${parentScheduleSummary}.` : ""} Если остались вопросы, напишите нам: +7 776 045 7776.`
      const parentTitle = parentTemplate
        ? renderTemplateString(parentTemplate.titleTemplate, parentVariables)
        : "Оплата подтверждена"
      const parentMessage = parentTemplate
        ? renderTemplateString(parentTemplate.messageTemplate, parentVariables)
        : fallbackParentMessage

      await db.notification.create({
        data: {
          userId: parent.id,
          title: parentTitle,
          message: parentMessage,
          type: "ENROLLMENT_APPROVED",
          metadata: { enrollmentRequestId: detailed.id }
        }
      }).catch(() => null)

      if (students.length > 0) {
        await db.notification.createMany({
          data: students.map((s: any) => {
            const parentLabel = parent.fullName || "Ваш родитель"
            const className = s.assignedClass?.name || ""
            const schedule = scheduleLabelForStudent(s)
            const mentorName = s.assignedClass?.mentor?.fullName || ""
            const studentVariables = {
              parentName: parentLabel,
              planTitle,
              className,
              schedule,
              mentorName: mentorName || "уточняется",
              contactPhone: "+7 776 045 7776",
            }
            const title = studentTemplate
              ? renderTemplateString(studentTemplate.titleTemplate, studentVariables)
              : "Ты записан(а) на занятия"
            const message = studentTemplate
              ? renderTemplateString(studentTemplate.messageTemplate, studentVariables)
              : `${parentLabel} записал(а) тебя на "${planTitle}".${className ? ` Класс: ${className}.` : ""} Расписание: ${schedule}.${mentorName ? ` Ментор: ${mentorName}.` : ""} Ждем тебя на занятиях! Если есть вопросы, позвоните: +7 776 045 7776.`
            return {
              userId: s.studentId,
              title,
              message,
              type: "ENROLLMENT_APPROVED",
              metadata: { enrollmentRequestId: detailed.id }
            }
          })
        }).catch(() => null)
      }

      await sendEnrollmentApprovedParentEmail({
        email: parent.email,
        parentName: parent.fullName || "Родитель",
        planTitle: detailed.plan?.title || "абонемент",
        students: students.map((s: any) => s.student?.fullName || ""),
        schedule: parentScheduleSummary,
        contactPhone: "+7 776 045 7776",
        amount: totalPaymentAmount,
        startDate,
        endDate
      }).catch((err) => console.error("Parent approval email failed:", err))

      for (const s of students) {
        await sendEnrollmentApprovedStudentEmail({
          email: s.student?.email,
          studentName: s.student?.fullName || "",
          parentName: parent.fullName || "Родитель",
          planTitle: detailed.plan?.title || "абонемент",
          className: s.assignedClass?.name || "",
          mentorName: s.assignedClass?.mentor?.fullName || "",
          schedule: scheduleLabelForStudent(s),
          contactPhone: "+7 776 045 7776"
        }).catch((err) => console.error("Student approval email failed:", err))
      }
    }

    await writeAdminAuditLog(db, {
      actorId: req.user!.id,
      action: "ENROLLMENT_APPROVE",
      entityType: "ENROLLMENT_REQUEST",
      entityId: id,
      targetUserId: request.parentId,
      reason: data.adminNotes || data.paymentConfirmationNote || null,
      metadata: {
        paymentCode: request.paymentCode,
        paymentAmount: toAmount(request.paymentAmount),
        studentsCount: request.students?.length || 0,
      },
    })

    res.json({ success: true })
  } catch (error) {
    console.error("[admin/enrollment approve] Error:", error)
    res.status(500).json({ error: "Failed to approve request" })
  }
})

const rejectSchema = z.object({
  adminNotes: z.string().min(1)
})

router.post("/enrollment-requests/:id/reject", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!ensurePermission(req, res, "enrollments.review")) return
    const { id } = req.params
    const parsed = rejectSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const data = parsed.data

    const request = await db.enrollmentRequest.findUnique({ where: { id } })
    if (!request) return res.status(404).json({ error: "Request not found" })
    if (request.status !== "PENDING") return res.status(400).json({ error: "Request already processed" })

    await db.enrollmentRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: req.user!.id,
        adminNotes: data.adminNotes
      }
    })

    await db.enrollmentRequestStudent.updateMany({
      where: { requestId: id },
      data: { status: "REJECTED" }
    })

    await db.notification.create({
      data: {
        userId: request.parentId,
        title: "Заявка отклонена",
        message: `Причина отклонения: ${data.adminNotes}`,
        type: "ENROLLMENT_REJECTED",
        metadata: { enrollmentRequestId: id }
      }
    }).catch(() => null)

    await writeAdminAuditLog(db, {
      actorId: req.user!.id,
      action: "ENROLLMENT_REJECT",
      entityType: "ENROLLMENT_REQUEST",
      entityId: id,
      targetUserId: request.parentId,
      reason: data.adminNotes,
      metadata: { paymentCode: request.paymentCode, paymentAmount: toAmount(request.paymentAmount) },
    })

    res.json({ success: true })
  } catch (error) {
    console.error("[admin/enrollment reject] Error:", error)
    res.status(500).json({ error: "Failed to reject request" })
  }
})

// ============ ADMIN EVENTS ============ 
const adminEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  audience: z.string().optional(),
  contact: z.string().optional(),
  date: z.string().optional(),
  imageUrl: z.string().optional(),
  format: z.enum(["online", "offline", "hybrid"]).optional(),
  isFree: z.boolean().optional(),
  price: z.number().optional(),
  location: z.string().optional(),
  url: z.string().optional(),
  status: z.enum(["pending", "published", "rejected"]).optional()
})

router.get("/events", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const events = await db.event.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { registrations: true } } }
    })
    res.json(events)
  } catch (error) {
    console.error("Admin Events Error:", error)
    res.status(500).json({ error: "Failed to load events" })
  }
})

router.post("/events", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = adminEventSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const data = parsed.data
    const created = await db.event.create({
      data: {
        title: data.title,
        description: data.description,
        audience: data.audience,
        contact: data.contact,
        date: data.date ? new Date(data.date) : undefined,
        imageUrl: data.imageUrl,
        format: data.format || "offline",
        isFree: data.isFree ?? true,
        price: data.isFree ? 0 : Number(data.price || 0),
        location: data.location,
        url: data.url,
        status: data.status || "published",
        createdById: req.user!.id
      }
    })
    res.status(201).json(created)
  } catch (error) {
    console.error("Admin Events Create Error:", error)
    res.status(500).json({ error: "Failed to create event" })
  }
})

router.delete("/events", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    await db.event.deleteMany({})
    res.json({ ok: true })
  } catch (error) {
    console.error("Admin Events Bulk Delete Error:", error)
    res.status(500).json({ error: "Failed to delete events" })
  }
})

router.delete("/events/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    await db.event.delete({ where: { id } })
    res.json({ ok: true })
  } catch (error) {
    console.error("Admin Events Delete Error:", error)
    res.status(500).json({ error: "Failed to delete event" })
  }
})

router.get("/events/:id/registrations", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const regs = await db.eventRegistration.findMany({
      where: { eventId: id },
      include: { user: { select: { id: true, email: true, fullName: true } } },
      orderBy: { createdAt: "desc" }
    })
    res.json(regs)
  } catch (error) {
    console.error("Admin Events Registrations Error:", error)
    res.status(500).json({ error: "Failed to load registrations" })
  }
})

router.post("/events/:eventId/registrations/:regId/approve", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { eventId, regId } = req.params
    const existing = await db.eventRegistration.findUnique({ where: { id: regId } })
    if (!existing || existing.eventId !== eventId) {
      return res.status(404).json({ error: "Registration not found" })
    }
    const updated = await db.eventRegistration.update({
      where: { id: regId },
      data: { status: "approved" }
    })
    res.json(updated)
  } catch (error) {
    console.error("Admin Event Registration Approve Error:", error)
    res.status(500).json({ error: "Failed to approve registration" })
  }
})

router.post("/events/:eventId/registrations/:regId/reject", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { eventId, regId } = req.params
    const existing = await db.eventRegistration.findUnique({ where: { id: regId } })
    if (!existing || existing.eventId !== eventId) {
      return res.status(404).json({ error: "Registration not found" })
    }
    const updated = await db.eventRegistration.update({
      where: { id: regId },
      data: { status: "rejected" }
    })
    res.json(updated)
  } catch (error) {
    console.error("Admin Event Registration Reject Error:", error)
    res.status(500).json({ error: "Failed to reject registration" })
  }
})
