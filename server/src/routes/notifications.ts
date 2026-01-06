import { Router, type Response } from "express"
import { prisma } from "../db"
import { requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

export const router = Router()
const db = prisma as any

// All routes require authentication
router.use(requireAuth)

// GET /api/notifications - List notifications
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id

        const notifications = await db.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 20
        })

        const unreadCount = await db.notification.count({
            where: { userId, isRead: false }
        })

        res.json({ notifications, unreadCount })
    } catch (error) {
        console.error("[notifications] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/notifications/read/:id - Mark as read
router.post("/read/:id", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const { id } = req.params

        await db.notification.updateMany({
            where: { id, userId },
            data: { isRead: true }
        })

        res.json({ success: true })
    } catch (error) {
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/notifications/read-all - Mark all as read
router.post("/read-all", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id

        await db.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true }
        })

        res.json({ success: true })
    } catch (error) {
        res.status(500).json({ error: "Internal server error" })
    }
})
