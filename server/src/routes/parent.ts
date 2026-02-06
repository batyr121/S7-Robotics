import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"
import { generateVerificationCode } from "../utils/email"

export const router = Router()

const db = prisma as any

const toAmount = (value: any) => {
    if (typeof value === "number") return value
    if (typeof value === "string") return Number(value) || 0
    if (value && typeof value.toNumber === "function") return value.toNumber()
    if (value && typeof value.toString === "function") return Number(value.toString()) || 0
    return 0
}

const formatCurrency = (amount: number, currency = "KZT") => {
    const label = currency === "KZT" ? "тг" : currency
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount || 0)} ${label}`
}

const generateUniquePaymentCode = async () => {
    let code = generateVerificationCode()
    let tries = 0
    while (tries < 10) {
        const exists = await db.enrollmentRequest.findFirst({ where: { paymentCode: code } })
        if (!exists) return code
        code = generateVerificationCode()
        tries += 1
    }
    return `${Date.now()}`.slice(-6)
}

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
        res.status(500).json({ error: "Р’РЅСѓС‚СЂРµРЅРЅСЏСЏ РѕС€РёР±РєР° СЃРµСЂРІРµСЂР°" })
    }
})

// GET /api/parent/child-search?query= - Search students by name/email to link
router.get("/child-search", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const role = String(req.user!.role || "").toUpperCase()
        if (!["PARENT", "ADMIN"].includes(role)) {
            return res.status(403).json({ error: "РџРѕРёСЃРє РґРѕСЃС‚СѓРїРµРЅ С‚РѕР»СЊРєРѕ СЂРѕРґРёС‚РµР»СЏРј" })
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
        res.status(500).json({ error: "Р’РЅСѓС‚СЂРµРЅРЅСЏСЏ РѕС€РёР±РєР° СЃРµСЂРІРµСЂР°" })
    }
})

// GET /api/parent/subscriptions - Get subscription status for home widget
router.get("/subscriptions", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parentId = req.user!.id
        const now = new Date()
        const subscriptions = await db.parentSubscription.findMany({
            where: { parentId },
            include: {
                student: { select: { id: true, fullName: true } },
                plan: { select: { id: true, title: true } }
            },
            orderBy: { endDate: "asc" }
        })

        const result = (subscriptions || []).map((s: any) => ({
            id: s.id,
            childName: s.student?.fullName || "Ученик",
            planLabel: s.plan?.title || "Абонемент",
            amount: toAmount(s.amount),
            expiresAt: s.endDate ? new Date(s.endDate).toISOString() : null,
            isActive: s.status === "ACTIVE" && (!s.endDate || new Date(s.endDate) > now)
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
        res.status(500).json({ error: "Р’РЅСѓС‚СЂРµРЅРЅСЏСЏ РѕС€РёР±РєР° СЃРµСЂРІРµСЂР°" })
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
            return res.status(404).json({ error: "Р РµР±РµРЅРѕРє РЅРµ РЅР°Р№РґРµРЅ РёР»Рё РЅРµ РїСЂРёРІСЏР·Р°РЅ Рє РІР°Рј" })
        }

        res.json(child)
    } catch (error) {
        console.error("[parent/child] Error:", error)
        res.status(500).json({ error: "Р’РЅСѓС‚СЂРµРЅРЅСЏСЏ РѕС€РёР±РєР° СЃРµСЂРІРµСЂР°" })
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
            return res.status(404).json({ error: "Р РµР±РµРЅРѕРє РЅРµ РЅР°Р№РґРµРЅ РёР»Рё РЅРµ РїСЂРёРІСЏР·Р°РЅ Рє РІР°Рј" })
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
        res.status(500).json({ error: "Р’РЅСѓС‚СЂРµРЅРЅСЏСЏ РѕС€РёР±РєР° СЃРµСЂРІРµСЂР°" })
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
            return res.status(404).json({ error: "Р РµР±РµРЅРѕРє РЅРµ РЅР°Р№РґРµРЅ РёР»Рё РЅРµ РїСЂРёРІСЏР·Р°РЅ Рє РІР°Рј" })
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
        res.status(500).json({ error: "Р’РЅСѓС‚СЂРµРЅРЅСЏСЏ РѕС€РёР±РєР° СЃРµСЂРІРµСЂР°" })
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
        res.status(500).json({ error: "Р’РЅСѓС‚СЂРµРЅРЅСЏСЏ РѕС€РёР±РєР° СЃРµСЂРІРµСЂР°" })
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
            return res.status(403).json({ error: "РџСЂРёРІСЏР·РєР° РґРѕСЃС‚СѓРїРЅР° С‚РѕР»СЊРєРѕ СЂРѕРґРёС‚РµР»СЏРј" })
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
            return res.status(404).json({ error: "РЈС‡РµРЅРёРє РЅРµ РЅР°Р№РґРµРЅ" })
        }

        if (child.parentId) {
            return res.status(400).json({ error: "Р­С‚РѕС‚ СѓС‡РµРЅРёРє СѓР¶Рµ РїСЂРёРІСЏР·Р°РЅ Рє СЂРѕРґРёС‚РµР»СЋ" })
        }

        const childRole = String(child.role || "").toUpperCase()
        if (!["STUDENT", "USER"].includes(childRole)) {
            return res.status(400).json({ error: "РџСЂРёРІСЏР·РєР° РґРѕСЃС‚СѓРїРЅР° С‚РѕР»СЊРєРѕ РґР»СЏ СѓС‡РµРЅРёРєРѕРІ" })
        }

        if (child.linkCode !== code) {
            return res.status(400).json({ error: "РќРµРІРµСЂРЅС‹Р№ РєРѕРґ РїСЂРёРІСЏР·РєРё" })
        }

        if (child.linkCodeExpiresAt && child.linkCodeExpiresAt < now) {
            return res.status(400).json({ error: "РљРѕРґ РїСЂРёРІСЏР·РєРё РёСЃС‚РµРє. РџРѕРїСЂРѕСЃРёС‚Рµ СѓС‡РµРЅРёРєР° РѕР±РЅРѕРІРёС‚СЊ РµРіРѕ." })
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
                    title: "Р РµР±РµРЅРѕРє РїСЂРёРІСЏР·Р°РЅ",
                    message: `${updated.fullName} С‚РµРїРµСЂСЊ РїСЂРёРІСЏР·Р°РЅ Рє РІР°С€РµРјСѓ Р°РєРєР°СѓРЅС‚Сѓ.`,
                    type: "parent_link"
                },
                {
                    userId: updated.id,
                    title: "Р РѕРґРёС‚РµР»СЊ РїСЂРёРІСЏР·Р°РЅ",
                    message: "Р’Р°С€ СЂРѕРґРёС‚РµР»СЊСЃРєРёР№ Р°РєРєР°СѓРЅС‚ СѓСЃРїРµС€РЅРѕ РїСЂРёРІСЏР·Р°РЅ.",
                    type: "parent_link"
                }
            ]
        }).catch(() => null)

        res.json({ success: true, child: { id: updated.id, fullName: updated.fullName, email: updated.email } })
    } catch (error) {
        console.error("[parent/link-child] Error:", error)
        res.status(500).json({ error: "Р’РЅСѓС‚СЂРµРЅРЅСЏСЏ РѕС€РёР±РєР° СЃРµСЂРІРµСЂР°" })
    }
})


// --- Enrollment Requests & Plans ---
const requestSchema = z.object({
    planId: z.string().min(1),
    comment: z.string().optional(),
    preferredSchedule: z.string().optional(),
    students: z.array(z.object({
        studentId: z.string().min(1),
        desiredClassId: z.string().optional().nullable(),
        note: z.string().optional()
    })).min(1)
})

// GET /api/parent/class-plans - Available plans with classes
router.get("/class-plans", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const plans = await db.classPlan.findMany({
            where: { isActive: true },
            include: {
                classes: {
                    include: {
                        class: {
                            include: {
                                kruzhok: { select: { id: true, title: true } },
                                mentor: { select: { id: true, fullName: true, email: true } },
                                _count: { select: { enrollments: true } }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        })

        const classIds: string[] = []
        for (const plan of plans || []) {
            for (const pc of plan.classes || []) {
                if (pc.classId) classIds.push(pc.classId)
            }
        }

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const schedules = classIds.length
            ? await db.schedule.findMany({
                where: {
                    classId: { in: Array.from(new Set(classIds)) },
                    scheduledDate: { gte: today },
                    status: { in: ["SCHEDULED", "IN_PROGRESS"] }
                },
                select: { classId: true, scheduledDate: true, scheduledTime: true },
                orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }]
            })
            : []

        const scheduleMap = new Map<string, Array<{ date: string; time: string }>>()
        for (const s of schedules || []) {
            if (!s.classId) continue
            const existing = scheduleMap.get(s.classId) || []
            if (existing.length >= 3) continue
            existing.push({
                date: s.scheduledDate.toISOString(),
                time: s.scheduledTime || ""
            })
            scheduleMap.set(s.classId, existing)
        }

        const result = (plans || []).map((plan: any) => ({
            id: plan.id,
            title: plan.title,
            description: plan.description || "",
            ageMin: plan.ageMin ?? null,
            ageMax: plan.ageMax ?? null,
            priceMonthly: toAmount(plan.priceMonthly),
            currency: plan.currency || "KZT",
            classes: (plan.classes || []).map((pc: any) => {
                const cls = pc.class
                const seatsTaken = cls?._count?.enrollments || 0
                const maxStudents = cls?.maxStudents || 0
                const seatsAvailable = Math.max(0, maxStudents - seatsTaken)
                return {
                    id: cls?.id,
                    name: cls?.name || "",
                    description: cls?.description || "",
                    kruzhokTitle: cls?.kruzhok?.title || "",
                    scheduleDescription: cls?.scheduleDescription || null,
                    mentor: cls?.mentor || null,
                    maxStudents,
                    seatsTaken,
                    seatsAvailable,
                    isFull: seatsAvailable <= 0,
                    nextLessons: scheduleMap.get(cls?.id) || []
                }
            })
        }))

        res.json(result)
    } catch (error) {
        console.error("[parent/class-plans] Error:", error)
        res.status(500).json({ error: "Внутренняя ошибка сервера" })
    }
})

// GET /api/parent/enrollment-requests - Parent requests
router.get("/enrollment-requests", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parentId = req.user!.id
        const requests = await db.enrollmentRequest.findMany({
            where: { parentId },
            include: {
                plan: { select: { id: true, title: true } },
                students: {
                    include: {
                        student: { select: { id: true, fullName: true, email: true } },
                        desiredClass: { select: { id: true, name: true } },
                        assignedClass: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: { requestedAt: "desc" }
        })

        const result = (requests || []).map((r: any) => ({
            id: r.id,
            status: r.status,
            planTitle: r.plan?.title || "Абонемент",
            paymentCode: r.paymentCode,
            paymentAmount: toAmount(r.paymentAmount),
            currency: r.currency || "KZT",
            comment: r.comment || "",
            preferredSchedule: r.preferredSchedule || "",
            requestedAt: r.requestedAt?.toISOString(),
            reviewedAt: r.reviewedAt?.toISOString() || null,
            adminNotes: r.adminNotes || "",
            students: (r.students || []).map((s: any) => ({
                id: s.id,
                studentId: s.studentId,
                studentName: s.student?.fullName || "",
                studentEmail: s.student?.email || "",
                desiredClassName: s.desiredClass?.name || "",
                assignedClassName: s.assignedClass?.name || "",
                status: s.status
            }))
        }))

        res.json(result)
    } catch (error) {
        console.error("[parent/enrollment-requests] Error:", error)
        res.status(500).json({ error: "Внутренняя ошибка сервера" })
    }
})

// POST /api/parent/enrollment-requests - Create enrollment request
router.post("/enrollment-requests", async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parentId = req.user!.id
        const parsed = requestSchema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() })
        }

        const data = parsed.data
        const plan = await db.classPlan.findUnique({
            where: { id: data.planId },
            include: { classes: { select: { classId: true } } }
        })

        if (!plan || !plan.isActive) {
            return res.status(404).json({ error: "Абонемент не найден" })
        }

        const studentIds = data.students.map((s) => s.studentId)
        const children = await db.user.findMany({
            where: { id: { in: studentIds }, parentId },
            select: { id: true }
        })
        if (children.length !== studentIds.length) {
            return res.status(400).json({ error: "Некоторые ученики не привязаны к родителю" })
        }

        const allowedClassIds = new Set((plan.classes || []).map((c: any) => c.classId))
        const desiredClassIds = data.students
            .map((s) => s.desiredClassId)
            .filter((id): id is string => typeof id === "string" && id.length > 0)

        if (desiredClassIds.length > 0) {
            for (const id of desiredClassIds) {
                if (!allowedClassIds.has(id)) {
                    return res.status(400).json({ error: "Выбранный класс не входит в абонемент" })
                }
            }
        }

        const classRows = desiredClassIds.length
            ? await db.clubClass.findMany({
                where: { id: { in: Array.from(new Set(desiredClassIds)) } },
                select: { id: true, maxStudents: true, isActive: true, _count: { select: { enrollments: true } } }
            })
            : []

        const classMap = new Map<string, any>(classRows.map((c: any) => [c.id, c]))
        const fullClassIds = new Set<string>()
        for (const id of desiredClassIds) {
            const cls = classMap.get(id)
            if (!cls || cls.isActive === false) {
                return res.status(400).json({ error: "Класс недоступен" })
            }
            const seatsLeft = Math.max(0, (cls.maxStudents || 0) - (cls._count?.enrollments || 0))
            if (seatsLeft <= 0) {
                fullClassIds.add(id)
            }
        }

        const paymentAmount = toAmount(plan.priceMonthly) * data.students.length
        const paymentCode = await generateUniquePaymentCode()

        const created = await db.enrollmentRequest.create({
            data: {
                parentId,
                planId: plan.id,
                status: "PENDING",
                paymentCode,
                paymentAmount,
                currency: plan.currency || "KZT",
                comment: data.comment || undefined,
                preferredSchedule: data.preferredSchedule || undefined,
                students: {
                    create: data.students.map((s) => ({
                        studentId: s.studentId,
                        desiredClassId: s.desiredClassId || null,
                        note: s.note || null
                    }))
                }
            }
        })

        const waitlistRows = data.students
            .filter((student) => {
                if (student.desiredClassId && fullClassIds.has(student.desiredClassId)) return true
                if (!student.desiredClassId && (data.preferredSchedule || student.note)) return true
                return false
            })
            .map((student) => ({
                parentId,
                studentId: student.studentId,
                planId: plan.id,
                classId: student.desiredClassId && fullClassIds.has(student.desiredClassId) ? student.desiredClassId : null,
                preferredSchedule: data.preferredSchedule || null,
                note: student.note || data.comment || null,
                status: "WAITING"
            }))

        if (waitlistRows.length > 0) {
            await db.waitlistEntry.createMany({
                data: waitlistRows
            }).catch(() => null)
        }

        const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
        if (admins.length > 0) {
            const waitlistInfo = waitlistRows.length > 0 ? ` Лист ожидания: ${waitlistRows.length}.` : ""
            const adminMessage = `Поступила заявка на "${plan.title}". Код оплаты: ${paymentCode}. Сумма: ${formatCurrency(paymentAmount, plan.currency || "KZT")}.${waitlistInfo}`
            await db.notification.createMany({
                data: admins.map((a: any) => ({
                    userId: a.id,
                    title: "Новая заявка на абонемент",
                    message: adminMessage,
                    type: "ENROLLMENT_REQUEST",
                    metadata: { enrollmentRequestId: created.id }
                }))
            })
        }

        await db.notification.create({
            data: {
                userId: parentId,
                title: "Заявка отправлена",
                message: `Мы получили заявку на "${plan.title}". Переведите ${formatCurrency(paymentAmount, plan.currency || "KZT")} на Kaspi +7 776 045 7776 и укажите код ${paymentCode} в комментарии. Проверим оплату и ответим в течение 1-2 часов.${waitlistRows.length > 0 ? " Часть учеников добавлена в лист ожидания, мы свяжемся по времени." : ""}`,
                type: "ENROLLMENT_REQUEST",
                metadata: { enrollmentRequestId: created.id }
            }
        }).catch(() => null)

        res.status(201).json({
            id: created.id,
            status: created.status,
            paymentCode,
            amount: paymentAmount,
            currency: plan.currency || "KZT"
        })
    } catch (error) {
        console.error("[parent/enrollment-requests] Error:", error)
        res.status(500).json({ error: "Внутренняя ошибка сервера" })
    }
})
