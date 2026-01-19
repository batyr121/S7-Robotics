import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"
import jwt from "jsonwebtoken"
import { env } from "../env"
import * as XLSX from "xlsx"
import { sendPushToUser } from "../utils/push"

export const router = Router()
const db = prisma as any
const QR_TOKEN_TTL_SECONDS = 120

router.use(requireAuth)

const startLessonSchema = z.object({
    classId: z.string().optional(),
    kruzhokId: z.string().optional(), // For ad-hoc if classId missing
    title: z.string().optional()
})

const buildQrToken = (scheduleId: string, mentorId: string) => {
    const payload = {
        scheduleId,
        mentorId,
        timestamp: Date.now()
    }
    return jwt.sign(payload, env.APP_SECRET || "fallback-secret", { expiresIn: `${QR_TOKEN_TTL_SECONDS}s` })
}

const canAccessSchedule = (userId: string, role: string, schedule: any) => {
    if (role === "ADMIN") return true
    if (schedule?.createdById === userId) return true
    if (schedule?.class?.mentorId === userId) return true
    return false
}

// POST /api/attendance-live/start
// Starts a lesson (creates/activates schedule) and returns QR payload
router.post("/start", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role
        if (!["MENTOR", "ADMIN"].includes(role)) {
            return res.status(403).json({ error: "Only mentors can start lessons" })
        }
        const parsed = startLessonSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const { classId, kruzhokId, title } = parsed.data

        if (classId && role !== "ADMIN") {
            const cls = await db.clubClass.findUnique({
                where: { id: classId },
                select: { id: true, mentorId: true, kruzhok: { select: { ownerId: true } } }
            })
            if (!cls) return res.status(404).json({ error: "Group not found" })
            const isAllowed = cls.mentorId === userId || cls.kruzhok?.ownerId === userId
            if (!isAllowed) {
                return res.status(403).json({ error: "Permission denied" })
            }
        }

        // 1. Find existing scheduled item for NOW (approx) or create new
        // Logic: If classId provided, look for SCHEDULED item today.
        let schedule = null

        if (classId) {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const tomorrow = new Date(today)
            tomorrow.setDate(tomorrow.getDate() + 1)

            schedule = await db.schedule.findFirst({
                where: {
                    classId,
                    scheduledDate: { gte: today, lt: tomorrow },
                    status: { in: ["SCHEDULED", "IN_PROGRESS"] }
                }
            })
        }

        if (schedule) {
            // Update status to IN_PROGRESS if not completed
            if (schedule.status === "SCHEDULED") {
                schedule = await db.schedule.update({
                    where: { id: schedule.id },
                    data: { status: "IN_PROGRESS", startedAt: new Date() }
                })
            } else if (!schedule.startedAt && schedule.status === "IN_PROGRESS") {
                schedule = await db.schedule.update({
                    where: { id: schedule.id },
                    data: { startedAt: new Date() }
                })
            }
        } else {
            // Create Ad-hoc
            // We need kruzhokId. If classId provided, get from it.
            let finalKruzhokId = kruzhokId;
            if (classId && !finalKruzhokId) {
                const cls = await db.clubClass.findUnique({ where: { id: classId } })
                finalKruzhokId = cls?.kruzhokId
            }

            if (!finalKruzhokId) {
                return res.status(400).json({ error: "Cannot start lesson: missing classId or kruzhokId" })
            }

            schedule = await db.schedule.create({
                data: {
                    title: title || "Live lesson",
                    kruzhokId: finalKruzhokId,
                    classId: classId,
                    scheduledDate: new Date(),
                    scheduledTime: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                    durationMinutes: 60,
                    createdById: userId,
                    status: "IN_PROGRESS",
                    startedAt: new Date()
                }
            })
        }

        // 2. Generate token (expires in 2 hours)
        const token = buildQrToken(schedule.id, userId)

        res.json({
            success: true,
            schedule,
            token,
            serverTime: Date.now(),
            startedAt: schedule.startedAt || new Date()
        })

    } catch (err: any) {
        console.error("[attendance-live] Start error:", err)
        res.status(500).json({ error: err.message })
    }
})

// GET /api/attendance-live/:scheduleId/qr
// Refresh QR token for an active lesson
router.get("/:scheduleId/qr", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { scheduleId } = req.params
        const userId = req.user!.id
        const role = req.user!.role

        const schedule = await db.schedule.findUnique({
            where: { id: scheduleId },
            select: { id: true, createdById: true, status: true, class: { select: { mentorId: true } } }
        })
        if (!schedule) return res.status(404).json({ error: "Schedule not found" })
        if (!canAccessSchedule(userId, role, schedule)) {
            return res.status(403).json({ error: "Permission denied" })
        }

        if (schedule.status !== "IN_PROGRESS") {
            return res.status(400).json({ error: "Lesson is not in progress" })
        }

        const token = buildQrToken(schedule.id, userId)
        res.json({ token, serverTime: Date.now() })
    } catch (err: any) {
        console.error("[attendance-live] QR error:", err)
        res.status(500).json({ error: err.message })
    }
})

// GET /api/attendance-live/:scheduleId/state
// Returns the "Excel" view: Enrolled students merged with Attendance records
router.get("/:scheduleId/state", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { scheduleId } = req.params

        const schedule = await db.schedule.findUnique({
            where: { id: scheduleId },
            include: {
                class: {
                    include: {
                        enrollments: { include: { user: true } }, // Get active enrollments
                        mentor: { select: { id: true } }
                    }
                }
            }
        })

        if (!schedule) return res.status(404).json({ error: "Schedule not found" })
        const userId = req.user!.id
        const role = req.user!.role
        if (!canAccessSchedule(userId, role, schedule)) {
            return res.status(403).json({ error: "Permission denied" })
        }

        // Get actual attendance records
        const attendanceRecords = await db.attendance.findMany({
            where: { scheduleId }
        })

        // Build list. 
        // Source of truth for "Who should be there": Schedule -> Class -> Enrollments.
        // If Schedule has no class (ad-hoc), we rely ONLY on attendanceRecords (anyone who scanned).

        let studentsMap = new Map<string, any>()

        // 1. Add enrolled students
        if (schedule.class && schedule.class.enrollments) {
            for (const enr of schedule.class.enrollments) {
                // Check status?
                if (enr.status === 'active' || enr.status === 'active') { // Just check active
                    studentsMap.set(enr.userId, {
                        user: enr.user,
                        status: "ABSENT", // Default
                        grade: null,
                        summary: null,
                        recordId: null,
                        isEnrolled: true
                    })
                }
            }
        }

        // 2. Merge attendance records (overwrites status, adds walk-ins)
        // Need to fetch user info for walk-ins if not in enrollments
        const attendedUserIds = attendanceRecords.map((a: any) => a.studentId)
        // Fetch users if we don't have them (walk-ins)
        const walkInIds = attendedUserIds.filter((id: string) => !studentsMap.has(id))

        if (walkInIds.length > 0) {
            const walkIns = await db.user.findMany({ where: { id: { in: walkInIds } } })
            for (const u of walkIns) {
                studentsMap.set(u.id, {
                    user: u,
                    status: "PRESENT",
                    grade: null,
                    summary: null,
                    recordId: null,
                    isEnrolled: false
                })
            }
        }

        // Apply records
        for (const record of attendanceRecords) {
            const entry = studentsMap.get(record.studentId)
            if (entry) {
                entry.status = record.status
                entry.grade = record.grade
                entry.summary = record.workSummary
                entry.comment = record.notes
                entry.recordId = record.id
                entry.markedAt = record.markedAt
            }
        }

        const rows = Array.from(studentsMap.values())

        res.json({
            schedule: {
                id: schedule.id,
                title: schedule.title,
                date: schedule.scheduledDate,
                status: schedule.status,
                startedAt: schedule.startedAt,
                completedAt: schedule.completedAt
            },
            rows
        })

    } catch (err: any) {
        console.error("[attendance-live] State error:", err)
        res.status(500).json({ error: err.message })
    }
})

// PATCH /api/attendance-live/record/:recordId
// Mentor manually updating grade/summary
// OR creating a record if it doesn't exist yet (upsert logic needed in frontend or here)
// Actually, let's make it smarter: receive scheduleId + studentId
router.post("/update-record", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { scheduleId, studentId, status, grade, workSummary, comment } = req.body
        const mentorId = req.user!.id
        const role = req.user!.role
        const schedule = await db.schedule.findUnique({
            where: { id: scheduleId },
            select: { id: true, createdById: true, class: { select: { mentorId: true } } }
        })
        if (!schedule) return res.status(404).json({ error: "Schedule not found" })
        if (!canAccessSchedule(mentorId, role, schedule)) {
            return res.status(403).json({ error: "Permission denied" })
        }

        // Upsert
        const record = await db.attendance.upsert({
            where: {
                scheduleId_studentId: { scheduleId, studentId }
            },
            update: {
                status: status || undefined,
                grade: grade, // Allow null/0
                workSummary: workSummary,
                notes: comment,
                markedById: mentorId // Last edit by mentor
            },
            create: {
                scheduleId,
                studentId,
                status: status || "PRESENT",
                grade,
                workSummary,
                notes: comment,
                markedById: mentorId
            }
        })

        const hasGrade = typeof grade === "number"

        if (comment) {
            const student = await db.user.findUnique({
                where: { id: studentId },
                select: { fullName: true, parentId: true }
            })
            if (student?.parentId) {
                await db.notification.create({
                    data: {
                        userId: student.parentId,
                        title: "New mentor comment",
                        message: `${student.fullName}: ${comment}`,
                        type: "mentor_comment"
                    }
                })
                await sendPushToUser(student.parentId, {
                    title: "New mentor comment",
                    body: `${student.fullName}: ${comment}`
                })
            }
        }

        if (hasGrade) {
            const student = await db.user.findUnique({
                where: { id: studentId },
                select: { fullName: true, parentId: true }
            })
            if (student?.parentId) {
                await db.notification.create({
                    data: {
                        userId: student.parentId,
                        title: "Lesson grade received",
                        message: `${student.fullName} received ${grade}/5 for the lesson.`,
                        type: "MENTOR_GRADE"
                    }
                })
                await sendPushToUser(student.parentId, {
                    title: "Lesson grade received",
                    body: `${student.fullName} received ${grade}/5 for the lesson.`
                })
            }
        }

        res.json({ success: true, record })

    } catch (err: any) {
        console.error("Update record error:", err)
        res.status(500).json({ error: err.message })
    }
})

// POST /api/attendance-live/:scheduleId/end
// Ends a lesson: marks absent students and completes schedule
router.post("/:scheduleId/end", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { scheduleId } = req.params
        const mentorId = req.user!.id
        const role = req.user!.role

        const schedule = await db.schedule.findUnique({
            where: { id: scheduleId },
            include: { class: { include: { enrollments: true } } }
        })

        if (!schedule) return res.status(404).json({ error: "Schedule not found" })
        if (!canAccessSchedule(mentorId, role, schedule)) {
            return res.status(403).json({ error: "Permission denied" })
        }

        const existing = await db.attendance.findMany({
            where: { scheduleId },
            select: { studentId: true }
        })
        const existingIds = new Set(existing.map((a: any) => a.studentId))

        const enrolledIds = (schedule.class?.enrollments || [])
            .filter((e: any) => e.status === "active")
            .map((e: any) => e.userId)

        const absentIds = enrolledIds.filter((id: string) => !existingIds.has(id))

        if (absentIds.length > 0) {
            await db.attendance.createMany({
                data: absentIds.map((studentId: string) => ({
                    scheduleId,
                    studentId,
                    status: "ABSENT",
                    markedById: mentorId,
                    markedAt: new Date()
                }))
            })

            const students = await db.user.findMany({
                where: { id: { in: absentIds } },
                select: { id: true, fullName: true, parentId: true }
            })
            const notifications = students
                .filter((s: any) => s.parentId)
                .map((s: any) => ({
                    userId: s.parentId,
                    title: "Student was absent",
                    message: `${s.fullName} did not attend the lesson.`,
                    type: "ATTENDANCE"
                }))
            if (notifications.length > 0) {
                await db.notification.createMany({ data: notifications })
                await Promise.all(
                    notifications.map((n: any) =>
                        sendPushToUser(n.userId, {
                            title: n.title,
                            body: n.message
                        })
                    )
                )
            }
        }

        const now = new Date()
        const durationMinutes = schedule.startedAt
            ? Math.max(1, Math.round((now.getTime() - new Date(schedule.startedAt).getTime()) / 60000))
            : schedule.durationMinutes

        const updated = await db.schedule.update({
            where: { id: scheduleId },
            data: {
                status: "COMPLETED",
                completedAt: now,
                durationMinutes
            }
        })

        res.json({
            success: true,
            schedule: updated,
            absentCount: absentIds.length
        })
    } catch (err: any) {
        console.error("[attendance-live] End error:", err)
        res.status(500).json({ error: err.message })
    }
})

// GET /api/attendance-live/:scheduleId/export
// Export lesson report to .xlsx
router.get("/:scheduleId/export", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { scheduleId } = req.params
        const userId = req.user!.id
        const role = req.user!.role

        const schedule = await db.schedule.findUnique({
            where: { id: scheduleId },
            include: {
                class: {
                    include: {
                        enrollments: { include: { user: true } }
                    }
                }
            }
        })
        if (!schedule) return res.status(404).json({ error: "Schedule not found" })
        if (!canAccessSchedule(userId, role, schedule)) {
            return res.status(403).json({ error: "Permission denied" })
        }

        const attendanceRecords = await db.attendance.findMany({
            where: { scheduleId },
            include: { student: true }
        })

        const rows = attendanceRecords.map((r: any) => ({
            "Student": r.student?.fullName || r.studentId,
            "Status": r.status,
            "Grade": r.grade ?? "",
            "Comment": r.notes || "",
            "MarkedAt": r.markedAt ? new Date(r.markedAt).toLocaleString("ru-RU") : ""
        }))

        const worksheet = XLSX.utils.json_to_sheet(rows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Lesson")

        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

        res.setHeader("Content-Disposition", `attachment; filename=lesson-${scheduleId}.xlsx`)
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        res.send(buffer)
    } catch (err: any) {
        console.error("[attendance-live] Export error:", err)
        res.status(500).json({ error: err.message })
    }
})

