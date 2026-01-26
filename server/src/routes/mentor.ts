import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"
import * as XLSX from "xlsx"

export const router = Router()

const db = prisma as any

// All routes require authentication
router.use(requireAuth)

// Helper to check if user is mentor for a kruzhok
async function isMentorOrOwner(userId: string, kruzhokId: string): Promise<boolean> {
    const kruzhok = await db.kruzhok.findUnique({
        where: { id: kruzhokId },
        select: { ownerId: true, programId: true }
    })
    if (!kruzhok) return false
    if (kruzhok.ownerId === userId) return true

    // Check if user is assigned as mentor in ClubMentor via shared program
    if (!kruzhok.programId) return false
    const mentorRole = await db.clubMentor.findFirst({
        where: { userId, club: { programId: kruzhok.programId } }
    })
    return !!mentorRole
}

async function getMentorProgramIds(userId: string): Promise<string[]> {
    const rows = await db.clubMentor.findMany({
        where: { userId },
        select: { club: { select: { programId: true } } }
    })
    const ids = (rows || [])
        .map((r: any) => r.club?.programId)
        .filter((id: any) => typeof id === "string" && id.length > 0)
    return Array.from(new Set(ids))
}

async function getClassAccess(userId: string, role: string, classId: string): Promise<{ exists: boolean; hasAccess: boolean }> {
    const cls = await db.clubClass.findUnique({
        where: { id: classId },
        select: {
            id: true,
            mentorId: true,
            createdById: true,
            kruzhok: { select: { ownerId: true, programId: true } }
        }
    })

    if (!cls) return { exists: false, hasAccess: false }
    if (role === "ADMIN") return { exists: true, hasAccess: true }

    let hasAccess = cls.mentorId === userId || cls.createdById === userId || cls.kruzhok?.ownerId === userId

    if (!hasAccess && cls.kruzhok?.programId) {
        const mentorRole = await db.clubMentor.findFirst({
            where: { userId, club: { programId: cls.kruzhok.programId } },
            select: { id: true }
        })
        if (mentorRole) hasAccess = true
    }

    if (!hasAccess) {
        const taught = await db.schedule.findFirst({
            where: {
                classId,
                OR: [
                    { createdById: userId },
                    { attendances: { some: { markedById: userId } } }
                ]
            },
            select: { id: true }
        })
        if (taught) hasAccess = true
    }

    return { exists: true, hasAccess }
}

const getPeriodKey = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    return `${year}-${month}`
}

const getScheduleAmount = (schedule: any) => {
    const wage = Number(schedule?.class?.wagePerLesson || 0)
    return wage > 0 ? wage : 0
}

const buildMentorScheduleWhere = (userId: string, role: string, from?: Date, to?: Date, statuses?: string[]) => {
    const where: any = {}
    if (role !== "ADMIN") {
        where.OR = [
            { createdById: userId },
            { class: { mentorId: userId } }
        ]
    }
    if (from || to) {
        where.scheduledDate = {}
        if (from) where.scheduledDate.gte = from
        if (to) where.scheduledDate.lte = to
    }
    if (statuses && statuses.length > 0) {
        where.status = { in: statuses }
    }
    return where
}

// GET /api/mentor/open-groups - Get open groups for mentor to join/take
router.get("/open-groups", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role

        // Get classes that are open for enrollment
        const classes = await db.clubClass.findMany({
            where: {
                isActive: true,
                ...(role !== "ADMIN" ? { kruzhok: { ownerId: userId } } : {})
            },
            include: {
                kruzhok: { select: { id: true, title: true } },
                _count: { select: { enrollments: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 10
        })

        const groups = classes.map((c: any) => ({
            id: c.id,
            name: c.name,
            kruzhokTitle: c.kruzhok?.title || "",
            studentsCount: c._count?.enrollments || 0,
            schedule: c.scheduleDescription || null
        }))

        res.json(groups)
    } catch (error) {
        console.error("[mentor/open-groups] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/mentor/groups - Get mentor's groups
router.get("/groups", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role

        const where: any = {}
        let programIds: string[] = []
        if (role !== "ADMIN") {
            programIds = await getMentorProgramIds(userId)
            where.OR = [
                { createdById: userId },
                { mentorId: userId },
                { kruzhok: { ownerId: userId } },
                ...(programIds.length ? [{ kruzhok: { programId: { in: programIds } } }] : []),
                { schedules: { some: { createdById: userId } } },
                { schedules: { some: { attendances: { some: { markedById: userId } } } } },
            ]
        }

        const classes = await db.clubClass.findMany({
            where,
            include: {
                kruzhok: {
                    select: {
                        title: true,
                        program: { select: { title: true, _count: { select: { lessons: true } } } }
                    }
                },
                _count: { select: { enrollments: true } }
            },
            orderBy: { createdAt: "desc" }
        })

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const classIds = (classes || []).map((c: any) => c.id)

        const nextSchedules = classIds.length
            ? await db.schedule.findMany({
                where: {
                    classId: { in: classIds },
                    status: { in: ["SCHEDULED", "IN_PROGRESS"] },
                    scheduledDate: { gte: today }
                },
                select: { classId: true, scheduledDate: true, scheduledTime: true, title: true },
                orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }]
            })
            : []

        const nextByClassId = new Map<string, any>()
        for (const s of nextSchedules || []) {
            if (!s.classId) continue
            if (!nextByClassId.has(s.classId)) nextByClassId.set(s.classId, s)
        }

        const groups = (classes || []).map((c: any) => {
            const next = nextByClassId.get(c.id)
            return {
                id: c.id,
                name: c.name,
                kruzhokTitle: c.kruzhok?.title || "",
                programTitle: c.kruzhok?.program?.title || null,
                programLessons: c.kruzhok?.program?._count?.lessons || 0,
                studentsCount: c._count?.enrollments || 0,
                schedule: c.scheduleDescription || null,
                nextLesson: next ? `${new Date(next.scheduledDate).toISOString()} ${next.scheduledTime || ""}`.trim() : null,
            }
        })

        res.json(groups)
    } catch (error) {
        console.error("[mentor/groups] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/mentor/groups/:id - Get specific group details
router.get("/groups/:id", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role
        const { id } = req.params

        // Verify access first
        const access = await getClassAccess(userId, role, id)
        if (!access.exists) return res.status(404).json({ error: "Group not found" })
        if (!access.hasAccess) return res.status(403).json({ error: "Permission denied" })

        const group = await db.clubClass.findUnique({
            where: { id },
            include: {
                kruzhok: {
                    select: {
                        title: true,
                        program: { select: { title: true, _count: { select: { lessons: true } } } }
                    }
                },
                _count: { select: { enrollments: true } }
            }
        })

        if (!group) return res.status(404).json({ error: "Group not found" })

        // Get next lesson
        const today = new Date()
        const nextSchedule = await db.schedule.findFirst({
            where: {
                classId: id,
                status: { in: ["SCHEDULED", "IN_PROGRESS"] },
                scheduledDate: { gte: today }
            },
            orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }]
        })

        const mapped = {
            id: group.id,
            name: group.name,
            kruzhokTitle: group.kruzhok?.title || "",
            programTitle: group.kruzhok?.program?.title || null,
            programLessons: group.kruzhok?.program?._count?.lessons || 0,
            studentsCount: group._count?.enrollments || 0,
            schedule: group.scheduleDescription || null,
            nextLesson: nextSchedule ? {
                date: nextSchedule.scheduledDate,
                time: nextSchedule.scheduledTime,
                title: nextSchedule.title
            } : null,
            isActive: group.isActive
        }

        res.json(mapped)
    } catch (error) {
        console.error("[mentor/groups/:id] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/mentor/groups/:id/gradebook - Get gradebook (history of lessons)
router.get("/groups/:id/gradebook", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role
        const { id } = req.params

        // Access check
        const access = await getClassAccess(userId, role, id)
        if (!access.exists) return res.status(404).json({ error: "Group not found" })
        if (!access.hasAccess) return res.status(403).json({ error: "Permission denied" })

        const schedules = await db.schedule.findMany({
            where: { classId: id, status: { in: ["COMPLETED", "IN_PROGRESS"] } },
            select: {
                id: true,
                title: true,
                scheduledDate: true,
                status: true,
                completedAt: true
            },
            orderBy: { scheduledDate: "desc" },
            take: 50
        })

        res.json(schedules)
    } catch (error) {
        console.error("[mentor/groups/gradebook] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/mentor/groups/:id/lesson/:scheduleId - Get detailed lesson report (gradebook view)
router.get("/groups/:id/report/:scheduleId", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role
        const { id, scheduleId } = req.params

        // Verify access
        const access = await getClassAccess(userId, role, id)
        if (!access.exists) return res.status(404).json({ error: "Group not found" })
        if (!access.hasAccess) return res.status(403).json({ error: "Permission denied" })

        const schedule = await db.schedule.findUnique({ where: { id: scheduleId } })
        if (!schedule) return res.status(404).json({ error: "Schedule not found" })

        // Get enrolled students
        const enrollments = await db.classEnrollment.findMany({
            where: { classId: id, status: "active" },
            include: { user: { select: { id: true, fullName: true, email: true } } }
        })

        // Get attendance
        const records = await db.attendance.findMany({
            where: { scheduleId }
        })

        // Get student ratings (MentorReview)
        const reviews = await db.mentorReview.findMany({
            where: { scheduleId }
        })

        const rows = enrollments.map((e: any) => {
            const att = records.find((r: any) => r.studentId === e.userId)
            const review = reviews.find((r: any) => r.studentId === e.userId)
            return {
                student: e.user,
                status: att?.status || "ABSENT",
                grade: att?.grade || null,
                workSummary: att?.workSummary || "",
                feedback: att?.notes || "",
                studentRating: review?.rating || null,
                studentComment: review?.comment || null,
                recordId: att?.id
            }
        })

        // Also add walk-ins
        const walkedInIds = records
            .filter((r: any) => !enrollments.find((e: any) => e.userId === r.studentId))
            .map((r: any) => r.studentId)

        if (walkedInIds.length > 0) {
            const walkIns = await db.user.findMany({ where: { id: { in: walkedInIds } }, select: { id: true, fullName: true, email: true } })
            for (const w of walkIns) {
                const att = records.find((r: any) => r.studentId === w.id)
                const review = reviews.find((r: any) => r.studentId === w.id)
                rows.push({
                    student: w,
                    status: att?.status || "PRESENT",
                    grade: att?.grade || null,
                    workSummary: att?.workSummary || "",
                    feedback: att?.notes || "",
                    studentRating: review?.rating || null,
                    studentComment: review?.comment || null,
                    recordId: att?.id
                })
            }
        }

        res.json({
            schedule: {
                title: schedule.title,
                date: schedule.scheduledDate,
            },
            rows
        })

    } catch (error) {
        console.error("[mentor/groups/report] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/mentor/wallet/summary - Wallet summary for home page widget
router.get("/wallet/summary", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role
        const now = new Date()
        const monthKey = getPeriodKey(now)

        const payments = await db.salaryPayment.findMany({
            where: { userId },
            select: { amount: true, period: true, status: true }
        }).catch(() => [])

        const paidTotal = payments
            .filter((p: any) => p.status === "PAID")
            .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

        const paidThisMonth = payments
            .filter((p: any) => p.status === "PAID" && p.period === monthKey)
            .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        const schedules = await db.schedule.findMany({
            where: buildMentorScheduleWhere(userId, role, startOfMonth, nextMonth, ["COMPLETED"]),
            include: { class: { select: { wagePerLesson: true } } }
        }).catch(() => [])

        const dueThisMonth = schedules.reduce((sum: number, s: any) => sum + getScheduleAmount(s), 0)
        const lessonsThisMonth = schedules.length
        const pendingBalance = Math.max(dueThisMonth - paidThisMonth, 0)

        res.json({ balance: paidTotal, pendingBalance, lessonsThisMonth })
    } catch (error) {
        console.error("[mentor/wallet/summary] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/mentor/wallet - Full wallet data
router.get("/wallet", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role

        const payments = await db.salaryPayment.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" }
        }).catch(() => [])

        const paidTotal = payments
            .filter((p: any) => p.status === "PAID")
            .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

        const now = new Date()
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
        const paidThisMonth = payments
            .filter((p: any) => p.status === "PAID" && p.period === monthKey)
            .reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

        const completedSchedules = await db.schedule.findMany({
            where: buildMentorScheduleWhere(userId, role, undefined, undefined, ["COMPLETED"]),
            include: { class: { select: { wagePerLesson: true } } }
        }).catch(() => [])

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const earnedThisMonth = completedSchedules
            .filter((s: any) => {
                const lessonDate = s.completedAt ? new Date(s.completedAt) : new Date(s.scheduledDate)
                return lessonDate >= monthStart
            })
            .reduce((sum: number, s: any) => sum + getScheduleAmount(s), 0)

        const pendingBalance = Math.max(Math.round(earnedThisMonth) - paidThisMonth, 0)

        const reviewAgg = await db.mentorReview.aggregate({
            where: { mentorId: userId },
            _avg: { rating: true },
            _count: { rating: true }
        }).catch(() => ({ _avg: { rating: null }, _count: { rating: 0 } }))

        const ratingAvg = Number(reviewAgg?._avg?.rating || 0)
        const ratingCount = Number(reviewAgg?._count?.rating || 0)

        const mentors = await db.user.findMany({
            where: { role: "MENTOR" },
            select: { id: true }
        }).catch(() => [])

        const grouped = await db.mentorReview.groupBy({
            by: ["mentorId"],
            _avg: { rating: true }
        }).catch(() => [])

        const ratingMap = new Map((grouped || []).map((g: any) => [g.mentorId, Number(g._avg?.rating || 0)]))
        const ranked = (mentors || []).map((m: any) => ({
            id: m.id,
            rating: ratingMap.get(m.id) || 0
        })).sort((a: any, b: any) => b.rating - a.rating)

        const rankIndex = ranked.findIndex((r: any) => r.id === userId) + 1
        const rankTotal = ranked.length || 1

        const grade = ratingAvg >= 4.8 ? "S" : ratingAvg >= 4.5 ? "A" : ratingAvg >= 4.2 ? "B" : ratingAvg >= 4.0 ? "C" : "D"

        const totalLessonAmount = completedSchedules.reduce((sum: number, s: any) => sum + getScheduleAmount(s), 0)
        const averageLessonWage = completedSchedules.length ? Math.round(totalLessonAmount / completedSchedules.length) : 0

        res.json({
            balance: paidTotal,
            pendingBalance,
            totalEarned: paidTotal,
            lessonsCount: completedSchedules.length,
            ratePerHour: averageLessonWage,
            grade,
            ratingAvg,
            ratingCount,
            rank: rankIndex,
            rankTotal
        })
    } catch (error) {
        console.error("[mentor/wallet] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/mentor/wallet/transactions - Payroll transactions
router.get("/wallet/transactions", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const payments = await db.salaryPayment.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" }
        }).catch(() => [])

        const transactions = (payments || []).map((p: any) => ({
            id: p.id,
            amount: p.amount || 0,
            type: "income",
            description: `Salary payment (${p.period || "period"})`,
            createdAt: p.createdAt,
            status: p.status === "PAID" ? "completed" : "pending"
        }))

        res.json(transactions)
    } catch (error) {
        console.error("[mentor/wallet/transactions] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/mentor/payroll/lessons - Completed lessons with payroll amounts
router.get("/payroll/lessons", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role

        const lessons = await db.schedule.findMany({
            where: buildMentorScheduleWhere(userId, role, undefined, undefined, ["COMPLETED"]),
            include: {
                class: { select: { name: true, wagePerLesson: true } },
                kruzhok: { select: { title: true } }
            },
            orderBy: { completedAt: "desc" },
            take: 50
        })

        const result = (lessons || []).map((l: any) => ({
            id: l.id,
            title: l.title,
            className: l.class?.name,
            kruzhokTitle: l.kruzhok?.title,
            completedAt: l.completedAt || l.scheduledDate,
            durationMinutes: l.durationMinutes || 60,
            amount: getScheduleAmount(l)
        }))

        res.json(result)
    } catch (error) {
        console.error("[mentor/payroll/lessons] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/mentor/today-lessons - Today's lessons for home page widget
router.get("/today-lessons", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        const schedules = await db.schedule.findMany({
            where: buildMentorScheduleWhere(userId, role, today, tomorrow, ["SCHEDULED", "IN_PROGRESS"]),
            include: {
                class: { select: { name: true, _count: { select: { enrollments: true } } } }
            },
            orderBy: { scheduledTime: "asc" }
        })

        const lessons = schedules.map((s: any) => ({
            id: s.id,
            groupName: s.class?.name || s.title,
            time: s.scheduledTime || "",
            studentsCount: s.class?._count?.enrollments || 0
        }))

        res.json(lessons)
    } catch (error) {
        console.error("[mentor/today-lessons] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/mentor/schedule - Mentor's teaching schedule
router.get("/schedule", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role
        const { from, to } = req.query as { from?: string; to?: string }

        const start = from ? new Date(from) : undefined
        const end = to ? new Date(to) : undefined
        const where = buildMentorScheduleWhere(userId, role, start, end)

        const schedules = await db.schedule.findMany({
            where,
            include: {
                kruzhok: { select: { id: true, title: true } },
                class: { select: { id: true, name: true } },
                lessonTemplate: { select: { id: true, title: true } },
                attendances: {
                    select: {
                        studentId: true,
                        status: true,
                        student: { select: { id: true, fullName: true } }
                    }
                }
            },
            orderBy: { scheduledDate: "asc" }
        })

        res.json(schedules)
    } catch (error) {
        console.error("[mentor/schedule] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/mentor/schedule - Create a new schedule item (lesson)
const createScheduleSchema = z.object({
    kruzhokId: z.string().min(1),
    classId: z.string().optional(),
    title: z.string().min(1),
    scheduledDate: z.string().datetime(), // ISO string
    scheduledTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM
    durationMinutes: z.number().int().positive().default(60),
})

router.post("/schedule", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role
        const parsed = createScheduleSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const { kruzhokId, classId, title, scheduledDate, scheduledTime, durationMinutes } = parsed.data

        // Verify access
        if (role !== "ADMIN") {
            const hasAccess = await isMentorOrOwner(userId, kruzhokId)
            if (!hasAccess) {
                return res.status(403).json({ error: "Permission denied" })
            }
        }

        const schedule = await db.schedule.create({
            data: {
                kruzhokId,
                classId,
                title,
                scheduledDate: new Date(scheduledDate),
                scheduledTime,
                durationMinutes,
                createdById: userId,
                status: "SCHEDULED"
            }
        })

        res.status(201).json(schedule)
    } catch (error) {
        console.error("[mentor/schedule create] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// PUT /api/mentor/schedule/:id - Update schedule status or details
const updateScheduleSchema = z.object({
    title: z.string().min(1).optional(),
    status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
    durationMinutes: z.number().int().positive().optional(),
})

router.put("/schedule/:id", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role
        const { id } = req.params
        const parsed = updateScheduleSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        // Check if schedule exists and user has access
        const schedule = await db.schedule.findUnique({
            where: { id },
            select: { kruzhokId: true }
        })

        if (!schedule) {
            return res.status(404).json({ error: "Schedule not found" })
        }

        if (role !== "ADMIN") {
            const hasAccess = await isMentorOrOwner(userId, schedule.kruzhokId)
            if (!hasAccess) return res.status(403).json({ error: "Permission denied" })
        }

        const updated = await db.schedule.update({
            where: { id },
            data: {
                ...parsed.data,
                completedAt: parsed.data.status === "COMPLETED" ? new Date() : undefined
            }
        })

        res.json(updated)
    } catch (error) {
        console.error("[mentor/schedule update] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/mentor/schedule/:id/attendance - Mark attendance
const attendanceSchema = z.object({
    attendances: z.array(z.object({
        studentId: z.string().min(1),
        status: z.enum(["PRESENT", "LATE", "ABSENT"]),
        notes: z.string().optional()
    }))
})

router.post("/schedule/:id/attendance", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role
        const { id } = req.params
        const parsed = attendanceSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        // Check if schedule exists and user has access
        const schedule = await db.schedule.findUnique({
            where: { id },
            select: { kruzhokId: true }
        })

        if (!schedule) return res.status(404).json({ error: "Schedule not found" })

        if (role !== "ADMIN") {
            const hasAccess = await isMentorOrOwner(userId, schedule.kruzhokId)
            if (!hasAccess) return res.status(403).json({ error: "Permission denied" })
        }

        // Update attendance
        await db.$transaction(
            parsed.data.attendances.map((a: any) =>
                db.attendance.upsert({
                    where: {
                        scheduleId_studentId: {
                            scheduleId: id,
                            studentId: a.studentId
                        }
                    },
                    update: {
                        status: a.status,
                        notes: a.notes,
                        markedById: userId,
                        markedAt: new Date()
                    },
                    create: {
                        scheduleId: id,
                        studentId: a.studentId,
                        status: a.status,
                        notes: a.notes,
                        markedById: userId,
                        markedAt: new Date()
                    }
                })
            )
        )

        res.json({ success: true })
    } catch (error) {
        console.error("[mentor/attendance] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/mentor/students - List of students in mentor's classes
router.get("/students", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role

        // Get kruzhoks owned by mentor
        const kruzhokIds = await db.kruzhok.findMany({
            where: role === "ADMIN" ? { isActive: true } : { ownerId: userId, isActive: true },
            select: { id: true }
        }).then((ks: any[]) => ks.map(k => k.id))

        // Get class IDs from these kruzhoks
        const classIds = await db.clubClass.findMany({
            where: { kruzhokId: { in: kruzhokIds }, isActive: true },
            select: { id: true }
        }).then((cs: any[]) => cs.map(c => c.id))

        // Get unique students enrolled in these classes
        const enrollments = await db.classEnrollment.findMany({
            where: { classId: { in: classIds }, status: "active" },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        level: true,
                        experiencePoints: true,
                        coinBalance: true
                    }
                },
                class: {
                    select: {
                        id: true,
                        name: true,
                        kruzhok: { select: { id: true, title: true } }
                    }
                }
            }
        })

        // Deduplicate students
        const studentMap = new Map()
        for (const e of enrollments) {
            if (!studentMap.has(e.user.id)) {
                studentMap.set(e.user.id, {
                    ...e.user,
                    classes: []
                })
            }
            studentMap.get(e.user.id).classes.push({
                id: e.class.id,
                name: e.class.name,
                kruzhokTitle: e.class.kruzhok?.title
            })
        }

        res.json(Array.from(studentMap.values()))
    } catch (error) {
        console.error("[mentor/students] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/mentor/student/:studentId - Student detailed info
router.get("/student/:studentId", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role
        const { studentId } = req.params

        const student = await db.user.findUnique({
            where: { id: studentId },
            select: {
                id: true,
                fullName: true,
                email: true,
                level: true,
                experiencePoints: true,
                coinBalance: true,
                createdAt: true,
                classEnrollments: {
                    include: {
                        class: {
                            select: {
                                id: true,
                                name: true,
                                kruzhok: { select: { id: true, title: true, ownerId: true } }
                            }
                        }
                    }
                },
                achievements: {
                    include: { achievement: true },
                    orderBy: { earnedAt: "desc" }
                }
            }
        })

        if (!student) {
            return res.status(404).json({ error: "Student not found" })
        }

        // Verify mentor has access to this student (owns a kruzhok where student is enrolled)
        if (role !== "ADMIN") {
            const hasAccess = student.classEnrollments.some(
                (e: any) => e.class?.kruzhok?.ownerId === userId
            )
            if (!hasAccess) {
                return res.status(403).json({ error: "You don't have access to this student" })
            }
        }

        // Get attendance for this student
        const attendance = await db.attendance.findMany({
            where: { studentId },
            include: {
                schedule: { select: { id: true, title: true, scheduledDate: true } }
            },
            orderBy: { markedAt: "desc" },
            take: 50
        })

        res.json({ ...student, attendance })
    } catch (error) {
        console.error("[mentor/student] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/mentor/award-coins - Award S7 100 to student
const awardCoinsSchema = z.object({
    studentId: z.string().min(1),
    amount: z.number().int().positive().max(10000),
    reason: z.string().min(1).max(255)
})

router.post("/award-coins", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role
        const parsed = awardCoinsSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const { studentId, amount, reason } = parsed.data

        // Get student and verify mentor access
        const student = await db.user.findUnique({
            where: { id: studentId },
            include: {
                classEnrollments: {
                    include: {
                        class: {
                            select: { kruzhok: { select: { ownerId: true } } }
                        }
                    }
                }
            }
        })

        if (!student) {
            return res.status(404).json({ error: "Student not found" })
        }

        // Verify access
        if (role !== "ADMIN") {
            const hasAccess = student.classEnrollments.some(
                (e: any) => e.class?.kruzhok?.ownerId === userId
            )
            if (!hasAccess) {
                return res.status(403).json({ error: "You don't have access to this student" })
            }
        }

        // Award coins
        await db.$transaction([
            db.user.update({
                where: { id: studentId },
                data: { coinBalance: { increment: amount } }
            }),
            db.coinTransaction.create({
                data: {
                    userId: studentId,
                    amount,
                    type: "EARN",
                    reason: `Mentor reward: ${reason}`
                }
            }),
            db.notification.create({
                data: {
                    userId: studentId,
                    title: "S7 100 received",
                    message: `You received ${amount} S7 100: ${reason}`,
                    type: "reward"
                }
            })
        ])

        res.json({ success: true, awarded: amount })
    } catch (error) {
        console.error("[mentor/award-coins] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/mentor/stats - Mentor work stats (hours, load)
router.get("/stats", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role

        // Get completed schedules (lessons conducted)
        const completedSchedules = await db.schedule.findMany({
            where: buildMentorScheduleWhere(userId, role, undefined, undefined, ["COMPLETED"]),
            select: { durationMinutes: true, scheduledDate: true }
        })

        // Calculate stats
        const totalMinutes = completedSchedules.reduce((acc: number, s: any) => acc + (s.durationMinutes || 60), 0)
        const totalHours = Math.round(totalMinutes / 60 * 10) / 10

        // Get student count
        const classWhere: any = { isActive: true }
        if (role !== "ADMIN") {
            classWhere.OR = [{ mentorId: userId }, { createdById: userId }]
        }
        const classIds = await db.clubClass.findMany({
            where: classWhere,
            select: { id: true }
        }).then((cs: any[]) => cs.map(c => c.id))

        const studentCount = await db.classEnrollment.count({
            where: { classId: { in: classIds }, status: "active" }
        })

        // Get upcoming sessions
        const upcomingSessions = await db.schedule.count({
            where: buildMentorScheduleWhere(userId, role, new Date(), undefined, ["SCHEDULED"])
        })

        res.json({
            totalHours,
            totalSessions: completedSchedules.length,
            studentCount,
            upcomingSessions,
            kruzhokCount: classIds.length
        })
    } catch (error) {
        console.error("[mentor/stats] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/mentor/comment - Add comment for student (creates notification)
const commentSchema = z.object({
    studentId: z.string().min(1),
    comment: z.string().min(1).max(1000)
})

router.post("/comment", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const parsed = commentSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const { studentId, comment } = parsed.data

        // Create notification for student
        await db.notification.create({
            data: {
                userId: studentId,
                title: "Mentor comment",
                message: comment,
                type: "mentor_comment"
            }
        })

        // If student has parent, notify parent too
        const student = await db.user.findUnique({
            where: { id: studentId },
            select: { parentId: true, fullName: true }
        })

        if (student?.parentId) {
            await db.notification.create({
                data: {
                    userId: student.parentId,
                    title: `Comment about ${student.fullName}`,
                    message: comment,
                    type: "mentor_comment"
                }
            })
        }

        res.json({ success: true })
    } catch (error) {
        console.error("[mentor/comment] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/mentor/class/:classId/students - Get students in a class
router.get("/class/:classId/students", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { classId } = req.params

        const enrollments = await db.classEnrollment.findMany({
            where: { classId, status: "active" },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        level: true,
                        experiencePoints: true,
                        // Helper to check for active subscription
                        subscriptions: {
                            where: {
                                status: "ACTIVE",
                                OR: [
                                    { expiresAt: null },
                                    { expiresAt: { gt: new Date() } }
                                ]
                            },
                            select: { id: true },
                            take: 1
                        }
                    }
                }
            }
        })

        const students = enrollments.map((e: any) => ({
            ...e.user,
            subscriptions: undefined, // hide raw data
            paymentStatus: e.user.subscriptions?.length > 0 ? "PAID" : "DEBTOR"
        }))
        res.json(students)
    } catch (error) {
        console.error("[mentor/class/students] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/mentor/class/:classId/attendance - Get attendance for a class
router.get("/class/:classId/attendance", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { classId } = req.params
        const { year, month } = req.query

        const startDate = new Date(Number(year), Number(month) - 1, 1)
        const endDate = new Date(Number(year), Number(month), 0)

        const records = await db.attendance.findMany({
            where: {
                schedule: { classId },
                markedAt: { gte: startDate, lte: endDate }
            },
            include: {
                schedule: { select: { scheduledDate: true } }
            }
        }).catch(() => [])

        const result = (records || []).map((r: any) => ({
            id: r.id,
            studentId: r.studentId,
            date: r.schedule?.scheduledDate?.toISOString().split('T')[0] || r.markedAt?.toISOString().split('T')[0],
            status: r.status?.toLowerCase() || "present",
            grade: r.grade,
            workSummary: r.workSummary || "",
            activity: r.workSummary || "",
            comment: r.notes
        }))

        res.json(result)
    } catch (error) {
        console.error("[mentor/class/attendance] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/mentor/class/:classId/attendance - Save attendance record
const saveAttendanceSchema = z.object({
    scheduleId: z.string().optional(),
    studentId: z.string().min(1),
    date: z.string().min(1),
    status: z.enum(["present", "absent", "late", "excused"]),
    grade: z.number().int().min(1).max(10).optional(),
    workSummary: z.string().optional(),
    activity: z.string().optional(),
    comment: z.string().optional()
})

router.post("/class/:classId/attendance", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const { classId } = req.params
        const parsed = saveAttendanceSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const { scheduleId, studentId, date, status, grade, workSummary, activity, comment } = parsed.data
        const summary = workSummary ?? activity

        let schedule;

        if (scheduleId) {
            schedule = await db.schedule.findUnique({ where: { id: scheduleId } })
        }

        if (!schedule) {
            // Find or create schedule for this date
            schedule = await db.schedule.findFirst({
                where: {
                    classId,
                    scheduledDate: new Date(date)
                }
            })
        }

        if (!schedule) {
            // Create a schedule entry for this date
            const cls = await db.clubClass.findUnique({ where: { id: classId }, select: { kruzhokId: true } })
            schedule = await db.schedule.create({
                data: {
                    kruzhokId: cls?.kruzhokId || "",
                    classId,
                    title: "Lesson",
                    scheduledDate: new Date(date),
                    scheduledTime: "00:00",
                    status: "COMPLETED",
                    createdById: userId
                }
            })
        }

        // Upsert attendance
        await db.attendance.upsert({
            where: {
                scheduleId_studentId: {
                    scheduleId: schedule.id,
                    studentId
                }
            },
            update: {
                status: status.toUpperCase(),
                grade,
                workSummary: summary,
                notes: comment,
                markedById: userId,
                markedAt: new Date()
            },
            create: {
                scheduleId: schedule.id,
                studentId,
                status: status.toUpperCase(),
                grade,
                workSummary: summary,
                notes: comment,
                markedById: userId,
                markedAt: new Date()
            }
        })

        res.json({ success: true })
    } catch (error) {
        console.error("[mentor/class/attendance POST] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/mentor/groups/:id/export - Export gradebook to XLSX
router.get("/groups/:id/export", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params
        // Fetch all completed schedules
        const schedules = await db.schedule.findMany({
            where: { classId: id, status: { in: ["COMPLETED", "IN_PROGRESS"] } },
            include: {
                attendances: {
                    include: {
                        student: { select: { fullName: true, email: true } }
                    }
                },
                reviews: {
                    include: {
                        student: { select: { id: true } }
                    }
                }
            },
            orderBy: { scheduledDate: "desc" }
        })

        const headers = ["Date", "Lesson Title", "Student Name", "Email", "Status", "Late Reason", "Grade", "Feedback", "Student Rating", "Student Comment"]
        const rows: (string | number)[][] = [headers]

        for (const s of schedules) {
            const dateStr = s.scheduledDate.toISOString().split('T')[0]
            for (const att of s.attendances) {
                const review = s.reviews.find((r: any) => r.studentId === att.studentId)
                rows.push([
                    dateStr,
                    s.title,
                    att.student.fullName,
                    att.student.email,
                    att.status,
                    att.workSummary || "",
                    att.grade || "",
                    att.notes || "",
                    review?.rating || "",
                    review?.comment || ""
                ])
            }
        }

        const worksheet = XLSX.utils.aoa_to_sheet(rows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Gradebook")

        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        res.setHeader("Content-Disposition", `attachment; filename="gradebook-${id}.xlsx"`)
        res.send(buffer)

    } catch (error) {
        console.error("[mentor/groups/export] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/mentor/class/:classId/add-student - Add student to class
const addStudentSchema = z.object({
    email: z.string().email()
})

router.post("/class/:classId/add-student", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { classId } = req.params
        const parsed = addStudentSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const { email } = parsed.data

        // Find student by email
        const student = await db.user.findUnique({
            where: { email },
            select: { id: true, fullName: true, parentId: true }
        })

        if (!student) {
            return res.status(404).json({ error: "Student with this email was not found" })
        }

        // Check if already enrolled
        const existing = await db.classEnrollment.findFirst({
            where: { classId, userId: student.id }
        })

        if (existing) {
            return res.status(400).json({ error: "Student is already in this group" })
        }

        // Get class info
        const cls = await db.clubClass.findUnique({
            where: { id: classId },
            select: { name: true, kruzhok: { select: { title: true } } }
        })

        // Add enrollment
        await db.classEnrollment.create({
            data: {
                classId,
                userId: student.id,
                status: "active"
            }
        })

        // Notify parent if exists
        if (student.parentId) {
            await db.notification.create({
                data: {
                    userId: student.parentId,
                    title: "Student added to a group",
                    message: `${student.fullName} was added to "${cls?.name}" (${cls?.kruzhok?.title})`,
                    type: "enrollment"
                }
            })
        }

        res.json({ success: true, student: { id: student.id, fullName: student.fullName } })
    } catch (error) {
        console.error("[mentor/class/add-student] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/mentor/class/:classId/migrate-student - Migrate student to another class
const migrateStudentSchema = z.object({
    studentId: z.string().min(1),
    targetClassId: z.string().min(1)
})

router.post("/class/:classId/migrate-student", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { classId } = req.params
        const parsed = migrateStudentSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const { studentId, targetClassId } = parsed.data

        // Get student info
        const student = await db.user.findUnique({
            where: { id: studentId },
            select: { id: true, fullName: true, parentId: true }
        })

        if (!student) {
            return res.status(404).json({ error: "Student not found" })
        }

        // Get source class info
        const sourceClass = await db.clubClass.findUnique({
            where: { id: classId },
            select: { name: true }
        })

        // Get target class info
        const targetClass = await db.clubClass.findUnique({
            where: { id: targetClassId },
            select: { name: true, kruzhok: { select: { title: true } } }
        })

        // Remove from source class
        await db.classEnrollment.deleteMany({
            where: { classId, userId: studentId }
        })

        // Add to target class
        await db.classEnrollment.create({
            data: {
                classId: targetClassId,
                userId: studentId,
                status: "active"
            }
        })

        // Notify parent if exists
        if (student.parentId) {
            await db.notification.create({
                data: {
                    userId: student.parentId,
                    title: "Student moved to a new group",
                    message: `${student.fullName} moved from "${sourceClass?.name}" to "${targetClass?.name}" (${targetClass?.kruzhok?.title})`,
                    type: "migration"
                }
            })
        }

        res.json({ success: true })
    } catch (error) {
        console.error("[mentor/class/migrate-student] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/mentor/class - Create a new class
const createClassSchema = z.object({
    kruzhokId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional()
})

router.post("/class", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role
        if (role !== "ADMIN") {
            return res.status(403).json({ error: "Only admins can create groups" })
        }
        const parsed = createClassSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const { kruzhokId, name, description } = parsed.data

        // Verify access
        if (role !== "ADMIN") {
            const hasAccess = await isMentorOrOwner(userId, kruzhokId)
            if (!hasAccess) {
                return res.status(403).json({ error: "Permission denied" })
            }
        }

        // Get max order index
        const lastClass = await db.clubClass.findFirst({
            where: { kruzhokId },
            orderBy: { orderIndex: "desc" }
        })
        const orderIndex = (lastClass?.orderIndex ?? -1) + 1

        const newClass = await db.clubClass.create({
            data: {
                kruzhokId,
                name,
                description,
                orderIndex,
                createdById: userId,
                isActive: true
            }
        })

        res.status(201).json(newClass)
    } catch (error) {
        console.error("[mentor/class create] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})
