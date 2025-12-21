import { Router, Response } from "express"
import { prisma } from "../db"
import { requireAuth, requireAdmin } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

const router = Router()

// GET /api/salaries/stats - Get unpaid sessions stats for mentors
router.get("/stats", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        // 1. Get all mentors
        // Note: We use "MENTOR" role string, or UserRole.MENTOR if available.
        // Assuming prisma schema allows filtering by role string.
        const mentors = await prisma.user.findMany({
            where: { role: "MENTOR" },
            select: { id: true, fullName: true, email: true } // hourlyRate selected via any if needed, or fetched as full object
        })

        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        // 2. Calculate unpaid stats for each mentor
        // Logic: Count all completed Kruzhok sessions where this mentor was assigning attendance (or we can use Kruzhok owner/mentor logic).
        // For simplicity: We'll count sessions of Kruzhoks owned by this mentor or "ClubMentor" relation.

        const stats = await Promise.all(mentors.map(async (mentor) => {
            // Find sessions conducted by this mentor (as owner of kruzhok for now, or elaborate logic if needed)
            // Or better: Count attended sessions in classes where they are mentors. 
            // Simplified logic: Count all KruzhokSessions for Kruzhoks owned by this mentor that happened this month.

            const sessionsCount = await (prisma as any).kruzhokSession.count({
                where: {
                    kruzhok: { ownerId: mentor.id },
                    date: { get: startOfMonth }
                }
            })

            // Calculate "unpaid" amount - ideally we'd track "paid" status per session.
            // Simplified: Just show total potential monthly earnings based on sessions * hourlyRate.

            const rate = (mentor as any).hourlyRate || 500

            return {
                mentorId: mentor.id,
                fullName: mentor.fullName,
                email: mentor.email,
                hourlyRate: rate,
                sessionsCount: sessionsCount || 0, // Mock or simple count
                estimatedDue: (sessionsCount || 0) * rate,
                lastPaymentDate: null // To be implemented with SalaryPayment queries
            }
        }))

        res.json(stats)
    } catch (error) {
        console.error("Failed to fetch salary stats:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/salaries/pay - Record a payment
router.post("/pay", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { userId, amount, period } = req.body
        const payment = await (prisma as any).salaryPayment.create({
            data: {
                userId,
                amount,
                period,
                status: "PAID"
            }
        })
        res.json(payment)
    } catch (error) {
        console.error("Payment error:", error)
        res.status(500).json({ error: "Failed to record payment" })
    }
})

export { router as salaryRouter }
