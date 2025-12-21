import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAdmin, requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

export const router = Router()

// Public or Protected: List games (for students/playing)
router.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const list = await (prisma as any).game.findMany({
            orderBy: { createdAt: "desc" },
        })
        res.json(list)
    } catch (error) {
        console.error("Failed to fetch games:", error)
        res.status(500).json({ error: "Failed to fetch games" })
    }
})

// Admin: Create Game
const createGameSchema = z.object({
    title: z.string().min(3),
    gameUrl: z.string().url(),
    description: z.string().optional(),
    coverUrl: z.string().optional(),
    isPublished: z.boolean().default(false),
})

router.post("/", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const result = createGameSchema.safeParse(req.body)
    if (!result.success) {
        return res.status(400).json({ error: result.error.flatten() })
    }
    try {
        const game = await (prisma as any).game.create({
            data: result.data,
        })
        res.status(201).json(game)
    } catch (error) {
        console.error("Failed to create game:", error)
        res.status(500).json({ error: "Failed to create game" })
    }
})

// Admin: Update Game
router.patch("/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params
    // Partial schema for updates
    const updateSchema = createGameSchema.partial()
    const result = updateSchema.safeParse(req.body)

    if (!result.success) {
        return res.status(400).json({ error: result.error.flatten() })
    }

    try {
        const game = await (prisma as any).game.update({
            where: { id },
            data: result.data,
        })
        res.json(game)
    } catch (error) {
        // Prisma "Record not found" usually throws
        res.status(404).json({ error: "Game not found" })
    }
})

// Admin: Delete Game
router.delete("/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params
    try {
        await (prisma as any).game.delete({
            where: { id },
        })
        res.json({ success: true })
    } catch (error) {
        res.status(404).json({ error: "Game not found" })
    }
})
