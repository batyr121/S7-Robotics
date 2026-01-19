import { Router, type Response } from "express"
import { prisma } from "../db"
import { z } from "zod"
import { requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

export const router = Router()
const db = prisma as any

router.use(requireAuth)

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
