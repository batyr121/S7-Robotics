import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAdmin, requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

export const router = Router()

// Validation schemas
const newsAttachmentSchema = z.object({
  type: z.enum(["photo", "video", "presentation", "document", "link"]),
  url: z.string().url(),
  title: z.string().optional(),
  description: z.string().optional(),
  orderIndex: z.number().int().default(0),
})

const createNewsSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  coverImageUrl: z.string().url().optional(),
  published: z.boolean().default(false),
  attachments: z.array(newsAttachmentSchema).optional(),
})

const updateNewsSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  coverImageUrl: z.string().url().optional().nullable(),
  published: z.boolean().optional(),
  attachments: z.array(newsAttachmentSchema).optional(),
})

// Helper function to normalize media URLs
function normalizeMediaUrl(u?: string | null): string | undefined {
  try {
    if (!u) return undefined
    const s = String(u)
    if (s.startsWith("/api/media/")) return s
    if (s.startsWith("/media/")) return s.replace("/media/", "/api/media/")
    const url = new URL(s)
    if (url.pathname.startsWith("/api/media/")) return url.pathname
    if (url.pathname.startsWith("/media/")) return url.pathname.replace("/media/", "/api/media/")
    return s
  } catch {
    return u || undefined
  }
}

// GET /api/news - Get all news (public, only published)
router.get("/", async (req, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit

    const where = { published: true }

    const [news, total] = await Promise.all([
      prisma.news.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          attachments: {
            orderBy: { orderIndex: "asc" },
          },
        },
      }),
      prisma.news.count({ where }),
    ])

    res.json({
      data: news.map((item) => ({
        ...item,
        coverImageUrl: normalizeMediaUrl(item.coverImageUrl),
        attachments: item.attachments.map((att) => ({
          ...att,
          url: normalizeMediaUrl(att.url) || att.url,
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching news:", error)
    res.status(500).json({ error: "Failed to fetch news" })
  }
})

// GET /api/news/admin/all - Get all news including drafts (admin only)
router.get("/admin/all", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const skip = (page - 1) * limit

    const [news, total] = await Promise.all([
      prisma.news.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          attachments: {
            orderBy: { orderIndex: "asc" },
          },
        },
      }),
      prisma.news.count(),
    ])

    res.json({
      data: news.map((item) => ({
        ...item,
        coverImageUrl: normalizeMediaUrl(item.coverImageUrl),
        attachments: item.attachments.map((att) => ({
          ...att,
          url: normalizeMediaUrl(att.url) || att.url,
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching news:", error)
    res.status(500).json({ error: "Failed to fetch news" })
  }
})

// GET /api/news/:id - Get single news item (public)
router.get("/:id", async (req, res: Response) => {
  try {
    const { id } = req.params

    const news = await prisma.news.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        attachments: {
          orderBy: { orderIndex: "asc" },
        },
      },
    })

    if (!news) {
      return res.status(404).json({ error: "News not found" })
    }

    // Only allow viewing published news for non-admin users
    if (!news.published) {
      return res.status(404).json({ error: "News not found" })
    }

    res.json({
      ...news,
      coverImageUrl: normalizeMediaUrl(news.coverImageUrl),
      attachments: news.attachments.map((att) => ({
        ...att,
        url: normalizeMediaUrl(att.url) || att.url,
      })),
    })
  } catch (error) {
    console.error("Error fetching news:", error)
    res.status(500).json({ error: "Failed to fetch news" })
  }
})

// POST /api/news - Create news (admin only)
router.post("/", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = createNewsSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    const data = parsed.data
    const userId = req.user!.id

    const news = await prisma.news.create({
      data: {
        title: data.title,
        content: data.content,
        coverImageUrl: normalizeMediaUrl(data.coverImageUrl),
        published: data.published,
        publishedAt: data.published ? new Date() : null,
        authorId: userId,
        attachments: data.attachments
          ? {
            create: data.attachments.map((att) => ({
              type: att.type,
              url: normalizeMediaUrl(att.url) || att.url,
              title: att.title,
              description: att.description,
              orderIndex: att.orderIndex,
            })),
          }
          : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        attachments: {
          orderBy: { orderIndex: "asc" },
        },
      },
    })

    res.status(201).json({
      ...news,
      coverImageUrl: normalizeMediaUrl(news.coverImageUrl),
      attachments: news.attachments.map((att) => ({
        ...att,
        url: normalizeMediaUrl(att.url) || att.url,
      })),
    })
  } catch (error) {
    console.error("Error creating news:", error)
    res.status(500).json({ error: "Failed to create news" })
  }
})

// PUT /api/news/:id - Update news (admin only)
router.put("/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const parsed = updateNewsSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    const data = parsed.data

    // Check if news exists
    const existing = await prisma.news.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: "News not found" })
    }

    // If publishing for the first time or if published but no date, set publishedAt
    const publishedAt =
      data.published === false ? null :
        (data.published && (!existing.published || !existing.publishedAt)) ? new Date() :
          existing.publishedAt

    // Handle attachments update
    if (data.attachments !== undefined) {
      // Delete existing attachments
      await prisma.newsAttachment.deleteMany({ where: { newsId: id } })
    }

    const news = await prisma.news.update({
      where: { id },
      data: {
        title: data.title,
        content: data.content,
        coverImageUrl: data.coverImageUrl === null ? null : normalizeMediaUrl(data.coverImageUrl),
        published: data.published,
        publishedAt,
        attachments: data.attachments
          ? {
            create: data.attachments.map((att) => ({
              type: att.type,
              url: normalizeMediaUrl(att.url) || att.url,
              title: att.title,
              description: att.description,
              orderIndex: att.orderIndex,
            })),
          }
          : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        attachments: {
          orderBy: { orderIndex: "asc" },
        },
      },
    })

    res.json({
      ...news,
      coverImageUrl: normalizeMediaUrl(news.coverImageUrl),
      attachments: news.attachments.map((att) => ({
        ...att,
        url: normalizeMediaUrl(att.url) || att.url,
      })),
    })
  } catch (error) {
    console.error("Error updating news:", error)
    res.status(500).json({ error: "Failed to update news" })
  }
})

// DELETE /api/news/:id - Delete news (admin only)
router.delete("/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params

    // Check if news exists
    const existing = await prisma.news.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: "News not found" })
    }

    // Delete attachments first (cascade should handle this, but being explicit)
    await prisma.newsAttachment.deleteMany({ where: { newsId: id } })

    // Delete news
    await prisma.news.delete({ where: { id } })

    res.json({ success: true, message: "News deleted successfully" })
  } catch (error) {
    console.error("Error deleting news:", error)
    res.status(500).json({ error: "Failed to delete news" })
  }
})

// PATCH /api/news/:id/publish - Toggle publish status (admin only)
router.patch("/:id/publish", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params
    const { published } = req.body

    if (typeof published !== "boolean") {
      return res.status(400).json({ error: "published must be a boolean" })
    }

    const existing = await prisma.news.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: "News not found" })
    }

    const publishedAt =
      !published ? null :
        (published && (!existing.published || !existing.publishedAt)) ? new Date() :
          existing.publishedAt

    console.log(`[News] Toggling publish for ${id}: ${published}`)

    const relatedNews = await prisma.news.update({
      where: { id },
      data: {
        published,
        publishedAt,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        attachments: {
          orderBy: { orderIndex: "asc" },
        },
      },
    })
    console.log(`[News] Updated ${id}: published=${relatedNews.published}, publishedAt=${relatedNews.publishedAt}`)

    res.json({
      ...relatedNews,
      coverImageUrl: normalizeMediaUrl(relatedNews.coverImageUrl),
      attachments: relatedNews.attachments.map((att) => ({
        ...att,
        url: normalizeMediaUrl(att.url) || att.url,
      })),
    })
  } catch (error) {
    console.error("Error toggling publish status:", error)
    res.status(500).json({ error: "Failed to toggle publish status" })
  }
})
