import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

export const router = Router()

const db = prisma as any

// GET /api/shop/items - List shop items (public for authenticated users)
router.get("/items", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const items = await db.shopItem.findMany({
            where: { isHidden: false },
            orderBy: { createdAt: "desc" }
        })

        res.json(items)
    } catch (error) {
        console.error("[shop/items] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/shop/purchase - Purchase item
const purchaseSchema = z.object({
    itemId: z.string().min(1)
})

router.post("/purchase", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id
        const parsed = purchaseSchema.safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const { itemId } = parsed.data

        // Get item
        const item = await db.shopItem.findUnique({
            where: { id: itemId }
        })

        if (!item) {
            return res.status(404).json({ error: "Item not found" })
        }

        if (item.isHidden) {
            return res.status(400).json({ error: "Item is not available" })
        }

        // Get user balance
        const user = await db.user.findUnique({
            where: { id: userId },
            select: { coinBalance: true }
        })

        if (!user || user.coinBalance < item.priceCoins) {
            return res.status(400).json({
                error: "Insufficient balance",
                required: item.priceCoins,
                current: user?.coinBalance || 0
            })
        }

        // Perform purchase
        await db.$transaction([
            // Deduct coins
            db.user.update({
                where: { id: userId },
                data: { coinBalance: { decrement: item.priceCoins } }
            }),
            // Create transaction record
            db.coinTransaction.create({
                data: {
                    userId,
                    amount: -item.priceCoins,
                    type: "SPEND",
                    reason: `Покупка: ${item.title}`,
                    shopItemId: item.id
                }
            }),
            // Create notification
            db.notification.create({
                data: {
                    userId,
                    title: "Покупка в магазине",
                    message: `Вы приобрели "${item.title}" за ${item.priceCoins} S7 100`,
                    type: "shop_purchase"
                }
            })
        ])

        // Get updated balance
        const updatedUser = await db.user.findUnique({
            where: { id: userId },
            select: { coinBalance: true }
        })

        res.json({
            success: true,
            item: { id: item.id, title: item.title },
            newBalance: updatedUser?.coinBalance || 0
        })
    } catch (error) {
        console.error("[shop/purchase] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/shop/my-purchases - User's purchase history
router.get("/my-purchases", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id

        const transactions = await db.coinTransaction.findMany({
            where: {
                userId,
                type: "SPEND",
                shopItemId: { not: null }
            },
            include: {
                shopItem: true
            },
            orderBy: { createdAt: "desc" },
            take: 50
        })

        res.json(transactions)
    } catch (error) {
        console.error("[shop/my-purchases] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/shop/my-balance - Get current coin balance
router.get("/my-balance", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id

        const user = await db.user.findUnique({
            where: { id: userId },
            select: { coinBalance: true }
        })

        res.json({ balance: user?.coinBalance || 0 })
    } catch (error) {
        console.error("[shop/my-balance] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/shop/transactions - All coin transactions
router.get("/transactions", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id

        const transactions = await db.coinTransaction.findMany({
            where: { userId },
            include: {
                shopItem: { select: { id: true, title: true } }
            },
            orderBy: { createdAt: "desc" },
            take: 100
        })

        res.json(transactions)
    } catch (error) {
        console.error("[shop/transactions] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// ============ ADMIN ROUTES ============

// GET /api/shop/admin/items - List all items (including hidden)
router.get("/admin/items", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (req.user!.role !== "ADMIN") {
        return res.status(403).json({ error: "Admin only" })
    }

    try {
        const items = await db.shopItem.findMany({
            orderBy: { createdAt: "desc" }
        })

        res.json(items)
    } catch (error) {
        console.error("[shop/admin/items] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// POST /api/shop/admin/items - Create item
const createItemSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    priceCoins: z.number().int().positive(),
    imageUrl: z.string().optional(),
    type: z.enum(["MERCH", "BONUS_LESSON", "MATERIAL", "DISCOUNT"]),
    isHidden: z.boolean().default(false)
})

router.post("/admin/items", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (req.user!.role !== "ADMIN") {
        return res.status(403).json({ error: "Admin only" })
    }

    try {
        const parsed = createItemSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const item = await db.shopItem.create({
            data: parsed.data
        })

        res.status(201).json(item)
    } catch (error) {
        console.error("[shop/admin/items create] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// PUT /api/shop/admin/items/:id - Update item
router.put("/admin/items/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (req.user!.role !== "ADMIN") {
        return res.status(403).json({ error: "Admin only" })
    }

    try {
        const { id } = req.params
        const parsed = createItemSchema.partial().safeParse(req.body)

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const item = await db.shopItem.update({
            where: { id },
            data: parsed.data
        })

        res.json(item)
    } catch (error) {
        console.error("[shop/admin/items update] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// DELETE /api/shop/admin/items/:id - Delete item
router.delete("/admin/items/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (req.user!.role !== "ADMIN") {
        return res.status(403).json({ error: "Admin only" })
    }

    try {
        const { id } = req.params

        await db.shopItem.delete({
            where: { id }
        })

        res.json({ success: true })
    } catch (error) {
        console.error("[shop/admin/items delete] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})
