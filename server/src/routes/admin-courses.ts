import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth, requireAdmin } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"
import { Prisma } from "@prisma/client"

export const router = Router()

router.use(requireAuth, requireAdmin)

// Get course details with modules and lessons
router.get("/:courseId", async (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.params

  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
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

    return res.json(course)
  } catch (error) {
    console.error("Error loading course:", error)
    return res.status(500).json({ error: "Failed to load course" })
  }
})

// Schema for individual question creation
const questionSchema = z.object({
  text: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(8),
  correctIndex: z.number().int().min(0),
  xpReward: z.number().int().min(0).max(10000).optional().default(20),
  level: z.number().int().min(1).max(10).optional().default(1),
  moduleId: z.string().optional(),
  lessonId: z.string().optional(),
})

// Schema for individual lesson creation
const lessonSchema = z.object({
  title: z.string().min(1),
  content: z.string().optional(),
  duration: z.string().optional(),
  orderIndex: z.number().int().min(0),
  isFreePreview: z.boolean().optional().default(false),
  videoUrl: z.string().optional(),
  presentationUrl: z.string().optional(),
  slides: z.array(z.object({ url: z.string() })).optional(),
  contentType: z.string().default("text"),
  quizQuestion: z.string().optional(),
  quizOptions: z.array(z.string()).optional(),
  quizCorrectIndex: z.number().int().min(-1).optional().default(-1),
  quizXp: z.number().int().min(0).optional().default(100),
})

// Schema for individual module creation
const moduleSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  orderIndex: z.number().int().min(0),
  lessons: z.array(lessonSchema).default([]),
})

// Schema for full course creation with modules and lessons
const fullCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  difficulty: z.string().min(1),
  price: z.number().nonnegative().default(0),
  isFree: z.boolean().default(true),
  isPublished: z.boolean().default(false),
  modules: z.array(z.object({
    id: z.string().optional(), // Optional for existing modules
    title: z.string().min(1),
    orderIndex: z.number().int().min(0),
    lessons: z.array(z.object({
      id: z.string().optional(), // Optional for existing lessons
      title: z.string().min(1),
      content: z.string().optional(),
      duration: z.string().optional(),
      orderIndex: z.number().int().min(0),
      isFreePreview: z.boolean().optional().default(false),
      videoUrl: z.string().optional(),
      presentationUrl: z.string().optional(),
      slides: z.array(z.object({ url: z.string() })).optional(),
      contentType: z.string().default("text"),
    })).default([]),
  })).default([]),
})

// Create course with full structure (modules and lessons)
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  const parsed = fullCourseSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const data = parsed.data

  try {
    // Create course with modules and lessons in a transaction
    const course = await prisma.course.create({
      data: {
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        authorId: req.user!.id,
        price: data.price,
        isFree: data.isFree,
        isPublished: data.isPublished,
        totalModules: data.modules.length,
        modules: {
          create: data.modules.map((module) => ({
            title: module.title,
            description: module.title,
            orderIndex: module.orderIndex,
            lessons: {
              create: module.lessons.map((lesson) => ({
                title: lesson.title,
                content: lesson.content,
                duration: lesson.duration,
                orderIndex: lesson.orderIndex,
                isFreePreview: lesson.isFreePreview,
                videoUrl: lesson.videoUrl,
                presentationUrl: lesson.presentationUrl,
                slides: lesson.slides || [],
                contentType: lesson.contentType,
              })),
            },
          })),
        },
      },
      include: {
        modules: {
          include: {
            lessons: true,
          },
        },
      },
    })

    return res.status(201).json(course)
  } catch (error) {
    console.error("Error creating course:", error)
    return res.status(500).json({ error: "Failed to create course" })
  }
})

// Update course with full structure (modules and lessons) - with sync parameter
router.put("/:courseId", async (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.params
  const syncMode = req.query.sync === 'ids'
  const parsed = fullCourseSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const data = parsed.data

  try {
    if (syncMode) {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: { modules: { include: { lessons: true } } },
      })
      if (!course) return res.status(404).json({ error: "Course not found" })

      await prisma.course.update({
        where: { id: courseId },
        data: {
          title: data.title,
          description: data.description,
          difficulty: data.difficulty,
          price: data.price,
          isFree: data.isFree,
          isPublished: data.isPublished,
          totalModules: data.modules.length,
        },
      })

      for (const moduleData of data.modules) {
        if (moduleData.id) {
          let targetModuleId = moduleData.id
          try {
            await prisma.courseModule.update({
              where: { id: moduleData.id },
              data: { title: moduleData.title, orderIndex: moduleData.orderIndex },
            })
          } catch (e: any) {
            if (e && (e as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
              const created = await prisma.courseModule.create({
                data: { courseId, title: moduleData.title, orderIndex: moduleData.orderIndex },
              })
              targetModuleId = created.id
              console.warn('Module not found, created instead:', moduleData.id)
            } else {
              throw e
            }
          }

          for (const lessonData of moduleData.lessons) {
            if (lessonData.id) {
              try {
                await prisma.lesson.update({
                  where: { id: lessonData.id },
                  data: {
                    title: lessonData.title,
                    content: lessonData.content,
                    duration: lessonData.duration,
                    orderIndex: lessonData.orderIndex,
                    isFreePreview: lessonData.isFreePreview,
                    videoUrl: lessonData.videoUrl,
                    presentationUrl: lessonData.presentationUrl,
                    slides: lessonData.slides || [],
                    contentType: lessonData.contentType,
                  },
                })
              } catch (e: any) {
                if (e && (e as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
                  await prisma.lesson.create({
                    data: {
                      moduleId: targetModuleId,
                      title: lessonData.title,
                      content: lessonData.content,
                      duration: lessonData.duration,
                      orderIndex: lessonData.orderIndex,
                      isFreePreview: lessonData.isFreePreview,
                      videoUrl: lessonData.videoUrl,
                      presentationUrl: lessonData.presentationUrl,
                      slides: lessonData.slides || [],
                      contentType: lessonData.contentType,
                    },
                  })
                  console.warn('Lesson not found, created instead:', lessonData.id)
                } else {
                  throw e
                }
              }
            } else {
              await prisma.lesson.create({
                data: {
                  moduleId: targetModuleId,
                  title: lessonData.title,
                  content: lessonData.content,
                  duration: lessonData.duration,
                  orderIndex: lessonData.orderIndex,
                  isFreePreview: lessonData.isFreePreview,
                  videoUrl: lessonData.videoUrl,
                  presentationUrl: lessonData.presentationUrl,
                  slides: lessonData.slides || [],
                  contentType: lessonData.contentType,
                },
              })
            }
          }
        } else {
          // No module ID provided: try to match by orderIndex to avoid unique constraint collision
          const existingModule = await prisma.courseModule.findFirst({ where: { courseId, orderIndex: moduleData.orderIndex } })
          let targetModuleId: string
          if (existingModule) {
            await prisma.courseModule.update({
              where: { id: existingModule.id },
              data: { title: moduleData.title, orderIndex: moduleData.orderIndex },
            })
            targetModuleId = existingModule.id
          } else {
            const created = await prisma.courseModule.create({
              data: { courseId, title: moduleData.title, orderIndex: moduleData.orderIndex },
            })
            targetModuleId = created.id
          }

          // Upsert lessons by id if provided, otherwise by orderIndex
          for (const lesson of moduleData.lessons) {
            if (lesson.id) {
              try {
                await prisma.lesson.update({
                  where: { id: lesson.id },
                  data: {
                    title: lesson.title,
                    content: lesson.content,
                    duration: lesson.duration,
                    orderIndex: lesson.orderIndex,
                    isFreePreview: lesson.isFreePreview,
                    videoUrl: lesson.videoUrl,
                    presentationUrl: lesson.presentationUrl,
                    slides: lesson.slides || [],
                    contentType: lesson.contentType,
                  },
                })
              } catch (e: any) {
                if (e && (e as Prisma.PrismaClientKnownRequestError).code === 'P2025') {
                  await prisma.lesson.create({
                    data: {
                      moduleId: targetModuleId,
                      title: lesson.title,
                      content: lesson.content,
                      duration: lesson.duration,
                      orderIndex: lesson.orderIndex,
                      isFreePreview: lesson.isFreePreview,
                      videoUrl: lesson.videoUrl,
                      presentationUrl: lesson.presentationUrl,
                      slides: lesson.slides || [],
                      contentType: lesson.contentType,
                    },
                  })
                } else {
                  throw e
                }
              }
            } else {
              // Try to match existing lesson by orderIndex to avoid P2002 unique constraint
              const existingLesson = await prisma.lesson.findFirst({ where: { moduleId: targetModuleId, orderIndex: lesson.orderIndex } })
              if (existingLesson) {
                await prisma.lesson.update({
                  where: { id: existingLesson.id },
                  data: {
                    title: lesson.title,
                    content: lesson.content,
                    duration: lesson.duration,
                    orderIndex: lesson.orderIndex,
                    isFreePreview: lesson.isFreePreview,
                    videoUrl: lesson.videoUrl,
                    presentationUrl: lesson.presentationUrl,
                    slides: lesson.slides || [],
                    contentType: lesson.contentType,
                  },
                })
              } else {
                await prisma.lesson.create({
                  data: {
                    moduleId: targetModuleId,
                    title: lesson.title,
                    content: lesson.content,
                    duration: lesson.duration,
                    orderIndex: lesson.orderIndex,
                    isFreePreview: lesson.isFreePreview,
                    videoUrl: lesson.videoUrl,
                    presentationUrl: lesson.presentationUrl,
                    slides: lesson.slides || [],
                    contentType: lesson.contentType,
                  },
                })
              }
            }
          }
        }
      }

      const updatedCourse = await prisma.course.findUnique({
        where: { id: courseId },
        include: { modules: { include: { lessons: true } } },
      })
      return res.json(updatedCourse)
    } else {
      // Regular update - just basic course info
      const course = await prisma.course.update({
        where: { id: courseId },
        data: {
          title: data.title,
          description: data.description,
          difficulty: data.difficulty,
          price: data.price,
          isFree: data.isFree,
          isPublished: data.isPublished,
          totalModules: data.modules.length,
        },
      })

      return res.json(course)
    }
  } catch (error) {
    console.error("Error updating course:", error)
    return res.status(500).json({ error: "Failed to update course" })
  }
})

// Create or update course basic info
// Note: This route handles both /courses/:courseId/basic AND /:courseId/basic for backward compatibility
const handleCourseBasicInfo = async (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.params
  const schema = z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    difficulty: z.string().min(1),
    price: z.number().nonnegative().default(0),
    isFree: z.boolean().default(true),
    isPublished: z.boolean().default(false),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    // Format validation errors for better frontend display
    const fieldErrors: Record<string, string[]> = {}
    if (parsed.error.formErrors.fieldErrors) {
      Object.entries(parsed.error.formErrors.fieldErrors).forEach(([field, errors]) => {
        fieldErrors[field] = errors || []
      })
    }
    return res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      fields: fieldErrors
    })
  }

  const data = parsed.data

  try {
    if (courseId === "new") {
      // Create new course
      const course = await prisma.course.create({
        data: {
          title: data.title,
          description: data.description,
          difficulty: data.difficulty,
          authorId: req.user!.id,
          price: data.price,
          isFree: data.isFree,
          isPublished: data.isPublished,
          totalModules: 0,
        },
      })
      return res.status(201).json(course)
    } else {
      // Update existing course
      const course = await prisma.course.update({
        where: { id: courseId },
        data: {
          title: data.title,
          description: data.description,
          difficulty: data.difficulty,
          price: data.price,
          isFree: data.isFree,
          isPublished: data.isPublished,
        },
      })
      return res.json(course)
    }
  } catch (error: any) {
    console.error("Error saving course basic info:", error)
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Course not found", code: "COURSE_NOT_FOUND" })
    }
    return res.status(500).json({ error: "Failed to save course basic info", code: "SERVER_ERROR" })
  }
}

// Register both route patterns for backward compatibility
router.post("/:courseId/basic", handleCourseBasicInfo)
router.post("/courses/:courseId/basic", handleCourseBasicInfo)

// Create or update module
router.post("/courses/:courseId/modules", async (req: AuthenticatedRequest, res: Response) => {
  const { courseId } = req.params
  const parsed = moduleSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const data = parsed.data

  try {
    // Verify course exists
    const course = await prisma.course.findUnique({ where: { id: courseId } })
    if (!course) return res.status(404).json({ error: "Course not found" })

    // Create module with lessons
    const module = await prisma.courseModule.create({
      data: {
        courseId,
        title: data.title,
        description: data.description,
        orderIndex: data.orderIndex,
        lessons: {
          create: data.lessons.map((lesson, index) => ({
            title: lesson.title,
            content: lesson.content,
            duration: lesson.duration,
            orderIndex: lesson.orderIndex,
            isFreePreview: lesson.isFreePreview,
            videoUrl: lesson.videoUrl,
            presentationUrl: lesson.presentationUrl,
            slides: lesson.slides || [],
            contentType: lesson.contentType,
          })),
        },
      },
      include: {
        lessons: true,
      },
    })

    // Update course totalModules count
    await prisma.course.update({
      where: { id: courseId },
      data: {
        totalModules: { increment: 1 },
      },
    })

    return res.status(201).json(module)
  } catch (error) {
    console.error("Error creating module:", error)
    return res.status(500).json({ error: "Failed to create module" })
  }
})

// Update module
router.put("/modules/:moduleId", async (req: AuthenticatedRequest, res: Response) => {
  const { moduleId } = req.params
  const parsed = moduleSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const data = parsed.data

  try {
    const module = await prisma.courseModule.update({
      where: { id: moduleId },
      data: {
        title: data.title,
        description: data.description,
        orderIndex: data.orderIndex,
      },
    })

    return res.json(module)
  } catch (error) {
    console.error("Error updating module:", error)
    return res.status(500).json({ error: "Failed to update module" })
  }
})

// Create or update lesson
router.post("/modules/:moduleId/lessons", async (req: AuthenticatedRequest, res: Response) => {
  const { moduleId } = req.params
  const parsed = lessonSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const data = parsed.data

  try {
    // Verify module exists
    const module = await prisma.courseModule.findUnique({ where: { id: moduleId } })
    if (!module) return res.status(404).json({ error: "Module not found" })

    // Create lesson
    const lesson = await prisma.lesson.create({
      data: {
        moduleId,
        title: data.title,
        content: data.content,
        duration: data.duration,
        orderIndex: data.orderIndex,
        isFreePreview: data.isFreePreview,
        videoUrl: data.videoUrl,
        presentationUrl: data.presentationUrl,
        slides: data.slides || [],
        contentType: data.contentType,
      },
    })

    // Create quiz question if provided
    if (data.quizQuestion && data.quizOptions && data.quizOptions.length >= 2 && data.quizCorrectIndex >= 0) {
      await prisma.courseQuestion.create({
        data: {
          courseId: module.courseId,
          moduleId,
          lessonId: lesson.id,
          text: data.quizQuestion,
          options: data.quizOptions,
          correctIndex: data.quizCorrectIndex,
          xpReward: data.quizXp || 100,
          level: 1,
          authorId: req.user!.id,
        },
      })
    }

    return res.status(201).json(lesson)
  } catch (error) {
    console.error("Error creating lesson:", error)
    return res.status(500).json({ error: "Failed to create lesson" })
  }
})

// Update lesson
router.put("/lessons/:lessonId", async (req: AuthenticatedRequest, res: Response) => {
  const { lessonId } = req.params
  const parsed = lessonSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    // Format validation errors for better frontend display
    const fieldErrors: Record<string, string[]> = {}
    if (parsed.error.formErrors.fieldErrors) {
      Object.entries(parsed.error.formErrors.fieldErrors).forEach(([field, errors]) => {
        fieldErrors[field] = errors || []
      })
    }
    return res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      fields: fieldErrors,
      message: Object.values(fieldErrors).flat().join(', ') || "Invalid lesson data"
    })
  }

  const data = parsed.data

  console.log('💾 Updating lesson:', lessonId, {
    title: data.title,
    hasContent: !!data.content,
    hasVideoUrl: !!data.videoUrl,
    videoUrl: data.videoUrl,
    hasPresentationUrl: !!data.presentationUrl,
    slidesCount: Array.isArray(data.slides) ? data.slides.length : 0,
    hasQuizData: !!(data.quizQuestion && data.quizOptions)
  })

  try {
    const lesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title: data.title,
        content: data.content,
        duration: data.duration,
        isFreePreview: data.isFreePreview,
        videoUrl: data.videoUrl,
        presentationUrl: data.presentationUrl,
        slides: data.slides as any,
        contentType: data.contentType,
      },
    })

    console.log('✅ Lesson updated in DB:', { id: lesson.id, videoUrl: lesson.videoUrl, hasContent: !!lesson.content })

    // Update quiz question if provided
    if (data.quizQuestion || data.quizOptions || data.quizCorrectIndex !== undefined) {
      console.log('📝 Processing quiz question:', {
        hasQuestion: !!data.quizQuestion,
        hasOptions: !!data.quizOptions,
        optionsCount: data.quizOptions?.length,
        correctIndex: data.quizCorrectIndex
      })

      const existingQuestion = await prisma.courseQuestion.findFirst({
        where: { lessonId },
      })

      if (existingQuestion) {
        // Update existing question
        console.log('✏️ Updating existing question:', existingQuestion.id)

        const nextOptions = (data.quizOptions || existingQuestion.options) as any
        let nextCorrectIndex = data.quizCorrectIndex !== undefined ? data.quizCorrectIndex : existingQuestion.correctIndex

        // Guard against invalid correctIndex values (-1, out of range, NaN)
        if (
          typeof nextCorrectIndex !== 'number' ||
          nextCorrectIndex < 0 ||
          (Array.isArray(nextOptions) && nextCorrectIndex >= nextOptions.length)
        ) {
          // If the new index is invalid, try to keep the old one if valid, otherwise reset to 0
          if (existingQuestion.correctIndex < nextOptions.length) {
            nextCorrectIndex = existingQuestion.correctIndex
          } else {
            nextCorrectIndex = 0
          }
        }

        await prisma.courseQuestion.update({
          where: { id: existingQuestion.id },
          data: {
            text: data.quizQuestion || existingQuestion.text,
            options: nextOptions,
            correctIndex: nextCorrectIndex,
            xpReward: typeof data.quizXp === 'number' ? data.quizXp : existingQuestion.xpReward,
          },
        })
      } else if (data.quizQuestion && data.quizOptions && data.quizOptions.length >= 2 && data.quizCorrectIndex !== undefined && data.quizCorrectIndex >= 0) {
        // Create new question
        const module = await prisma.courseModule.findUnique({
          where: { id: lesson.moduleId },
        })

        console.log('➕ Creating new question for lesson:', lessonId)
        await prisma.courseQuestion.create({
          data: {
            courseId: module!.courseId,
            moduleId: lesson.moduleId,
            lessonId,
            text: data.quizQuestion,
            options: data.quizOptions,
            correctIndex: data.quizCorrectIndex,
            xpReward: data.quizXp || 100,
            level: 1,
            authorId: req.user!.id,
          },
        })
        console.log('✅ Question created successfully')
      } else {
        console.log('⚠️ Question not created - validation failed:', {
          hasQuestion: !!data.quizQuestion,
          hasOptions: data.quizOptions && data.quizOptions.length >= 2,
          hasCorrectIndex: data.quizCorrectIndex !== undefined && data.quizCorrectIndex >= 0
        })
      }
    }

    return res.json(lesson)
  } catch (error) {
    console.error("Error updating lesson:", error)
    return res.status(500).json({ error: "Failed to update lesson" })
  }
})

// Create question for existing lesson
router.post("/lessons/:lessonId/questions", async (req: AuthenticatedRequest, res: Response) => {
  const { lessonId } = req.params
  const parsed = questionSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const data = parsed.data

  try {
    // Verify lesson exists and get module info
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: true },
    })
    if (!lesson) return res.status(404).json({ error: "Lesson not found" })

    // Create question
    const question = await prisma.courseQuestion.create({
      data: {
        courseId: lesson.module.courseId,
        moduleId: lesson.moduleId,
        lessonId,
        text: data.text,
        options: data.options,
        correctIndex: data.correctIndex,
        xpReward: data.xpReward || 100,
        level: data.level || 1,
        authorId: req.user!.id,
      },
    })

    return res.status(201).json(question)
  } catch (error) {
    console.error("Error creating question:", error)
    return res.status(500).json({ error: "Failed to create question" })
  }
})

// Update question
router.put("/questions/:questionId", async (req: AuthenticatedRequest, res: Response) => {
  const { questionId } = req.params
  const parsed = questionSchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const data = parsed.data

  try {
    const question = await prisma.courseQuestion.update({
      where: { id: questionId },
      data: {
        text: data.text,
        options: data.options,
        correctIndex: data.correctIndex,
        xpReward: data.xpReward,
        level: data.level,
      },
    })

    return res.json(question)
  } catch (error) {
    console.error("Error updating question:", error)
    return res.status(500).json({ error: "Failed to update question" })
  }
})

// Delete question
router.delete("/questions/:questionId", async (req: AuthenticatedRequest, res: Response) => {
  const { questionId } = req.params

  try {
    await prisma.courseQuestion.delete({ where: { id: questionId } })
    return res.json({ success: true })
  } catch (error) {
    console.error("Error deleting question:", error)
    return res.status(500).json({ error: "Failed to delete question" })
  }
})

// Delete lesson
router.delete("/lessons/:lessonId", async (req: AuthenticatedRequest, res: Response) => {
  const { lessonId } = req.params

  try {
    // Get lesson info first
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: true },
    })

    if (!lesson) return res.status(404).json({ error: "Lesson not found" })

    // Delete lesson (questions will be cascade deleted)
    await prisma.lesson.delete({ where: { id: lessonId } })

    return res.json({ success: true })
  } catch (error) {
    console.error("Error deleting lesson:", error)
    return res.status(500).json({ error: "Failed to delete lesson" })
  }
})

// Delete module
router.delete("/modules/:moduleId", async (req: AuthenticatedRequest, res: Response) => {
  const { moduleId } = req.params

  try {
    // Get module info first
    const module = await prisma.courseModule.findUnique({
      where: { id: moduleId },
      include: { course: true },
    })

    if (!module) return res.status(404).json({ error: "Module not found" })

    // Delete module (lessons and questions will be cascade deleted)
    await prisma.courseModule.delete({ where: { id: moduleId } })

    // Update course totalModules count
    await prisma.course.update({
      where: { id: module.courseId },
      data: {
        totalModules: { decrement: 1 },
      },
    })

    return res.json({ success: true })
  } catch (error) {
    console.error("Error deleting module:", error)
    return res.status(500).json({ error: "Failed to delete module" })
  }
})