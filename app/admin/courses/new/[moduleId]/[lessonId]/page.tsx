"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Image, Upload, Trash, Bold, Italic, Heading2, List } from "lucide-react"
import dynamic from "next/dynamic"
import { saveFile, deleteFile, getObjectUrl, getFile } from "@/lib/s7media"
import { toast } from "@/hooks/use-toast"
import { apiFetch, getTokens } from "@/lib/api"
import FileUpload from "@/components/kokonutui/file-upload"
import { AspectRatio } from "@/components/ui/aspect-ratio"
const ReactMarkdown = dynamic(() => import("react-markdown").then((m) => m.default as any), { ssr: false }) as any

interface DraftLesson {
  id: number
  title: string
  time?: string
  slides?: string[]
  videoName?: string
  remoteId?: string
  content?: string
  presentationFileName?: string
  videoMediaId?: string
  slideMediaIds?: string[]
  presentationMediaId?: string
  videoUrl?: string
  presentationUrl?: string
  slideUrls?: string[]
  quizQuestion?: string
  quizOptions?: string[]
  quizCorrectIndex?: number
  quizXp?: number
}

interface DraftModule {
  id: number
  title: string
  remoteId?: string
  lessons: DraftLesson[]
}

interface DraftCourse {
  title: string
  author: string
  modules: DraftModule[]
}

function readDraftBy(key: string): DraftCourse | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function writeDraftBy(key: string, d: DraftCourse) {
  try { localStorage.setItem(key, JSON.stringify(d)) } catch {}
}

export default function Page() {
  const params = useParams<{ moduleId: string; lessonId: string }>()
  const search = useSearchParams()
  const moduleId = useMemo(() => Number(params.moduleId), [params.moduleId])
  const lessonId = useMemo(() => Number(params.lessonId), [params.lessonId])
  const router = useRouter()
  const editId = search.get("edit")

  const [course, setCourse] = useState<DraftCourse | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const slideInput = useRef<HTMLInputElement | null>(null)
  const presentationInput = useRef<HTMLInputElement | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [slidePreviews, setSlidePreviews] = useState<string[]>([])
  const [presPreview, setPresPreview] = useState<string | null>(null)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const draftKey = useMemo(() => {
    const d = search.get("draft")
    return d ? `s7_admin_course_draft_${d}` : "s7_admin_course_draft"
  }, [search])

  const qs = useMemo(() => {
    const d = search.get("draft")
    const e = search.get("edit")
    const params = new URLSearchParams()
    if (d) params.set("draft", d)
    if (e) params.set("edit", e)
    const s = params.toString()
    return s ? `?${s}` : ""
  }, [search])

  useEffect(() => {
    const d = readDraftBy(draftKey)
    if (d) setCourse(d)
    else {
      try {
        const raw = localStorage.getItem("s7_admin_course_draft")
        const fallback = raw ? JSON.parse(raw) : null
        if (fallback) setCourse(fallback)
      } catch {}
    }
    setHydrated(true)
  }, [draftKey])

  useEffect(() => {
    const d = search.get("draft")
    if (!d && typeof window !== 'undefined') {
      const stored = localStorage.getItem("s7_admin_course_default_id")
      const generated = stored || `s7-${(typeof crypto !== 'undefined' && crypto.getRandomValues ? Array.from(crypto.getRandomValues(new Uint32Array(2))).map(n=>n.toString().padStart(10,'0')).join('').slice(0,10) : `${Math.floor(1000000000 + Math.random()*9000000000)}`)}`
      if (!stored) localStorage.setItem("s7_admin_course_default_id", generated)
      const e = search.get('edit')
      router.replace(`/admin/courses/new/${moduleId}/${lessonId}?draft=${encodeURIComponent(generated)}${e?`&edit=${encodeURIComponent(e)}`:''}`)
    }
  }, [search, moduleId, lessonId, router])

  useEffect(() => {
    if (!hydrated || !moduleId || !lessonId) return
    if (course == null) {
      const draft: DraftCourse = {
        title: "",
        author: "",
        modules: [
          { id: moduleId, title: `Модуль ${moduleId}`, lessons: [{ id: lessonId, title: "Название урока", time: "" }] },
        ],
      }
      setCourse(draft)
      writeDraftBy(draftKey, draft)
      return
    }
    const mod = course.modules.find((m) => m.id === moduleId)
    if (!mod) {
      const next: DraftCourse = {
        ...course,
        modules: [...course.modules, { id: moduleId, title: `Модуль ${moduleId}`, lessons: [{ id: lessonId, title: "Название урока", time: "" }] }],
      }
      setCourse(next)
      writeDraftBy(draftKey, next)
      return
    }
    if (!mod.lessons.find((l) => l.id === lessonId)) {
      const newModules = course.modules.map((m) => (m.id === moduleId ? { ...m, lessons: [...m.lessons, { id: lessonId, title: "Название урока", time: "" }] } : m))
      const next: DraftCourse = { ...course, modules: newModules }
      setCourse(next)
      writeDraftBy(draftKey, next)
    }
  }, [hydrated, course, moduleId, lessonId, draftKey])

  const module = course?.modules?.find((m) => m.id === moduleId)
  const lessonIndex = module?.lessons?.findIndex((l) => l.id === lessonId) ?? -1
  const lesson = lessonIndex >= 0 && module ? module.lessons[lessonIndex] : undefined

  const updateLesson = (patch: Partial<DraftLesson>) => {
    if (!course || !module || lessonIndex < 0) return
    const newModules = course.modules.map((m) =>
      m.id === module.id
        ? {
            ...m,
            lessons: m.lessons.map((l, idx) => (idx === lessonIndex ? { ...l, ...patch } : l)),
          }
        : m
    )
    const next = { ...course, modules: newModules }
    setCourse(next)
    writeDraftBy(draftKey, next)
    scheduleAutosave()
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!lesson) return
      if (lesson.videoMediaId) {
        const u = await getObjectUrl(lesson.videoMediaId)
        if (alive) setVideoPreview(u)
      } else setVideoPreview(null)
      if (Array.isArray(lesson.slideMediaIds) && lesson.slideMediaIds.length) {
        const urls = await Promise.all(lesson.slideMediaIds.map((id) => getObjectUrl(id)))
        if (alive) setSlidePreviews((urls.filter(Boolean) as string[]))
      } else setSlidePreviews([])
      if (lesson.presentationMediaId) {
        const u = await getObjectUrl(lesson.presentationMediaId)
        if (alive) setPresPreview(u)
      } else setPresPreview(null)
    })()
    return () => { alive = false }
  }, [lesson?.videoMediaId, lesson?.slideMediaIds, lesson?.presentationMediaId])

  const uploadById = async (mediaId: string): Promise<string> => {
    const rec = await getFile(mediaId)
    if (!rec) throw new Error("Файл не найден")
    const fd = new FormData()
    const file = new File([rec.blob], rec.name, { type: rec.type })
    fd.append("file", file)
    const tokens = getTokens()
    const tryEndpoints = ["/uploads/media", "/api/uploads/media"]
    let lastErr: any = null
    for (const ep of tryEndpoints) {
      try {
        const res = await fetch(ep, { method: "POST", headers: tokens?.accessToken ? { authorization: `Bearer ${tokens.accessToken}` } : undefined, body: fd })
        if (!res.ok) {
          const text = await res.text().catch(() => "Upload failed")
          throw new Error(text || `Upload failed (${res.status})`)
        }
        const data = await res.json()
        const u = String(data.url || "")
        const abs = u.startsWith("http://") || u.startsWith("https://") ? u : new URL(u, window.location.origin).href
        return abs
      } catch (e) { lastErr = e }
    }
    throw lastErr || new Error("Upload failed")
  }

  const saveLessonDraft = async (goBack?: boolean) => {
    if (!course) return
    try {
      writeDraftBy(draftKey, course)
      toast({ title: "Сохранено", description: "Урок сохранён в черновик" } as any)
      await persistToServer()
      try {
        const cid = editId || (typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem("s7_admin_course_draft") || '{}') as any)?.courseId : '')
        const text = (lesson?.quizQuestion || '').trim()
        const opts = Array.isArray(lesson?.quizOptions) ? (lesson!.quizOptions as string[]).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()) : []
        const correctIndex = typeof lesson?.quizCorrectIndex === 'number' ? (lesson!.quizCorrectIndex as number) : -1
        const xpReward = typeof lesson?.quizXp === 'number' ? (lesson!.quizXp as number) : 100
        if (cid && text && opts.length >= 2 && correctIndex >= 0 && correctIndex < opts.length) {
          try {
            const courseData = await apiFetch<any>(`/api/admin-courses/${encodeURIComponent(cid)}`)
            const modIdx = Number(moduleId)
            const lesIdx = Number(lessonId)
            const targetModule = (courseData.modules || []).find((m: any) => Number(m.orderIndex) === Number(modIdx - 1)) || (courseData.modules || [])[modIdx - 1]
            const targetLesson = targetModule ? ((targetModule.lessons || []).find((l: any) => Number(l.orderIndex) === Number(lesIdx - 1)) || (targetModule.lessons || [])[lesIdx - 1]) : null
            if (targetModule && targetLesson) {
              await apiFetch(`/api/admin-courses/lessons/${targetLesson.id}/questions`, { method: 'POST', body: JSON.stringify({ text, options: opts, correctIndex, xpReward, moduleId: targetModule.id, lessonId: targetLesson.id }) })
              toast({ title: 'Вопрос сохранен', description: 'Вопрос успешно добавлен к уроку' } as any)
            }
          } catch {}
        }
      } catch {}
      if (goBack) router.push(`/admin/courses/new/${moduleId}${qs}`)
    } catch {}
  }

  const onSelectVideo = async (file: File) => {
    const meta = await saveFile("video", file)
    updateLesson({ videoName: file.name, videoMediaId: meta.id })
    
    // Automatically upload to server in the background
    toast({ title: "Загрузка видео...", description: "Видео загружается на сервер" } as any)
    try {
      const url = await uploadById(meta.id)
      updateLesson({ videoUrl: url })
      toast({ title: "Видео загружено", description: "Видео успешно загружено на сервер" } as any)
    } catch (e: any) {
      console.warn("Auto-upload failed:", e?.message)
      toast({ title: "Ошибка автозагрузки", description: "Используйте кнопку 'Загрузить на сервер'", variant: "destructive" as any })
    }
  }

  const onAddSlide = async (file: File) => {
    const meta = await saveFile("slide", file)
    const s = [...(lesson?.slides || []), file.name]
    const ids = [...(lesson?.slideMediaIds || []), meta.id]
    updateLesson({ slides: s, slideMediaIds: ids })
    
    // Automatically upload to server in the background
    try {
      const url = await uploadById(meta.id)
      const currentUrls = lesson?.slideUrls || []
      updateLesson({ slideUrls: [...currentUrls, url] })
    } catch (e: any) {
      console.warn("Auto-upload failed:", e?.message)
    }
  }

  const onSelectPresentation = async (file: File) => {
    const meta = await saveFile("presentation", file)
    updateLesson({ presentationFileName: file.name, presentationMediaId: meta.id })
    
    // Automatically upload to server in the background
    try {
      const url = await uploadById(meta.id)
      updateLesson({ presentationUrl: url })
      toast({ title: "Презентация загружена" } as any)
    } catch (e: any) {
      console.warn("Auto-upload failed:", e?.message)
    }
  }

  const removeSlideAt = async (idx: number) => {
    if (!lesson) return
    const names = [...(lesson.slides || [])]
    const ids = [...(lesson.slideMediaIds || [])]
    const removedId = ids[idx]
    names.splice(idx, 1)
    ids.splice(idx, 1)
    updateLesson({ slides: names, slideMediaIds: ids })
    if (removedId) try { await deleteFile(removedId) } catch {}
  }

  const removePresentation = async () => {
    if (!lesson) return
    const id = lesson.presentationMediaId
    updateLesson({ presentationFileName: "", presentationMediaId: undefined })
    if (id) try { await deleteFile(id) } catch {}
  }

  const removeVideo = async () => {
    if (!lesson) return
    const id = lesson.videoMediaId
    updateLesson({ videoName: "", videoMediaId: undefined, videoUrl: undefined })
    if (id) try { await deleteFile(id) } catch {}
  }

  const uploadVideoToServer = async () => {
    if (!lesson?.videoMediaId) return
    try {
      const url = await uploadById(lesson.videoMediaId)
      updateLesson({ videoUrl: url })
      toast({ title: "Видео загружено на сервер" } as any)
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось загрузить", variant: "destructive" as any })
    }
  }
  const uploadPresentationToServer = async () => {
    if (!lesson?.presentationMediaId) return
    try {
      const url = await uploadById(lesson.presentationMediaId)
      updateLesson({ presentationUrl: url })
      toast({ title: "Презентация загружена" } as any)
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось загрузить", variant: "destructive" as any })
    }
  }
  const uploadSlidesToServer = async () => {
    if (!lesson?.slideMediaIds || lesson.slideMediaIds.length === 0) return
    try {
      const urls: string[] = []
      for (const id of lesson.slideMediaIds) {
        const url = await uploadById(id)
        urls.push(url)
      }
      updateLesson({ slideUrls: urls })
      toast({ title: "Слайды загружены" } as any)
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось загрузить", variant: "destructive" as any })
    }
  }

  // Build payload from current draft for server persistence
  const buildPayload = (dc: DraftCourse) => {
    const mods = (dc.modules || []).map((m, mi) => ({
      ...(typeof (m as any).remoteId === 'string' && (m as any).remoteId ? { id: (m as any).remoteId } : {}),
      title: m.title || `Модуль ${mi + 1}`,
      orderIndex: mi,
      lessons: (m.lessons || []).map((l, li) => ({
        ...(typeof (l as any).remoteId === 'string' && (l as any).remoteId ? { id: (l as any).remoteId } : {}),
        title: l.title || `Урок ${li + 1}`,
        duration: l.time || undefined,
        orderIndex: li,
        isFreePreview: false,
        content: l.content || undefined,
        contentType: "text",
        videoUrl: l.videoUrl || undefined,
        presentationUrl: l.presentationUrl || undefined,
        slides: Array.isArray(l.slideUrls) && l.slideUrls.length ? l.slideUrls.map((u: string) => ({ url: u })) : undefined,
      }))
    }))
    return {
      title: (dc.title || "Черновик").trim() || "Черновик",
      description: (dc.title || "Черновик").trim() || "Черновик",
      difficulty: "Легкий",
      price: 0,
      isFree: true,
      isPublished: false,
      modules: mods,
    }
  }

  const persistToServer = async () => {
    try {
      const raw = readDraftBy(draftKey)
      if (!raw) return
      const payload = buildPayload(raw)
      if (editId) {
        await apiFetch(`/api/admin/courses/${encodeURIComponent(editId)}?sync=ids`, { method: 'PUT', body: JSON.stringify(payload) })
      } else {
        const created = await apiFetch<any>(`/api/admin/courses`, { method: 'POST', body: JSON.stringify(payload) })
        if (created?.id) {
          const qs2 = new URLSearchParams(search.toString())
          qs2.set('edit', created.id)
          router.replace(`/admin/courses/new/${moduleId}/${lessonId}?${qs2.toString()}`)
        }
      }
    } catch {}
  }

  const scheduleAutosave = () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => { void persistToServer() }, 900)
  }

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
      <div className="mb-4">
        <button
          onClick={() => { if (course) { try { writeDraftBy(draftKey, course) } catch {} } router.push(`/admin/courses/new/${moduleId}${qs}`) }}
          className="inline-flex items-center gap-2 text-[var(--color-text-2)] hover:text-[var(--color-text-1)] px-3 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border-2)]"
        >
          Назад
        </button>
      </div>
      <h2 className="text-[var(--color-text-1)] text-xl font-medium mb-6">Создать курс</h2>

      <div className="max-w-6xl space-y-5">
        
        <div className="flex items-center justify-between rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border-2)] px-4 py-3 text-[var(--color-text-1)]">
          <div className="flex items-center gap-3 w-full">
            <span className="w-8 h-8 rounded-full bg-[var(--color-accent-warm)] text-black flex items-center justify-center font-semibold">{lesson?.id ?? 1}</span>
            <input
              value={lesson?.title || ""}
              onChange={(e) => updateLesson({ title: e.target.value })}
              placeholder="Название урока"
              className="flex-1 bg-transparent outline-none text-[var(--color-text-2)]"
            />
          </div>
          <input
            value={lesson?.time || ""}
            onChange={(e) => updateLesson({ time: e.target.value })}
            placeholder="Время курса"
            className="w-32 text-right bg-transparent outline-none text-[var(--color-text-3)]"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        
          <section>
            <div className="rounded-3xl border-2 border-[var(--color-border-2)] p-3">
              <div className="rounded-2xl bg-[var(--color-surface-3)] border border-[var(--color-border-2)] min-h-[320px] flex items-center justify-center text-[var(--color-text-1)] overflow-hidden p-4">
                {!lesson?.videoMediaId ? (
                  <FileUpload
                    className="w-full"
                    acceptedFileTypes={["video/*"]}
                    uploadDelay={600}
                    onUploadSuccess={(f) => onSelectVideo(f)}
                    onUploadError={(err) => toast({ title: "Ошибка", description: err.message, variant: "destructive" as any })}
                  />
                ) : (
                  <AspectRatio ratio={16/9} className="w-full">
                    <video src={videoPreview || undefined} controls className="w-full h-full object-contain bg-black" />
                  </AspectRatio>
                )}
              </div>
              {lesson?.videoMediaId && (
                <div className="flex items-center justify-end gap-3 mt-3">
                  <button onClick={() => fileInput.current?.click()} className="rounded-full bg-[var(--color-border-2)] hover:bg-[var(--color-border-hover-1)] px-3 py-1 text-[var(--color-text-2)] text-sm">Заменить</button>
                  <input ref={fileInput} type="file" accept="video/*" onChange={(e)=>{ const f=e.target.files?.[0]; if(f) onSelectVideo(f) }} className="hidden" />
                  <button onClick={uploadVideoToServer} className="rounded-full bg-[var(--color-border-2)] hover:bg-[var(--color-border-hover-1)] px-3 py-1 text-[var(--color-text-2)] text-sm">Загрузить на сервер</button>
                  {lesson.videoUrl && <a href={lesson.videoUrl} target="_blank" className="text-xs text-[var(--color-accent-warm)] underline">Открыть URL</a>}
                  <button onClick={removeVideo} className="rounded-full bg-[var(--color-border-2)] hover:bg-[var(--color-border-hover-1)] px-3 py-1 text-[var(--color-text-2)] text-sm inline-flex items-center gap-1"><Trash className="w-4 h-4"/>Удалить</button>
                </div>
              )}
            </div>
          </section>

          
          <aside className="space-y-3">
            <button
              onClick={() => slideInput.current?.click()}
              className="w-full inline-flex items-center justify-between rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border-2)] px-4 py-3 text-[var(--color-text-1)] hover:bg-[#1a1a22] transition-colors"
            >
              <div className="inline-flex items-center gap-2">
                <Image className="w-5 h-5 text-[var(--color-text-2)]" />
                <span>Добавить слайд</span>
              </div>
            </button>
          
            {!(lesson?.slides && lesson.slides.length > 0) && (
              <button
                onClick={() => slideInput.current?.click()}
                className="w-full inline-flex items-center justify-between rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border-2)] px-4 py-3 text-[var(--color-text-1)] hover:bg-[#1a1a22] transition-colors"
              >
                <div className="inline-flex items-center gap-2">
                  <Image className="w-5 h-5 text-[var(--color-text-2)]" />
                  <span>Добавить слайд</span>
                </div>
              </button>
            )}
            <input
              ref={slideInput}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onAddSlide(f)
              }}
              className="hidden"
            />
            {lesson?.slideMediaIds && lesson.slideMediaIds.length > 0 && (
              <div className="flex items-center justify-end gap-3 mt-2">
                <button onClick={uploadSlidesToServer} className="rounded-full bg-[var(--color-border-2)] hover:bg-[var(--color-border-hover-1)] px-3 py-1 text-[var(--color-text-2)] text-sm">Загрузить все слайды</button>
                {Array.isArray(lesson.slideUrls) && lesson.slideUrls.length > 0 && <span className="text-xs text-[var(--color-text-3)]">Загружено: {lesson.slideUrls.length}</span>}
              </div>
            )}

          
            <button
              onClick={() => presentationInput.current?.click()}
              className="w-full inline-flex items-center justify-between rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border-2)] px-4 py-3 text-[var(--color-text-1)] hover:bg-[#1a1a22] transition-colors"
            >
              <div className="inline-flex items-center gap-2">
                <Image className="w-5 h-5 text-[var(--color-text-2)]" />
                <span>Добавить презентацию</span>
              </div>
            </button>
            <input
              ref={presentationInput}
              type="file"
              accept="application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onSelectPresentation(f)
              }}
              className="hidden"
            />

          
            {(lesson?.slides || []).map((name, idx) => (
              <div
                key={`${name}-${idx}`}
                className="w-full inline-flex items-center justify-between rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border-2)] px-4 py-3 text-[var(--color-text-1)] animate-slide-up"
              >
                <div className="inline-flex items-center gap-2">
                  <Image className="w-5 h-5 text-[var(--color-text-2)]" />
                  <span className="text-[var(--color-text-2)]">{name}</span>
                </div>
                <button
                  onClick={() => removeSlideAt(idx)}
                  className="rounded-full bg-[var(--color-border-2)] hover:bg-[var(--color-border-hover-1)] p-2 text-[var(--color-text-2)] transition-colors"
                  aria-label="Удалить слайд"
                >
                  <Trash className="w-4 h-4" />
                </button>
              </div>
            ))}

          
            {lesson?.presentationFileName && (
              <div className="w-full inline-flex items-center justify-between rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border-2)] px-4 py-3 text-[var(--color-text-1)] animate-slide-up">
                <div className="inline-flex items-center gap-2">
                  <Image className="w-5 h-5 text-[var(--color-text-2)]" />
                  <span className="text-[var(--color-text-2)]">Презентация: {lesson.presentationFileName}</span>
                </div>
                <button
                  onClick={removePresentation}
                  className="rounded-full bg-[var(--color-border-2)] hover:bg-[var(--color-border-hover-1)] p-2 text-[var(--color-text-2)] transition-colors"
                >
                  <Trash className="w-4 h-4" />
                </button>
              </div>
            )}
            {presPreview && (
              <div className="flex items-center justify-end gap-3">
                <a href={presPreview} target="_blank" className="text-xs rounded-full bg-[var(--color-border-2)] hover:bg-[var(--color-border-hover-1)] px-3 py-1">Открыть локально</a>
                <button onClick={uploadPresentationToServer} className="text-xs rounded-full bg-[var(--color-border-2)] hover:bg-[var(--color-border-hover-1)] px-3 py-1">Загрузить на сервер</button>
                {lesson?.presentationUrl && <a href={lesson.presentationUrl} target="_blank" className="text-xs text-[var(--color-accent-warm)] underline">URL</a>}
              </div>
            )}
          </aside>
        </div>

      
        <section className="bg-[var(--color-surface-2)] border border-[var(--color-border-2)] rounded-2xl p-4 text-[var(--color-text-1)] space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <div className="text-[var(--color-text-2)] font-medium">Текст урока (Markdown)</div>
            <div className="inline-flex items-center gap-1">
              <button title="Жирный" onClick={() => updateLesson({ content: (lesson?.content || "") + "**жирный**" })} className="p-2 rounded hover:bg-[var(--color-border-2)]"><Bold className="w-4 h-4" /></button>
              <button title="Курсив" onClick={() => updateLesson({ content: (lesson?.content || "") + " *курсив*" })} className="p-2 rounded hover:bg-[var(--color-border-2)]"><Italic className="w-4 h-4" /></button>
              <button title="Заголовок" onClick={() => updateLesson({ content: (lesson?.content || "") + "\n\n## Заголовок" })} className="p-2 rounded hover:bg-[var(--color-border-2)]"><Heading2 className="w-4 h-4" /></button>
              <button title="Список" onClick={() => updateLesson({ content: (lesson?.content || "") + "\n- пункт" })} className="p-2 rounded hover:bg-[var(--color-border-2)]"><List className="w-4 h-4" /></button>
            </div>
          </div>
          <textarea
            value={lesson?.content || ""}
            onChange={(e) => updateLesson({ content: e.target.value })}
            placeholder="Добавьте поясняющий текст, конспект, ссылки и т.д."
            className="w-full min-h-[160px] bg-[var(--color-surface-3)] border border-[var(--color-border-2)] rounded-lg p-3 outline-none text-[var(--color-text-2)]"
          />
          <div className="bg-[var(--color-surface-3)] border border-[var(--color-border-2)] rounded-lg p-3 text-[var(--color-text-2)]">
            <div className="text-[var(--color-text-3)] text-xs mb-2">Предпросмотр</div>
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown>{lesson?.content || ""}</ReactMarkdown>
            </div>
          </div>
        </section>
      </div>
      
      <div className="mt-6 bg-[var(--color-surface-2)] border border-[var(--color-border-2)] rounded-2xl p-4 text-[var(--color-text-1)] space-y-3 animate-slide-up">
        <div className="text-[var(--color-text-2)] font-medium">Вопрос по уроку (опционально)</div>
        <input
          value={lesson?.quizQuestion || ""}
          onChange={(e) => updateLesson({ quizQuestion: e.target.value })}
          placeholder="Текст вопроса"
          className="w-full bg-[var(--color-surface-3)] border border-[var(--color-border-2)] rounded-lg p-2 outline-none"
        />
        <div className="space-y-2">
          {(() => {
            const opts = (lesson?.quizOptions && lesson.quizOptions.length > 0) ? lesson.quizOptions : ["", "", "", ""]
            return opts.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="quiz-correct"
                  checked={(lesson?.quizCorrectIndex ?? -1) === idx}
                  onChange={() => updateLesson({ quizCorrectIndex: idx })}
                />
                <input
                  value={opt}
                  onChange={(e) => {
                    const arr = [...opts]
                    arr[idx] = e.target.value
                    updateLesson({ quizOptions: arr })
                  }}
                  placeholder={`Вариант ${idx + 1}`}
                  className="flex-1 bg-[var(--color-surface-3)] border border-[var(--color-border-2)] rounded-lg p-2 outline-none"
                />
              </div>
            ))
          })()}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const opts = (lesson?.quizOptions && lesson.quizOptions.length > 0) ? lesson.quizOptions : ["", "", "", ""]
              if (opts.length >= 8) return
              updateLesson({ quizOptions: [...opts, ""] })
            }}
            className="rounded-lg bg-[var(--color-border-2)] hover:bg-[var(--color-border-hover-1)] px-3 py-1 text-[var(--color-text-2)] text-sm"
          >
            Добавить вариант
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[var(--color-text-3)] text-sm">XP за верный ответ</span>
            <input
              type="number"
              min={0}
              max={10000}
              value={typeof lesson?.quizXp === 'number' ? lesson.quizXp : 100}
              onChange={(e) => updateLesson({ quizXp: Number(e.target.value || 0) })}
              className="w-24 bg-[var(--color-surface-3)] border border-[var(--color-border-2)] rounded-lg p-2 outline-none text-right"
            />
          </div>
        </div>
      </div>

      
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={() => saveLessonDraft(false)} className="rounded-lg bg-[var(--color-border-2)] hover:bg-[var(--color-border-hover-1)] px-4 py-2 text-[var(--color-text-2)]">Сохранить</button>
        <button onClick={() => saveLessonDraft(true)} className="rounded-lg bg-[var(--color-accent-warm)] hover:bg-[#0088cc] px-4 py-2 text-black font-medium">Сохранить и выйти</button>
      </div>
    </main>
  )
}
