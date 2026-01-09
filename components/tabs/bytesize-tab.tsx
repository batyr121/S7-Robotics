"use client"
import { useEffect, useRef, useState } from "react"
import { Heart, Share2, ArrowUpRight } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { useAuth } from "@/components/auth/auth-context"
import { toast } from "@/hooks/use-toast"

interface ReelItem {
  id: string
  title: string
  description?: string
  videoUrl: string
  coverImageUrl?: string
  likesCount: number
  likedByMe: boolean
  linkedCourseId?: string
}

function resolveMediaUrl(u?: string | null): string {
  try {
    const s = String(u || "").trim()
    if (!s) return ""
    if (s.startsWith("http://") || s.startsWith("https://")) {
      try {
        const url = new URL(s)
        if (url.pathname.startsWith("/media/")) {
          return new URL(url.pathname.replace("/media/", "/api/media/"), window.location.origin).href
        }
        return s
      } catch {
        return s
      }
    }
    const path = s.startsWith("/media/") ? s.replace("/media/", "/api/media/") : s
    return new URL(path, window.location.origin).href
  } catch {
    return String(u || "")
  }
}

export default function ByteSizeTab() {
  const { user } = useAuth()
  const [items, setItems] = useState<ReelItem[]>([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  const viewedRef = useRef<Set<string>>(new Set())
  const startRef = useRef<{ x: number; y: number; id?: string } | null>(null)
  const [swipeOutId, setSwipeOutId] = useState<string | null>(null)

  const share = async (it: ReelItem) => {
    try {
      const url = resolveMediaUrl(it.videoUrl)
      if (navigator.share) {
        await navigator.share({ title: it.title, text: it.description || it.title, url })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        toast({ title: "Link copied to clipboard" })
      }
    } catch { }
  }

  useEffect(() => {
    apiFetch<ReelItem[]>("/bytesize")
      .then((list) => {
        setItems(list || [])
      })
      .catch(() => {
        setItems([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).dataset.reelId
          if (!id) return
          const video = videoRefs.current[id]
          if (!video) return
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            video.play().catch(() => {})
            if (!viewedRef.current.has(id)) {
              viewedRef.current.add(id)
              fetch(`/bytesize/${id}/view`, { method: "POST" }).catch(() => {})
            }
          } else {
            video.pause()
          }
        })
      },
      { root: containerRef.current, threshold: [0.6] }
    )
    const nodes = containerRef.current.querySelectorAll("[data-reel-id]")
    nodes.forEach((n) => observer.observe(n))
    return () => observer.disconnect()
  }, [items.length])

  const toggleLike = async (id: string) => {
    if (!user) {
      toast({ title: "Please sign in", description: "Sign in to like videos." })
      return
    }
    try {
      const res = await apiFetch<{ liked: boolean; likesCount: number }>(`/bytesize/${id}/like`, { method: "POST" })
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, likedByMe: res.liked, likesCount: res.likesCount } : it)))
    } catch (e: any) {
      toast({ title: "Unable to like", description: e?.message || "Please try again.", variant: "destructive" as any })
    }
  }

  const openCourse = (courseId?: string) => {
    if (!courseId) return
    try {
      window.dispatchEvent(new CustomEvent("s7-open-course", { detail: { courseId } }))
    } catch { }
  }

  if (loading) {
    return <div className="flex-1 p-8 text-white/70">Loading ByteSize...</div>
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 p-8">
        <div className="text-center text-white/70 bg-[#16161c] border border-[#636370]/20 rounded-2xl p-10">
          No videos yet.
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 h-[calc(100vh-120px)]" ref={containerRef}>
      <div className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar">
        {items.map((it) => (
          <div key={it.id} data-reel-id={it.id} className="snap-start h-[calc(100vh-120px)] flex items-center justify-center">
            <div
              className={`relative w-full max-w-[420px] aspect-[9/16] bg-black rounded-xl overflow-hidden border border-[#2a2a35] transition-transform duration-200 ${swipeOutId === it.id ? "translate-x-full opacity-0" : ""}`}
              onPointerDown={(e) => { startRef.current = { x: e.clientX, y: e.clientY, id: it.id } }}
              onPointerUp={(e) => {
                const s = startRef.current; startRef.current = null
                if (!s || s.id !== it.id) return
                const dx = e.clientX - s.x; const dy = e.clientY - s.y
                if (dx > 80 && Math.abs(dx) > Math.abs(dy) && it.linkedCourseId) {
                  setSwipeOutId(it.id)
                  setTimeout(() => { setSwipeOutId(null); openCourse(it.linkedCourseId) }, 180)
                }
              }}
            >
              <video
                ref={(el) => { videoRefs.current[it.id] = el }}
                src={resolveMediaUrl(it.videoUrl)}
                poster={resolveMediaUrl(it.coverImageUrl)}
                controls={false}
                playsInline
                loop
                className="w-full h-full object-cover"
                preload="metadata"
                crossOrigin="anonymous"
              />
              <div className="absolute left-0 right-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pb-3">
                <div className="text-white font-semibold text-base leading-tight mb-1">{it.title}</div>
                {it.description && <div className="text-white/70 text-xs leading-snug mb-2">{it.description}</div>}
                {it.linkedCourseId && (
                  <button
                    onClick={() => openCourse(it.linkedCourseId)}
                    className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 text-xs text-white/90 hover:text-white transition-colors"
                  >
                    <span className="text-[10px] leading-none">Open<br />course</span>
                    <div className="w-8 h-8 rounded-full bg-[#00a3ff] hover:bg-[#0099ee] flex items-center justify-center transition-colors">
                      <ArrowUpRight className="w-4 h-4 text-black" />
                    </div>
                  </button>
                )}
              </div>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-3">
                <button
                  onClick={() => toggleLike(it.id)}
                  className={`w-11 h-11 rounded-full flex flex-col items-center justify-center transition-all ${it.likedByMe ? "bg-red-500/20" : "bg-black/30 hover:bg-black/50"}`}
                  aria-label="Like"
                >
                  <Heart className={`w-6 h-6 ${it.likedByMe ? "text-red-500 fill-red-500" : "text-white"}`} />
                  <span className="text-white text-[10px] font-medium mt-0.5">{it.likesCount}</span>
                </button>
                <button
                  onClick={() => share(it)}
                  className="w-11 h-11 rounded-full flex items-center justify-center bg-black/30 hover:bg-black/50 transition-all"
                  aria-label="Share"
                >
                  <Share2 className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
