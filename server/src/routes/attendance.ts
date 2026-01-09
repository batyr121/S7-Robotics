import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

export const router = Router()
const db = prisma as any

// Require authentication for all routes
router.use(requireAuth)

const markAttendanceSchema = z.object({
    mentorId: z.string().min(1),
    groupId: z.string().min(1), // this is classId
    timestamp: z.number().int().positive()
})

// POST /api/attendance/mark
router.post("/mark", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        // Extend schema to accept qrToken
        const bodySchema = z.object({
            qrToken: z.string().optional(),
            mentorId: z.string().optional(),
            groupId: z.string().optional(),
            timestamp: z.number().int().optional()
        })

        const parsed = bodySchema.safeParse(req.body)
        if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

        let scheduleId: string | undefined
        let mentorId: string | undefined
        let payloadTimestamp: number | undefined

        const { qrToken, groupId } = parsed.data

        if (qrToken) {
            try {
                const jwt = require("jsonwebtoken")
                const { env } = require("../env")

                const payload: any = jwt.verify(qrToken, env.APP_SECRET || "fallback-secret")
                scheduleId = payload.scheduleId
                mentorId = payload.mentorId
                const timestamp = payload.timestamp
                payloadTimestamp = timestamp

                // Check freshness
                const now = Date.now()
                const age = now - timestamp
                if (age > 7200000) return res.status(400).json({ error: "QR code expired" })

            } catch (e) {
                return res.status(400).json({ error: "Invalid QR Token" })
            }
        } else {
            // Old fallback
            mentorId = parsed.data.mentorId
            const t = parsed.data.timestamp
            if (!mentorId || !groupId || !t) {
                return res.status(400).json({ error: "Missing required fields (qrToken OR mentorId/groupId/timestamp)" })
            }
            // 2 hours = 7200000 ms
            if (Date.now() - t > 7200000) return res.status(400).json({ error: "QR code expired" })
            payloadTimestamp = t
        }

        let schedule;

        if (scheduleId) {
            schedule = await db.schedule.findUnique({ where: { id: scheduleId } })
            if (!schedule) return res.status(404).json({ error: "Lesson not found" })
        } else if (groupId && mentorId) {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const tomorrow = new Date(today)
            tomorrow.setDate(tomorrow.getDate() + 1)

            schedule = await db.schedule.findFirst({
                where: {
                    classId: groupId,
                    scheduledDate: { gte: today, lt: tomorrow },
                    status: { not: "CANCELLED" }
                }
            })

            if (!schedule) {
                // Fallback create ad-hoc
                const cls = await db.clubClass.findUnique({ where: { id: groupId } })
                if (!cls) return res.status(404).json({ error: "Group not found" })

                schedule = await db.schedule.create({
                    data: {
                        kruzhokId: cls.kruzhokId,
                        classId: groupId,
                        title: "Lesson (QR)",
                        scheduledDate: new Date(),
                        scheduledTime: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                        durationMinutes: 60,
                        createdById: mentorId,
                        status: "IN_PROGRESS"
                    }
                })
            }
        }

        if (!schedule) return res.status(400).json({ error: "Could not identify lesson" })
        if (!mentorId) mentorId = schedule.createdById // Fallback

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

        if (!schedule.startedAt) {
            const nextStatus = schedule.status === "SCHEDULED" ? "IN_PROGRESS" : schedule.status
            schedule = await db.schedule.update({
                where: { id: schedule.id },
                data: { startedAt: new Date(), status: nextStatus }
            })
        }

        const startMs = schedule.startedAt ? new Date(schedule.startedAt).getTime() : Date.now()
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
                    title: statusToSave === "LATE" ? "Ученик опоздал" : "Ученик отметился",
                    message: statusToSave === "LATE"
                        ? `${student.fullName} опоздал(а) на урок.`
                        : `${student.fullName} отметился(ась) на уроке.`,
                    type: "ATTENDANCE"
                }
            })
        }

        res.json({ success: true, date: schedule.scheduledDate, status: statusToSave })
    } catch (error) {
        console.error("[attendance/mark] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})
