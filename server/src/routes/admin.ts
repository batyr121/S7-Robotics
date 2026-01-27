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

// GET /api/admin/analytics
router.get("/analytics", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date()
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

    const registrationsByDay = await Promise.all(
      Array.from({ length: 7 }).map((_, index) => {
        const day = new Date(now)
        day.setDate(now.getDate() - (6 - index))
        const start = startOfDay(day)
        const end = new Date(start)
        end.setDate(start.getDate() + 1)
        return db.user.count({ where: { createdAt: { gte: start, lt: end } } })
          .then((count: number) => ({ date: start.toISOString().slice(0, 10), count }))
      })
    )

    const [
      usersCount,
      studentsCount,
      parentsCount,
      mentorsCount,
      newsCount,
      publishedNewsCount,
      bytesizeCount,
      eventsCount,
      eventsPendingCount,
      eventsPublishedCount,
      shopItemsCount,
      groupsCount,
      schedulesCount,
      coinsAgg,
      attendanceAgg,
      gradeAgg,
      ratingAgg,
      mentors,
      reviewGroup,
      lessonGroup
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { role: "STUDENT" } }),
      db.user.count({ where: { role: "PARENT" } }),
      db.user.count({ where: { role: "MENTOR" } }),
      db.news.count(),
      db.news.count({ where: { published: true } }),
      db.byteSizeItem.count().catch(() => 0),
      db.event.count(),
      db.event.count({ where: { status: "pending" } }),
      db.event.count({ where: { status: "published" } }),
      db.shopItem.count(),
      db.clubClass.count(),
      db.schedule.count(),
      db.user.aggregate({ _sum: { coinBalance: true } }),
      db.attendance.groupBy({ by: ["status"], _count: { _all: true } }).catch(() => []),
      db.attendance.aggregate({ _avg: { grade: true } }).catch(() => ({ _avg: { grade: null } })),
      db.mentorReview.aggregate({ _avg: { rating: true }, _count: { rating: true } }).catch(() => ({ _avg: { rating: null }, _count: { rating: 0 } })),
      db.user.findMany({ where: { role: "MENTOR" }, select: { id: true, fullName: true, email: true } }),
      db.mentorReview.groupBy({ by: ["mentorId"], _avg: { rating: true }, _count: { rating: true } }).catch(() => []),
      db.schedule.groupBy({ by: ["createdById"], where: { status: "COMPLETED" }, _count: { _all: true } }).catch(() => [])
    ])

    const attendanceMap = new Map((attendanceAgg || []).map((row: any) => [row.status, row._count?._all || 0]))
    const presentCount = Number(attendanceMap.get("PRESENT") || 0)
    const lateCount = Number(attendanceMap.get("LATE") || 0)
    const absentCount = Number(attendanceMap.get("ABSENT") || 0)
    const totalAttendance = presentCount + lateCount + absentCount

    const reviewMap = new Map<string, { avg: number; count: number }>((reviewGroup || []).map((row: any) => [
      row.mentorId,
      { avg: Number(row._avg?.rating || 0), count: Number(row._count?.rating || 0) }
    ]))
    const lessonMap = new Map((lessonGroup || []).map((row: any) => [row.createdById, Number(row._count?._all || 0)]))

    const mentorRatings = (mentors || []).map((mentor: any) => {
      const review = reviewMap.get(mentor.id) || { avg: 0, count: 0 }
      return {
        id: mentor.id,
        fullName: mentor.fullName,
        email: mentor.email,
        ratingAvg: review.avg,
        ratingCount: review.count,
        lessonsCompleted: lessonMap.get(mentor.id) || 0
      }
    }).sort((a: any, b: any) => {
      if (b.ratingAvg !== a.ratingAvg) return b.ratingAvg - a.ratingAvg
      if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount
      return b.lessonsCompleted - a.lessonsCompleted
    })

    res.json({
      usersCount,
      studentsCount,
      parentsCount,
      mentorsCount,
      groupsCount,
      schedulesCount,
      totalCoins: Number(coinsAgg?._sum?.coinBalance || 0),
      registrationsByDay,
      attendance: {
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        total: totalAttendance
      },
      performance: {
        averageGrade: Number(gradeAgg?._avg?.grade || 0),
        averageRating: Number(ratingAgg?._avg?.rating || 0),
        ratingCount: Number(ratingAgg?._count?.rating || 0)
      },
      content: {
        newsTotal: newsCount,
        newsPublished: publishedNewsCount,
        newsDrafts: Math.max(newsCount - publishedNewsCount, 0),
        bytesizeTotal: bytesizeCount,
        shopItemsTotal: shopItemsCount,
        eventsTotal: eventsCount,
        eventsPending: eventsPendingCount,
        eventsPublished: eventsPublishedCount
      },
      mentorRatings
    })
  } catch (error) {
    console.error("Admin Analytics Error:", error)
    res.status(500).json({ error: "Failed to load analytics" })
  }
})

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

const adminGroupSchema = z.object({
  kruzhokId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  maxStudents: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  mentorId: z.string().optional(), // New field
  wagePerLesson: z.number().int().optional(),
  scheduleDescription: z.string().optional()
})

const adminGroupUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  maxStudents: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  mentorId: z.string().optional(), // New field
  wagePerLesson: z.number().int().optional(),
  scheduleDescription: z.string().optional()
})

// ============ KRUZHOK (CLUBS) CRUD ============

const kruzhokSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  programId: z.string().optional(),
  isActive: z.boolean().optional(),
  isFree: z.boolean().optional(),
  price: z.number().optional()
})

// GET /api/admin/kruzhoks - List all kruzhoks
router.get("/kruzhoks", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const kruzhoks = await db.kruzhok.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        programId: true,
        program: { select: { id: true, title: true } },
        isActive: true,
        isFree: true,
        price: true,
        ownerId: true,
        owner: { select: { id: true, fullName: true, email: true } },
        _count: { select: { classes: true, subscriptions: true } },
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    })
    res.json(kruzhoks)
  } catch (error) {
    console.error("Admin Kruzhoks Error:", error)
    res.status(500).json({ error: "Failed to load kruzhoks" })
  }
})

// GET /api/admin/kruzhoks/:id - Get single kruzhok
router.get("/kruzhoks/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const kruzhok = await db.kruzhok.findUnique({
      where: { id },
      include: {
        program: { select: { id: true, title: true } },
        owner: { select: { id: true, fullName: true, email: true } },
        classes: {
          select: { id: true, name: true, isActive: true, _count: { select: { enrollments: true } } }
        }
      }
    })
    if (!kruzhok) return res.status(404).json({ error: "Kruzhok not found" })
    res.json(kruzhok)
  } catch (error) {
    console.error("Admin Kruzhok Detail Error:", error)
    res.status(500).json({ error: "Failed to load kruzhok" })
  }
})

// POST /api/admin/kruzhoks - Create kruzhok
router.post("/kruzhoks", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = kruzhokSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const data = parsed.data
    const created = await db.kruzhok.create({
      data: {
        title: data.title,
        description: data.description,
        programId: data.programId || null,
        isActive: data.isActive ?? true,
        isFree: data.isFree ?? false,
        price: data.price ?? 0,
        ownerId: req.user!.id // Admin becomes owner by default
      },
      include: {
        program: { select: { id: true, title: true } },
        owner: { select: { id: true, fullName: true } }
      }
    })
    res.status(201).json(created)
  } catch (error) {
    console.error("Admin Kruzhok Create Error:", error)
    res.status(500).json({ error: "Failed to create kruzhok" })
  }
})

// PUT /api/admin/kruzhoks/:id - Update kruzhok
router.put("/kruzhoks/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const parsed = kruzhokSchema.partial().safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const data = parsed.data
    const updated = await db.kruzhok.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        programId: data.programId,
        isActive: data.isActive,
        isFree: data.isFree,
        price: data.price
      },
      include: {
        program: { select: { id: true, title: true } },
        owner: { select: { id: true, fullName: true } }
      }
    })
    res.json(updated)
  } catch (error) {
    console.error("Admin Kruzhok Update Error:", error)
    res.status(500).json({ error: "Failed to update kruzhok" })
  }
})

// DELETE /api/admin/kruzhoks/:id - Delete kruzhok
router.delete("/kruzhoks/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    await db.kruzhok.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    console.error("Admin Kruzhok Delete Error:", error)
    res.status(500).json({ error: "Failed to delete kruzhok. It may have related classes or schedules." })
  }
})

// ============ PROGRAMS CRUD ============

const programSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional()
})

// GET /api/admin/programs - List all programs
router.get("/programs", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const programs = await db.kruzhokProgram.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        isActive: true,
        _count: { select: { kruzhoks: true, lessons: true } },
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    })
    res.json(programs)
  } catch (error) {
    console.error("Admin Programs Error:", error)
    res.status(500).json({ error: "Failed to load programs" })
  }
})

// GET /api/admin/programs/:id - Get single program with lesson templates
router.get("/programs/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const program = await db.kruzhokProgram.findUnique({
      where: { id },
      include: {
        lessons: {
          orderBy: { orderIndex: "asc" },
          select: { id: true, title: true, orderIndex: true, content: true }
        },
        kruzhoks: {
          select: { id: true, title: true, isActive: true }
        }
      }
    })
    if (!program) return res.status(404).json({ error: "Program not found" })
    res.json(program)
  } catch (error) {
    console.error("Admin Program Detail Error:", error)
    res.status(500).json({ error: "Failed to load program" })
  }
})

// POST /api/admin/programs - Create program
router.post("/programs", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = programSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const data = parsed.data
    const created = await db.kruzhokProgram.create({
      data: {
        title: data.title,
        description: data.description,
        isActive: data.isActive ?? true
      }
    })
    res.status(201).json(created)
  } catch (error) {
    console.error("Admin Program Create Error:", error)
    res.status(500).json({ error: "Failed to create program" })
  }
})

// PUT /api/admin/programs/:id - Update program
router.put("/programs/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const parsed = programSchema.partial().safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const data = parsed.data
    const updated = await db.kruzhokProgram.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        isActive: data.isActive
      }
    })
    res.json(updated)
  } catch (error) {
    console.error("Admin Program Update Error:", error)
    res.status(500).json({ error: "Failed to update program" })
  }
})

// DELETE /api/admin/programs/:id - Delete program
router.delete("/programs/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    await db.kruzhokProgram.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    console.error("Admin Program Delete Error:", error)
    res.status(500).json({ error: "Failed to delete program. It may be used by kruzhoks." })
  }
})

// GET /api/admin/groups
// List classes
router.get("/groups", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const groups = await db.clubClass.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        maxStudents: true,
        isActive: true,
        kruzhokId: true,
        kruzhok: { select: { id: true, title: true } },
        mentorId: true,
        mentor: { select: { id: true, fullName: true, email: true } },
        wagePerLesson: true,
        scheduleDescription: true,
        _count: { select: { enrollments: true } }
      },
      orderBy: { createdAt: "desc" }
    })

    res.json({ groups })
  } catch (error) {
    console.error("Admin Groups Error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /api/admin/groups/:id
// Group details with students
router.get("/groups/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const group = await db.clubClass.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        maxStudents: true,
        isActive: true,
        kruzhokId: true,
        kruzhok: { select: { id: true, title: true } },
        mentorId: true,
        wagePerLesson: true,
        scheduleDescription: true,
        mentor: { select: { id: true, fullName: true, email: true } },
        enrollments: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            user: { select: { id: true, fullName: true, email: true } }
          }
        }
      }
    })

    if (!group) return res.status(404).json({ error: "Group not found" })
    res.json(group)
  } catch (error) {
    console.error("Admin Group Detail Error:", error)
    res.status(500).json({ error: "Failed to load group detail" })
  }
})

// POST /api/admin/groups
// Create group
router.post("/groups", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = adminGroupSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const data = parsed.data
    const last = await db.clubClass.findFirst({
      where: { kruzhokId: data.kruzhokId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true }
    })
    const orderIndex = (last?.orderIndex ?? -1) + 1
    const created = await db.clubClass.create({
      data: {
        kruzhokId: data.kruzhokId,
        name: data.name,
        description: data.description,
        maxStudents: data.maxStudents ?? 30,
        isActive: data.isActive ?? true,
        orderIndex,
        createdById: req.user!.id,
        mentorId: data.mentorId,
        wagePerLesson: data.wagePerLesson ?? 0,
        scheduleDescription: data.scheduleDescription
      },
      select: {
        id: true,
        name: true,
        description: true,
        maxStudents: true,
        isActive: true,
        kruzhokId: true,
        kruzhok: { select: { id: true, title: true } },
        mentorId: true,
        mentor: { select: { id: true, fullName: true } },
        wagePerLesson: true,
        scheduleDescription: true,
        _count: { select: { enrollments: true } }
      }
    })
    res.status(201).json(created)
  } catch (error) {
    console.error("Admin Group Create Error:", error)
    res.status(500).json({ error: "Failed to create group" })
  }
})

// PUT /api/admin/groups/:id
// Update group
router.put("/groups/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const parsed = adminGroupUpdateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const data = parsed.data
    if (!Object.keys(data).length) return res.status(400).json({ error: "No updates provided" })

    const existing = await db.clubClass.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        scheduleDescription: true,
        enrollments: {
          select: {
            userId: true,
            user: { select: { id: true, fullName: true, parentId: true } }
          }
        }
      }
    })

    const updated = await db.clubClass.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        maxStudents: data.maxStudents,
        isActive: data.isActive,
        mentorId: data.mentorId,
        wagePerLesson: data.wagePerLesson,
        scheduleDescription: data.scheduleDescription
      },
      select: {
        id: true,
        name: true,
        description: true,
        maxStudents: true,
        isActive: true,
        kruzhokId: true,
        kruzhok: { select: { id: true, title: true } },
        mentorId: true,
        mentor: { select: { id: true, fullName: true } },
        wagePerLesson: true,
        scheduleDescription: true,
        _count: { select: { enrollments: true } }
      }
    })

    try {
      const scheduleWasProvided = Object.prototype.hasOwnProperty.call(data, "scheduleDescription")
      const prevSchedule = existing?.scheduleDescription || ""
      const nextSchedule = scheduleWasProvided ? (data.scheduleDescription || "") : prevSchedule
      const scheduleChanged = scheduleWasProvided && prevSchedule !== nextSchedule
      if (scheduleChanged && existing?.enrollments?.length) {
        const nextLabel = nextSchedule || "уточняется"
        const notifications: Array<{ userId: string; title: string; message: string; type: string }> = []
        existing.enrollments.forEach((enr: any) => {
          if (enr.userId) {
            notifications.push({
              userId: enr.userId,
              title: "Изменилось расписание",
              message: `Группа "${existing.name}" теперь: ${nextLabel}.`,
              type: "schedule"
            })
          }
          const parentId = enr.user?.parentId
          if (parentId) {
            const studentName = enr.user?.fullName || "Ваш ребёнок"
            notifications.push({
              userId: parentId,
              title: "Изменилось расписание ребёнка",
              message: `${studentName}: группа "${existing.name}" теперь ${nextLabel}.`,
              type: "schedule"
            })
          }
        })
        if (notifications.length) {
          await db.notification.createMany({ data: notifications })
        }
      }
    } catch (notifyError) {
      console.error("Admin Group Schedule Notify Error:", notifyError)
    }

    res.json(updated)
  } catch (error) {
    console.error("Admin Group Update Error:", error)
    res.status(500).json({ error: "Failed to update group" })
  }
})

// DELETE /api/admin/groups/:id
router.delete("/groups/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    await db.clubClass.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    console.error("Admin Group Delete Error:", error)
    res.status(500).json({ error: "Failed to delete group" })
  }
})

// POST /api/admin/groups/:id/assign
// Add student
router.post("/groups/:id/assign", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const { studentId } = req.body

    if (!studentId) return res.status(400).json({ error: "Missing studentId" })

    const student = await db.user.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, parentId: true }
    })
    if (!student) return res.status(404).json({ error: "Student not found" })

    const group = await db.clubClass.findUnique({
      where: { id },
      select: { id: true, name: true }
    })

    await db.classEnrollment.upsert({
      where: { classId_userId: { classId: id, userId: studentId } },
      create: { classId: id, userId: studentId, status: "active" },
      update: { status: "active" }
    })

    try {
      if (group) {
        const notifications: Array<{ userId: string; title: string; message: string; type: string }> = [
          {
            userId: student.id,
            title: "Вы добавлены в группу",
            message: `Вы добавлены в группу "${group.name}".`,
            type: "group"
          }
        ]
        if (student.parentId) {
          notifications.push({
            userId: student.parentId,
            title: "Ребёнок добавлен в группу",
            message: `${student.fullName || "Ваш ребёнок"} добавлен(а) в группу "${group.name}".`,
            type: "group"
          })
        }
        await db.notification.createMany({ data: notifications })
      }
    } catch (notifyError) {
      console.error("Assign Student Notify Error:", notifyError)
    }

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

    const student = await db.user.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, parentId: true }
    })
    const group = await db.clubClass.findUnique({
      where: { id },
      select: { id: true, name: true }
    })

    await db.classEnrollment.deleteMany({
      where: { classId: id, userId: studentId }
    })

    try {
      if (student && group) {
        const notifications: Array<{ userId: string; title: string; message: string; type: string }> = [
          {
            userId: student.id,
            title: "Вы исключены из группы",
            message: `Вы больше не состоите в группе "${group.name}".`,
            type: "group"
          }
        ]
        if (student.parentId) {
          notifications.push({
            userId: student.parentId,
            title: "Ребёнок исключён из группы",
            message: `${student.fullName || "Ваш ребёнок"} больше не в группе "${group.name}".`,
            type: "group"
          })
        }
        await db.notification.createMany({ data: notifications })
      }
    } catch (notifyError) {
      console.error("Remove Student Notify Error:", notifyError)
    }

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

    const group = await db.clubClass.update({
      where: { id },
      data: { mentorId: mentorId || null },
      select: { id: true, mentorId: true, mentor: { select: { id: true, fullName: true } } }
    })

    res.json(group)
  } catch (error) {
    console.error("Admin Group Set Mentor Error:", error)
    res.status(500).json({ error: "Failed to set mentor" })
  }
})

// POST /api/admin/groups/:id/migrate-student
router.post("/groups/:id/migrate-student", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const payload = z.object({
      studentId: z.string().min(1),
      targetClassId: z.string().min(1)
    }).safeParse(req.body)
    if (!payload.success) return res.status(400).json({ error: payload.error.flatten() })
    const { studentId, targetClassId } = payload.data
    if (targetClassId === id) return res.status(400).json({ error: "Target class must be different." })

    const student = await db.user.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, parentId: true }
    })
    if (!student) return res.status(404).json({ error: "Student not found" })

    const sourceGroup = await db.clubClass.findUnique({
      where: { id },
      select: { id: true, name: true }
    })
    if (!sourceGroup) return res.status(404).json({ error: "Source group not found" })

    const targetGroup = await db.clubClass.findUnique({
      where: { id: targetClassId },
      select: { id: true, name: true, kruzhok: { select: { title: true } } }
    })
    if (!targetGroup) return res.status(404).json({ error: "Target group not found" })

    const existing = await db.classEnrollment.findUnique({
      where: { classId_userId: { classId: id, userId: studentId } }
    })
    if (!existing) return res.status(404).json({ error: "Student is not enrolled in the source group" })

    await db.$transaction([
      db.classEnrollment.delete({ where: { classId_userId: { classId: id, userId: studentId } } }),
      db.classEnrollment.upsert({
        where: { classId_userId: { classId: targetClassId, userId: studentId } },
        create: { classId: targetClassId, userId: studentId, status: "active" },
        update: { status: "active" }
      })
    ])

    if (student.parentId) {
      await db.notification.create({
        data: {
          userId: student.parentId,
          title: "Student moved to a new group",
          message: `${student.fullName} moved from "${sourceGroup.name}" to "${targetGroup.name}" (${targetGroup.kruzhok?.title || "Club"}).`,
          type: "migration"
        }
      })
    }

    res.json({ success: true })
  } catch (error) {
    console.error("Admin Migrate Student Error:", error)
    res.status(500).json({ error: "Failed to migrate student" })
  }
})

// GET /api/admin/analytics/groups - Group attendance/performance drilldown
router.get("/analytics/groups", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date()
    const fromRaw = String(req.query.from || "")
    const toRaw = String(req.query.to || "")
    const from = fromRaw ? new Date(fromRaw) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const to = toRaw ? new Date(toRaw) : now

    const schedules = await db.schedule.findMany({
      where: {
        classId: { not: null },
        scheduledDate: { gte: from, lte: to }
      },
      select: {
        id: true,
        classId: true,
        status: true,
        scheduledDate: true,
        scheduledTime: true,
        completedAt: true,
        class: {
          select: {
            id: true,
            name: true,
            isActive: true,
            kruzhok: { select: { title: true } }
          }
        },
        attendances: { select: { status: true, grade: true } }
      }
    })

    const groupMap = new Map<string, any>()
    for (const s of schedules || []) {
      if (!s.classId || !s.class) continue
      const key = s.classId
      const entry = groupMap.get(key) || {
        id: s.class.id,
        name: s.class.name,
        kruzhokTitle: s.class.kruzhok?.title || "",
        isActive: s.class.isActive !== false,
        lessonsTotal: 0,
        lessonsCompleted: 0,
        attendanceTotal: 0,
        present: 0,
        late: 0,
        absent: 0,
        gradeSum: 0,
        gradeCount: 0,
        lastLessonDate: null as Date | null
      }

      entry.lessonsTotal += 1
      if (s.status === "COMPLETED") entry.lessonsCompleted += 1
      const lessonDate = s.completedAt || s.scheduledDate
      if (!entry.lastLessonDate || (lessonDate && lessonDate > entry.lastLessonDate)) {
        entry.lastLessonDate = lessonDate || entry.lastLessonDate
      }

      for (const a of s.attendances || []) {
        entry.attendanceTotal += 1
        if (a.status === "PRESENT") entry.present += 1
        if (a.status === "LATE") entry.late += 1
        if (a.status === "ABSENT") entry.absent += 1
        if (typeof a.grade === "number") {
          entry.gradeSum += a.grade
          entry.gradeCount += 1
        }
      }

      groupMap.set(key, entry)
    }

    const groups = Array.from(groupMap.values()).map((g: any) => ({
      id: g.id,
      name: g.name,
      kruzhokTitle: g.kruzhokTitle,
      isActive: g.isActive,
      lessonsTotal: g.lessonsTotal,
      lessonsCompleted: g.lessonsCompleted,
      attendanceTotal: g.attendanceTotal,
      present: g.present,
      late: g.late,
      absent: g.absent,
      averageGrade: g.gradeCount ? Number((g.gradeSum / g.gradeCount).toFixed(2)) : 0,
      lastLessonDate: g.lastLessonDate
    }))

    const scheduleEvents = (schedules || [])
      .filter((s: any) => s.classId && s.class)
      .map((s: any) => ({
        id: s.id,
        classId: s.classId,
        className: s.class?.name || "",
        kruzhokTitle: s.class?.kruzhok?.title || "",
        scheduledDate: s.scheduledDate,
        scheduledTime: s.scheduledTime || "00:00",
        status: s.status
      }))

    res.json({ from, to, groups, schedules: scheduleEvents })
  } catch (error) {
    console.error("Admin Groups Analytics Error:", error)
    res.status(500).json({ error: "Failed to load group analytics" })
  }
})

// GET /api/admin/analytics/groups/:id - Group details with lesson attendance
router.get("/analytics/groups/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const now = new Date()
    const fromRaw = String(req.query.from || "")
    const toRaw = String(req.query.to || "")
    const from = fromRaw ? new Date(fromRaw) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const to = toRaw ? new Date(toRaw) : now

    const cls = await db.clubClass.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true, kruzhok: { select: { title: true } } }
    })
    if (!cls) return res.status(404).json({ error: "Group not found" })

    const schedules = await db.schedule.findMany({
      where: { classId: id, scheduledDate: { gte: from, lte: to } },
      orderBy: { scheduledDate: "desc" },
      select: {
        id: true,
        title: true,
        scheduledDate: true,
        scheduledTime: true,
        status: true,
        attendances: { select: { status: true, grade: true } }
      }
    })

    let present = 0
    let late = 0
    let absent = 0
    let gradeSum = 0
    let gradeCount = 0

    const lessons = (schedules || []).map((s: any) => {
      let lessonPresent = 0
      let lessonLate = 0
      let lessonAbsent = 0
      let lessonGradeSum = 0
      let lessonGradeCount = 0
      for (const a of s.attendances || []) {
        if (a.status === "PRESENT") lessonPresent += 1
        if (a.status === "LATE") lessonLate += 1
        if (a.status === "ABSENT") lessonAbsent += 1
        if (typeof a.grade === "number") {
          lessonGradeSum += a.grade
          lessonGradeCount += 1
        }
      }
      present += lessonPresent
      late += lessonLate
      absent += lessonAbsent
      gradeSum += lessonGradeSum
      gradeCount += lessonGradeCount
      const total = lessonPresent + lessonLate + lessonAbsent
      return {
        id: s.id,
        title: s.title,
        scheduledDate: s.scheduledDate,
        scheduledTime: s.scheduledTime,
        status: s.status,
        attendance: {
          present: lessonPresent,
          late: lessonLate,
          absent: lessonAbsent,
          total,
          averageGrade: lessonGradeCount ? Number((lessonGradeSum / lessonGradeCount).toFixed(2)) : 0
        }
      }
    })

    res.json({
      group: {
        id: cls.id,
        name: cls.name,
        kruzhokTitle: cls.kruzhok?.title || "",
        isActive: cls.isActive !== false
      },
      summary: {
        lessonsTotal: schedules.length,
        lessonsCompleted: schedules.filter((s: any) => s.status === "COMPLETED").length,
        attendanceTotal: present + late + absent,
        present,
        late,
        absent,
        averageGrade: gradeCount ? Number((gradeSum / gradeCount).toFixed(2)) : 0
      },
      lessons
    })
  } catch (error) {
    console.error("Admin Group Detail Error:", error)
    res.status(500).json({ error: "Failed to load group detail" })
  }
})

// GET /api/admin/users/:id/overview - Admin user overview
router.get("/users/:id/overview", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      }
    })
    if (!user) return res.status(404).json({ error: "User not found" })

    const registrations = await db.eventRegistration.findMany({
      where: { userId: id },
      include: { event: { select: { id: true, title: true, date: true } } },
      orderBy: { createdAt: "desc" }
    })

    let mentorStats: any = null
    if (user.role === "MENTOR") {
      const [reviewAgg, reviews, lessonsCompleted] = await Promise.all([
        db.mentorReview.aggregate({ where: { mentorId: id }, _avg: { rating: true }, _count: { rating: true } }),
        db.mentorReview.findMany({
          where: { mentorId: id },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            student: { select: { id: true, fullName: true } },
            schedule: { select: { id: true, title: true, scheduledDate: true } }
          }
        }),
        db.schedule.count({ where: { createdById: id, status: "COMPLETED" } })
      ])
      mentorStats = {
        ratingAvg: Number(reviewAgg?._avg?.rating || 0),
        ratingCount: Number(reviewAgg?._count?.rating || 0),
        lessonsCompleted,
        recentReviews: reviews
      }
    }

    res.json({
      user,
      registrations,
      mentorStats
    })
  } catch (error) {
    console.error("Admin User Overview Error:", error)
    res.status(500).json({ error: "Failed to load overview" })
  }
})

// ============ ADMIN BYTESIZE ============ 
const bytesizeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  videoUrl: z.string().min(1),
  coverImageUrl: z.string().optional(),
  tags: z.array(z.string()).optional()
})

router.get("/bytesize", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const items = await db.byteSizeItem.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { likes: true } } }
    })
    res.json(items)
  } catch (error) {
    console.error("Admin ByteSize Error:", error)
    res.status(500).json({ error: "Failed to load bytesize items" })
  }
})

router.post("/bytesize", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = bytesizeSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const created = await db.byteSizeItem.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        videoUrl: parsed.data.videoUrl,
        coverImageUrl: parsed.data.coverImageUrl,
        tags: parsed.data.tags || []
      }
    })
    res.status(201).json(created)
  } catch (error) {
    console.error("Admin ByteSize Create Error:", error)
    res.status(500).json({ error: "Failed to create bytesize item" })
  }
})

router.delete("/bytesize/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    await db.byteSizeItem.delete({ where: { id } })
    res.json({ ok: true })
  } catch (error) {
    console.error("Admin ByteSize Delete Error:", error)
    res.status(500).json({ error: "Failed to delete bytesize item" })
  }
})

// ============ ADMIN EVENTS ============ 
const adminEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  audience: z.string().optional(),
  contact: z.string().optional(),
  date: z.string().optional(),
  imageUrl: z.string().optional(),
  format: z.enum(["online", "offline", "hybrid"]).optional(),
  isFree: z.boolean().optional(),
  price: z.number().optional(),
  location: z.string().optional(),
  url: z.string().optional(),
  status: z.enum(["pending", "published", "rejected"]).optional()
})

router.get("/events", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const events = await db.event.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { registrations: true } } }
    })
    res.json(events)
  } catch (error) {
    console.error("Admin Events Error:", error)
    res.status(500).json({ error: "Failed to load events" })
  }
})

router.post("/events", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = adminEventSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const data = parsed.data
    const created = await db.event.create({
      data: {
        title: data.title,
        description: data.description,
        audience: data.audience,
        contact: data.contact,
        date: data.date ? new Date(data.date) : undefined,
        imageUrl: data.imageUrl,
        format: data.format || "offline",
        isFree: data.isFree ?? true,
        price: data.isFree ? 0 : Number(data.price || 0),
        location: data.location,
        url: data.url,
        status: data.status || "published",
        createdById: req.user!.id
      }
    })
    res.status(201).json(created)
  } catch (error) {
    console.error("Admin Events Create Error:", error)
    res.status(500).json({ error: "Failed to create event" })
  }
})

router.delete("/events", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    await db.event.deleteMany({})
    res.json({ ok: true })
  } catch (error) {
    console.error("Admin Events Bulk Delete Error:", error)
    res.status(500).json({ error: "Failed to delete events" })
  }
})

router.delete("/events/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    await db.event.delete({ where: { id } })
    res.json({ ok: true })
  } catch (error) {
    console.error("Admin Events Delete Error:", error)
    res.status(500).json({ error: "Failed to delete event" })
  }
})

router.get("/events/:id/registrations", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const regs = await db.eventRegistration.findMany({
      where: { eventId: id },
      include: { user: { select: { id: true, email: true, fullName: true } } },
      orderBy: { createdAt: "desc" }
    })
    res.json(regs)
  } catch (error) {
    console.error("Admin Events Registrations Error:", error)
    res.status(500).json({ error: "Failed to load registrations" })
  }
})

router.post("/events/:eventId/registrations/:regId/approve", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { eventId, regId } = req.params
    const existing = await db.eventRegistration.findUnique({ where: { id: regId } })
    if (!existing || existing.eventId !== eventId) {
      return res.status(404).json({ error: "Registration not found" })
    }
    const updated = await db.eventRegistration.update({
      where: { id: regId },
      data: { status: "approved" }
    })
    res.json(updated)
  } catch (error) {
    console.error("Admin Event Registration Approve Error:", error)
    res.status(500).json({ error: "Failed to approve registration" })
  }
})

router.post("/events/:eventId/registrations/:regId/reject", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { eventId, regId } = req.params
    const existing = await db.eventRegistration.findUnique({ where: { id: regId } })
    if (!existing || existing.eventId !== eventId) {
      return res.status(404).json({ error: "Registration not found" })
    }
    const updated = await db.eventRegistration.update({
      where: { id: regId },
      data: { status: "rejected" }
    })
    res.json(updated)
  } catch (error) {
    console.error("Admin Event Registration Reject Error:", error)
    res.status(500).json({ error: "Failed to reject registration" })
  }
})
