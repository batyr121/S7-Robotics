import { Router, type Response, type Request } from "express"
import path from "path"
import { env } from "../env"
import { z } from "zod"
import { prisma } from "../db"
import { requireAdmin, requireAuth } from "../middleware/auth"
import { hashPassword } from "../utils/password"
import { UserRole } from "@prisma/client"
import type { AuthenticatedRequest } from "../types"

// Declare router early so it can be used by routes defined above/below
export const router = Router()

router.use(requireAuth, requireAdmin)

function normalizeMediaUrl(u?: string): string | undefined {
  try {
    if (!u) return undefined
    const s = String(u)
    // Prefer /api/media to work with common nginx configs
    if (s.startsWith("/api/media/")) return s
    if (s.startsWith("/media/")) return s.replace("/media/", "/api/media/")
    const url = new URL(s)
    if (url.pathname.startsWith("/api/media/")) return url.pathname
    if (url.pathname.startsWith("/media/")) return url.pathname.replace("/media/", "/api/media/")
    return s
  } catch {
    return u
  }
}

function normalizeSlides(slides?: any): any {
  try {
    if (!Array.isArray(slides)) return slides
    return slides.map((s) => {
      if (s && typeof s === "object") {
        const url = normalizeMediaUrl((s as any).url)
        return url ? { ...s, url } : s
      }
      if (typeof s === "string") {
        const url = normalizeMediaUrl(s)
        return url ? { url } : { url: s }
      }
      return s
    })
  } catch {
    return slides
  }
}

const slideSchema = z.object({
  title: z.string().optional(),
  url: z.string().url(),
  storagePath: z.string().optional(),
})

// Competitions CRUD (admin-only)
const competitionSchema = z.object({
  id: z.string().optional(),
  teamId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  competitionDate: z.union([z.string(), z.date()]),
  venue: z.string().optional(),
  awardsWon: z.string().optional(),
  status: z.string().optional(),
})

router.get("/competitions", async (_req: AuthenticatedRequest, res: Response) => {
  const list = await prisma.competition.findMany({ orderBy: { createdAt: "desc" } })
  res.json(list)
})

// ---- ByteSize admin ----
const byteSizeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  videoUrl: z.string().url(),
  coverImageUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
})

router.get("/bytesize", async (_req: AuthenticatedRequest, res: Response) => {
  const list = await (prisma as any).byteSizeItem.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { likes: true } } },
  })
  res.json(list)
})

router.post("/bytesize", async (req: AuthenticatedRequest, res: Response) => {
  const parsed = byteSizeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = parsed.data

  // Normalize URLs to /api/media/ format
  const normalizedVideoUrl = normalizeMediaUrl(data.videoUrl) || data.videoUrl
  const normalizedCoverUrl = normalizeMediaUrl(data.coverImageUrl) || data.coverImageUrl

  console.log('[ByteSize] Creating new item:', {
    title: data.title,
    videoUrl: data.videoUrl,
    normalizedVideoUrl,
    coverImageUrl: data.coverImageUrl,
    normalizedCoverUrl
  })

  const created = await (prisma as any).byteSizeItem.create({
    data: {
      title: data.title,
      description: data.description,
      videoUrl: normalizedVideoUrl,
      coverImageUrl: normalizedCoverUrl,
      tags: data.tags && data.tags.length ? data.tags : undefined,
      authorId: req.user!.id,
    },
  })

  console.log('[ByteSize] Created item:', { id: created.id, videoUrl: created.videoUrl })
  res.status(201).json(created)
})

router.delete("/bytesize/:id", async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  try {
    // try to remove likes first (FK safety)
    await (prisma as any).byteSizeLike.deleteMany({ where: { itemId: id } }).catch(() => null)
    // delete media files if stored locally
    try {
      const item = await (prisma as any).byteSizeItem.findUnique({ where: { id } })
      const files: string[] = []
      if (item?.videoUrl && item.videoUrl.startsWith("/media/")) files.push(path.resolve(env.MEDIA_DIR, item.videoUrl.replace("/media/", "")))
      if (item?.coverImageUrl && item.coverImageUrl.startsWith("/media/")) files.push(path.resolve(env.MEDIA_DIR, item.coverImageUrl.replace("/media/", "")))
      if (files.length) {
        const fs = await import("fs/promises")
        await Promise.all(files.map((p) => fs.unlink(p).catch(() => null)))
      }
    } catch { }
    await (prisma as any).byteSizeItem.delete({ where: { id } }).catch(() => null)
    res.json({ success: true })
  } catch {
    res.json({ success: true })
  }
})

// Revoke (delete) a specific user achievement (admin-only)
router.delete("/user-achievements/:id", async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  try {
    await prisma.userAchievement.delete({ where: { id } })
    return res.json({ success: true })
  } catch {
    return res.status(404).json({ error: "User achievement not found" })
  }
})

router.post("/competitions", async (req: AuthenticatedRequest, res: Response) => {
  const parsed = competitionSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = parsed.data
  const created = await prisma.competition.create({
    data: {
      id: data.id,
      teamId: data.teamId,
      name: data.name,
      description: data.description,
      competitionDate: new Date(data.competitionDate as any),
      venue: data.venue,
      awardsWon: data.awardsWon,
      status: data.status ?? "upcoming",
    },
  })
  res.status(201).json(created)
})

router.put("/competitions/:competitionId", async (req: AuthenticatedRequest, res: Response) => {
  const { competitionId } = req.params
  const parsed = competitionSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = parsed.data
  try {
    const updated = await prisma.competition.update({
      where: { id: competitionId },
      data: {
        teamId: data.teamId,
        name: data.name,
        description: data.description,
        competitionDate: new Date(data.competitionDate as any),
        venue: data.venue,
        awardsWon: data.awardsWon,
        status: data.status ?? undefined,
      },
    })
    res.json(updated)
  } catch (e) {
    res.status(404).json({ error: "Competition not found" })
  }
})

router.delete("/competitions/:competitionId", async (req: AuthenticatedRequest, res: Response) => {
  const { competitionId } = req.params
  await prisma.competition.delete({ where: { id: competitionId } }).catch(() => null)
  res.json({ success: true })
})

const lessonSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  content: z.string().optional(),
  duration: z.string().optional(),
  orderIndex: z.number().int().min(0),
  isFreePreview: z.boolean().optional().default(false),
  videoUrl: z.string().optional(),
  videoStoragePath: z.string().optional(),
  presentationUrl: z.string().optional(),
  presentationStoragePath: z.string().optional(),
  slides: z.array(slideSchema).optional(),
  contentType: z.string().default("text"),
})

const moduleSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  orderIndex: z.number().int().min(0),
  lessons: z.array(lessonSchema).default([]),
})

const courseSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  difficulty: z.string().min(1),
  price: z.number().nonnegative().default(0),
  isFree: z.boolean().default(true),
  isPublished: z.boolean().default(false),
  coverImageUrl: z.string().optional(),
  estimatedHours: z.number().int().nonnegative().optional(),
  modules: z.array(moduleSchema).default([]),
})

const teamSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  captainId: z.string().optional(),
  logoUrl: z.string().optional(),
  maxMembers: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  metadata: z.object({
    city: z.string().optional(),
    phone: z.string().optional(),
    educationalInstitution: z.string().optional(),
    mentorName: z.string().optional(),
    positionsWanted: z.array(z.string()).optional(),
    competitions: z.array(z.string()).optional(),
  }).optional(),
})

// router already declared above


// Platform statistics for Admin Dashboard
router.get("/stats", async (_req: AuthenticatedRequest, res: Response) => {
  const [totalUsers, totalCourses, pendingPayments, approvedPayments, revenueAgg] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.purchase.count({ where: { status: "pending" } }),
    prisma.purchase.count({ where: { status: "approved" } }),
    prisma.purchase.aggregate({ _sum: { amount: true }, where: { status: "approved" } }),
  ])
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const newUsersThisWeek = await prisma.user.count({ where: { createdAt: { gte: weekAgo } } })
  res.json({
    totalUsers,
    totalCourses,
    pendingPayments,
    completedPayments: approvedPayments,
    newUsersThisWeek,
    totalRevenue: Number(revenueAgg._sum.amount || 0),
  })
})

// Payments management
router.get("/purchases", async (req: AuthenticatedRequest, res: Response) => {
  const status = (req.query.status as string | undefined) as any
  const limit = Number(req.query.limit || 50)
  const purchases = await prisma.purchase.findMany({
    where: { status: status || undefined },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      course: { select: { id: true, title: true } },
    },
  })
  res.json(
    purchases.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt,
      payerFullName: (p as any).payerFullName,
      senderCode: (p as any).senderCode,
      transactionId: p.transactionId,
      paymentMethod: p.paymentMethod,
      user: p.user,
      course: p.course,
    }))
  )
})

// Club subscription requests (created as notifications for admins)
router.get("/club-subscription-requests", async (req: AuthenticatedRequest, res: Response) => {
  const limit = Number(req.query.limit || 50)
  // Fetch only notifications for current admin to avoid duplicates across admins
  const notifs = await (prisma as any).notification.findMany({
    where: { userId: req.user!.id, type: "subscription" },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  // Collect requester IDs from metadata
  const requesterIds = Array.from(
    new Set(
      (notifs || [])
        .map((n: any) => (n?.metadata as any)?.requestUserId)
        .filter((id: any) => typeof id === "string" && id.trim().length > 0)
    )
  ) as string[]
  const users = requesterIds.length
    ? await (prisma as any).user.findMany({
      where: { id: { in: requesterIds } },
      select: { id: true, email: true, fullName: true },
    })
    : []
  const uMap = new Map<string, any>(users.map((u: any) => [u.id, u]))
  const rows = (notifs || []).map((n: any) => {
    const md: any = n?.metadata || {}
    const reqUser = typeof md?.requestUserId === "string" ? uMap.get(md.requestUserId) : undefined
    return {
      id: n.id,
      createdAt: n.createdAt,
      amount: Number(md?.amount || 0),
      currency: String(md?.currency || "KZT"),
      period: String(md?.period || "month"),
      method: String(md?.method || "kaspi"),
      note: typeof md?.note === "string" ? md.note : undefined,
      requester: reqUser || { id: md?.requestUserId || "", email: "", fullName: "" },
    }
  })
  res.json(rows)
})

router.post("/purchases/:id/approve", async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const updated = await prisma.purchase.update({
    where: { id },
    data: { status: "approved", confirmedAt: new Date(), adminNotes: (req.body as any)?.adminNotes },
  }).catch(() => null)
  if (!updated) return res.status(404).json({ error: "Purchase not found" })
  res.json(updated)
})

router.post("/purchases/:id/reject", async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const updated = await prisma.purchase.update({
    where: { id },
    data: { status: "rejected", adminNotes: (req.body as any)?.adminNotes },
  }).catch(() => null)
  if (!updated) return res.status(404).json({ error: "Purchase not found" })
  res.json(updated)
})

// User management (admin-only)
const roleUpdateSchema = z.object({ role: z.enum(["ADMIN", "USER"]) })

router.get("/users", async (_req: AuthenticatedRequest, res: Response) => {
  const users = await (prisma as any).user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, fullName: true, createdAt: true, experiencePoints: true, banned: true, bannedReason: true } as any,
  })
  res.json((users as any[]).map((u: any) => ({ ...u, xp: Number((u as any).experiencePoints || 0) })))
})

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(3),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
})

router.post("/users", async (req: AuthenticatedRequest, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const { email, password, fullName, role } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(409).json({ error: "Email already registered" })

  try {
    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        role,
        emailVerified: true, // Admin created users are verified
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
    res.status(201).json(user)
  } catch (error) {
    console.error("Failed to create user:", error)
    res.status(500).json({ error: "Failed to create user" })
  }
})

const banSchema = z.object({ reason: z.string().optional() })

// Ban user
router.post("/users/:userId/ban", async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params
  const parsed = banSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  try {
    const updated = await (prisma as any).user.update({ where: { id: userId }, data: { banned: true, bannedReason: parsed.data.reason || null } as any })
    return res.json({ id: updated.id, banned: updated.banned, bannedReason: updated.bannedReason })
  } catch {
    return res.status(404).json({ error: "User not found" })
  }
})

// Unban user
router.post("/users/:userId/unban", async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params
  try {
    const updated = await (prisma as any).user.update({ where: { id: userId }, data: { banned: false, bannedReason: null } as any })
    return res.json({ id: updated.id, banned: updated.banned })
  } catch {
    return res.status(404).json({ error: "User not found" })
  }
})

router.post("/users/:userId/role", async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params
  const parsed = roleUpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  try {
    const updated = await prisma.user.update({ where: { id: userId }, data: { role: parsed.data.role } })
    return res.json({ id: updated.id, email: updated.email, role: updated.role })
  } catch {
    return res.status(404).json({ error: "User not found" })
  }
})

router.post("/users/:userId/promote", async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params
  try {
    const updated = await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } })
    return res.json({ id: updated.id, email: updated.email, role: updated.role })
  } catch {
    return res.status(404).json({ error: "User not found" })
  }
})

router.post("/users/:userId/demote", async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params
  try {
    const updated = await prisma.user.update({ where: { id: userId }, data: { role: "USER" } })
    return res.json({ id: updated.id, email: updated.email, role: updated.role })
  } catch {
    return res.status(404).json({ error: "User not found" })
  }
})

// Overview for a specific user: participations, purchases, achievements
router.get("/users/:userId/overview", async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      enrollments: { include: { course: { select: { id: true, title: true } } } },
      teamMemberships: { include: { team: { select: { id: true, name: true } } } },
    },
  })
  if (!user) return res.status(404).json({ error: "User not found" })
  const [purchases, registrations, userAchievements, submissions] = await Promise.all([
    prisma.purchase.findMany({ where: { userId }, include: { course: { select: { id: true, title: true } } } }),
    (prisma as any).eventRegistration.findMany({ where: { userId }, include: { event: { select: { id: true, title: true, date: true } } } }),
    prisma.userAchievement.findMany({ where: { userId }, include: { achievement: true } }),
    prisma.competitionSubmission.findMany({ where: { userId } }),
  ])
  res.json({ user, purchases, registrations, achievements: userAchievements, competitionSubmissions: submissions })
})

// Achievements across all users
router.get("/achievements/users", async (_req: AuthenticatedRequest, res: Response) => {
  const list = await prisma.userAchievement.findMany({
    orderBy: { earnedAt: "desc" },
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      achievement: true,
    },
  })
  res.json(list)
})

// Award a simple ad-hoc achievement to a user (admin-only)
const awardSchema = z.object({ text: z.string().min(1) })

router.post("/users/:userId/achievements", async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params
  const parsed = awardSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  // Create a minimal achievement and link it to the user
  try {
    const achievement = await prisma.achievement.create({
      data: {
        title: "Достижение",
        description: parsed.data.text,
        criteriaType: "manual",
      },
    })
    const ua = await prisma.userAchievement.create({
      data: {
        userId,
        achievementId: achievement.id,
        awardedById: req.user!.id,
      },
    })
    return res.status(201).json(ua)
  } catch (e) {
    return res.status(400).json({ error: "Failed to create achievement" })
  }
})

// Enroll user to a course (admin-only)
const enrollSchema = z.object({ courseId: z.string().min(1) })

router.post("/users/:userId/enrollments", async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params
  const parsed = enrollSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  try {
    // ensure course exists
    const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId } })
    if (!course) return res.status(404).json({ error: "Course not found" })

    const existing = await prisma.enrollment.findFirst({ where: { userId, courseId: parsed.data.courseId } })
    if (existing) return res.json(existing)

    const enr = await prisma.enrollment.create({
      data: {
        userId,
        courseId: parsed.data.courseId,
        status: "active",
      },
    })
    return res.status(201).json(enr)
  } catch (e) {
    return res.status(400).json({ error: "Failed to enroll" })
  }
})

router.get("/courses", async (_req: AuthenticatedRequest, res: Response) => {
  const courses = await prisma.course.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      modules: {
        orderBy: { orderIndex: "asc" },
        include: { lessons: { orderBy: { orderIndex: "asc" } } },
      },
    },
  })
  res.json(courses)
})

router.post("/courses", async (req: AuthenticatedRequest, res: Response) => {
  const parsed = courseSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = parsed.data

  const course = await prisma.course.create({
    data: {
      title: data.title,
      description: data.description,
      difficulty: data.difficulty,
      authorId: req.user!.id,
      price: data.price,
      isFree: data.isFree,
      isPublished: data.isPublished,
      coverImageUrl: data.coverImageUrl,
      estimatedHours: data.estimatedHours,
      totalModules: data.modules.length,
      modules: {
        create: data.modules.map((module, moduleIndex) => ({
          ...(module.id ? { id: module.id } : {}),
          title: module.title,
          description: module.description,
          orderIndex: module.orderIndex ?? moduleIndex,
          lessons: {
            create: module.lessons.map((lesson, lessonIndex) => ({
              ...(lesson.id ? { id: lesson.id } : {}),
              title: lesson.title,
              content: typeof lesson.content === "string" ? (lesson.content.trim() ? lesson.content : undefined) : lesson.content,
              duration: typeof lesson.duration === "string" ? (lesson.duration.trim() ? lesson.duration : undefined) : lesson.duration,
              orderIndex: lesson.orderIndex ?? lessonIndex,
              isFreePreview: lesson.isFreePreview ?? false,
              videoUrl: normalizeMediaUrl(lesson.videoUrl) || lesson.videoUrl,
              videoStoragePath: lesson.videoStoragePath,
              presentationUrl: normalizeMediaUrl(lesson.presentationUrl) || lesson.presentationUrl,
              presentationStoragePath: lesson.presentationStoragePath,
              slides: normalizeSlides(lesson.slides) ?? [],
              contentType: lesson.contentType,
            })),
          },
        })),
      },
    },
    include: {
      modules: { include: { lessons: true } },
    },
  })

  res.status(201).json(course)
})

router.put("/courses/:courseId", async (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.params
  const parsed = courseSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = parsed.data

  const existing = await prisma.course.findUnique({ where: { id: courseId }, include: { modules: { include: { lessons: true } } } })
  if (!existing) return res.status(404).json({ error: "Course not found" })

  const existingModulesById = new Map(existing.modules.map((m) => [m.id, m]))
  const ops: any[] = []
  let nextModuleOrder = existing.modules.length
  const syncParam = String((req.query as any)?.sync || "").toLowerCase()
  const syncIds = syncParam === "ids" || syncParam === "true"
  // Pruning (удаление отсутствующих модулей/уроков) теперь включается только
  // при явном запросе ?prune=true, чтобы черновики без уроков не затирали данные.
  const pruneMissing = syncIds && ["true", "1", "yes"].includes(String((req.query as any)?.prune || (req.query as any)?.deleteMissing || "").toLowerCase())

  // Precompute orderIndex map and derive accurate module counts
  const existingModulesByOrder = new Map<number, any>(
    (existing.modules || []).map((m) => [Number(m.orderIndex), m])
  )
  const willCreateNewModule = (module: any, moduleIndex: number) => {
    const hasPrev = module.id && existingModulesById.has(module.id)
    if (hasPrev) return false
    const targetOrder = module.orderIndex ?? moduleIndex
    const same = existingModulesByOrder.get(Number(targetOrder))
    return !same
  }
  const newModulesToCreateCount = (data.modules || []).reduce((acc, m, i) => acc + (willCreateNewModule(m, i) ? 1 : 0), 0)

  // If sync deletions requested, compute modules to delete to keep totalModules accurate
  const keepModuleIds = new Set<string>()
  if (pruneMissing) {
    for (let moduleIndex = 0; moduleIndex < data.modules.length; moduleIndex++) {
      const module = data.modules[moduleIndex]
      if (module.id && existingModulesById.has(module.id)) keepModuleIds.add(module.id)
      else {
        const targetOrder = module.orderIndex ?? moduleIndex
        const same = existingModulesByOrder.get(Number(targetOrder))
        if (same) keepModuleIds.add(same.id)
      }
    }
  }
  const modulesToDeleteIds = pruneMissing
    ? (existing.modules || []).filter((m) => !keepModuleIds.has(m.id)).map((m) => m.id)
    : []
  const finalTotalModules = (existing.modules.length - modulesToDeleteIds.length) + newModulesToCreateCount

  ops.push(
    prisma.course.update({
      where: { id: courseId },
      data: {
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        price: data.price,
        isFree: data.isFree,
        isPublished: data.isPublished,
        coverImageUrl: data.coverImageUrl,
        estimatedHours: data.estimatedHours,
        totalModules: finalTotalModules,
      },
    })
  )

  for (let moduleIndex = 0; moduleIndex < data.modules.length; moduleIndex++) {
    const module = data.modules[moduleIndex]
    const prevModule = module.id ? existingModulesById.get(module.id) : undefined
    if (prevModule) {
      ops.push(
        prisma.courseModule.update({
          where: { id: prevModule.id },
          data: {
            title: module.title,
            description: module.description ?? prevModule.description,
            orderIndex: module.orderIndex ?? moduleIndex,
          },
        })
      )
      const prevLessonsById = new Map((prevModule.lessons || []).map((l) => [l.id, l]))
      for (let lessonIndex = 0; lessonIndex < (module.lessons || []).length; lessonIndex++) {
        const lesson = module.lessons[lessonIndex]
        if (lesson.id && prevLessonsById.has(lesson.id)) {
          const prevLesson = prevLessonsById.get(lesson.id)!
          ops.push(
            prisma.lesson.update({
              where: { id: lesson.id },
              data: {
                title: lesson.title,
                content: (typeof lesson.content === "string" ? (lesson.content.trim() ? lesson.content : undefined) : lesson.content) ?? (prevLesson.content as any),
                duration: (typeof lesson.duration === "string" ? (lesson.duration.trim() ? lesson.duration : undefined) : lesson.duration) ?? (prevLesson.duration as any),
                orderIndex: lesson.orderIndex ?? lessonIndex,
                isFreePreview: lesson.isFreePreview !== undefined ? lesson.isFreePreview : (prevLesson.isFreePreview ?? false),
                videoUrl: (typeof lesson.videoUrl === "string" ? (normalizeMediaUrl(lesson.videoUrl?.trim() || undefined) || undefined) : lesson.videoUrl) ?? (prevLesson.videoUrl as any),
                videoStoragePath: (typeof lesson.videoStoragePath === "string" ? (lesson.videoStoragePath.trim() ? lesson.videoStoragePath : undefined) : lesson.videoStoragePath) ?? (prevLesson.videoStoragePath as any),
                presentationUrl: (typeof lesson.presentationUrl === "string" ? (normalizeMediaUrl(lesson.presentationUrl?.trim() || undefined) || undefined) : lesson.presentationUrl) ?? (prevLesson.presentationUrl as any),
                presentationStoragePath: (typeof lesson.presentationStoragePath === "string" ? (lesson.presentationStoragePath.trim() ? lesson.presentationStoragePath : undefined) : lesson.presentationStoragePath) ?? (prevLesson.presentationStoragePath as any),
                slides: lesson.slides !== undefined ? normalizeSlides(lesson.slides) : (prevLesson.slides as any),
                contentType: lesson.contentType !== undefined ? lesson.contentType : (prevLesson.contentType ?? "text"),
              },
            })
          )
        } else {
          // Fallback: if draft lost lesson id, update existing lesson with the same orderIndex instead of creating
          const targetOrder = lesson.orderIndex ?? lessonIndex
          const sameOrder = (prevModule.lessons || []).find((l) => Number(l.orderIndex) === Number(targetOrder))
          if (sameOrder) {
            ops.push(
              prisma.lesson.update({
                where: { id: sameOrder.id },
                data: {
                  title: lesson.title,
                  content: typeof lesson.content === "string" ? (lesson.content.trim() ? lesson.content : undefined) : lesson.content,
                  duration: typeof lesson.duration === "string" ? (lesson.duration.trim() ? lesson.duration : undefined) : lesson.duration,
                  orderIndex: targetOrder,
                  isFreePreview: lesson.isFreePreview ?? sameOrder.isFreePreview ?? false,
                  videoUrl: normalizeMediaUrl(lesson.videoUrl) || (sameOrder.videoUrl as any),
                  videoStoragePath: lesson.videoStoragePath ?? (sameOrder.videoStoragePath as any),
                  presentationUrl: normalizeMediaUrl(lesson.presentationUrl) || (sameOrder.presentationUrl as any),
                  presentationStoragePath: lesson.presentationStoragePath ?? (sameOrder.presentationStoragePath as any),
                  slides: lesson.slides !== undefined ? normalizeSlides(lesson.slides) : (sameOrder.slides as any),
                  contentType: lesson.contentType !== undefined ? lesson.contentType : (sameOrder.contentType ?? "text"),
                },
              })
            )
            continue
          }
          ops.push(
            prisma.lesson.create({
              data: {
                moduleId: prevModule.id,
                title: lesson.title,
                content: typeof lesson.content === "string" ? (lesson.content.trim() ? lesson.content : undefined) : lesson.content,
                duration: typeof lesson.duration === "string" ? (lesson.duration.trim() ? lesson.duration : undefined) : lesson.duration,
                orderIndex: lesson.orderIndex ?? lessonIndex,
                isFreePreview: lesson.isFreePreview ?? false,
                videoUrl: normalizeMediaUrl(lesson.videoUrl) || lesson.videoUrl,
                videoStoragePath: lesson.videoStoragePath,
                presentationUrl: normalizeMediaUrl(lesson.presentationUrl) || lesson.presentationUrl,
                presentationStoragePath: lesson.presentationStoragePath,
                slides: normalizeSlides(lesson.slides) ?? [],
                contentType: lesson.contentType,
              },
            })
          )
        }
      }
    } else {
      // If module.id missing, create a new module instead of trying to match/update existing one by orderIndex.
      // Matching by orderIndex can unintentionally overwrite existing modules/lessons when local drafts
      // lack remote IDs. Safer approach: always create new module (append) for missing IDs.
      ops.push(
        prisma.courseModule.create({
          data: {
            courseId,
            title: module.title,
            description: module.description,
            orderIndex: nextModuleOrder++,
            lessons: {
              create: (module.lessons || []).map((lesson, lessonIndex) => ({
                ...(lesson.id ? { id: lesson.id } : {}),
                title: lesson.title,
                content: typeof lesson.content === "string" ? (lesson.content.trim() ? lesson.content : undefined) : lesson.content,
                duration: typeof lesson.duration === "string" ? (lesson.duration.trim() ? lesson.duration : undefined) : lesson.duration,
                orderIndex: lesson.orderIndex ?? lessonIndex,
                isFreePreview: lesson.isFreePreview ?? false,
                videoUrl: normalizeMediaUrl(lesson.videoUrl) || lesson.videoUrl,
                videoStoragePath: lesson.videoStoragePath,
                presentationUrl: normalizeMediaUrl(lesson.presentationUrl) || lesson.presentationUrl,
                presentationStoragePath: lesson.presentationStoragePath,
                slides: normalizeSlides(lesson.slides) ?? [],
                contentType: lesson.contentType,
              })),
            },
          },
        })
      )
    }
  }

  // Optional: sync deletions by IDs (and orderIndex fallback) for modules/lessons that were removed in payload
  if (pruneMissing) {
    if (modulesToDeleteIds.length > 0) {
      ops.push(prisma.courseModule.deleteMany({ where: { id: { in: modulesToDeleteIds } } }))
    }

    // Lessons deletion per matched existing module
    for (let moduleIndex = 0; moduleIndex < data.modules.length; moduleIndex++) {
      const module = data.modules[moduleIndex]
      // Determine corresponding existing module (by id or orderIndex)
      const prevModule = module.id
        ? existingModulesById.get(module.id)
        : existingModulesByOrder.get(Number(module.orderIndex ?? moduleIndex))
      if (!prevModule) continue
      const keepLessonIds = new Set<string>()
      const prevLessons = prevModule.lessons || []
      for (let lessonIndex = 0; lessonIndex < (module.lessons || []).length; lessonIndex++) {
        const lesson = module.lessons[lessonIndex]
        if (lesson.id) keepLessonIds.add(lesson.id)
        else {
          const targetOrder = lesson.orderIndex ?? lessonIndex
          const same = prevLessons.find((l: any) => Number(l.orderIndex) === Number(targetOrder))
          if (same) keepLessonIds.add(same.id)
        }
      }
      const lessonsToDelete = prevLessons
        .filter((l: any) => !keepLessonIds.has(l.id))
        .map((l: any) => l.id)
      if (lessonsToDelete.length > 0) {
        ops.push(prisma.lesson.deleteMany({ where: { id: { in: lessonsToDelete } } }))
      }
    }
  }

  await prisma.$transaction(ops as any)

  const updated = await prisma.course.findUnique({
    where: { id: courseId },
    include: { modules: { include: { lessons: true }, orderBy: { orderIndex: "asc" } } },
  })

  res.json(updated)
})

router.post("/courses/:courseId/publish", async (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.params
  const { published } = z.object({ published: z.boolean().default(true) }).parse(req.body)
  const course = await prisma.course.update({ where: { id: courseId }, data: { isPublished: published } })
  res.json(course)
})

router.delete("/courses/:courseId", async (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.params
  try {
    await prisma.$transaction([
      prisma.lesson.deleteMany({ where: { module: { courseId } } }),
      prisma.courseModule.deleteMany({ where: { courseId } }),
      prisma.enrollment.deleteMany({ where: { courseId } }).catch(() => null) as any,
      prisma.purchase.deleteMany({ where: { courseId } }).catch(() => null) as any,
    ] as any)
  } catch { }
  await prisma.course.delete({ where: { id: courseId } }).catch(() => null)
  res.json({ success: true })
})

router.get("/teams", async (_req: AuthenticatedRequest, res: Response) => {
  const teams = await prisma.team.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { memberships: true } } } })
  res.json(teams)
})

router.post("/teams", async (req: AuthenticatedRequest, res: Response) => {
  const parsed = teamSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = parsed.data

  const team = await prisma.team.create({
    data: {
      id: data.id,
      name: data.name,
      description: data.description,
      captainId: data.captainId ?? req.user!.id,
      logoUrl: data.logoUrl,
      maxMembers: data.maxMembers ?? 6,
      isActive: data.isActive ?? true,
      metadata: data.metadata ?? undefined,
    },
  })

  res.status(201).json(team)
})

router.put("/teams/:teamId", async (req: AuthenticatedRequest, res: Response) => {
  const { teamId } = req.params
  const parsed = teamSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = parsed.data

  const team = await prisma.team.update({
    where: { id: teamId },
    data: {
      name: data.name,
      description: data.description,
      captainId: data.captainId ?? req.user!.id,
      logoUrl: data.logoUrl,
      maxMembers: data.maxMembers ?? 6,
      isActive: data.isActive ?? true,
      metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
    },
  })

  res.json(team)
})

router.delete("/teams/:teamId", async (req: AuthenticatedRequest, res: Response) => {
  const { teamId } = req.params
  await prisma.teamMembership.deleteMany({ where: { teamId } }).catch(() => null)
  await prisma.team.delete({ where: { id: teamId } }).catch(() => null)
  res.json({ success: true })
})

// Team members with registration statuses
router.get("/teams/:teamId/members", async (req: AuthenticatedRequest, res: Response) => {
  const { teamId } = req.params
  const status = (req.query.status as string | undefined) || undefined
  const where: any = { teamId }
  if (status) where.status = status
  const members = await prisma.teamMembership.findMany({
    where,
    orderBy: { joinedAt: "desc" },
    include: { user: { select: { id: true, email: true, fullName: true, profile: true } } },
  })
  res.json(members)
})

// Update team member role/status
const memberUpdateSchema = z.object({
  role: z.string().optional(),
  status: z.string().optional(),
})

router.put("/teams/:teamId/members/:membershipId", async (req: AuthenticatedRequest, res: Response) => {
  const { membershipId } = req.params
  const parsed = memberUpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = parsed.data
  const updated = await prisma.teamMembership.update({ where: { id: membershipId }, data }).catch(() => null)
  if (!updated) return res.status(404).json({ error: "Membership not found" })
  res.json(updated)
})

// ---- Events moderation ----
router.get("/events", async (_req: AuthenticatedRequest, res: Response) => {
  const events = await (prisma as any).event.findMany({ orderBy: { createdAt: "desc" } })
  res.json(events)
})

// List registrations for a specific event
router.get("/events/:eventId/registrations", async (req: AuthenticatedRequest, res: Response) => {
  const { eventId } = req.params
  const regs = await (prisma as any).eventRegistration.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, email: true, fullName: true } } },
  })
  res.json(regs)
})

// Approve or reject a registration
router.post("/events/:eventId/registrations/:regId/approve", async (req: AuthenticatedRequest, res: Response) => {
  const { regId } = req.params
  const updated = await (prisma as any).eventRegistration.update({ where: { id: regId }, data: { status: "approved" } }).catch(() => null)
  if (!updated) return res.status(404).json({ error: "Registration not found" })
  res.json(updated)
})

router.post("/events/:eventId/registrations/:regId/reject", async (req: AuthenticatedRequest, res: Response) => {
  const { regId } = req.params
  const updated = await (prisma as any).eventRegistration.update({ where: { id: regId }, data: { status: "rejected" } }).catch(() => null)
  if (!updated) return res.status(404).json({ error: "Registration not found" })
  res.json(updated)
})

router.put("/events/:eventId", async (req: AuthenticatedRequest, res: Response) => {
  const { eventId } = req.params
  const data = req.body as any
  try {
    const updated = await (prisma as any).event.update({
      where: { id: eventId },
      data: {
        title: data.title,
        description: data.description,
        audience: data.audience,
        contact: data.contact,
        date: data.date ? new Date(data.date) : undefined,
        imageUrl: data.imageUrl,
        format: data.format,
        isFree: data.isFree,
        price: data.price,
        location: data.location,
        url: data.url,
      },
    })
    res.json(updated)
  } catch (e) {
    res.status(404).json({ error: "Event not found" })
  }
})

// Create event as admin
router.post("/events", async (req: AuthenticatedRequest, res: Response) => {
  const data = req.body as any
  const created = await (prisma as any).event.create({
    data: {
      title: data.title,
      description: data.description,
      audience: data.audience,
      contact: data.contact,
      date: data.date ? new Date(data.date) : undefined,
      imageUrl: data.imageUrl,
      format: data.format ?? "offline",
      isFree: data.isFree ?? true,
      price: data.price ?? 0,
      location: data.location,
      url: data.url,
      status: data.status ?? "published",
      createdById: req.user!.id,
    },
  })
  res.status(201).json(created)
})

router.post("/events/:eventId/publish", async (req: AuthenticatedRequest, res: Response) => {
  const { eventId } = req.params
  const ev = await (prisma as any).event.update({ where: { id: eventId }, data: { status: "published" } }).catch(() => null)
  if (!ev) return res.status(404).json({ error: "Event not found" })
  res.json(ev)
})

router.post("/events/:eventId/reject", async (req: AuthenticatedRequest, res: Response) => {
  const { eventId } = req.params
  const ev = await (prisma as any).event.update({ where: { id: eventId }, data: { status: "rejected" } }).catch(() => null)
  if (!ev) return res.status(404).json({ error: "Event not found" })
  res.json(ev)
})

// Delete event (admin)
router.delete("/events/:eventId", async (req: AuthenticatedRequest, res: Response) => {
  const { eventId } = req.params
  await (prisma as any).eventRegistration.deleteMany({ where: { eventId } }).catch(() => null)
  await (prisma as any).event.delete({ where: { id: eventId } }).catch(() => null)
  res.json({ success: true })
})

// Bulk delete all events (admin)
router.delete("/events", async (_req: AuthenticatedRequest, res: Response) => {
  const result = await (prisma as any).event.deleteMany({})
  res.json({ success: true, deleted: result.count ?? undefined })
})

// ---- Competition submissions moderation ----
router.get("/competition-submissions", async (req: AuthenticatedRequest, res: Response) => {
  const status = (req.query.status as string | undefined) as any
  const where = status ? { status } : {}
  const list = await prisma.competitionSubmission.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, email: true, fullName: true } } },
  })
  res.json(list)
})

router.put("/competition-submissions/:id", async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const data = req.body as any
  try {
    const updated = await prisma.competitionSubmission.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        projectSummary: data.projectSummary,
        venue: data.venue,
        placement: data.placement,
        eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
        imageUrl: data.imageUrl,
      },
    })
    res.json(updated)
  } catch (e) {
    res.status(404).json({ error: "Submission not found" })
  }
})

router.post("/competition-submissions/:id/approve", async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const sub = await prisma.competitionSubmission.update({ where: { id }, data: { status: "approved" } }).catch(() => null)
  if (!sub) return res.status(404).json({ error: "Submission not found" })
  res.json(sub)
})

router.post("/competition-submissions/:id/reject", async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const sub = await prisma.competitionSubmission.update({ where: { id }, data: { status: "rejected" } }).catch(() => null)
  if (!sub) return res.status(404).json({ error: "Submission not found" })
  res.json(sub)
})

// GET /api/admin/analytics - System statistics
router.get("/analytics", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      usersCount,
      studentsCount,
      mentorsCount,
      coursesCount,
      kruzhoksCount,
      totalCoins,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: UserRole.STUDENT } }),
      prisma.user.count({ where: { role: UserRole.MENTOR } }),
      prisma.course.count(),
      prisma.kruzhok.count(),
      prisma.user.aggregate({ _sum: { coinBalance: true } }),
    ])

    const sumCoins = totalCoins._sum?.coinBalance ?? 0

    res.json({
      usersCount,
      studentsCount,
      mentorsCount,
      coursesCount,
      kruzhoksCount,
      totalCoins: sumCoins,
    })
  } catch (error) {
    console.error("Failed to fetch analytics:", error)
    res.status(500).json({ error: "Failed to fetch analytics" })
  }
})
