import { Router, type Request, type Response } from "express"
import { prisma } from "../db"
import { optionalAuth, requireAuth } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

export const router = Router()

function normalizeMediaUrl(u?: string | null): string | undefined {
  try {
    if (!u) return undefined
    const s = String(u)
    // Keep /api/media/ format for consistency with other endpoints
    if (s.startsWith("/api/media/")) return s
    if (s.startsWith("/media/")) return s.replace("/media/", "/api/media/")
    // Handle full URLs
    const url = new URL(s)
    if (url.pathname.startsWith("/api/media/")) return url.pathname
    if (url.pathname.startsWith("/media/")) return url.pathname.replace("/media/", "/api/media/")
    return s
  } catch {
    return u || undefined
  }
}

const viewCounters = new Map<string, number>()
const lastViewByIp: Map<string, number> = new Map()

router.get("/", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const includeLiked = Boolean(req.user)
  const items = await (prisma as any).byteSizeItem.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { likes: true } },
      ...(includeLiked ? { likes: { where: { userId: req.user!.id } } } : {}),
    } as any,
  })
  
  console.log('[ByteSize] Feed request - found items:', items.length)
  if (items.length > 0) {
    console.log('[ByteSize] Sample item:', {
      id: items[0].id,
      title: items[0].title,
      videoUrl: items[0].videoUrl,
      createdAt: items[0].createdAt
    })
  }
  
  const tag = (req.query.tag as string | undefined)?.trim()
  const filtered = tag && tag.toLowerCase() !== "all"
    ? items.filter((it: any) => Array.isArray(it.tags) && it.tags.some((t: string) => String(t).toLowerCase() === tag.toLowerCase()))
    : items
  
  const result = filtered.map((it: any) => {
    const rawTags = Array.isArray(it.tags) ? it.tags : []
    const publicTags = rawTags.filter((t: any) => !(typeof t === "string" && t.startsWith("__course:")))
    const normalizedVideoUrl = normalizeMediaUrl(it.videoUrl) || it.videoUrl
    const normalizedCoverUrl = normalizeMediaUrl(it.coverImageUrl) || it.coverImageUrl
    
    return {
      id: it.id,
      title: it.title,
      description: it.description,
      videoUrl: normalizedVideoUrl,
      coverImageUrl: normalizedCoverUrl,
      tags: publicTags,
      createdAt: it.createdAt,
      views: (it as any).views ?? viewCounters.get(it.id) ?? 0,
      likesCount: it._count?.likes ?? 0,
      likedByMe: Array.isArray(it.likes) ? it.likes.length > 0 : false,
    }
  })
  
  console.log('[ByteSize] Returning items:', result.length)
  res.json(result)
})

router.post("/:id/like", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id
  const existing = await (prisma as any).byteSizeLike.findUnique({ where: { itemId_userId: { itemId: id, userId: req.user!.id } } }).catch(
    () => null
  )
  if (existing) {
    await (prisma as any).byteSizeLike.delete({ where: { id: existing.id } })
  } else {
    await (prisma as any).byteSizeLike.create({ data: { itemId: id, userId: req.user!.id } })
  }
  const count = await (prisma as any).byteSizeLike.count({ where: { itemId: id } })
  const liked = !existing
  res.json({ liked, likesCount: count })
})

router.post("/:id/view", async (req: Request, res: Response) => {
  const id = req.params.id
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || (req.socket?.remoteAddress || "")
  const key = `${ip}|${id}`
  const now = Date.now()
  const last = lastViewByIp.get(key) || 0
  if (now - last < 60_000) return res.json({ ok: true, skipped: true })
  lastViewByIp.set(key, now)
  const updated = await (prisma as any).byteSizeItem.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => null)
  if (!updated) {
    viewCounters.set(id, (viewCounters.get(id) || 0) + 1)
  }
  res.json({ ok: true })
})
