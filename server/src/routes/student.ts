import { Router, type Response } from "express"
import { prisma } from "../db"
import { z } from "zod"
import { requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

export const router = Router()
const db = prisma as any

router.use(requireAuth)

const LINK_CODE_TTL_MS = 24 * 60 * 60 * 1000

const generateLinkCode = () => {
    const num = Math.floor(100000 + Math.random() * 900000)
    return String(num)
}

const createUniqueLinkCode = async (): Promise<string> => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = generateLinkCode()
        const existing = await db.user.findUnique({ where: { linkCode: code }, select: { id: true } })
        if (!existing) return code
    }
    throw new Error("Failed to generate unique link code")
}

// GET /api/student/link-code - Get or create a 6-digit parent link code
router.get("/link-code", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = String(req.user!.role || "").toUpperCase()
        if (!["STUDENT", "USER"].includes(role)) {
            return res.status(403).json({ error: "Only students can generate link codes" })
        }

        const student = await db.user.findUnique({
            where: { id: userId },
            select: { id: true, parentId: true, linkCode: true, linkCodeExpiresAt: true }
        })
        if (!student) return res.status(404).json({ error: "Student not found" })

        if (student.parentId) {
            return res.json({ linked: true })
        }

        const now = new Date()
        if (student.linkCode && (!student.linkCodeExpiresAt || student.linkCodeExpiresAt > now)) {
            return res.json({ linked: false, code: student.linkCode, expiresAt: student.linkCodeExpiresAt })
        }

        const code = await createUniqueLinkCode()
        const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS)
        await db.user.update({
            where: { id: userId },
            data: {
                linkCode: code,
                linkCodeIssuedAt: now,
                linkCodeExpiresAt: expiresAt
            }
        })

        res.json({ linked: false, code, expiresAt })
    } catch (error) {
        console.error("[student/link-code] Error:", error)
        res.status(500).json({ error: "Failed to generate link code" })
    }
})

// POST /api/student/link-code - Refresh link code
router.post("/link-code", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = String(req.user!.role || "").toUpperCase()
        if (!["STUDENT", "USER"].includes(role)) {
            return res.status(403).json({ error: "Only students can generate link codes" })
        }

        const student = await db.user.findUnique({
            where: { id: userId },
            select: { id: true, parentId: true }
        })
        if (!student) return res.status(404).json({ error: "Student not found" })
        if (student.parentId) {
            return res.json({ linked: true })
        }

        const now = new Date()
        const code = await createUniqueLinkCode()
        const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS)
        await db.user.update({
            where: { id: userId },
            data: {
                linkCode: code,
                linkCodeIssuedAt: now,
                linkCodeExpiresAt: expiresAt
            }
        })

        res.json({ linked: false, code, expiresAt })
    } catch (error) {
        console.error("[student/link-code refresh] Error:", error)
        res.status(500).json({ error: "Failed to refresh link code" })
    }
})

// GET /api/student/mentors - mentors for current student
router.get("/mentors", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id

        const enrollments = await db.classEnrollment.findMany({
            where: { userId, status: "active" },
            include: {
                class: {
                    include: {
                        kruzhok: {
                            select: {
                                owner: {
                                    select: {
                                        id: true,
                                        fullName: true,
                                        email: true,
                                        profile: { select: { phone: true } }
                                    }
                                },
                                title: true
                            }
                        },
                        mentor: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                profile: { select: { phone: true } }
                            }
                        },
                        name: true
                    }
                }
            }
        })

        const mentorMap = new Map()
        for (const e of enrollments) {
            const groupsFn = (mId: string) => {
                const existing = mentorMap.get(mId)
                if (existing) return existing
                const newEntry = {
                    id: mId,
                    fullName: "",
                    email: "",
                    phone: null,
                    groups: []
                }
                mentorMap.set(mId, newEntry)
                return newEntry
            }

            const owner = e.class?.kruzhok?.owner
            if (owner) {
                const entry = groupsFn(owner.id)
                entry.fullName = owner.fullName
                entry.email = owner.email
                entry.phone = owner.profile?.phone || null
                // Avoid duplicate groups if mentor and owner are same
                if (!entry.groups.some((g: any) => g.className === e.class?.name)) {
                    entry.groups.push({
                        className: e.class?.name,
                        kruzhokTitle: e.class?.kruzhok?.title
                    })
                }
            }

            const clsMentor = e.class?.mentor
            if (clsMentor) {
                const entry = groupsFn(clsMentor.id)
                entry.fullName = clsMentor.fullName
                entry.email = clsMentor.email
                entry.phone = clsMentor.profile?.phone || null
                if (!entry.groups.some((g: any) => g.className === e.class?.name)) {
                    entry.groups.push({
                        className: e.class?.name,
                        kruzhokTitle: e.class?.kruzhok?.title
                    })
                }
            }
        }

        res.json({ mentors: Array.from(mentorMap.values()) })
    } catch (error) {
        console.error("[student/mentors] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/student/groups - groups/classes for current student
router.get("/groups", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id

        const enrollments = await db.classEnrollment.findMany({
            where: { userId, status: "active" },
            include: {
                class: {
                    select: {
                        id: true,
                        name: true,
                        isActive: true,
                        wagePerLesson: true,
                        scheduleDescription: true,
                        kruzhok: { select: { id: true, title: true } },
                        mentor: { select: { id: true, fullName: true, email: true } },
                        _count: { select: { enrollments: true } },
                    }
                }
            }
        })

        const groups = (enrollments || [])
            .map((e: any) => e.class)
            .filter(Boolean)
            .map((cls: any) => ({
                id: cls.id,
                name: cls.name,
                isActive: cls.isActive,
                kruzhokId: cls.kruzhok?.id,
                kruzhokTitle: cls.kruzhok?.title,
                mentor: cls.mentor ? { id: cls.mentor.id, fullName: cls.mentor.fullName, email: cls.mentor.email } : null,
                scheduleDescription: cls.scheduleDescription || null,
                wagePerLesson: Number(cls.wagePerLesson || 0),
                studentsCount: cls._count?.enrollments || 0,
            }))

        res.json({ groups })
    } catch (error) {
        console.error("[student/groups] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/student/pending-ratings - Check for completed lessons without rating
router.get("/pending-ratings", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id

        // Find attendance records where:
        // 1. Status is PRESENT/LATE
        // 2. Schedule is COMPLETED
        // 3. No review exists
        const pending = await db.attendance.findFirst({
            where: {
                studentId: userId,
                status: { in: ["PRESENT", "LATE"] },
                schedule: {
                    status: "COMPLETED",
                    reviews: { none: { studentId: userId } }
                }
            },
            include: {
                schedule: {
                    select: {
                        id: true,
                        title: true,
                        scheduledDate: true,
                        kruzhok: { select: { title: true } },
                        class: { select: { mentor: { select: { id: true, fullName: true, email: true } } } }
                    }
                }
            },
            orderBy: { markedAt: "desc" }
        })

        if (!pending) {
            return res.json({ pending: null })
        }

        const s = pending.schedule
        res.json({
            pending: {
                scheduleId: s.id,
                title: s.title,
                kruzhokTitle: s.kruzhok?.title,
                date: s.scheduledDate,
                mentor: s.class?.mentor || { fullName: "Mentor" }
            }
        })

    } catch (error) {
        console.error("[student/pending-ratings] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/student/rate-lesson
const rateSchema = z.object({
    scheduleId: z.string().min(1),
    rating: z.number().int().min(1).max(5),
    comment: z.string().optional()
})

router.post("/rate-lesson", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const parsed = rateSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const { scheduleId, rating, comment } = parsed.data

        // Verify attendance
        const attendance = await db.attendance.findFirst({
            where: { scheduleId, studentId: userId, status: { in: ["PRESENT", "LATE"] } }
        })

        if (!attendance) {
            return res.status(403).json({ error: "You did not attend this lesson or it is not completed." })
        }

        const schedule = await db.schedule.findUnique({
            where: { id: scheduleId },
            include: {
                class: { select: { mentorId: true } }
            }
        })

        if (!schedule) return res.status(404).json({ error: "Lesson not found" })

        // Check if already reviewed
        const existing = await db.mentorReview.findUnique({
            where: {
                scheduleId_studentId: {
                    scheduleId,
                    studentId: userId
                }
            }
        })

        if (existing) {
            return res.status(400).json({ error: "You have already rated this lesson" })
        }

        // If mentor is missing (e.g. self-managed or deleted), we still want to save the review associated with the schedule
        // But the schema requires mentorId. We'll use the class mentorId or the schedule creator.
        let mentorId = schedule.class?.mentorId || schedule.createdById

        await db.mentorReview.create({
            data: {
                scheduleId,
                studentId: userId,
                mentorId,
                rating,
                comment,
            }
        })

        res.json({ success: true })

    } catch (error) {
        console.error("[student/rate-lesson] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})
