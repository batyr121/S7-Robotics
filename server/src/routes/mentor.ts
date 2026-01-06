import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

export const router = Router()

const db = prisma as any

// All routes require authentication
router.use(requireAuth)

// Helper to check if user is mentor for a kruzhok
async function isMentorOrOwner(userId: string, kruzhokId: string): Promise<boolean> {
    const kruzhok = await db.kruzhok.findUnique({
        where: { id: kruzhokId },
        select: { ownerId: true }
    })
    if (!kruzhok) return false
    if (kruzhok.ownerId === userId) return true

    // Check if user is assigned as mentor in ClubMentor
    const mentorRole = await db.clubMentor.findFirst({
        where: { userId, club: { programId: kruzhokId } }
    })
    return !!mentorRole
}

// GET /api/mentor/my-kruzhoks - Get kruzhoks where user is mentor/owner
router.get("/my-kruzhoks", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role

        // Admins see all, mentors see owned/assigned
        const kruzhoks = await db.kruzhok.findMany({
            where: role === "ADMIN"
                ? { isActive: true }
                : { ownerId: userId, isActive: true },
            include: {
                classes: {
                    include: {
                        enrollments: { include: { user: { select: { id: true, fullName: true } } } },
                        _count: { select: { enrollments: true, sessions: true } }
                    }
                },
                _count: { select: { classes: true, sessions: true } }
            },
            orderBy: { createdAt: "desc" }
        })

        res.json(kruzhoks)
    } catch (error) {
        console.error("[mentor/my-kruzhoks] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

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
            schedule: c.schedule || null
        }))

        res.json(groups)
    } catch (error) {
        console.error("[mentor/open-groups] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/mentor/wallet/summary - Wallet summary for home page widget
router.get("/wallet/summary", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id

        // Try to get salary data for mentor
        let balance = 0
        let pendingBalance = 0
        let lessonsThisMonth = 0

        try {
            const salary = await db.mentorSalary.findFirst({
                where: { mentorId: userId },
                orderBy: { createdAt: "desc" }
            })
            if (salary) {
                balance = salary.paidAmount || 0
                pendingBalance = salary.pendingAmount || 0
            }
        } catch {
            // Salary table might not exist
        }

        // Count completed lessons this month
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        try {
            const kruzhokIds = await db.kruzhok.findMany({
                where: { ownerId: userId, isActive: true },
                select: { id: true }
            }).then((ks: any[]) => ks.map(k => k.id))

            lessonsThisMonth = await db.schedule.count({
                where: {
                    kruzhokId: { in: kruzhokIds },
                    status: "COMPLETED",
                    completedAt: { gte: startOfMonth }
                }
            })
        } catch {
            lessonsThisMonth = 0
        }

        res.json({ balance, pendingBalance, lessonsThisMonth })
    } catch (error) {
        console.error("[mentor/wallet/summary] Error:", error)
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

        const kruzhokIds = await db.kruzhok.findMany({
            where: role === "ADMIN" ? { isActive: true } : { ownerId: userId, isActive: true },
            select: { id: true }
        }).then((ks: any[]) => ks.map(k => k.id))

        const schedules = await db.schedule.findMany({
            where: {
                kruzhokId: { in: kruzhokIds },
                scheduledDate: { gte: today, lt: tomorrow },
                status: { in: ["SCHEDULED", "IN_PROGRESS"] }
            },
            include: {
                class: { select: { name: true, _count: { select: { enrollments: true } } } }
            },
            orderBy: { scheduledTime: "asc" }
        })

        const lessons = schedules.map((s: any) => ({
            id: s.id,
            groupName: s.class?.name || s.title,
            time: s.scheduledTime || "—",
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

        // Get kruzhoks owned by mentor
        const kruzhokIds = await db.kruzhok.findMany({
            where: role === "ADMIN" ? { isActive: true } : { ownerId: userId, isActive: true },
            select: { id: true }
        }).then((ks: any[]) => ks.map(k => k.id))

        const where: any = { kruzhokId: { in: kruzhokIds } }
        if (from) {
            where.scheduledDate = { gte: new Date(from) }
        }
        if (to) {
            where.scheduledDate = { ...(where.scheduledDate || {}), lte: new Date(to) }
        }

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
                    reason: `Награда от ментора: ${reason}`
                }
            }),
            db.notification.create({
                data: {
                    userId: studentId,
                    title: "Получены S7 100!",
                    message: `Вы получили ${amount} S7 100: ${reason}`,
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

        // Get kruzhoks owned by mentor
        const kruzhoks = await db.kruzhok.findMany({
            where: role === "ADMIN" ? { isActive: true } : { ownerId: userId, isActive: true },
            select: { id: true }
        })
        const kruzhokIds = kruzhoks.map((k: any) => k.id)

        // Get completed schedules (lessons conducted)
        const completedSchedules = await db.schedule.findMany({
            where: {
                kruzhokId: { in: kruzhokIds },
                status: "COMPLETED"
            },
            select: { durationMinutes: true, scheduledDate: true }
        })

        // Calculate stats
        const totalMinutes = completedSchedules.reduce((acc: number, s: any) => acc + (s.durationMinutes || 60), 0)
        const totalHours = Math.round(totalMinutes / 60 * 10) / 10

        // Get student count
        const classIds = await db.clubClass.findMany({
            where: { kruzhokId: { in: kruzhokIds }, isActive: true },
            select: { id: true }
        }).then((cs: any[]) => cs.map(c => c.id))

        const studentCount = await db.classEnrollment.count({
            where: { classId: { in: classIds }, status: "active" }
        })

        // Get upcoming sessions
        const upcomingSessions = await db.schedule.count({
            where: {
                kruzhokId: { in: kruzhokIds },
                status: "SCHEDULED",
                scheduledDate: { gte: new Date() }
            }
        })

        res.json({
            totalHours,
            totalSessions: completedSchedules.length,
            studentCount,
            upcomingSessions,
            kruzhokCount: kruzhoks.length
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
                title: "Комментарий от ментора",
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
                    title: `Комментарий о ${student.fullName}`,
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
                    select: { id: true, fullName: true, email: true, level: true, experiencePoints: true }
                }
            }
        })

        const students = enrollments.map((e: any) => e.user)
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
            activity: r.activity,
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
    studentId: z.string().min(1),
    date: z.string().min(1),
    status: z.enum(["present", "absent", "late", "excused"]),
    grade: z.number().int().min(1).max(5).optional(),
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

        const { studentId, date, status, grade, activity, comment } = parsed.data

        // Find or create schedule for this date
        let schedule = await db.schedule.findFirst({
            where: {
                classId,
                scheduledDate: new Date(date)
            }
        })

        if (!schedule) {
            // Create a schedule entry for this date
            const cls = await db.clubClass.findUnique({ where: { id: classId }, select: { kruzhokId: true } })
            schedule = await db.schedule.create({
                data: {
                    kruzhokId: cls?.kruzhokId || "",
                    classId,
                    title: "Урок",
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
                activity,
                notes: comment,
                markedById: userId,
                markedAt: new Date()
            },
            create: {
                scheduleId: schedule.id,
                studentId,
                status: status.toUpperCase(),
                grade,
                activity,
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
            return res.status(404).json({ error: "Ученик с таким email не найден" })
        }

        // Check if already enrolled
        const existing = await db.classEnrollment.findFirst({
            where: { classId, userId: student.id }
        })

        if (existing) {
            return res.status(400).json({ error: "Ученик уже в этой группе" })
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
                    title: "Ребенок добавлен в группу",
                    message: `${student.fullName} добавлен в группу "${cls?.name}" (${cls?.kruzhok?.title})`,
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
            return res.status(404).json({ error: "Ученик не найден" })
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
                    title: "Перевод в другую группу",
                    message: `${student.fullName} переведен из "${sourceClass?.name}" в "${targetClass?.name}" (${targetClass?.kruzhok?.title})`,
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
