"use client"
import { useEffect, useRef, useState } from "react"
import { ArrowUpRight, Upload, Image, BookOpen, ChevronDown, Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { apiFetch, getTokens } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm"
import FileUpload from "@/components/kokonutui/file-upload"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([])
  const [linkedCourseId, setLinkedCourseId] = useState<string | null>(null)

  const ALLOWED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"]
  const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]

  useEffect(() => {
    try {
      const raw = localStorage.getItem('s7_admin_bytesize_draft')
      if (!raw) return
      const d = JSON.parse(raw)
      if (d.title) setTitle(d.title)
      if (d.description) setDescription(d.description)
      if (Array.isArray(d.category)) setCategory(d.category)
      if (d.videoUrl) setVideoUrl(d.videoUrl)
      if (d.coverUrl) setCoverUrl(d.coverUrl)
      if (d.linkedCourseId) setLinkedCourseId(d.linkedCourseId)
    } catch {}
  }, [])

  useEffect(() => {
    apiFetch<any[]>("/courses")
      .then((list)=>{
        const m = (list||[]).map((c:any)=>({ id: c.id, title: c.title }))
        setCourses(m)
      })
      .catch(()=>setCourses([]))
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
        const path = u.startsWith('/media/') ? u.replace('/media/', '/api/media/') : u
        const abs = path.startsWith("http://") || path.startsWith("https://") ? path : new URL(path, window.location.origin).href
        return abs
      } catch (e) {
        clearTimeout(timeoutId)
        lastErr = e
      }
    }
    // Отображаем ошибку пользователю
    if (lastErr) {
      toast({ title: "Ошибка загрузки", description: lastErr?.message || "Не удалось загрузить файл", variant: "destructive" as any })
    }
    throw lastErr || new Error("Upload failed")
  }

  const publish = async () => {
    const ok = await confirm({ 
      title: 'Опубликовать Bytesize?', 
      description: 'Вы уверены, что хотите опубликовать этот Bytesize? После публикации он станет доступен всем пользователям.',
      confirmText: 'Опубликовать', 
      cancelText: 'Отмена'
    })
    if (!ok) return
    setIsPublishing(true)
    try {
      const tags = Array.from(new Set([...(category||[]), ...(linkedCourseId ? [`__course:${linkedCourseId}`] : [])]))
      await apiFetch("/api/admin/bytesize", { method: "POST", body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined, videoUrl, coverImageUrl: coverUrl || undefined, tags }) })
      toast({ title: "Bytesize опубликован" })
      try { localStorage.removeItem('s7_admin_bytesize_draft') } catch {}
      router.push("/admin/bytesize")
    } catch(e:any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось опубликовать", variant: "destructive" as any })
      setIsPublishing(false)
    }
  }

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
      <h2 className="text-white text-xl font-medium mb-6">Byte Size</h2>

      <div className="max-w-3xl space-y-6">
        
        <div className="rounded-3xl border-2 border-[#2a2a35] p-3">
          <div className="rounded-2xl bg-[#0f0f14] border border-[#2a2a35] min-h-[360px] flex items-center justify-center text-white relative overflow-hidden p-4">
            {videoUrl ? (
              <AspectRatio ratio={16/9} className="w-full">
                <video src={videoUrl} controls className="w-full h-full object-contain" />
              </AspectRatio>
            ) : (
              <FileUpload
                className="w-full"
                acceptedFileTypes={["video/mp4","video/webm","video/quicktime"]}
                uploadDelay={800}
                onUploadSuccess={async (f)=>{
                  if (f.type && !ALLOWED_VIDEO_TYPES.includes(f.type)) {
                    toast({ title: "Неподдерживаемый формат видео", description: "Разрешены: MP4, WebM, MOV", variant: "destructive" as any })
                    return
                  }
                  setUploading(true)
                  try { const url = await uploadMedia(f); setVideoUrl(url); toast({ title: "Видео загружено" }) } catch(e:any){ toast({ title: "Ошибка", description: e?.message||"Не удалось загрузить", variant: "destructive" as any }) } finally { setUploading(false) }
                }}
                onUploadError={(err)=> toast({ title: "Ошибка", description: err.message, variant: "destructive" as any })}
              />
            )}
          </div>

        
        <div className="bg-[#16161c] border border-[#2a2a35] rounded-2xl px-4 py-4 text-white">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4" />
            <div className="text-white/80">Переход к курсу (по свайпу/копке)</div>
          </div>
          <Select value={linkedCourseId || "none"} onValueChange={(v)=> setLinkedCourseId(v==="none" ? null : v)}>
            <SelectTrigger className="w-full bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2.5 text-white hover:border-[#00a3ff]/50 transition-all duration-200 focus:border-[#00a3ff] focus:ring-2 focus:ring-[#00a3ff]/20">
              <SelectValue>
                {linkedCourseId ? (
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-[#00a3ff]" />
                    <span>{courses.find(c=>c.id===linkedCourseId)?.title || "Курс выбран"}</span>
                  </div>
                ) : (
                  <span className="text-white/60">Ничего — просто короткое видео</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-[#16161c] border border-[#2a2a35] rounded-xl shadow-2xl overflow-hidden">
              <SelectItem value="none" className="text-white/80 hover:bg-[#2a2a35] hover:text-white cursor-pointer transition-colors rounded-lg mx-1 my-0.5">
                <span className="flex items-center gap-2">
                  <span className="text-white/60">Ничего — просто короткое видео</span>
                </span>
              </SelectItem>
              {courses.length > 0 && <div className="h-px bg-[#2a2a35] my-1" />}
              {courses.map((c)=> (
                <SelectItem key={c.id} value={c.id} className="text-white/80 hover:bg-[#2a2a35] hover:text-white cursor-pointer transition-colors rounded-lg mx-1 my-0.5">
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-[#00a3ff]" />
                    <span>{c.title}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
          <div className="flex gap-2 mt-3">
            <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e)=>{
              const f = e.target.files?.[0]; if(!f) return;
              if (f.type && !ALLOWED_COVER_TYPES.includes(f.type)) {
                toast({ title: "Неподдерживаемый формат обложки", description: "Разрешены: JPG, PNG, WEBP", variant: "destructive" as any });
                return;
              }
              setUploading(true);
              try { const url = await uploadMedia(f); setCoverUrl(url); toast({ title: "Обложка загружена" }); } catch(e:any){ toast({ title: "Ошибка", description: e?.message||"Не удалось загрузить", variant: "destructive" as any }) } finally { setUploading(false) }
            }} />
            <button type="button" onClick={()=>coverInputRef.current?.click()} className="inline-flex items-center gap-2 px-3 py-2 bg-[#16161c] border border-[#2a2a35] rounded-lg text-white">
              <Image className="w-4 h-4" /> Обложка
            </button>
          </div>
        </div>

        
        <div className="bg-[#16161c] border border-[#2a2a35] rounded-2xl px-4 py-3 text-white">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название видео"
            className="w-full bg-transparent outline-none text-white"
          />
        </div>

        
        <div className="bg-[#16161c] border border-[#2a2a35] rounded-2xl px-4 py-3 text-white">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Описание (необязательно)"
            className="w-full bg-transparent outline-none text-white min-h-28"
          />
        </div>

        
        <div className="bg-[#16161c] border border-[#2a2a35] rounded-2xl px-4 py-4 text-white">
          <div className="text-white/80 mb-2">Категории</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {presets.map((t) => {
              const active = category.includes(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCategory((prev)=> active ? prev.filter(x=>x!==t) : [...prev, t])}
                  className={`text-xs font-medium px-3 py-1 rounded-full border ${active ? 'bg-[#00a3ff] text-white border-[#00a3ff]' : 'bg-transparent text-white/80 border-[#2a2a35]'}`}
                >
                  {t}
                </button>
              )
            })}
          </div>
          {category.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {category.map((t) => (
                <span key={t} className="inline-flex items-center gap-2 text-xs bg-[#00a3ff] text-white rounded-full px-3 py-1">
                  {t}
                  <button onClick={()=>setCategory((prev)=>prev.filter(x=>x!==t))} className="text-white/80 hover:text-white">Г—</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input value={newTag} onChange={(e)=>setNewTag(e.target.value)} placeholder="Новая категория" className="flex-1 bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2 outline-none" />
            <button type="button" onClick={()=>{ const v = newTag.trim(); if(!v) return; if(!category.includes(v)) setCategory(prev=>[...prev, v]); setNewTag('') }} className="px-3 py-2 rounded-lg bg-[#2a2a35] hover:bg-[#333344]">Добавить</button>
          </div>
        </div>

        
        <div className="pt-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                try { localStorage.setItem('s7_admin_bytesize_draft', JSON.stringify({ title, description, category, videoUrl, coverUrl, linkedCourseId })) } catch {}
                toast({ title: 'Черновик сохранен' })
              }}
              className="rounded-2xl bg-[#2a2a35] hover:bg-[#333344] text-white font-medium py-4 transition-colors"
            >
              Сохранить черновик
            </button>
            <button
              disabled={uploading || isPublishing || !videoUrl || !title.trim()}
              onClick={publish}
              className="rounded-2xl bg-[#00a3ff] hover:bg-[#0088cc] disabled:opacity-60 text-black font-medium py-4 flex items-center justify-center gap-2 transition-colors"
            >
              {isPublishing ? "Публикация..." : "Опубликовать"}
              {!isPublishing && <ArrowUpRight className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

