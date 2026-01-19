import { Router, Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth, requireAdmin } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

const router = Router()
const db = prisma as any

const periodSchema = z.string().regex(/^\d{4}-\d{2}$/)
const paySchema = z.object({
    userId: z.string().min(1),
    amount: z.number().int().positive(),
    period: periodSchema.optional()
})

const getPeriodKey = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    return `${year}-${month}`
}

const getPeriodRange = (period?: string) => {
    const base = period && periodSchema.safeParse(period).success
        ? period
        : getPeriodKey(new Date())
    const [yearStr, monthStr] = base.split("-")
    const year = Number(yearStr)
    const month = Number(monthStr)
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 1)
    return { period: base, start, end }
}

const getScheduleAmount = (schedule: any) => {
    const wage = Number(schedule?.class?.wagePerLesson || 0)
    return wage > 0 ? wage : 0
}

// GET /api/salaries/stats - monthly salary stats for mentors
router.get("/stats", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { period } = req.query as { period?: string }
        const range = getPeriodRange(period)

        const mentors = await db.user.findMany({
            where: { role: "MENTOR" },
            select: { id: true, fullName: true, email: true }
        })

        const schedules = await db.schedule.findMany({
            where: {
                status: "COMPLETED",
                scheduledDate: { gte: range.start, lt: range.end }
            },
            select: {
                id: true,
                createdById: true,
                scheduledDate: true,
                class: { select: { mentorId: true, wagePerLesson: true } }
            }
        })

        const statsMap = new Map<string, any>()
        for (const mentor of mentors) {
            statsMap.set(mentor.id, {
                mentorId: mentor.id,
                fullName: mentor.fullName,
                email: mentor.email,
                lessonsCount: 0,
                dueTotal: 0,
                missingWageLessons: 0,
                paidTotal: 0,
                balanceDue: 0,
                lastPaymentDate: null
            })
        }

        for (const schedule of schedules) {
            const mentorId = schedule.class?.mentorId || schedule.createdById
            if (!mentorId || !statsMap.has(mentorId)) continue
            const stat = statsMap.get(mentorId)
            stat.lessonsCount += 1
            const amount = getScheduleAmount(schedule)
            if (amount <= 0) {
                stat.missingWageLessons += 1
            } else {
                stat.dueTotal += amount
            }
        }

        const payments = await db.salaryPayment.findMany({
            where: { period: range.period },
            select: { id: true, userId: true, amount: true, createdAt: true, paidAt: true }
        })

        for (const payment of payments) {
            const stat = statsMap.get(payment.userId)
            if (!stat) continue
            stat.paidTotal += Number(payment.amount || 0)
            const paidAt = payment.paidAt || payment.createdAt
            if (paidAt) {
                const paidAtDate = new Date(paidAt)
                if (!stat.lastPaymentDate || paidAtDate > new Date(stat.lastPaymentDate)) {
                    stat.lastPaymentDate = paidAtDate.toISOString()
                }
            }
        }

        for (const stat of statsMap.values()) {
            stat.balanceDue = Math.max(stat.dueTotal - stat.paidTotal, 0)
        }

        const result = Array.from(statsMap.values()).sort((a, b) => b.balanceDue - a.balanceDue)
        res.json({ period: range.period, stats: result })
    } catch (error) {
        console.error("Failed to fetch salary stats:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/salaries/payments - list salary payments
router.get("/payments", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { mentorId, period } = req.query as { mentorId?: string; period?: string }
        const where: any = {}
        if (mentorId) where.userId = mentorId
        if (period) where.period = period

        const payments = await db.salaryPayment.findMany({
            where,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                userId: true,
                amount: true,
                period: true,
                status: true,
                paidAt: true,
                createdAt: true,
                user: { select: { id: true, fullName: true, email: true } }
            }
        })

        res.json(payments || [])
    } catch (error) {
        console.error("Failed to fetch salary payments:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/salaries/pay - Record a cash payment
router.post("/pay", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parsed = paySchema.safeParse(req.body)
        if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
        const { userId, amount, period } = parsed.data
        const finalPeriod = period || getPeriodKey(new Date())
        const payment = await db.salaryPayment.create({
            data: {
                userId,
                amount,
                period: finalPeriod,
                status: "PAID"
            }
        })
        res.json(payment)
    } catch (error) {
        console.error("Payment error:", error)
        res.status(500).json({ error: "Failed to record payment" })
    }
})

// DELETE /api/salaries/payments/:id - Remove a payment record
router.delete("/payments/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params
        await db.salaryPayment.delete({ where: { id } })
        res.json({ success: true })
    } catch (error) {
        console.error("Failed to delete payment:", error)
        res.status(500).json({ error: "Failed to delete payment" })
    }
})

export { router as salaryRouter }
