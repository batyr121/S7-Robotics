import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"
import jwt from "jsonwebtoken"
import { env } from "../env"

export const router = Router()
const db = prisma as any

router.use(requireAuth)

const startLessonSchema = z.object({
    classId: z.string().optional(),
    kruzhokId: z.string().optional(), // For ad-hoc if classId missing
    title: z.string().optional()
})

// POST /api/attendance-live/start
// Starts a lesson (creates/activates schedule) and returns QR payload
router.post("/start", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const parsed = startLessonSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const { classId, kruzhokId, title } = parsed.data

        // 1. Find existing scheduled item for NOW (approx) or create new
        // Logic: If classId provided, look for SCHEDULED item today.
        let schedule = null;

        if (classId) {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const tomorrow = new Date(today)
            tomorrow.setDate(tomorrow.getDate() + 1)

            schedule = await db.schedule.findFirst({
                where: {
                    classId,
                    scheduledDate: { gte: today, lt: tomorrow },
                    status: { not: "CANCELLED" }
                }
            })
        }

        if (schedule) {
            // Update status to IN_PROGRESS if not completed
            if (schedule.status === "SCHEDULED") {
                schedule = await db.schedule.update({
                    where: { id: schedule.id },
                    data: { status: "IN_PROGRESS" }
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
                    title: title || "Живой урок",
                    kruzhokId: finalKruzhokId,
                    classId: classId,
                    scheduledDate: new Date(),
                    scheduledTime: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                    durationMinutes: 60,
                    createdById: userId,
                    status: "IN_PROGRESS"
                }
            })
        }

        // 2. Generate token (expires in 2 hours)
        const payload = {
            scheduleId: schedule.id,
            mentorId: userId,
            timestamp: Date.now()
        }
        const token = jwt.sign(payload, env.APP_SECRET || "fallback-secret", { expiresIn: "3h" })

        res.json({ success: true, schedule, token })

    } catch (err: any) {
        console.error("[attendance-live] Start error:", err)
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
                        enrollments: { include: { user: true } } // Get active enrollments
                    }
                }
            }
        })

        if (!schedule) return res.status(404).json({ error: "Schedule not found" })

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
                status: schedule.status
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
        const { scheduleId, studentId, status, grade, workSummary } = req.body
        const mentorId = req.user!.id

        // Upsert
        const record = await db.attendance.upsert({
            where: {
                scheduleId_studentId: { scheduleId, studentId }
            },
            update: {
                status: status || undefined,
                grade: grade, // Allow null/0
                workSummary: workSummary,
                markedById: mentorId // Last edit by mentor
            },
            create: {
                scheduleId,
                studentId,
                status: status || "PRESENT",
                grade,
                workSummary,
                markedById: mentorId
            }
        })

        res.json({ success: true, record })

    } catch (err: any) {
        console.error("Update record error:", err)
        res.status(500).json({ error: err.message })
    }
})

