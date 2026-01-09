import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

export const router = Router()
const db = prisma as any

router.use(requireAuth)

// GET /api/reviews/pending - pending mentor feedback for student
router.get("/pending", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id

        const schedules = await db.schedule.findMany({
            where: {
                status: "COMPLETED",
                attendances: { some: { studentId: userId } },
                reviews: { none: { studentId: userId } }
            },
            include: {
                class: { select: { id: true, name: true } },
                kruzhok: { select: { id: true, title: true } },
                createdBy: { select: { id: true, fullName: true, email: true } }
            },
            orderBy: { completedAt: "desc" },
            take: 1
        })

        res.json({ items: schedules || [] })
    } catch (error) {
        console.error("[reviews/pending] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/reviews/mentor - submit mentor review
const reviewSchema = z.object({
    scheduleId: z.string().min(1),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).optional()
})

router.post("/mentor", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const parsed = reviewSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const { scheduleId, rating, comment } = parsed.data

        const schedule = await db.schedule.findUnique({
            where: { id: scheduleId },
            include: { attendances: { where: { studentId: userId } } }
        })

        if (!schedule || !schedule.attendances?.length) {
            return res.status(404).json({ error: "Lesson not found for this student" })
        }

        if (schedule.status !== "COMPLETED") {
            return res.status(400).json({ error: "Lesson is not completed" })
        }

        const mentorId = schedule.createdById

        const review = await db.mentorReview.upsert({
            where: { scheduleId_studentId: { scheduleId, studentId: userId } },
            update: { rating, comment },
            create: {
                scheduleId,
                studentId: userId,
                mentorId,
                rating,
                comment
            }
        })

        const student = await db.user.findUnique({ where: { id: userId }, select: { fullName: true } })

        await db.notification.create({
            data: {
                userId: mentorId,
                title: "New mentor review",
                message: `${student?.fullName || "A student"} rated your lesson: ${rating}/5`,
                type: "review"
            }
        })

        res.json({ success: true, review })
    } catch (error) {
        console.error("[reviews/mentor] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})
