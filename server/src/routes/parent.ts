import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

export const router = Router()

const db = prisma as any

// All routes require authenticated parent
router.use(requireAuth)

// GET /api/parent/children - Get linked children
router.get("/children", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parentId = req.user!.id

        const children = await db.user.findMany({
            where: { parentId },
            select: {
                id: true,
                fullName: true,
                email: true,
                level: true,
                experiencePoints: true,
                coinBalance: true,
                createdAt: true,
                _count: {
                    select: {
                        enrollments: true,
                        classEnrollments: true,
                    }
                }
            }
        })

        res.json(children)
    } catch (error) {
        console.error("[parent/children] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/parent/subscriptions - Get subscription status for home widget
router.get("/subscriptions", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parentId = req.user!.id

        // Get children first
        const children = await db.user.findMany({
            where: { parentId },
            select: { id: true, fullName: true }
        })
        const childIds = children.map((c: any) => c.id)

        // Get subscriptions for parent and children
        const subscriptions = await db.subscription.findMany({
            where: {
                OR: [
                    { userId: parentId },
                    { userId: { in: childIds } }
                ]
            },
            include: {
                user: { select: { id: true, fullName: true } }
            },
            orderBy: { expiresAt: "desc" }
        })

        const now = new Date()
        const result = subscriptions.map((s: any) => ({
            id: s.id,
            childName: s.user?.fullName || "Unknown",
            courseName: s.planName || s.type || "Subscription",
            expiresAt: s.expiresAt?.toISOString(),
            isActive: s.status === "ACTIVE" && (!s.expiresAt || new Date(s.expiresAt) > now)
        }))

        res.json(result)
    } catch (error) {
        console.error("[parent/subscriptions] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/parent/discounts - Get available discounts for home widget
router.get("/discounts", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const now = new Date()

        // Get active discounts/promotions
        const discounts = await db.promotion.findMany({
            where: {
                isActive: true,
                OR: [
                    { validUntil: null },
                    { validUntil: { gte: now } }
                ]
            },
            orderBy: { createdAt: "desc" },
            take: 10
        }).catch(() => [])

        const result = (discounts || []).map((d: any) => ({
            id: d.id,
            title: d.title || d.name,
            description: d.description || "",
            percent: d.discountPercent || d.percent || 0,
            validUntil: d.validUntil?.toISOString() || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }))

        res.json(result)
    } catch (error) {
        console.error("[parent/discounts] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/parent/child/:childId - Get child details
router.get("/child/:childId", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parentId = req.user!.id
        const { childId } = req.params

        const child = await db.user.findFirst({
            where: { id: childId, parentId },
            select: {
                id: true,
                fullName: true,
                email: true,
                level: true,
                experiencePoints: true,
                coinBalance: true,
                createdAt: true,
                enrollments: {
                    include: {
                        course: {
                            select: { id: true, title: true, difficulty: true }
                        }
                    }
                },
                classEnrollments: {
                    include: {
                        class: {
                            select: {
                                id: true,
                                name: true,
                                kruzhok: { select: { id: true, title: true } }
                            }
                        }
                    }
                },
                achievements: {
                    include: {
                        achievement: true
                    }
                }
            }
        })

        if (!child) {
            return res.status(404).json({ error: "Child not found or not linked to you" })
        }

        res.json(child)
    } catch (error) {
        console.error("[parent/child] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/parent/child/:childId/progress - Get child's course progress
router.get("/child/:childId/progress", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parentId = req.user!.id
        const { childId } = req.params

        // Verify child belongs to parent
        const child = await db.user.findFirst({
            where: { id: childId, parentId },
            select: { id: true }
        })

        if (!child) {
            return res.status(404).json({ error: "Child not found or not linked to you" })
        }

        const enrollments = await db.enrollment.findMany({
            where: { userId: childId },
            include: {
                course: {
                    select: { id: true, title: true, difficulty: true, totalModules: true }
                },
                lessonProgress: {
                    select: { isCompleted: true, completedAt: true }
                }
            },
            orderBy: { enrolledAt: "desc" }
        })

        const progress = enrollments.map((e: any) => ({
            courseId: e.course.id,
            courseTitle: e.course.title,
            difficulty: e.course.difficulty,
            totalModules: e.course.totalModules,
            progressPercentage: Number(e.progressPercentage),
            enrolledAt: e.enrolledAt,
            completedAt: e.completedAt,
            completedLessons: e.lessonProgress.filter((lp: any) => lp.isCompleted).length,
            totalLessons: e.lessonProgress.length
        }))

        res.json(progress)
    } catch (error) {
        console.error("[parent/child/progress] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/parent/child/:childId/attendance - Get child's attendance records
router.get("/child/:childId/attendance", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parentId = req.user!.id
        const { childId } = req.params
        const { from, to } = req.query as { from?: string; to?: string }

        // Verify child belongs to parent
        const child = await db.user.findFirst({
            where: { id: childId, parentId },
            select: { id: true }
        })

        if (!child) {
            return res.status(404).json({ error: "Child not found or not linked to you" })
        }

        const where: any = { studentId: childId }
        if (from) {
            where.markedAt = { gte: new Date(from) }
        }
        if (to) {
            where.markedAt = { ...(where.markedAt || {}), lte: new Date(to) }
        }

        const attendance = await db.attendance.findMany({
            where,
            include: {
                schedule: {
                    select: {
                        id: true,
                        title: true,
                        scheduledDate: true,
                        kruzhok: { select: { id: true, title: true } }
                    }
                }
            },
            orderBy: { markedAt: "desc" },
            take: 100
        })

        res.json(attendance)
    } catch (error) {
        console.error("[parent/child/attendance] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/parent/child/:childId/achievements - Get child's achievements
router.get("/child/:childId/achievements", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parentId = req.user!.id
        const { childId } = req.params

        // Verify child belongs to parent
        const child = await db.user.findFirst({
            where: { id: childId, parentId },
            select: { id: true }
        })

        if (!child) {
            return res.status(404).json({ error: "Child not found or not linked to you" })
        }

        const achievements = await db.userAchievement.findMany({
            where: { userId: childId },
            include: {
                achievement: true
            },
            orderBy: { earnedAt: "desc" }
        })

        res.json(achievements)
    } catch (error) {
        console.error("[parent/child/achievements] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/parent/payments - Payment history for linked children
router.get("/payments", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parentId = req.user!.id

        // Get all children IDs
        const children = await db.user.findMany({
            where: { parentId },
            select: { id: true }
        })
        const childIds = children.map((c: any) => c.id)

        // Get purchases for parent and children
        const purchases = await db.purchase.findMany({
            where: {
                OR: [
                    { userId: parentId },
                    { userId: { in: childIds } }
                ]
            },
            include: {
                user: { select: { id: true, fullName: true } },
                course: { select: { id: true, title: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 50
        })

        // Get subscriptions
        const subscriptions = await db.subscription.findMany({
            where: {
                OR: [
                    { userId: parentId },
                    { userId: { in: childIds } }
                ]
            },
            include: {
                user: { select: { id: true, fullName: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 50
        })

        res.json({
            purchases,
            subscriptions
        })
    } catch (error) {
        console.error("[parent/payments] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/parent/notifications - Parent-specific notifications
router.get("/notifications", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parentId = req.user!.id

        const notifications = await db.notification.findMany({
            where: { userId: parentId },
            orderBy: { createdAt: "desc" },
            take: 50
        })

        res.json(notifications)
    } catch (error) {
        console.error("[parent/notifications] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/parent/link-child - Link a child by email
const linkChildSchema = z.object({
    childEmail: z.string().email()
})

router.post("/link-child", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parentId = req.user!.id
        const parsed = linkChildSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const { childEmail } = parsed.data

        // Find child user
        const child = await db.user.findUnique({
            where: { email: childEmail }
        })

        if (!child) {
            return res.status(404).json({ error: "User with this email not found" })
        }

        if (child.parentId) {
            return res.status(400).json({ error: "This user is already linked to a parent" })
        }

        if (child.role === "ADMIN" || child.role === "PARENT") {
            return res.status(400).json({ error: "Cannot link admin or parent accounts" })
        }

        // Link child to parent
        const updated = await db.user.update({
            where: { id: child.id },
            data: { parentId }
        })

        res.json({ success: true, child: { id: updated.id, fullName: updated.fullName, email: updated.email } })
    } catch (error) {
        console.error("[parent/link-child] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})
