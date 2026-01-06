import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

export const router = Router()

const db = prisma as any

// ============ STUDENT ROUTES ============

// GET /api/individual-lessons/slots - List available slots
router.get("/slots", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { mentorId, dateFrom, dateTo } = req.query

        const where: any = {
            isAvailable: true,
            booking: null, // No booking exists
            date: { gte: new Date() } // Only future slots
        }

        if (mentorId) {
            where.mentorId = mentorId
        }

        if (dateFrom) {
            where.date = { ...where.date, gte: new Date(dateFrom as string) }
        }
        if (dateTo) {
            where.date = { ...where.date, lte: new Date(dateTo as string) }
        }

        const slots = await db.individualLessonSlot.findMany({
            where,
            include: {
                mentor: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true
                    }
                }
            },
            orderBy: [
                { date: "asc" },
                { startTime: "asc" }
            ]
        })

        res.json(slots)
    } catch (error) {
        console.error("[individual-lessons/slots] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/individual-lessons/mentors - List mentors who offer individual lessons
router.get("/mentors", requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const mentors = await db.user.findMany({
            where: {
                role: { in: ["MENTOR", "ADMIN"] },
                mentorSlots: { some: {} }
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                _count: {
                    select: {
                        mentorSlots: {
                            where: {
                                isAvailable: true,
                                booking: null,
                                date: { gte: new Date() }
                            }
                        }
                    }
                }
            }
        })

        res.json(mentors.map((m: any) => ({
            ...m,
            availableSlots: m._count.mentorSlots
        })))
    } catch (error) {
        console.error("[individual-lessons/mentors] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/individual-lessons/book/:slotId - Book a slot
const bookingSchema = z.object({
    topic: z.string().optional(),
    notes: z.string().optional()
})

router.post("/book/:slotId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const { slotId } = req.params
        const parsed = bookingSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        // Check slot exists and is available
        const slot = await db.individualLessonSlot.findUnique({
            where: { id: slotId },
            include: {
                booking: true,
                mentor: { select: { id: true, fullName: true } }
            }
        })

        if (!slot) {
            return res.status(404).json({ error: "Slot not found" })
        }

        if (!slot.isAvailable || slot.booking) {
            return res.status(400).json({ error: "Slot is not available" })
        }

        if (new Date(slot.date) < new Date()) {
            return res.status(400).json({ error: "Cannot book past slots" })
        }

        // Create booking
        const booking = await db.individualLessonBooking.create({
            data: {
                slotId,
                studentId: userId,
                topic: parsed.data.topic,
                notes: parsed.data.notes,
                status: "SCHEDULED"
            },
            include: {
                slot: {
                    include: {
                        mentor: { select: { id: true, fullName: true } }
                    }
                }
            }
        })

        // Create notification for mentor
        await db.notification.create({
            data: {
                userId: slot.mentorId,
                title: "Новое бронирование",
                message: `Ученик забронировал индивидуальный урок на ${new Date(slot.date).toLocaleDateString('ru-RU')} ${slot.startTime}`,
                type: "individual_lesson_booked"
            }
        })

        // Create notification for student
        await db.notification.create({
            data: {
                userId,
                title: "Урок забронирован",
                message: `Вы забронировали урок с ${slot.mentor.fullName} на ${new Date(slot.date).toLocaleDateString('ru-RU')} ${slot.startTime}`,
                type: "individual_lesson_confirmed"
            }
        })

        res.status(201).json(booking)
    } catch (error) {
        console.error("[individual-lessons/book] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/individual-lessons/my-bookings - Student's bookings
router.get("/my-bookings", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const { status } = req.query

        const where: any = { studentId: userId }
        if (status) {
            where.status = status
        }

        const bookings = await db.individualLessonBooking.findMany({
            where,
            include: {
                slot: {
                    include: {
                        mentor: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        })

        res.json(bookings)
    } catch (error) {
        console.error("[individual-lessons/my-bookings] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// DELETE /api/individual-lessons/bookings/:id - Cancel booking (student)
router.delete("/bookings/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const { id } = req.params

        const booking = await db.individualLessonBooking.findUnique({
            where: { id },
            include: {
                slot: {
                    include: { mentor: { select: { id: true, fullName: true } } }
                }
            }
        })

        if (!booking) {
            return res.status(404).json({ error: "Booking not found" })
        }

        if (booking.studentId !== userId && req.user!.role !== "ADMIN") {
            return res.status(403).json({ error: "Access denied" })
        }

        if (booking.status === "COMPLETED") {
            return res.status(400).json({ error: "Cannot cancel completed lesson" })
        }

        // Cancel the booking
        await db.individualLessonBooking.update({
            where: { id },
            data: { status: "CANCELLED" }
        })

        // Notify mentor
        await db.notification.create({
            data: {
                userId: booking.slot.mentorId,
                title: "Бронирование отменено",
                message: `Ученик отменил урок на ${new Date(booking.slot.date).toLocaleDateString('ru-RU')} ${booking.slot.startTime}`,
                type: "individual_lesson_cancelled"
            }
        })

        res.json({ success: true })
    } catch (error) {
        console.error("[individual-lessons/bookings cancel] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/individual-lessons/bookings/:id/rate - Rate a completed lesson
const rateSchema = z.object({
    rating: z.number().int().min(1).max(5)
})

router.post("/bookings/:id/rate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const { id } = req.params
        const parsed = rateSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const booking = await db.individualLessonBooking.findUnique({
            where: { id }
        })

        if (!booking) {
            return res.status(404).json({ error: "Booking not found" })
        }

        if (booking.studentId !== userId) {
            return res.status(403).json({ error: "Access denied" })
        }

        if (booking.status !== "COMPLETED") {
            return res.status(400).json({ error: "Can only rate completed lessons" })
        }

        await db.individualLessonBooking.update({
            where: { id },
            data: { rating: parsed.data.rating }
        })

        res.json({ success: true })
    } catch (error) {
        console.error("[individual-lessons/rate] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// ============ MENTOR ROUTES ============

// GET /api/individual-lessons/mentor-slots - Mentor's own slots
router.get("/mentor-slots", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id

        if (!["MENTOR", "ADMIN"].includes(req.user!.role)) {
            return res.status(403).json({ error: "Mentors only" })
        }

        const slots = await db.individualLessonSlot.findMany({
            where: { mentorId: userId },
            include: {
                booking: {
                    include: {
                        student: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                { date: "desc" },
                { startTime: "asc" }
            ]
        })

        res.json(slots)
    } catch (error) {
        console.error("[individual-lessons/mentor-slots] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/individual-lessons/slots - Create slot (mentor/admin)
const createSlotSchema = z.object({
    date: z.string().datetime(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    duration: z.number().int().min(15).max(180).default(60),
    price: z.number().min(0).default(5000),
    topic: z.string().optional()
})

router.post("/slots", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id

        if (!["MENTOR", "ADMIN"].includes(req.user!.role)) {
            return res.status(403).json({ error: "Mentors only" })
        }

        const parsed = createSlotSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const slotDate = new Date(parsed.data.date)

        // Check for conflicts
        const existingSlot = await db.individualLessonSlot.findFirst({
            where: {
                mentorId: userId,
                date: slotDate,
                startTime: parsed.data.startTime
            }
        })

        if (existingSlot) {
            return res.status(400).json({ error: "Slot already exists at this time" })
        }

        const slot = await db.individualLessonSlot.create({
            data: {
                mentorId: userId,
                date: slotDate,
                startTime: parsed.data.startTime,
                endTime: parsed.data.endTime,
                duration: parsed.data.duration,
                price: parsed.data.price,
                topic: parsed.data.topic,
                isAvailable: true
            }
        })

        res.status(201).json(slot)
    } catch (error) {
        console.error("[individual-lessons/slots create] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// DELETE /api/individual-lessons/slots/:id - Delete slot (mentor/admin)
router.delete("/slots/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const { id } = req.params

        const slot = await db.individualLessonSlot.findUnique({
            where: { id },
            include: { booking: true }
        })

        if (!slot) {
            return res.status(404).json({ error: "Slot not found" })
        }

        if (slot.mentorId !== userId && req.user!.role !== "ADMIN") {
            return res.status(403).json({ error: "Access denied" })
        }

        if (slot.booking && slot.booking.status === "SCHEDULED") {
            return res.status(400).json({ error: "Cannot delete slot with active booking. Cancel the booking first." })
        }

        await db.individualLessonSlot.delete({
            where: { id }
        })

        res.json({ success: true })
    } catch (error) {
        console.error("[individual-lessons/slots delete] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/individual-lessons/mentor-bookings - Mentor's bookings
router.get("/mentor-bookings", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id

        if (!["MENTOR", "ADMIN"].includes(req.user!.role)) {
            return res.status(403).json({ error: "Mentors only" })
        }

        const { status } = req.query

        const where: any = {
            slot: { mentorId: userId }
        }
        if (status) {
            where.status = status
        }

        const bookings = await db.individualLessonBooking.findMany({
            where,
            include: {
                student: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        age: true
                    }
                },
                slot: true
            },
            orderBy: { createdAt: "desc" }
        })

        res.json(bookings)
    } catch (error) {
        console.error("[individual-lessons/mentor-bookings] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// PATCH /api/individual-lessons/bookings/:id/complete - Complete lesson (mentor)
const completeSchema = z.object({
    feedback: z.string().optional(),
    xpAward: z.number().int().min(0).max(500).default(100),
    coinsAward: z.number().int().min(0).max(100).default(50)
})

router.patch("/bookings/:id/complete", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const { id } = req.params
        const parsed = completeSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const booking = await db.individualLessonBooking.findUnique({
            where: { id },
            include: {
                slot: { include: { mentor: true } },
                student: { select: { id: true, fullName: true } }
            }
        })

        if (!booking) {
            return res.status(404).json({ error: "Booking not found" })
        }

        if (booking.slot.mentorId !== userId && req.user!.role !== "ADMIN") {
            return res.status(403).json({ error: "Access denied" })
        }

        if (booking.status !== "SCHEDULED") {
            return res.status(400).json({ error: "Booking is not scheduled" })
        }

        // Complete the lesson
        await db.$transaction([
            // Update booking
            db.individualLessonBooking.update({
                where: { id },
                data: {
                    status: "COMPLETED",
                    feedback: parsed.data.feedback,
                    xpAwarded: parsed.data.xpAward,
                    coinsAwarded: parsed.data.coinsAward,
                    completedAt: new Date()
                }
            }),
            // Award XP to student
            db.user.update({
                where: { id: booking.studentId },
                data: {
                    experiencePoints: { increment: parsed.data.xpAward },
                    coinBalance: { increment: parsed.data.coinsAward }
                }
            }),
            // Create coin transaction
            db.coinTransaction.create({
                data: {
                    userId: booking.studentId,
                    amount: parsed.data.coinsAward,
                    type: "EARN",
                    reason: "Индивидуальный урок завершён"
                }
            }),
            // Notify student
            db.notification.create({
                data: {
                    userId: booking.studentId,
                    title: "Урок завершён",
                    message: `Вы получили ${parsed.data.xpAward} XP и ${parsed.data.coinsAward} S7 100 за индивидуальный урок`,
                    type: "individual_lesson_completed"
                }
            })
        ])

        res.json({ success: true })
    } catch (error) {
        console.error("[individual-lessons/complete] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// PATCH /api/individual-lessons/bookings/:id/no-show - Mark as no-show (mentor)
router.patch("/bookings/:id/no-show", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const { id } = req.params

        const booking = await db.individualLessonBooking.findUnique({
            where: { id },
            include: { slot: true }
        })

        if (!booking) {
            return res.status(404).json({ error: "Booking not found" })
        }

        if (booking.slot.mentorId !== userId && req.user!.role !== "ADMIN") {
            return res.status(403).json({ error: "Access denied" })
        }

        await db.individualLessonBooking.update({
            where: { id },
            data: { status: "NO_SHOW" }
        })

        res.json({ success: true })
    } catch (error) {
        console.error("[individual-lessons/no-show] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// ============ ADMIN ROUTES ============

// GET /api/individual-lessons/admin/all-slots - All slots (admin)
router.get("/admin/all-slots", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (req.user!.role !== "ADMIN") {
        return res.status(403).json({ error: "Admin only" })
    }

    try {
        const slots = await db.individualLessonSlot.findMany({
            include: {
                mentor: { select: { id: true, fullName: true, email: true } },
                booking: {
                    include: {
                        student: { select: { id: true, fullName: true, email: true } }
                    }
                }
            },
            orderBy: { date: "desc" },
            take: 100
        })

        res.json(slots)
    } catch (error) {
        console.error("[individual-lessons/admin/all-slots] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/individual-lessons/admin/all-bookings - All bookings (admin)
router.get("/admin/all-bookings", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (req.user!.role !== "ADMIN") {
        return res.status(403).json({ error: "Admin only" })
    }

    try {
        const { status } = req.query

        const where: any = {}
        if (status) {
            where.status = status
        }

        const bookings = await db.individualLessonBooking.findMany({
            where,
            include: {
                student: { select: { id: true, fullName: true, email: true } },
                slot: {
                    include: {
                        mentor: { select: { id: true, fullName: true, email: true } }
                    }
                }
            },
            orderBy: { createdAt: "desc" },
            take: 100
        })

        res.json(bookings)
    } catch (error) {
        console.error("[individual-lessons/admin/all-bookings] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/individual-lessons/stats - Statistics (mentor/admin)
router.get("/stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const role = req.user!.role

        let mentorWhere: any = {}
        if (role === "MENTOR") {
            mentorWhere = { slot: { mentorId: userId } }
        }

        const [totalBookings, completedBookings, cancelledBookings, upcomingBookings] = await Promise.all([
            db.individualLessonBooking.count({ where: mentorWhere }),
            db.individualLessonBooking.count({ where: { ...mentorWhere, status: "COMPLETED" } }),
            db.individualLessonBooking.count({ where: { ...mentorWhere, status: "CANCELLED" } }),
            db.individualLessonBooking.count({
                where: {
                    ...mentorWhere,
                    status: "SCHEDULED",
                    slot: { date: { gte: new Date() } }
                }
            })
        ])

        res.json({
            totalBookings,
            completedBookings,
            cancelledBookings,
            upcomingBookings
        })
    } catch (error) {
        console.error("[individual-lessons/stats] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})
