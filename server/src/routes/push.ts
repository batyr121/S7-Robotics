import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"
import { getVapidPublicKey } from "../utils/push"

export const router = Router()
const db = prisma as any

router.use(requireAuth)

const subscriptionSchema = z.object({
    endpoint: z.string().min(1),
    keys: z.object({
        p256dh: z.string().min(1),
        auth: z.string().min(1)
    })
})

// GET /api/push/vapid-public-key
router.get("/vapid-public-key", (_req: AuthenticatedRequest, res: Response) => {
    const key = getVapidPublicKey()
    if (!key) return res.status(404).json({ error: "Push not configured" })
    res.json({ publicKey: key })
})

// POST /api/push/subscribe
router.post("/subscribe", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parsed = subscriptionSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }
        const userId = req.user!.id
        const { endpoint, keys } = parsed.data
        const userAgent = String(req.headers["user-agent"] || "")

        const record = await db.pushSubscription.upsert({
            where: { userId_endpoint: { userId, endpoint } },
            update: {
                p256dh: keys.p256dh,
                auth: keys.auth,
                userAgent
            },
            create: {
                userId,
                endpoint,
                p256dh: keys.p256dh,
                auth: keys.auth,
                userAgent
            }
        })

        res.json({ success: true, subscriptionId: record.id })
    } catch (error) {
        console.error("[push/subscribe] error:", error)
        res.status(500).json({ error: "Failed to save subscription" })
    }
})

// POST /api/push/unsubscribe
router.post("/unsubscribe", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parsed = subscriptionSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }
        const userId = req.user!.id
        const { endpoint } = parsed.data
        await db.pushSubscription.deleteMany({ where: { userId, endpoint } })
        res.json({ success: true })
    } catch (error) {
        console.error("[push/unsubscribe] error:", error)
        res.status(500).json({ error: "Failed to unsubscribe" })
    }
})
