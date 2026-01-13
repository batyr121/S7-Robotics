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
                        mentor: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                profile: { select: { phone: true } }
                            }
                        },
                        name: true
                    }
                }
            }
        })

        const mentorMap = new Map()
        for (const e of enrollments) {
            const groupsFn = (mId: string) => {
                const existing = mentorMap.get(mId)
                if (existing) return existing
                const newEntry = {
                    id: mId,
                    fullName: "",
                    email: "",
                    phone: null,
                    groups: []
                }
                mentorMap.set(mId, newEntry)
                return newEntry
            }

            const owner = e.class?.kruzhok?.owner
            if (owner) {
                const entry = groupsFn(owner.id)
                entry.fullName = owner.fullName
                entry.email = owner.email
                entry.phone = owner.profile?.phone || null
                // Avoid duplicate groups if mentor and owner are same
                if (!entry.groups.some((g: any) => g.className === e.class?.name)) {
                    entry.groups.push({
                        className: e.class?.name,
                        kruzhokTitle: e.class?.kruzhok?.title
                    })
                }
            }

            const clsMentor = e.class?.mentor
            if (clsMentor) {
                const entry = groupsFn(clsMentor.id)
                entry.fullName = clsMentor.fullName
                entry.email = clsMentor.email
                entry.phone = clsMentor.profile?.phone || null
                if (!entry.groups.some((g: any) => g.className === e.class?.name)) {
                    entry.groups.push({
                        className: e.class?.name,
                        kruzhokTitle: e.class?.kruzhok?.title
                    })
                }
            }
        }

        res.json({ mentors: Array.from(mentorMap.values()) })
    } catch (error) {
        console.error("[student/mentors] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})

// GET /api/student/groups - groups/classes for current student
router.get("/groups", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id

        const enrollments = await db.classEnrollment.findMany({
            where: { userId, status: "active" },
            include: {
                class: {
                    select: {
                        id: true,
                        name: true,
                        isActive: true,
                        wagePerLesson: true,
                        scheduleDescription: true,
                        kruzhok: { select: { id: true, title: true } },
                        mentor: { select: { id: true, fullName: true, email: true } },
                        _count: { select: { enrollments: true } },
                    }
                }
            }
        })

        const groups = (enrollments || [])
            .map((e: any) => e.class)
            .filter(Boolean)
            .map((cls: any) => ({
                id: cls.id,
                name: cls.name,
                isActive: cls.isActive,
                kruzhokId: cls.kruzhok?.id,
                kruzhokTitle: cls.kruzhok?.title,
                mentor: cls.mentor ? { id: cls.mentor.id, fullName: cls.mentor.fullName, email: cls.mentor.email } : null,
                scheduleDescription: cls.scheduleDescription || null,
                wagePerLesson: Number(cls.wagePerLesson || 0),
                studentsCount: cls._count?.enrollments || 0,
            }))

        res.json({ groups })
    } catch (error) {
        console.error("[student/groups] Error:", error)
        res.status(500).json({ error: "Internal server error" })
    }
})
