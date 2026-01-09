import { Router, type Response } from "express"
import { prisma } from "../db"
import { requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

export const router = Router()
const db = prisma as any

router.use(requireAuth)

// GET /api/student/mentors - mentors for current student
router.get("/mentors", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id

        const enrollments = await db.classEnrollment.findMany({
            where: { userId, status: "active" },
            include: {
                class: {
                    include: {
                        kruzhok: {
                            select: {
                                owner: {
                                    select: {
                                        id: true,
                                        fullName: true,
                                        email: true,
                                        profile: { select: { phone: true } }
                                    }
                                },
                                title: true
                            }
                        },
                        name: true
                    }
                }
            }
        })

        const mentorMap = new Map()
        for (const e of enrollments) {
            const owner = e.class?.kruzhok?.owner
            if (!owner) continue
            if (!mentorMap.has(owner.id)) {
                mentorMap.set(owner.id, {
                    id: owner.id,
                    fullName: owner.fullName,
                    email: owner.email,
                    phone: owner.profile?.phone || null,
                    groups: []
                })
            }
            mentorMap.get(owner.id).groups.push({
                className: e.class?.name,
                kruzhokTitle: e.class?.kruzhok?.title
            })
        }

        res.json({ mentors: Array.from(mentorMap.values()) })
    } catch (error) {
        console.error("[student/mentors] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})
