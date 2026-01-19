import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth, requireAdmin } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

export const router = Router()
const db = prisma as any

router.use(requireAuth)

const promotionSchema = z.object({
    title: z.string().min(1),
    description: z.string().max(2000).optional(),
    percent: z.number().int().min(0).max(100).default(0),
    validUntil: z.string().datetime().optional().nullable(),
    isActive: z.boolean().optional()
})

const promotionUpdateSchema = promotionSchema.partial()

// GET /api/promotions - list promotions (admin)
router.get("/", requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const items = await db.promotion.findMany({
            orderBy: { createdAt: "desc" }
        })
        res.json(items || [])
    } catch (error) {
        console.error("[promotions] list error:", error)
        res.status(500).json({ error: "Failed to load promotions" })
    }
})

// POST /api/promotions - create promotion (admin)
router.post("/", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parsed = promotionSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }
        const data = parsed.data
        const promotion = await db.promotion.create({
            data: {
                title: data.title,
                description: data.description || null,
                percent: data.percent,
                validUntil: data.validUntil ? new Date(data.validUntil) : null,
                isActive: data.isActive ?? true
            }
        })
        res.status(201).json(promotion)
    } catch (error) {
        console.error("[promotions] create error:", error)
        res.status(500).json({ error: "Failed to create promotion" })
    }
})

// PUT /api/promotions/:id - update promotion (admin)
router.put("/:id", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parsed = promotionUpdateSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }
        const data = parsed.data
        const promotion = await db.promotion.update({
            where: { id: req.params.id },
            data: {
                title: data.title,
                description: data.description,
                percent: data.percent,
                validUntil: data.validUntil ? new Date(data.validUntil) : data.validUntil === null ? null : undefined,
                isActive: data.isActive
            }
        })
        res.json(promotion)
    } catch (error) {
        console.error("[promotions] update error:", error)
        res.status(500).json({ error: "Failed to update promotion" })
    }
})

// DELETE /api/promotions/:id - delete promotion (admin)
router.delete("/:id", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
        await db.promotion.delete({ where: { id: req.params.id } })
        res.json({ success: true })
    } catch (error) {
        console.error("[promotions] delete error:", error)
        res.status(500).json({ error: "Failed to delete promotion" })
    }
})
