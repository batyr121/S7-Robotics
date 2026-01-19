"use client"
import { useEffect, useRef, useState } from "react"
import { ArrowUpRight, Image as ImageIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { apiFetch, getTokens } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm"
import FileUpload from "@/components/kokonutui/file-upload"
import { AspectRatio } from "@/components/ui/aspect-ratio"

export default function Page() {
  const router = useRouter()
  const confirm = useConfirm()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const presets = ["Robotics", "Coding", "AI", "Design", "Education", "News", "Tips"]
  const [category, setCategory] = useState<string[]>(["Robotics"])
  const [newTag, setNewTag] = useState("")
  const [videoUrl, setVideoUrl] = useState<string>("")
  const [coverUrl, setCoverUrl] = useState<string>("")
  const [uploading, setUploading] = useState(false)
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  const ALLOWED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"]
  const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]

  useEffect(() => {
    try {
      const raw = localStorage.getItem("s7_admin_bytesize_draft")
      if (!raw) return
      const d = JSON.parse(raw)
      if (d.title) setTitle(d.title)
      if (d.description) setDescription(d.description)
      if (Array.isArray(d.category)) setCategory(d.category)
      if (d.videoUrl) setVideoUrl(d.videoUrl)
      if (d.coverUrl) setCoverUrl(d.coverUrl)
    } catch {}
  }, [])

  const [isPublishing, setIsPublishing] = useState(false)

  const uploadMedia = async (file: File): Promise<string> => {
    const tokens = getTokens()
    const fd = new FormData()
    fd.append("file", file)
    const tryEndpoints = ["/uploads/media", "/api/uploads/media"]
    let lastErr: any = null
    for (const ep of tryEndpoints) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)
      try {
        const res = await fetch(ep, {
          method: "POST",
          headers: tokens?.accessToken ? { authorization: `Bearer ${tokens.accessToken}` } : undefined,
          body: fd,
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        if (!res.ok) {
          const ct = res.headers.get("content-type") || ""
          if (ct.includes("application/json")) {
            const j = await res.json().catch(() => null)
            throw new Error(j?.error || `Upload failed (${res.status})`)
          }
          const t = await res.text().catch(() => "Upload failed")
          throw new Error(t || `Upload failed (${res.status})`)
        }
        const data = await res.json()
        const u = String(data.url || "")
        const path = u.startsWith("/media/") ? u.replace("/media/", "/api/media/") : u
        const abs = path.startsWith("http://") || path.startsWith("https://") ? path : new URL(path, window.location.origin).href
        return abs
      } catch (e) {
        clearTimeout(timeoutId)
        lastErr = e
      }
    }
    if (lastErr) {
      toast({ title: "Upload failed", description: lastErr?.message || "Failed to upload media", variant: "destructive" as any })
    }
    throw lastErr || new Error("Upload failed")
  }

  const publish = async () => {
    const ok = await confirm({
      title: "Publish ByteSize?",
      description: "This will publish the ByteSize item to the feed.",
      confirmText: "Publish",
      cancelText: "Cancel"
    })
    if (!ok) return
    setIsPublishing(true)
    try {
      const tags = Array.from(new Set([...(category || [])]))
      await apiFetch("/api/admin/bytesize", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          videoUrl,
          coverImageUrl: coverUrl || undefined,
          tags
        })
      })
      toast({ title: "ByteSize published" })
      try { localStorage.removeItem("s7_admin_bytesize_draft") } catch {}
      router.push("/admin/bytesize")
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to publish ByteSize", variant: "destructive" as any })
      setIsPublishing(false)
    }
  }

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--color-text-1)]">Create ByteSize</h2>
          <p className="text-sm text-[var(--color-text-3)]">Upload a short video, tag it, and publish.</p>
        </div>
      </div>

      <div className="max-w-3xl space-y-6">
        <div className="card p-4">
          <div className="rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border-1)] min-h-[320px] flex items-center justify-center text-[var(--color-text-1)] relative overflow-hidden p-4">
            {videoUrl ? (
              <AspectRatio ratio={16 / 9} className="w-full">
                <video src={videoUrl} controls className="w-full h-full object-contain" />
              </AspectRatio>
            ) : (
              <FileUpload
                className="w-full"
                acceptedFileTypes={["video/mp4", "video/webm", "video/quicktime"]}
                uploadDelay={800}
                onUploadSuccess={async (f) => {
                  if (f.type && !ALLOWED_VIDEO_TYPES.includes(f.type)) {
                    toast({ title: "Unsupported video type", description: "Supported: MP4, WebM, MOV", variant: "destructive" as any })
                    return
                  }
                  setUploading(true)
                  try {
                    const url = await uploadMedia(f)
                    setVideoUrl(url)
                    toast({ title: "Video uploaded" })
                  } catch (e: any) {
                    toast({ title: "Error", description: e?.message || "Failed to upload video", variant: "destructive" as any })
                  } finally {
                    setUploading(false)
                  }
                }}
                onUploadError={(err) => toast({ title: "Error", description: err.message, variant: "destructive" as any })}
              />
            )}
          </div>

          <div className="mt-4">
            <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              if (f.type && !ALLOWED_COVER_TYPES.includes(f.type)) {
                toast({ title: "Unsupported image type", description: "Supported: JPG, PNG, WEBP", variant: "destructive" as any })
                return
              }
              setUploading(true)
              try {
                const url = await uploadMedia(f)
                setCoverUrl(url)
                toast({ title: "Cover uploaded" })
              } catch (e: any) {
                toast({ title: "Error", description: e?.message || "Failed to upload cover", variant: "destructive" as any })
              } finally {
                setUploading(false)
              }
            }} />
            <button type="button" onClick={() => coverInputRef.current?.click()} className="inline-flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)]">
              <ImageIcon className="w-4 h-4" /> Upload cover image
            </button>
          </div>
        </div>

        <div className="card p-4 space-y-4">
          <div>
            <label className="block text-sm text-[var(--color-text-3)] mb-2">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ByteSize title"
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-3 py-2 outline-none text-[var(--color-text-1)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-3)] mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-3 py-2 outline-none text-[var(--color-text-1)] min-h-28"
            />
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <div className="text-[var(--color-text-2)]">Tags</div>
          <div className="flex flex-wrap gap-2">
            {presets.map((t) => {
              const active = category.includes(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCategory((prev) => active ? prev.filter(x => x !== t) : [...prev, t])}
                  className={`text-xs font-medium px-3 py-1 rounded-full border ${active ? "bg-[#00a3ff] text-white border-[#00a3ff]" : "bg-transparent text-[var(--color-text-2)] border-[var(--color-border-1)]"}`}
                >
                  {t}
                </button>
              )
            })}
          </div>
          {category.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {category.map((t) => (
                <span key={t} className="inline-flex items-center gap-2 text-xs bg-[#00a3ff] text-white rounded-full px-3 py-1">
                  {t}
                  <button onClick={() => setCategory((prev) => prev.filter(x => x !== t))} className="text-white/80 hover:text-white">x</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add custom tag" className="flex-1 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-3 py-2 outline-none text-[var(--color-text-1)]" />
            <button type="button" onClick={() => {
              const v = newTag.trim()
              if (!v) return
              if (!category.includes(v)) setCategory(prev => [...prev, v])
              setNewTag("")
            }} className="px-3 py-2 rounded-lg bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-1)]">Add</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              try { localStorage.setItem("s7_admin_bytesize_draft", JSON.stringify({ title, description, category, videoUrl, coverUrl })) } catch {}
              toast({ title: "Draft saved" })
            }}
            className="rounded-2xl bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-1)] font-medium py-4 transition-colors"
          >
            Save draft
          </button>
          <button
            disabled={uploading || isPublishing || !videoUrl || !title.trim()}
            onClick={publish}
            className="rounded-2xl bg-[#00a3ff] hover:bg-[#0088cc] disabled:opacity-60 text-black font-medium py-4 flex items-center justify-center gap-2 transition-colors"
          >
            {isPublishing ? "Publishing..." : "Publish"}
            {!isPublishing && <ArrowUpRight className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </main>
  )
}
