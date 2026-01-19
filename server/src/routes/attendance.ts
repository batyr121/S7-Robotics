import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"
import { sendPushToUser } from "../utils/push"

export const router = Router()
const db = prisma as any

// Require authentication for all routes
router.use(requireAuth)

const MAX_QR_AGE_MS = 120 * 1000

// POST /api/attendance/mark
router.post("/mark", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = String(req.user!.role || "").toUpperCase()
        if (!["STUDENT", "USER"].includes(role)) {
            return res.status(403).json({ error: "Only students can mark attendance" })
        }
        const bodySchema = z.object({
            qrToken: z.string().min(1)
        })

        const parsed = bodySchema.safeParse(req.body)
        if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

        const { qrToken } = parsed.data

        let scheduleId: string | undefined
        let mentorId: string | undefined

        try {
            const jwt = require("jsonwebtoken")
            const { env } = require("../env")

            const payload: any = jwt.verify(qrToken, env.APP_SECRET || "fallback-secret")
            scheduleId = payload.scheduleId
            mentorId = payload.mentorId
            const timestamp = payload.timestamp

            if (!scheduleId || !mentorId || !timestamp) {
                return res.status(400).json({ error: "Invalid QR token payload" })
            }

            const now = Date.now()
            const age = now - Number(timestamp)
            if (age > MAX_QR_AGE_MS) return res.status(400).json({ error: "QR code expired" })
        } catch (e) {
            return res.status(400).json({ error: "Invalid QR token" })
        }

        const schedule = await db.schedule.findUnique({ where: { id: scheduleId } })
        if (!schedule) return res.status(404).json({ error: "Lesson not found" })
        if (schedule.status !== "IN_PROGRESS" || !schedule.startedAt) {
            return res.status(400).json({ error: "Lesson has not started yet" })
        }

        // Verify student is enrolled in this class (if schedule has a classId)
        if (schedule.classId) {
            const enrollment = await db.classEnrollment.findUnique({
                where: {
                    classId_userId: {
                        classId: schedule.classId,
                        userId: userId
                    }
                }
            })
            if (!enrollment || enrollment.status !== "active") {
                return res.status(403).json({ error: "You are not enrolled in this class" })
            }
        }

        const startMs = new Date(schedule.startedAt).getTime()
        const ageMs = Date.now() - startMs
        const statusToSave = ageMs > 5 * 60 * 1000 ? "LATE" : "PRESENT"

        // Check existing
        const existing = await db.attendance.findUnique({
            where: {
                scheduleId_studentId: {
                    scheduleId: schedule.id,
                    studentId: userId
                }
            }
        })

        if (existing) {
            return res.json({ success: true, message: "Already marked", status: existing.status })
        }

        // Mark attendance
        await db.attendance.create({
            data: {
                scheduleId: schedule.id,
                studentId: userId,
                status: statusToSave,
                markedById: mentorId,
                markedAt: new Date()
            }
        })

        // Notify Parent
        const student = await db.user.findUnique({
            where: { id: userId },
            select: { fullName: true, parentId: true }
        })

        if (student?.parentId) {
            await db.notification.create({
                data: {
                    userId: student.parentId,
                    title: statusToSave === "LATE" ? "Student was late" : "Student checked in",
                    message: statusToSave === "LATE"
                        ? `${student.fullName} arrived late to the lesson.`
                        : `${student.fullName} checked in for the lesson.`,
                    type: "ATTENDANCE"
                }
            })
            await sendPushToUser(student.parentId, {
                title: statusToSave === "LATE" ? "Student was late" : "Student checked in",
                body: statusToSave === "LATE"
                    ? `${student.fullName} arrived late to the lesson.`
                    : `${student.fullName} checked in for the lesson.`
            })
        }

        res.json({ success: true, date: schedule.scheduledDate, status: statusToSave })
    } catch (error) {
        console.error("[attendance/mark] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})
