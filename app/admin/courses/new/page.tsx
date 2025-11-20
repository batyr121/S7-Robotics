"use client"
import { useMemo, useState, useEffect, useRef } from "react"
import { ArrowUpRight, LogIn, Trash } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { listCourses, saveCourses } from "@/lib/s7db"
import { apiFetch, getTokens } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm"
import { getFile } from "@/lib/s7media"

interface ModuleItem {
  id: number
  title: string
}

export default function Page() {
  const router = useRouter()
  const search = useSearchParams()
  const editId = search.get("edit")
  const draftParam = search.get("draft")
  const isFresh = useMemo(() => {
    const v = search.get("fresh")
    return v === "1" || v === "true"
  }, [search])
  const isEdit = useMemo(() => Boolean(editId), [editId])
  const confirm = useConfirm()

  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [modules, setModules] = useState<ModuleItem[]>([{ id: 1, title: "Модуль 1" }])
  const [free, setFree] = useState(true)
  const [price, setPrice] = useState<number>(0)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [dragId, setDragId] = useState<number | null>(null)
  const [difficulty, setDifficulty] = useState<string>("Легкий")
  const [showFilters, setShowFilters] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const draftId = useMemo(() => {
    if (draftParam) return draftParam
    if (typeof window === "undefined") return ""
    const stored = localStorage.getItem("s7_admin_course_default_id")
    if (stored) return stored
    const generated = (typeof crypto !== "undefined" && crypto.getRandomValues
      ? Array.from(crypto.getRandomValues(new Uint32Array(2))).map((n) => n.toString().padStart(10, "0")).join("").slice(0, 10)
      : `${Math.floor(1000000000 + Math.random() * 9000000000)}`)
    const id = `s7-${generated}`
    localStorage.setItem("s7_admin_course_default_id", id)
    return id
  }, [draftParam])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!draftParam && draftId) {
      localStorage.setItem("s7_admin_course_default_id", draftId)
      const qs = new URLSearchParams(search.toString())
      qs.set("draft", draftId)
      router.replace(`/admin/courses/new?${qs.toString()}`)
    }
  }, [draftParam, draftId, router, search])

  const draftKey = useMemo(() => {
    const id = draftId || ""
    return id ? `s7_admin_course_draft_${id}` : "s7_admin_course_draft"
  }, [draftId])

  const qs = useMemo(() => {
    const d = draftId
    if (d) {
      const params = new URLSearchParams()
      params.set("draft", d)
      if (editId) params.set("edit", editId)
      return `?${params.toString()}`
    }
    if (editId) return `?edit=${encodeURIComponent(editId)}`
    return ""
  }, [draftId, editId])

  const saveDraftImmediate = () => {
    try {
      if (!draftKey) return
      const existingRaw = localStorage.getItem(draftKey)
      const existing = existingRaw ? JSON.parse(existingRaw) : { modules: [] }
      const mergedModules = modules.map((m) => {
        const prev = (existing.modules || []).find((pm: any) => pm.id === m.id)
        // Preserve remoteId and lessons from existing draft
        return {
          id: m.id,
          title: m.title,
          remoteId: prev?.remoteId,
          lessons: prev?.lessons || []
        }
      })
      const draft = {
        ...existing,
        title,
        author,
        difficulty,
        modules: mergedModules,
        price: free ? 0 : price,
      }
      localStorage.setItem(draftKey, JSON.stringify(draft))
      localStorage.setItem("s7_admin_course_draft", JSON.stringify(draft))

      // Очистка старых черновиков (более 7 дней)
      const cleanupThreshold = Date.now() - (7 * 24 * 60 * 60 * 1000)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('s7_admin_course_draft_')) {
          try {
            const item = localStorage.getItem(key)
            if (item) {
              const data = JSON.parse(item)
              if (data.lastUpdated && new Date(data.lastUpdated).getTime() < cleanupThreshold) {
                localStorage.removeItem(key)
              }
            }
          } catch (e) {
            // Игнорируем ошибки парсинга
          }
        }
      }
    } catch (e) {
      console.error("Failed to save draft:", e)
      toast({ title: "Ошибка сохранения", description: "Не удалось сохранить черновик", variant: "destructive" as any })
    }
  }

  const buildPayload = (mods: any[]) => {
    return {
      title: (title || "Черновик").trim() || "Черновик",
      description: (title || "Черновик").trim() || "Черновик",
      difficulty: (difficulty || "Легкий").trim() || "Легкий",
      price: free ? 0 : Number(price || 0),
      isFree: free,
      isPublished: false,
      modules: (mods || []).map((m: any, mi: number) => ({
        ...(typeof m.remoteId === 'string' && m.remoteId ? { id: m.remoteId } : {}),
        title: m.title || `Модуль ${mi + 1}`,
        orderIndex: mi,
        lessons: (m.lessons || []).map((l: any, li: number) => ({
          ...(typeof l.remoteId === 'string' && l.remoteId ? { id: l.remoteId } : {}),
          title: l.title || `Урок ${li + 1}`,
          duration: l.time || l.duration || undefined,
          orderIndex: li,
          isFreePreview: false,
          content: l.content || undefined,
          contentType: "text",
          videoUrl: l.videoUrl || undefined,
          presentationUrl: l.presentationUrl || undefined,
          slides: Array.isArray(l.slideUrls) && l.slideUrls.length ? l.slideUrls.map((u: string) => ({ url: u })) : undefined,
        }))
      })),
    }
  }

  const persistToServer = async () => {
    try {
      // read latest draft to include lessons/media
      const fromKey = draftKey ? localStorage.getItem(draftKey) : null
      const draft = fromKey ? JSON.parse(fromKey) : null
      const mods = draft?.modules && draft.modules.length ? draft.modules : modules.map((m) => ({ id: m.id, title: m.title, lessons: [] }))
      const payload = buildPayload(mods)
      if (editId) {
        await apiFetch(`/api/admin/courses/${encodeURIComponent(editId)}?sync=ids`, { method: "PUT", body: JSON.stringify(payload) })
      } else {
        const created = await apiFetch<any>("/api/admin/courses", { method: "POST", body: JSON.stringify(payload) })
        if (created?.id) {
          // put new edit id into URL and seed draft with courseId and remote IDs
          const qs2 = new URLSearchParams(search.toString())
          qs2.set("edit", created.id)
          if (draftId) qs2.set("draft", draftId)
          router.replace(`/admin/courses/new?${qs2.toString()}`)
          try {
            const existingRaw = draftKey ? localStorage.getItem(draftKey) : localStorage.getItem("s7_admin_course_draft")
            const d = existingRaw ? JSON.parse(existingRaw) : {}
            d.courseId = created.id
            // sync remote IDs by orderIndex
            const createdModules = (created.modules || []).slice().sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
            if (Array.isArray(d.modules)) {
              for (let mi = 0; mi < d.modules.length; mi++) {
                const dm = d.modules[mi]
                const cm = createdModules.find((x: any) => x.orderIndex === mi)
                if (dm && cm) {
                  dm.remoteId = cm.id
                  const createdLessons = (cm.lessons || []).slice().sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                  const dLessons: any[] = Array.isArray(dm.lessons) ? dm.lessons : []
                  for (let li = 0; li < dLessons.length; li++) {
                    const dl = dLessons[li]
                    const cl = createdLessons.find((x: any) => x.orderIndex === li)
                    if (dl && cl) dl.remoteId = cl.id
                  }
                }
              }
            }
            localStorage.setItem("s7_admin_course_draft", JSON.stringify(d))
            if (draftKey) localStorage.setItem(draftKey, JSON.stringify(d))
          } catch { }
        }
      }
    } catch (e: any) {
      console.error("Autosave failed:", e)
      // Only show toast for non-abort errors or persistent failures if needed
      // For now, just log it, but if it's a 500, maybe warn.
      if (e?.message !== "Aborted") {
        // toast({ title: "Ошибка автосохранения", description: "Проверьте соединение", variant: "destructive" })
      }
    }
  }

  const scheduleAutosave = () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => { persistToServer() }, 800)
  }

  useEffect(() => {
    if (!editId) return
    try {
      const raw = localStorage.getItem("s7_admin_courses")
      const list = raw ? JSON.parse(raw) : []
      const found = list.find((c: any) => c.id === editId)
      if (found) {
        setTitle(found.title || "")
        setAuthor(found.author || "")
        if (found.difficulty) setDifficulty(found.difficulty)
        const mapped = (found.modules || []).map((m: any, idx: number) => ({ localId: idx + 1, remoteId: m.remoteId || m.id, title: m.title, lessons: (m.lessons || []).map((l: any, li: number) => ({ localId: li + 1, remoteId: l.remoteId || l.id, title: l.title, time: l.duration })) }))
        setModules(mapped.map((m: any) => ({ id: m.localId, title: m.title })))
        if (typeof found.price === "number" && found.price > 0) {
          setFree(false)
          setPrice(found.price)
        } else {
          setFree(true)
          setPrice(0)
        }
        const seeded = { courseId: found.id, title: found.title, author: found.author, difficulty: found.difficulty, price: found.price, modules: mapped.map((m: any) => ({ id: m.localId, remoteId: m.remoteId, title: m.title, lessons: m.lessons.map((l: any) => ({ id: l.localId, remoteId: l.remoteId, title: l.title, time: l.time })) })) }
        if (draftKey) {
          localStorage.setItem(draftKey, JSON.stringify(seeded))
        }
        localStorage.setItem("s7_admin_course_draft", JSON.stringify(seeded))
      } else {
        apiFetch<any[]>("/api/admin/courses")
          .then((list) => {
            const foundSrv = (list || []).find((c: any) => c.id === editId)
            if (!foundSrv) return
            setTitle(foundSrv.title || "")
            setAuthor(foundSrv.author || "")
            if (foundSrv.difficulty) setDifficulty(foundSrv.difficulty)
            const mapped = (foundSrv.modules || []).map((m: any, idx: number) => ({ localId: idx + 1, remoteId: m.id, title: m.title, lessons: (m.lessons || []).map((l: any, li: number) => ({ localId: li + 1, remoteId: l.id, title: l.title, time: l.duration })) }))
            setModules(mapped.map((m: any) => ({ id: m.localId, title: m.title })))
            if (typeof foundSrv.price === "number" && foundSrv.price > 0) { setFree(false); setPrice(foundSrv.price) } else { setFree(true); setPrice(0) }
            try {
              const seeded = { courseId: foundSrv.id, title: foundSrv.title, author: foundSrv.author, difficulty: foundSrv.difficulty, price: foundSrv.price, modules: mapped.map((m: any) => ({ id: m.localId, remoteId: m.remoteId, title: m.title, lessons: m.lessons.map((l: any) => ({ id: l.localId, remoteId: l.remoteId, title: l.title, time: l.time })) })) }
              if (draftKey) localStorage.setItem(draftKey, JSON.stringify(seeded))
              localStorage.setItem("s7_admin_course_draft", JSON.stringify(seeded))
            } catch { }
          })
          .catch(() => { })
      }
    } catch { }
    finally { setHydrated(true); scheduleAutosave() }
  }, [editId, draftKey])

  useEffect(() => {
    if (editId || isFresh) return
    try {
      if (!draftKey) return
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const d = JSON.parse(raw)
        if (d.title) setTitle(d.title)
        if (d.author) setAuthor(d.author)
        if (d.difficulty) setDifficulty(d.difficulty)
        if (Array.isArray(d.modules) && d.modules.length) {
          setModules(d.modules.map((m: any) => ({ id: m.id, title: m.title })))
        }
      }
    } catch { }
    finally { setHydrated(true) }
  }, [editId, isFresh, draftKey])

  useEffect(() => {
    if (!isFresh) return
    try {
      const raw = localStorage.getItem(draftKey)
      const hasDraft = !!raw && raw !== "{}" && raw !== "null" && raw.length > 2
      if (!hasDraft) {
        if (!draftKey) {
          const generated = (typeof crypto !== "undefined" && crypto.getRandomValues
            ? Array.from(crypto.getRandomValues(new Uint32Array(2))).map((n) => n.toString().padStart(10, "0")).join("").slice(0, 10)
            : `${Math.floor(1000000000 + Math.random() * 9000000000)}`)
          const id = `s7-${generated}`
          localStorage.setItem("s7_admin_course_default_id", id)
          const qs = new URLSearchParams(search.toString())
          qs.set("draft", id)
          router.replace(`/admin/courses/new?${qs.toString()}`)
        }
        if (draftKey) localStorage.removeItem(draftKey)
        localStorage.removeItem("s7_admin_course_draft")
        setTitle("")
        setAuthor("")
        setDifficulty("Легкий")
        setModules([{ id: 1, title: "Модуль 1" }])
        setFree(true)
        setPrice(0)
      }
    } catch { }
    setHydrated(true); scheduleAutosave()
  }, [isFresh, draftKey])

  useEffect(() => {
    if (!hydrated) return
    try {
      if (!draftKey) return
      const existingRaw = localStorage.getItem(draftKey)
      const existing = existingRaw ? JSON.parse(existingRaw) : { modules: [] }
      const mergedModules = modules.map((m) => {
        const prev = (existing.modules || []).find((pm: any) => pm.id === m.id)
        return { id: m.id, title: m.title, remoteId: prev?.remoteId, lessons: prev?.lessons || [] }
      })
      const draft = {
        ...existing,
        title,
        author,
        difficulty,
        modules: mergedModules,
        price: free ? 0 : price,
      }
      if (draftKey) localStorage.setItem(draftKey, JSON.stringify(draft))
      localStorage.setItem("s7_admin_course_draft", JSON.stringify(draft))
    } catch { }
    scheduleAutosave()
  }, [title, author, difficulty, modules, free, price, hydrated, draftKey])

  useEffect(() => {
    // Очистка старых черновиков при загрузке страницы
    try {
      const cleanupThreshold = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 дней
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('s7_admin_course_draft_')) {
          try {
            const item = localStorage.getItem(key)
            if (item) {
              const data = JSON.parse(item)
              // Если у черновика нет даты обновления или она старше 7 дней, удаляем его
              if (!data.lastUpdated || new Date(data.lastUpdated).getTime() < cleanupThreshold) {
                localStorage.removeItem(key)
              }
            }
          } catch (e) {
            // Игнорируем ошибки парсинга и удаляем проблемный ключ
            localStorage.removeItem(key || '')
          }
        }
      }
    } catch (e) {
      console.warn("Failed to cleanup old drafts:", e)
    }
  }, [])

  const addModule = () => {
    const nextId = modules.length ? Math.max(...modules.map((m) => m.id)) + 1 : 1
    setModules([...modules, { id: nextId, title: `Модуль ${nextId}` }])
  }

  const renameModule = (id: number, newTitle: string) => {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, title: newTitle } : m)))
  }

  const removeModule = async (id: number) => {
    const ok = await confirm({
      title: `Удалить модуль?`,
      description: `Вы уверены, что хотите удалить этот модуль? Все уроки в этом модуле также будут удалены. Это действие невозможно отменить.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      variant: 'danger'
    })
    if (!ok) return
    setModules((prev) => prev.filter((m) => m.id !== id))
    try {
      toast({ title: 'Модуль удалён', description: 'Модуль успешно удалён из курса' })
    } catch { }
  }

  const reorderModules = (fromId: number, toId: number) => {
    setModules((prev) => {
      const list = [...prev]
      const fromIdx = list.findIndex((m) => m.id === fromId)
      const toIdx = list.findIndex((m) => m.id === toId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [item] = list.splice(fromIdx, 1)
      list.splice(toIdx, 0, item)
      return list
    })
  }

  const publish = async () => {
    const ok = await confirm({
      title: 'Опубликовать курс?',
      description: 'Вы уверены, что хотите опубликовать этот курс? После публикации он станет доступен всем пользователям.',
      confirmText: 'Опубликовать',
      cancelText: 'Отмена'
    })
    if (!ok) return
    let finalModules = modules.map((m) => ({ id: m.id, title: m.title, lessons: [] as any[] }))
    try {
      const fromKey = draftKey ? localStorage.getItem(draftKey) : null
      const fromGlobal = localStorage.getItem("s7_admin_course_draft")
      const parseSafe = (raw: string | null) => { try { return raw ? JSON.parse(raw) : null } catch { return null } }
      const dk = parseSafe(fromKey)
      const dg = parseSafe(fromGlobal)
      const pick = (() => {
        if (dk && Array.isArray(dk.modules) && dk.modules.length) return dk
        if (dg && Array.isArray(dg.modules) && dg.modules.length) return dg
        return dk || dg
      })()
      if (pick && Array.isArray(pick.modules) && pick.modules.length) {
        finalModules = pick.modules.map((m: any) => ({
          id: m.id,
          title: m.title,
          remoteId: m.remoteId,
          lessons: (m.lessons || []).map((l: any) => ({
            id: l.id,
            title: l.title,
            time: l.time,
            videoName: l.videoName,
            slides: l.slides || [],
            content: l.content || "",
            presentationFileName: l.presentationFileName || "",
            videoMediaId: l.videoMediaId || undefined,
            slideMediaIds: l.slideMediaIds || [],
            presentationMediaId: l.presentationMediaId || undefined,
            videoUrl: l.videoUrl || undefined,
            presentationUrl: l.presentationUrl || undefined,
            slideUrls: l.slideUrls || [],
            remoteId: l.remoteId,
            quizQuestion: l.quizQuestion || undefined,
            quizOptions: l.quizOptions || undefined,
            quizCorrectIndex: l.quizCorrectIndex !== undefined ? l.quizCorrectIndex : undefined,
            quizXp: l.quizXp !== undefined ? l.quizXp : undefined,
          })),
        }))
      }
    } catch { }

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
            const t = await res.text().catch(() => "Upload failed")
            throw new Error(t || `Upload failed (${res.status})`)
          }
          const data = await res.json()
          const u = String(data.url || "")
          const abs = u.startsWith("http://") || u.startsWith("https://") ? u : new URL(u, window.location.origin).href
          return abs
        } catch (e) { lastErr = e }
      }
      throw lastErr || new Error("Upload failed")
    }

    try {
      for (const m of finalModules as any[]) {
        for (const l of (m.lessons || []) as any[]) {
          if (!l.videoUrl && l.videoMediaId) {
            try {
              l.videoUrl = await uploadById(l.videoMediaId)
            } catch (e: any) {
              console.warn("Video upload failed", e?.message)
              toast({ title: "Ошибка загрузки видео", description: e?.message || "Не удалось загрузить видео", variant: "destructive" as any })
            }
          }
          if ((!Array.isArray(l.slideUrls) || l.slideUrls.length === 0) && Array.isArray(l.slideMediaIds) && l.slideMediaIds.length > 0) {
            const urls: string[] = []
            for (const id of l.slideMediaIds) {
              try {
                const u = await uploadById(id)
                if (u) urls.push(u)
              } catch (e: any) {
                console.warn("Slide upload failed", e?.message)
                toast({ title: "Ошибка загрузки слайда", description: e?.message || "Не удалось загрузить слайд", variant: "destructive" as any })
              }
            }
            l.slideUrls = urls
          }
          if (!l.presentationUrl && l.presentationMediaId) {
            try {
              l.presentationUrl = await uploadById(l.presentationMediaId)
            } catch (e: any) {
              console.warn("Presentation upload failed", e?.message)
              toast({ title: "Ошибка загрузки презентации", description: e?.message || "Не удалось загрузить презентацию", variant: "destructive" as any })
            }
          }
        }
      }
    } catch (e: any) {
      toast({ title: "Ошибка загрузки файлов", description: e?.message || "Не удалось загрузить медиа файлы", variant: "destructive" as any })
    }

    const newCourse = {
      id: editId || title.toLowerCase().replace(/\s+/g, "-"),
      title,
      difficulty,
      author,
      price: free ? 0 : price,
      modules: finalModules,
      published: true,
    }

    try {
      let created: any = null
      try {
        const payload = {
          title: title.trim(),
          description: title.trim(),
          difficulty,
          price: free ? 0 : Number(price || 0),
          isFree: free,
          isPublished: true,
          modules: finalModules.map((m, mi) => ({
            ...((typeof (m as any).remoteId === 'string' && (m as any).remoteId) ? { id: (m as any).remoteId as string } : {}),
            title: (m as any).title || `Модуль ${mi + 1}`,
            orderIndex: mi,
            lessons: (m as any).lessons?.map((l: any, li: number) => ({
              ...((typeof (l as any).remoteId === 'string' && (l as any).remoteId) ? { id: (l as any).remoteId as string } : {}),
              title: l.title || `Урок ${li + 1}`,
              duration: l.time || l.duration || undefined,
              orderIndex: li,
              isFreePreview: false,
              content: l.content || undefined,
              contentType: "text",
              videoUrl: l.videoUrl || undefined,
              presentationUrl: l.presentationUrl || undefined,
              slides: Array.isArray(l.slideUrls) && l.slideUrls.length
                ? l.slideUrls.map((u: string) => ({ url: u }))
                : undefined,
            })) || [],
          })),
        }
        created = await apiFetch<any>(
          editId ? `/api/admin/courses/${encodeURIComponent(editId)}?sync=ids` : "/api/admin/courses",
          { method: editId ? "PUT" : "POST", body: JSON.stringify(payload) }
        )
        try {
          // Update the draft with the new remote IDs from the backend
          const draftRaw = draftKey ? localStorage.getItem(draftKey) : localStorage.getItem("s7_admin_course_draft")
          const draft = draftRaw ? JSON.parse(draftRaw) : null
          if (created?.id && draft && Array.isArray(draft.modules)) {
            // Update course ID
            draft.courseId = created.id

            // Update module and lesson IDs based on orderIndex to ensure proper mapping
            const createdModules = (created.modules || []).slice().sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
            for (let mi = 0; mi < draft.modules.length; mi++) {
              const dMod = draft.modules[mi]
              // Find the corresponding created module by orderIndex
              const cMod = createdModules.find((m: any) => m.orderIndex === mi)
              if (!dMod || !cMod) continue
              dMod.remoteId = cMod.id

              // Update lesson IDs based on orderIndex
              const createdLessons = (cMod.lessons || []).slice().sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
              const dLessons: any[] = Array.isArray(dMod.lessons) ? dMod.lessons : []
              for (let li = 0; li < dLessons.length; li++) {
                const dLesson = dLessons[li]
                // Find the corresponding created lesson by orderIndex
                const cLesson = createdLessons.find((l: any) => l.orderIndex === li)
                if (!dLesson || !cLesson) continue
                dLesson.remoteId = cLesson.id

                // Save quiz questions if they exist
                const text = (dLesson.quizQuestion || "").trim()
                const opts: string[] = Array.isArray(dLesson.quizOptions) ? dLesson.quizOptions.filter((s: any) => typeof s === 'string' && s.trim()).map((s: string) => s.trim()) : []
                const correctIndex = typeof dLesson.quizCorrectIndex === 'number' ? dLesson.quizCorrectIndex : -1
                const xpReward = typeof dLesson.quizXp === 'number' ? dLesson.quizXp : 100
                if (text && opts.length >= 2 && correctIndex >= 0 && correctIndex < opts.length) {
                  try {
                    await apiFetch(`/courses/${created.id}/questions`, {
                      method: "POST",
                      body: JSON.stringify({
                        text,
                        options: opts,
                        correctIndex,
                        xpReward,
                        moduleId: cMod.id,
                        lessonId: cLesson.id,
                      }),
                    })
                    toast({ title: "Вопрос сохранен", description: "Вопрос успешно добавлен к уроку" } as any)
                  } catch (e: any) {
                    console.error("Failed to save question:", e)
                    toast({ title: "Ошибка сохранения вопроса", description: e?.message || "Не удалось сохранить вопрос", variant: "destructive" as any })
                  }
                }
              }
            }
            localStorage.setItem("s7_admin_course_draft", JSON.stringify(draft))
            if (draftKey) localStorage.setItem(draftKey, JSON.stringify(draft))
          }
        } catch (e) {
          console.error("Failed to update draft with remote IDs:", e)
        }
      } catch (e: any) {
        console.warn("Backend create course failed:", e?.message)
        throw e
      }

      const raw = localStorage.getItem("s7_admin_courses")
      const list = raw ? JSON.parse(raw) : []
      const courseForCards = created?.id
        ? {
          id: created.id,
          title: created.title,
          difficulty: created.difficulty,
          author,
          price: free ? 0 : price,
          modules: (created.modules || []).map((m: any) => ({ id: m.id, title: m.title, lessons: (m.lessons || []).map((l: any) => ({ id: l.id, title: l.title })) })),
          published: true,
        }
        : newCourse
      if (editId) {
        const idx = list.findIndex((c: any) => c.id === editId)
        if (idx !== -1) list[idx] = courseForCards
        else list.push(courseForCards)
      } else {
        const idx = list.findIndex((c: any) => c.id === courseForCards.id)
        if (idx !== -1) list[idx] = courseForCards
        else list.push(courseForCards)
      }
      localStorage.setItem("s7_admin_courses", JSON.stringify(list))

      try {
        const fresh = await apiFetch<any[]>("/api/admin/courses")
        if (Array.isArray(fresh)) {
          localStorage.setItem("s7_admin_courses", JSON.stringify(fresh))
        }
      } catch { }

      try {
        const db = listCourses()
        const i = db.findIndex((c) => c.id === courseForCards.id)
        if (i >= 0) db[i] = courseForCards as any
        else db.push(courseForCards as any)
        saveCourses(db as any)
      } catch { }

      localStorage.removeItem(draftKey)
    } catch { }

    toast({ title: "Курс успешно создан", description: "Курс был успешно опубликован и доступен для студентов" })
    router.push("/admin/courses")
  }

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white text-xl font-medium">Создать курс</h2>
        <button
          onClick={() => {
            try {
              const raw = localStorage.getItem(draftKey) || localStorage.getItem("s7_admin_course_draft")
              const d = raw ? JSON.parse(raw) : null
              const id = (editId as string) || d?.courseId || ""
              if (!id) { toast({ title: "Сначала опубликуйте курс", description: "После публикации станет доступен конструктор игры", variant: "destructive" as any }); return }
              router.push(`/admin/courses/${encodeURIComponent(id)}/quiz`)
            } catch {
              toast({ title: "Нет курса", description: "Сначала опубликуйте курс", variant: "destructive" as any })
            }
          }}
          className="rounded-full bg-[#00a3ff] hover:bg-[#0088cc] text-black font-medium px-4 py-2"
        >
          Игра
        </button>
      </div>

      <div className="max-w-2xl space-y-5">

        <div className="bg-[#16161c] border border-[#636370]/20 rounded-2xl p-5 text-white relative">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название"
            className="w-full bg-transparent outline-none text-2xl md:text-3xl font-semibold placeholder-white/40"
          />
          <div className="mt-3 flex items-center gap-3 relative">
            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              className="inline-flex items-center text-xs font-medium px-3 py-1 rounded-full bg-[#f59e0b] text-black"
            >
              фильтр
            </button>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Имя автора"
              className="bg-[var(--color-surface-3)] border border-[var(--color-border-2)] text-[var(--color-text-2)] text-xs rounded-full px-3 py-1 outline-none"
            />
            {showFilters && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-[var(--color-surface-3)] border border-[var(--color-border-2)] rounded-xl p-3 shadow-xl z-10">
                <div className="text-[var(--color-text-2)] text-xs mb-2">Сложность</div>
                <div className="flex items-center gap-2">
                  {(["Легкий", "Средний", "Сложный"] as string[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setDifficulty(lvl)}
                      className={`px-3 py-1 rounded-full text-xs border ${difficulty === lvl ? 'bg-[var(--color-accent-warm)] text-black border-[var(--color-accent-warm)]' : 'bg-transparent text-[var(--color-text-2)] border-[var(--color-border-2)]'}`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end mt-3">
                  <button onClick={() => setShowFilters(false)} className="text-xs px-3 py-1 rounded-lg bg-[var(--color-border-2)] hover:bg-[var(--color-border-hover-1)] text-[var(--color-text-2)]">Готово</button>
                </div>
              </div>
            )}
          </div>


          {isEdit && (
            <div className="pt-2">
              <button
                onClick={async () => {
                  const ok = await confirm({ title: 'Удалить этот курс?', confirmText: 'Удалить', cancelText: 'Отмена', variant: 'danger' })
                  if (!ok) return
                  try {
                    await apiFetch(`/api/admin/courses/${editId}` as any, { method: 'DELETE' })
                    try {
                      const raw = localStorage.getItem('s7_admin_courses')
                      const list = raw ? JSON.parse(raw) : []
                      const next = (list || []).filter((c: any) => c.id !== editId)
                      localStorage.setItem('s7_admin_courses', JSON.stringify(next))
                      localStorage.removeItem('s7_admin_course_draft')
                    } catch { }
                    toast({ title: 'Курс успешно удалён', description: 'Курс был удалён из системы' })
                    router.push('/admin/courses')
                  } catch (e: any) {
                    toast({ title: 'Ошибка', description: e?.message || 'Не удалось удалить', variant: 'destructive' as any })
                  }
                }}
                className="w-full rounded-2xl bg-[#ef4444] hover:bg-[#dc2626] text-white font-medium py-3"
              >
                Удалить курс
              </button>
            </div>
          )}
        </div>


        {modules.map((m) => (
          <div
            key={m.id}
            draggable
            onDragStart={() => setDragId(m.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragId != null && dragId !== m.id) reorderModules(dragId, m.id); setDragId(null) }}
            className="flex items-center justify-between bg-[var(--color-surface-2)] border border-[var(--color-border-2)] rounded-2xl px-4 py-3 text-[var(--color-text-1)] animate-slide-up"
          >
            <div className="flex items-center gap-3 w-full">
              <span className="w-7 h-7 rounded-full bg-[var(--color-border-2)] text-[var(--color-text-2)] flex items-center justify-center text-xs">{m.id}.</span>
              {editingId === m.id ? (
                <input
                  autoFocus
                  value={m.title}
                  onChange={(e) => renameModule(m.id, e.target.value)}
                  onBlur={() => setEditingId(null)}
                  className="flex-1 bg-transparent outline-none border-b border-[var(--color-border-2)]"
                />
              ) : (
                <button onClick={() => setEditingId(m.id)} className="text-left flex-1">
                  <span className="font-medium">{m.title}</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { saveDraftImmediate(); router.push(`/admin/courses/new/${m.id}${qs}`) }}
                aria-label="Открыть уроки"
                className="text-[var(--color-text-4)] hover:text-[var(--color-text-1)]"
              >
                <LogIn className="w-5 h-5" />
              </button>
              <button onClick={() => removeModule(m.id)} aria-label="Удалить модуль" className="text-[var(--color-text-4)] hover:text-[#ef4444] transition-colors">
                <Trash className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addModule}
          className="flex items-center justify-between bg-[var(--color-surface-2)] border border-[var(--color-border-2)] rounded-2xl px-4 py-3 text-[var(--color-text-1)] w-full hover:bg-[#1a1a22]"
        >
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-[var(--color-border-2)] text-[var(--color-text-2)] flex items-center justify-center text-xs">x.</span>
            <span className="font-medium">Добавить модули</span>
          </div>
          <LogIn className="w-5 h-5 text-[var(--color-text-4)]" />
        </button>


        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              try {
                const existingRaw = draftKey ? localStorage.getItem(draftKey) : null
                const existing = existingRaw ? JSON.parse(existingRaw) : { modules: [] }
                const mergedModules = modules.map((m) => {
                  const prev = (existing.modules || []).find((pm: any) => pm.id === m.id)
                  return { id: m.id, title: m.title, remoteId: prev?.remoteId, lessons: prev?.lessons || [] }
                })
                const draft = {
                  ...existing,
                  title,
                  author,
                  difficulty,
                  modules: mergedModules,
                  price: free ? 0 : price,
                }
                if (draftKey) localStorage.setItem(draftKey, JSON.stringify(draft))
                localStorage.setItem("s7_admin_course_draft", JSON.stringify(draft))
                toast({ title: 'Черновик сохранён', description: 'Ваши изменения сохранены в черновике' })
              } catch { }
            }}
            className="rounded-2xl bg-[var(--color-border-2)] hover:bg-[var(--color-border-hover-1)] text-[var(--color-text-1)] font-medium py-4 transition-colors"
          >
            Сохранить черновик
          </button>
          <button
            onClick={publish}
            className="rounded-2xl bg-[var(--color-accent-warm)] hover:bg-[#0088cc] text-black font-medium py-4 flex items-center justify-center gap-2 transition-colors"
          >
            Опубликовать
            <ArrowUpRight className="w-5 h-5" />
          </button>
        </div>


        <div className="flex items-center gap-3">
          <span className="text-[var(--color-text-3)]">Цена</span>
          <div className="rounded-full border border-[var(--color-border-2)] p-1 flex items-center bg-[var(--color-surface-3)]">
            <button
              onClick={() => setFree(false)}
              className={`px-4 py-1 rounded-full text-sm ${!free ? "bg-[var(--color-surface-1)] text-[var(--color-text-1)]" : "text-[var(--color-text-3)]"}`}
            >
              Цена
            </button>
            <button
              onClick={() => setFree(true)}
              className={`px-4 py-1 rounded-full text-sm ${free ? "bg-white text-black" : "text-[var(--color-text-3)]"}`}
            >
              Бесплатно
            </button>
          </div>
        </div>
        {!free && (
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            placeholder="Введите цену"
            className="w-40 bg-[var(--color-surface-3)] border border-[var(--color-border-2)] text-[var(--color-text-1)] rounded-lg px-3 py-2 outline-none"
          />
        )}
      </div>
    </main>
  )
}
