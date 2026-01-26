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
        res.status(500).json({ error: "Внутренняя ошибка сервера" })
    }
})

// GET /api/parent/child-search?query= - Search students by name/email to link
router.get("/child-search", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const role = String(req.user!.role || "").toUpperCase()
        if (!["PARENT", "ADMIN"].includes(role)) {
            return res.status(403).json({ error: "Поиск доступен только родителям" })
        }
        const query = String(req.query.query || "").trim()
        if (!query) return res.json([])

        const students = await db.user.findMany({
            where: {
                parentId: null,
                role: { in: ["STUDENT", "USER"] },
                OR: [
                    { fullName: { contains: query, mode: "insensitive" } },
                    { email: { contains: query, mode: "insensitive" } }
                ]
            },
            select: { id: true, fullName: true, email: true },
            take: 8,
            orderBy: { createdAt: "desc" }
        })

        res.json(students || [])
    } catch (error) {
        console.error("[parent/child-search] Error:", error)
        res.status(500).json({ error: "Внутренняя ошибка сервера" })
    }
})

// GET /api/parent/subscriptions - Get subscription status for home widget
router.get("/subscriptions", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parentId = req.user!.id
        const planLabels: Record<string, string> = {
            MONTHLY_SUBSCRIPTION: "Ежемесячный абонемент",
            ONETIME_PURCHASE: "Разовый абонемент"
        }
        const toAmount = (value: any) => {
            if (typeof value === "number") return value
            if (typeof value === "string") return Number(value) || 0
            if (value && typeof value.toNumber === "function") return value.toNumber()
            if (value && typeof value.toString === "function") return Number(value.toString()) || 0
            return 0
        }

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
            childName: s.user?.fullName || "Неизвестно",
            planLabel: planLabels[s.type] || s.type || "Абонемент",
            amount: toAmount(s.amount),
            expiresAt: s.expiresAt?.toISOString(),
            isActive: s.status === "ACTIVE" && (!s.expiresAt || new Date(s.expiresAt) > now)
        }))

        res.json(result)
    } catch (error) {
        console.error("[parent/subscriptions] Error:", error)
        res.status(500).json({ error: "Внутренняя ошибка сервера" })
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
        })

        const result = (discounts || []).map((d: any) => ({
            id: d.id,
            title: d.title || d.name,
            description: d.description || "",
            percent: d.percent || 0,
            validUntil: d.validUntil?.toISOString() || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }))

        res.json(result)
    } catch (error) {
        console.error("[parent/discounts] Error:", error)
        res.status(500).json({ error: "Внутренняя ошибка сервера" })
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
            return res.status(404).json({ error: "Ребенок не найден или не привязан к вам" })
        }

        res.json(child)
    } catch (error) {
        console.error("[parent/child] Error:", error)
        res.status(500).json({ error: "Внутренняя ошибка сервера" })
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
            return res.status(404).json({ error: "Ребенок не найден или не привязан к вам" })
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
            select: {
                id: true,
                markedAt: true,
                status: true,
                grade: true,
                workSummary: true,
                notes: true,
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
        res.status(500).json({ error: "Внутренняя ошибка сервера" })
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
            return res.status(404).json({ error: "Ребенок не найден или не привязан к вам" })
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
        res.status(500).json({ error: "Внутренняя ошибка сервера" })
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
        res.status(500).json({ error: "Внутренняя ошибка сервера" })
    }
})

// POST /api/parent/link-child - Link a child by 6-digit code
const linkChildSchema = z.object({
    code: z.string().regex(/^\d{6}$/),
    childId: z.string().optional()
})

router.post("/link-child", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const role = String(req.user!.role || "").toUpperCase()
        if (!["PARENT", "ADMIN"].includes(role)) {
            return res.status(403).json({ error: "Привязка доступна только родителям" })
        }
        const parentId = req.user!.id
        const parsed = linkChildSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const { code, childId } = parsed.data
        const now = new Date()

        const child = childId
            ? await db.user.findUnique({ where: { id: childId } })
            : await db.user.findUnique({ where: { linkCode: code } })

        if (!child) {
            return res.status(404).json({ error: "Ученик не найден" })
        }

        if (child.parentId) {
            return res.status(400).json({ error: "Этот ученик уже привязан к родителю" })
        }

        const childRole = String(child.role || "").toUpperCase()
        if (!["STUDENT", "USER"].includes(childRole)) {
            return res.status(400).json({ error: "Привязка доступна только для учеников" })
        }

        if (child.linkCode !== code) {
            return res.status(400).json({ error: "Неверный код привязки" })
        }

        if (child.linkCodeExpiresAt && child.linkCodeExpiresAt < now) {
            return res.status(400).json({ error: "Код привязки истек. Попросите ученика обновить его." })
        }

        const updated = await db.user.update({
            where: { id: child.id },
            data: {
                parentId,
                linkCode: null,
                linkCodeIssuedAt: null,
                linkCodeExpiresAt: null
            }
        })

        await db.notification.createMany({
            data: [
                {
                    userId: parentId,
                    title: "Ребенок привязан",
                    message: `${updated.fullName} теперь привязан к вашему аккаунту.`,
                    type: "parent_link"
                },
                {
                    userId: updated.id,
                    title: "Родитель привязан",
                    message: "Ваш родительский аккаунт успешно привязан.",
                    type: "parent_link"
                }
            ]
        }).catch(() => null)

        res.json({ success: true, child: { id: updated.id, fullName: updated.fullName, email: updated.email } })
    } catch (error) {
        console.error("[parent/link-child] Error:", error)
        res.status(500).json({ error: "Внутренняя ошибка сервера" })
    }
})
