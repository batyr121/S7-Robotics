import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth, requireAdmin } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

export const router = Router()
const db = prisma as any

// All routes require Admin role
router.use(requireAuth)
router.use(requireAdmin)

// GET /api/admin/users
// Query: search, role, page, limit
router.get("/users", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, role, page = "1", limit = "20" } = req.query as any
    const skip = (Number(page) - 1) * Number(limit)
    const take = Number(limit)

    const where: any = {}

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ]
    }

    if (role) {
      where.role = role.toUpperCase()
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          createdAt: true,
          parentId: true,
          parent: {
            select: { id: true, fullName: true, email: true }
          },
          children: {
            select: { id: true, fullName: true, email: true }
          }
        }
      }),
      db.user.count({ where })
    ])

    res.json({ users, total, page: Number(page), totalPages: Math.ceil(total / take) })
  } catch (error) {
    console.error("Admin Users Error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// PUT /api/admin/users/:id
// Update role, parentId
router.put("/users/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const { role, parentId, fullName } = req.body

    const data: any = {}
    if (role) data.role = role
    if (fullName) data.fullName = fullName

    // Handle parentId update (can be null to remove)
    if (typeof parentId !== 'undefined') {
      data.parentId = parentId
    }

    const user = await db.user.update({
      where: { id },
      data,
      select: { id: true, role: true, parentId: true }
    })

    res.json({ success: true, user })
  } catch (error) {
    console.error("Admin Update User Error:", error)
    res.status(500).json({ error: "Failed to update user" })
  }
})

// GET /api/admin/groups
// List classes
router.get("/groups", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const groups = await db.clubClass.findMany({
      include: {
        kruzhok: { select: { title: true } },
        mentor: { select: { id: true, fullName: true } },
        _count: {
          select: { students: true }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    res.json({ groups })
  } catch (error) {
    console.error("Admin Groups Error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /api/admin/groups/:id/assign
// Add student
router.post("/groups/:id/assign", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const { studentId } = req.body

    if (!studentId) return res.status(400).json({ error: "Missing studentId" })

    await db.clubClass.update({
      where: { id },
      data: {
        students: {
          connect: { id: studentId }
        }
      }
    })

    res.json({ success: true })
  } catch (error) {
    console.error("Assign Student Error:", error)
    res.status(500).json({ error: "Failed to assign student" })
  }
})

// POST /api/admin/groups/:id/remove
// Remove student
router.post("/groups/:id/remove", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const { studentId } = req.body

    if (!studentId) return res.status(400).json({ error: "Missing studentId" })

    await db.clubClass.update({
      where: { id },
      data: {
        students: {
          disconnect: { id: studentId }
        }
      }
    })

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Failed to remove student" })
  }
})

// POST /api/admin/groups/:id/set-mentor
router.post("/groups/:id/set-mentor", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const { mentorId } = req.body

    await db.clubClass.update({
      where: { id },
      data: {
        mentorId: mentorId || null // allow null to remove mentor
      }
    })

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Failed to set mentor" })
  }
})
