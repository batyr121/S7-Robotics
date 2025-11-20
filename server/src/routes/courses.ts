function toApiMedia(u?: string | null): string | undefined {
  try {
    if (!u) return undefined
    const s = String(u)
    if (s.startsWith("http")) return s
    if (s.startsWith('/api/media/')) return s
    if (s.startsWith('/media/')) return s.replace('/media/', '/api/media/')
    // If it's just a filename or relative path, assume it's in media
    if (!s.startsWith('/')) return `/api/media/${s}`
    return s
  } catch { return u as any }
}

import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { optionalAuth, requireAuth } from "../middleware/auth"
import { requireAdmin } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"
import { generateCertificate, saveCertificate } from '../utils/certificate'
import { sendCertificateEmail } from '../utils/email'

export const router = Router()

// Get lesson details for regular users

// Get questions for a specific lesson
router.get("/:courseId/lessons/:lessonId/questions", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { courseId, lessonId } = req.params

  try {
    // Check if user has access to this course
    if (req.user) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: req.user.id,
            courseId: courseId
          }
        }
      })

      if (!enrollment) {
        return res.status(403).json({ error: "Not enrolled in this course" })
      }
    }

    // Verify lesson belongs to course
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          select: { courseId: true }
        }
      }
    })

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" })
    }

    if (lesson.module.courseId !== courseId) {
      return res.status(400).json({ error: "Lesson does not belong to this course" })
    }

    const questions = await prisma.courseQuestion.findMany({
      where: { lessonId: lessonId },
      orderBy: { createdAt: "asc" }
    })

    res.json(questions)
  } catch (error) {
    console.error("Error fetching lesson questions:", error)
    res.status(500).json({ error: "Failed to fetch lesson questions" })
  }
})

const purchaseSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default("KZT"),
  paymentMethod: z.string().default("kaspi"),
  transactionId: z.string().optional(),
  payerFullName: z.string().min(1).optional(),
  senderCode: z.string().min(3).max(64).optional(),
  metadata: z.record(z.any()).optional(),
})

router.get("/:courseId/analytics", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "ADMIN") return res.status(403).json({ error: "Admin only" })
  const { courseId } = req.params
  const [totalPurchases, approvedPurchases, pendingPurchases, enrollmentsCount, activeEnrollments, completedEnrollments, revenue] = await Promise.all([
    prisma.purchase.count({ where: { courseId } }),
    prisma.purchase.count({ where: { courseId, status: "approved" as any } }),
    prisma.purchase.count({ where: { courseId, status: "pending" as any } }),
    prisma.enrollment.count({ where: { courseId } }),
    prisma.enrollment.count({ where: { courseId, status: "active" as any } }),
    prisma.enrollment.count({ where: { courseId, progressPercentage: { gte: 100 as any } } }),
    prisma.purchase.aggregate({ _sum: { amount: true }, where: { courseId, status: "approved" as any } }),
  ])
  const revenueSum = (revenue._sum.amount as unknown as any) ?? 0
  res.json({ totalPurchases, approvedPurchases, pendingPurchases, enrollmentsCount, activeEnrollments, completedEnrollments, revenue: revenueSum })
})

const questionSchema = z.object({
  text: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(8),
  correctIndex: z.number().int().min(0),
  xpReward: z.number().int().min(0).max(10000).optional().default(20),
  level: z.number().int().min(1).max(10).optional().default(1),
  moduleId: z.string().optional(),
  lessonId: z.string().optional(),
})

router.post("/:courseId/questions", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "ADMIN") return res.status(403).json({ error: "Admin only" })
  const { courseId } = req.params
  const parsed = questionSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const data = parsed.data
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } })
  if (!course) return res.status(404).json({ error: "Course not found" })
  const q = await (prisma as any).courseQuestion.create({
    data: {
      courseId,
      moduleId: data.moduleId,
      lessonId: data.lessonId,
      text: data.text,
      options: data.options as any,
      correctIndex: data.correctIndex,
      xpReward: data.xpReward ?? 100,
      level: data.level ?? 1,
      authorId: req.user!.id,
    },
  })
  res.status(201).json(q)
})

router.get("/:courseId/questions", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.params
  console.log('🔍 GET /courses/:courseId/questions', { courseId, query: req.query })

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, isFree: true, price: true } })
  if (!course) return res.status(404).json({ error: "Course not found" })

  if (req.user?.role !== "ADMIN") {
    // Auto-enroll user in free courses
    if (req.user?.id && (course.isFree || !course.price || Number(course.price) === 0)) {
      const existingEnrollment = await prisma.enrollment.findFirst({
        where: { userId: req.user.id, courseId }
      })
      if (!existingEnrollment) {
        await prisma.enrollment.create({
          data: { userId: req.user.id, courseId }
        })
      }
    }

    const hasAccess = await userHasCourseAccess(req.user?.id, course)
    if (!hasAccess && !course.isFree) return res.status(403).json({ error: "No access" })
  }

  const { moduleId, lessonId } = req.query as any
  const level = (req.query.level as string | undefined) || undefined
  const levelMin = (req.query.levelMin as string | undefined) || undefined
  const levelMax = (req.query.levelMax as string | undefined) || undefined
  const where: any = { courseId }
  if (moduleId) where.moduleId = moduleId
  if (lessonId) where.lessonId = lessonId
  if (level) where.level = Number(level)
  if (levelMin || levelMax) where.level = { gte: levelMin ? Number(levelMin) : undefined, lte: levelMax ? Number(levelMax) : undefined }

  console.log('🔍 Querying questions with where:', where)
  const list = await (prisma as any).courseQuestion.findMany({ where, orderBy: { createdAt: "desc" } })
  console.log('📝 Questions found:', list.length, list.map((q: any) => ({ id: q.id, text: q.text, lessonId: q.lessonId })))

  // Include user answer status if user is authenticated
  let result = list.map((q: any) => ({
    id: q.id,
    text: q.text,
    options: q.options,
    moduleId: q.moduleId,
    lessonId: q.lessonId,
    xpReward: q.xpReward,
    level: q.level,
    // Expose correctIndex to allow editors and frontend to work reliably
    correctIndex: q.correctIndex,
  }))

  if (req.user?.id) {
    const questionIds = list.map((q: any) => q.id)
    const userAnswers = await (prisma as any).courseAnswer.findMany({
      where: { questionId: { in: questionIds }, userId: req.user.id },
      select: { questionId: true, selectedIndex: true, isCorrect: true }
    })

    const answerMap = new Map<string, any>(userAnswers.map((a: any) => [String(a.questionId), a] as [string, any]))
    result = result.map((q: any) => {
      const userAnswer: any = answerMap.get(String(q.id))
      return {
        ...q,
        userAnswered: !!userAnswer,
        userSelectedIndex: userAnswer?.selectedIndex,
        userAnswerCorrect: userAnswer?.isCorrect
      }
    })
  }

  console.log('✅ Sending questions response:', result.length, 'questions')
  res.json(result)
})

router.post("/questions/:questionId/answer", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { questionId } = req.params
  const { selectedIndex } = z.object({ selectedIndex: z.number().int().min(0) }).parse(req.body)
  const q = await (prisma as any).courseQuestion.findUnique({ where: { id: questionId } })
  if (!q) return res.status(404).json({ error: "Question not found" })

  // Check if user already answered this question
  const existingAnswer = await (prisma as any).courseAnswer.findUnique({
    where: { questionId_userId: { questionId, userId: req.user!.id } }
  })

  if (existingAnswer) {
    // Normalize correct index before returning it
    const opts = Array.isArray(q.options) ? q.options : []
    let normalizedCorrectIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0
    if (normalizedCorrectIndex < 0 || (opts.length > 0 && normalizedCorrectIndex >= opts.length)) {
      normalizedCorrectIndex = 0
    }

    return res.status(400).json({
      error: "Вы уже ответили на этот вопрос",
      answerId: existingAnswer.id,
      isCorrect: existingAnswer.isCorrect,
      correctIndex: normalizedCorrectIndex,
    })
  }

  // Normalize correct index to avoid out-of-range / negative values
  const options = Array.isArray(q.options) ? q.options : []
  let correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0
  if (correctIndex < 0 || (options.length > 0 && correctIndex >= options.length)) {
    correctIndex = 0
  }

  const isCorrect = Number(selectedIndex) === Number(correctIndex)
  const ans = await (prisma as any).courseAnswer.create({
    data: { questionId, userId: req.user!.id, selectedIndex, isCorrect },
  })
  let awarded = 0
  const achievements: Array<{ type: string; threshold: number; message: string; certificateSent: boolean }> = []

  if (isCorrect) {
    // Unified reward for correct answer
    const reward = 20
    awarded = reward
    const before = (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { experiencePoints: true } }))?.experiencePoints || 0
    await prisma.user.update({ where: { id: req.user!.id }, data: { experiencePoints: { increment: awarded } } })
    const afterXp = Number(before) + Number(awarded)
    const beforeLevel = Math.floor(Number(before) / 100)
    const afterLevel = Math.floor(afterXp / 100)
    const crossed = afterLevel > beforeLevel

    if (crossed) {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
      for (const a of admins) {
        await (prisma as any).notification.create({ data: { userId: a.id, title: "Достигнут порог XP", message: `Пользователь достиг >=100 XP: ${req.user!.id}`, type: "certificate" } })
      }

      // Generate and send certificate
      let certificateSent = false
      try {
        const user = await prisma.user.findUnique({
          where: { id: req.user!.id },
          select: { email: true, fullName: true }
        })

        if (user && user.email && user.fullName) {
          const course = await prisma.course.findUnique({
            where: { id: q.courseId },
            select: { title: true }
          })

          const fullName = user.fullName
          const courseName = course?.title || 'Курс S7 Robotics'

          // Generate certificate
          const certificateBuffer = await generateCertificate({
            fullName,
            courseName,
            date: new Date()
          })

          // Send certificate email
          await sendCertificateEmail(user.email, fullName, courseName, certificateBuffer)
          certificateSent = true
        }
      } catch (error) {
        console.error('Error generating/sending certificate:', error)
        // Don't fail the answer submission if certificate generation fails
      }

      // Add achievement notification data for frontend
      achievements.push({
        type: 'milestone',
        threshold: afterLevel * 100,
        message: `Поздравляем! Вы успешно достигли ${afterLevel * 100} очков в этом курсе. На вашу почту отправлен бонус.`,
        certificateSent
      })
    }

    // increment daily missions progress for this course (type: correct_answers)
    try {
      await incrementDailyMissionsProgressForCourse({ courseId: q.courseId, userId: req.user!.id, delta: 1 })
    } catch { }
  }

  res.status(201).json({
    isCorrect,
    answerId: ans.id,
    correctIndex,
    xpAwarded: awarded,
    userTotalXp: (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { experiencePoints: true } }))?.experiencePoints || 0,
    achievements
  })
})

// Daily missions
const missionSchema = z.object({
  title: z.string().min(1),
  target: z.number().int().min(1).max(1000).default(1),
  xpReward: z.number().int().min(0).max(100000).default(50),
  type: z.string().optional().default("correct_answers"),
  active: z.boolean().optional().default(true),
})

router.get("/:courseId/missions", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.params
  const list = await (prisma as any).dailyMission.findMany({ where: { courseId, active: true }, orderBy: { createdAt: "asc" } })
  let result = list.map((m: any) => ({ id: m.id, title: m.title, target: m.target, xpReward: m.xpReward, type: m.type, progress: 0, completed: false }))
  if (req.user?.id) {
    const day = startOfDay(new Date())
    const prog = await (prisma as any).dailyMissionProgress.findMany({ where: { missionId: { in: list.map((m: any) => m.id) }, userId: req.user!.id, day } })
    const map = new Map<string, any>(prog.map((p: any) => [String(p.missionId), p] as [string, any]))
    result = result.map((r: any) => {
      const p = map.get(String(r.id)) as any
      return { ...r, progress: p?.count ?? 0, completed: Boolean(p?.completed) }
    })
  }
  res.json(result)
})

router.post("/:courseId/missions", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "ADMIN") return res.status(403).json({ error: "Admin only" })
  const { courseId } = req.params
  const parsed = missionSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } })
  if (!course) return res.status(404).json({ error: "Course not found" })
  const m = await (prisma as any).dailyMission.create({ data: { courseId, title: parsed.data.title, target: parsed.data.target, xpReward: parsed.data.xpReward, type: parsed.data.type, active: parsed.data.active } })
  res.status(201).json(m)
})

router.post("/missions/:missionId/progress", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { missionId } = req.params
  const { delta } = z.object({ delta: z.number().int().min(1).default(1) }).parse(req.body)
  const m = await (prisma as any).dailyMission.findUnique({ where: { id: missionId } })
  if (!m || !m.active) return res.status(404).json({ error: "Mission not found" })
  const day = startOfDay(new Date())
  let p = await (prisma as any).dailyMissionProgress.findFirst({ where: { missionId, userId: req.user!.id, day } })
  if (!p) {
    p = await (prisma as any).dailyMissionProgress.create({ data: { missionId, userId: req.user!.id, day, count: 0, completed: false } })
  }
  if (p.completed) return res.json({ ...p, awarded: 0 })
  const newCount = (p.count || 0) + delta
  const willComplete = newCount >= m.target
  p = await (prisma as any).dailyMissionProgress.update({ where: { id: p.id }, data: { count: newCount, completed: willComplete, updatedAt: new Date() } })
  let awarded = 0
  if (willComplete) {
    awarded = Number(m.xpReward || 0)
    if (awarded > 0) await prisma.user.update({ where: { id: req.user!.id }, data: { experiencePoints: { increment: awarded } } })
  }
  res.json({ ...p, awarded })
})

router.get("/:courseId/leaderboard", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.params
  const enrollments = await prisma.enrollment.findMany({ where: { courseId }, include: { user: { select: { id: true, fullName: true, email: true, experiencePoints: true } } } })
  const users = enrollments.map((e) => e.user).filter(Boolean) as any[]
  const uniq = new Map<string, any>()
  for (const u of users) { if (!uniq.has(u.id)) uniq.set(u.id, u) }
  const top = Array.from(uniq.values()).sort((a, b) => Number(b.experiencePoints) - Number(a.experiencePoints)).slice(0, 10)
  res.json(top.map((u, i) => ({ rank: i + 1, id: u.id, name: u.fullName || u.email, xp: Number(u.experiencePoints || 0) })))
})

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

async function incrementDailyMissionsProgressForCourse({ courseId, userId, delta }: { courseId: string; userId: string; delta: number }) {
  const missions = await (prisma as any).dailyMission.findMany({ where: { courseId, active: true, type: "correct_answers" } })
  if ((missions || []).length === 0) return
  const day = startOfDay(new Date())
  const before = (await prisma.user.findUnique({ where: { id: userId }, select: { experiencePoints: true } }))?.experiencePoints || 0
  let thresholdNotified = false
  for (const m of missions) {
    let p = await (prisma as any).dailyMissionProgress.findFirst({ where: { missionId: m.id, userId, day } })
    if (!p) p = await (prisma as any).dailyMissionProgress.create({ data: { missionId: m.id, userId, day, count: 0, completed: false } })
    if (p.completed) continue
    const newCount = (p.count || 0) + delta
    const willComplete = newCount >= m.target
    await (prisma as any).dailyMissionProgress.update({ where: { id: p.id }, data: { count: newCount, completed: willComplete, updatedAt: new Date() } })
    if (willComplete && Number(m.xpReward || 0) > 0) {
      await prisma.user.update({ where: { id: userId }, data: { experiencePoints: { increment: Number(m.xpReward || 0) } } })
      if (!thresholdNotified) {
        const after = Number(before) + Number(m.xpReward || 0)
        if (Number(before) < 100 && after >= 100) {
          const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
          for (const a of admins) {
            await (prisma as any).notification.create({ data: { userId: a.id, title: "Достигнут порог XP", message: `Пользователь достиг >=100 XP: ${userId}`, type: "certificate" } })
          }
          thresholdNotified = true
        }
      }
    }
  }
}

router.get("/:courseId/questions/analytics", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "ADMIN") return res.status(403).json({ error: "Admin only" })
  const { courseId } = req.params
  const qs = await (prisma as any).courseQuestion.findMany({ where: { courseId }, include: { answers: true } })
  const data = qs.map((q: any) => ({
    id: q.id,
    text: q.text,
    totalAnswers: q.answers.length,
    correct: q.answers.filter((a: any) => a.isCorrect).length,
    wrong: q.answers.filter((a: any) => !a.isCorrect).length,
  }))
  res.json(data)
})

router.get("/:courseId/questions/answers", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== "ADMIN") return res.status(403).json({ error: "Admin only" })
  const { courseId } = req.params
  const where: any = { courseId }
  const questionId = (req.query.questionId as string | undefined) || undefined
  if (questionId) where.id = questionId
  const qs = await (prisma as any).courseQuestion.findMany({ where, include: { answers: { include: { user: { select: { id: true, email: true, fullName: true } } } } } })
  const rows = qs.flatMap((q: any) =>
    (q.answers || []).map((a: any) => ({
      questionId: q.id,
      question: q.text,
      selectedIndex: a.selectedIndex,
      isCorrect: a.isCorrect,
      createdAt: a.createdAt,
      user: a.user,
    }))
  )
  res.json(rows)
})

const progressSchema = z.object({
  lessonId: z.string(),
  isCompleted: z.boolean().optional(),
  watchTimeSeconds: z.number().int().nonnegative().optional(),
})

router.get("/", async (req: Request, res: Response) => {
  const search = (req.query.search as string | undefined)?.trim()
  const filter = (req.query.filter as string | undefined) // 'free' | 'paid' | 'all'

  const where: any = { isPublished: true }
  if (search && search.length > 0) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ]
  }
  if (filter === "free") where.isFree = true
  if (filter === "paid") where.isFree = false

  const courses = await prisma.course.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, fullName: true } },
      modules: {
        orderBy: { orderIndex: "asc" },
        include: {
          lessons: {
            orderBy: { orderIndex: "asc" },
            select: { id: true, title: true, isFreePreview: true, duration: true },
          },
        },
      },
    },
  })

  res.json(
    courses.map((course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      difficulty: course.difficulty,
      coverImageUrl: course.coverImageUrl,
      price: course.price,
      isFree: course.isFree,
      estimatedHours: course.estimatedHours,
      author: course.author,
      modules: course.modules,
    }))
  )
})

router.get("/continue", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const enrollments = (await prisma.enrollment.findMany({
    where: { userId: req.user!.id },
    orderBy: { enrolledAt: "desc" },
    include: {
      lessonProgress: true,
      course: {
        include: {
          author: { select: { id: true, fullName: true } },
          modules: { orderBy: { orderIndex: "asc" }, include: { lessons: true } },
        },
      },
    },
  })) as any[]

  const items = enrollments
    .map((e: any) => {
      const completedLessons = (e.lessonProgress || []).filter((p: any) => p.isCompleted).length
      const totalLessons = (e.course?.modules || []).reduce((acc: number, m: any) => acc + (m.lessons?.length || 0), 0)
      const progress = typeof e.progressPercentage === "number" ? e.progressPercentage : totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0
      return {
        id: e.course.id,
        title: e.course.title,
        difficulty: e.course.difficulty,
        author: e.course.author,
        price: e.course.price,
        modules: (e.course.modules || []).map((m: any) => ({ id: m.id, title: m.title, lessons: m.lessons })),
        completedLessons,
        totalLessons,
        progress,
      }
    })
    .filter((it) => it.completedLessons >= 1)

  res.json(items)
})

router.get("/:courseId", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const courseId = req.params.courseId
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      author: { select: { id: true, fullName: true, email: true } },
      modules: {
        orderBy: { orderIndex: "asc" },
        include: {
          lessons: {
            orderBy: { orderIndex: "asc" },
          },
        },
      },
    },
  })
  if (!course) return res.status(404).json({ error: "Course not found" })

  const isAdmin = (req.user as any)?.role === "ADMIN"

  // Auto-enroll user in free courses
  if (req.user?.id && (course.isFree || !course.price || Number(course.price) === 0)) {
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { userId: req.user.id, courseId }
    })
    if (!existingEnrollment) {
      await prisma.enrollment.create({
        data: { userId: req.user.id, courseId }
      })
    }
  }

  const hasAccess = isAdmin ? true : await userHasCourseAccess(req.user?.id, course)

  const safeModules = course.modules.map((module) => ({
    id: module.id,
    title: module.title,
    description: module.description,
    orderIndex: module.orderIndex,
    lessons: module.lessons.map((lesson: any) => {
      if (!(hasAccess || lesson.isFreePreview || course.isFree)) {
        return {
          id: lesson.id,
          title: lesson.title,
          duration: lesson.duration,
          isFreePreview: lesson.isFreePreview,
        }
      }
      return {
        id: lesson.id,
        title: lesson.title,
        content: lesson.content,
        duration: lesson.duration,
        orderIndex: lesson.orderIndex,
        isFreePreview: lesson.isFreePreview,
        videoUrl: toApiMedia(lesson.videoUrl),
        presentationUrl: toApiMedia(lesson.presentationUrl),
        slides: Array.isArray(lesson.slides)
          ? lesson.slides.map((s: any) => (s && typeof s === 'object' && s.url ? { ...s, url: toApiMedia(s.url) } : s))
          : lesson.slides,
      }
    }),
  }))

  res.json({
    id: course.id,
    title: course.title,
    description: course.description,
    difficulty: course.difficulty,
    author: course.author,
    price: course.price,
    isFree: course.isFree,
    coverImageUrl: course.coverImageUrl,
    estimatedHours: course.estimatedHours,
    modules: safeModules,
    hasAccess,
  })
})

router.get("/:courseId/lessons/:lessonId", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { courseId, lessonId } = req.params
  console.log('🔍 GET /courses/:courseId/lessons/:lessonId', { courseId, lessonId })

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { module: { include: { course: true } } } })
  console.log('📚 Lesson from DB:', {
    id: lesson?.id,
    title: lesson?.title,
    videoUrl: lesson?.videoUrl,
    content: lesson?.content?.substring(0, 100),
    slides: lesson?.slides
  })

  if (!lesson || lesson.module.courseId !== courseId) return res.status(404).json({ error: "Lesson not found" })

  const isAdmin = (req.user as any)?.role === "ADMIN"

  // Auto-enroll user in free courses
  if (req.user?.id && (lesson.module.course.isFree || !lesson.module.course.price || Number(lesson.module.course.price) === 0)) {
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { userId: req.user.id, courseId: lesson.module.courseId }
    })
    if (!existingEnrollment) {
      await prisma.enrollment.create({
        data: { userId: req.user.id, courseId: lesson.module.courseId }
      })
    }
  }

  const hasAccess = isAdmin ? true : await userHasCourseAccess(req.user?.id, lesson.module.course)
  if (!hasAccess && !lesson.isFreePreview) return res.status(403).json({ error: "Lesson requires purchase" })

  const response = {
    id: lesson.id,
    title: lesson.title,
    content: lesson.content,
    duration: lesson.duration,
    videoUrl: toApiMedia(lesson.videoUrl),
    presentationUrl: toApiMedia(lesson.presentationUrl),
    slides: Array.isArray(lesson.slides)
      ? (lesson.slides as any[]).map((s: any) => (s && typeof s === 'object' && s.url ? { ...s, url: toApiMedia(s.url) } : s))
      : lesson.slides,
    isFreePreview: lesson.isFreePreview,
    moduleId: lesson.moduleId,
  }

  console.log('✅ Sending lesson response:', {
    id: response.id,
    videoUrl: response.videoUrl,
    hasContent: !!response.content,
    slidesCount: Array.isArray(response.slides) ? response.slides.length : 0
  })

  res.json(response)
})

router.post("/:courseId/purchase", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.params
  const parsed = purchaseSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  const course = await prisma.course.findUnique({ where: { id: courseId } })
  if (!course) return res.status(404).json({ error: "Course not found" })

  const purchase = await (prisma as any).purchase.create({
    data: {
      userId: req.user!.id,
      courseId,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      paymentMethod: parsed.data.paymentMethod,
      transactionId: parsed.data.transactionId,
      payerFullName: parsed.data.payerFullName,
      senderCode: parsed.data.senderCode,
      metadata: parsed.data.metadata as any,
    },
  })

  res.status(201).json(purchase)
})

router.get("/:courseId/progress", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.params

  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: req.user!.id, courseId },
    include: { lessonProgress: true },
  })
  if (!enrollment) return res.json({ completion: 0, lessons: [] })

  res.json({
    completion: enrollment.progressPercentage,
    lessons: enrollment.lessonProgress,
  })
})

router.post("/:courseId/lessons/:lessonId/progress", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { courseId, lessonId } = req.params
  const parsed = progressSchema.safeParse({ ...req.body, lessonId })
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const course = await prisma.course.findUnique({ where: { id: courseId }, include: { modules: { include: { lessons: true } } } })
  if (!course) return res.status(404).json({ error: "Course not found" })

  const hasAccess = await userHasCourseAccess(req.user!.id, course)
  if (!hasAccess) return res.status(403).json({ error: "No access" })

  let enrollment = await prisma.enrollment.findFirst({ where: { userId: req.user!.id, courseId } })
  if (!enrollment) {
    enrollment = await prisma.enrollment.create({ data: { userId: req.user!.id, courseId } })
  }

  const progress = await prisma.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
    create: {
      enrollmentId: enrollment.id,
      lessonId,
      isCompleted: parsed.data.isCompleted ?? false,
      watchTimeSeconds: parsed.data.watchTimeSeconds ?? 0,
    },
    update: {
      isCompleted: parsed.data.isCompleted ?? undefined,
      watchTimeSeconds: parsed.data.watchTimeSeconds ?? undefined,
      completedAt: parsed.data.isCompleted ? new Date() : undefined,
    },
  })

  await updateCourseProgress(enrollment.id)

  res.json(progress)
})

async function userHasCourseAccess(userId: string | undefined, course: { id: string; isFree: boolean; price: any }) {
  if (course.isFree || !course.price || Number(course.price) === 0) return true
  if (!userId) return false

  const enrollment = await prisma.enrollment.findFirst({ where: { userId, courseId: course.id, status: "active" } })
  if (enrollment) return true

  const purchase = await prisma.purchase.findFirst({ where: { userId, courseId: course.id, status: "approved" } })
  return Boolean(purchase)
}

async function updateCourseProgress(enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      lessonProgress: true,
      course: { include: { modules: { include: { lessons: true } } } },
    },
  })
  if (!enrollment) return

  const totalLessons = enrollment.course.modules.reduce((count, module) => count + module.lessons.length, 0)
  if (totalLessons === 0) return
  const completed = enrollment.lessonProgress.filter((p) => p.isCompleted).length
  const percentage = (completed / totalLessons) * 100

  await prisma.enrollment.update({ where: { id: enrollmentId }, data: { progressPercentage: percentage } })
}
