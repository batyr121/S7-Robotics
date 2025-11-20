"use client"
import { useMemo, useState, useEffect, useRef } from "react"
import { ArrowUpRight, LogIn, Trash } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm"

interface ModuleItem {
  id: number
  title: string
  remoteId?: string
}

interface CourseData {
  id?: string
  title: string
  description: string
  difficulty: string
  price: number
  isFree: boolean
  isPublished: boolean
  modules: ModuleItem[]
}

export default function Page() {
  const router = useRouter()
  const search = useSearchParams()
  const editId = search.get("edit")
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
  const [saving, setSaving] = useState(false)
  const [courseId, setCourseId] = useState<string | null>(editId)

  // Load existing course data if editing
  useEffect(() => {
    if (!editId) {
      setHydrated(true)
      return
    }
    
    const loadCourse = async () => {
      try {
        const course = await apiFetch<any>(`/api/admin-courses/${editId}`)
        if (course) {
          setTitle(course.title || "")
          setAuthor(course.author || "")
          setDifficulty(course.difficulty || "Легкий")
          setFree(course.isFree || course.price === 0)
          setPrice(course.price || 0)
          
          // Load modules
          if (course.modules && course.modules.length > 0) {
            const loadedModules = course.modules.map((m: any, index: number) => ({
              id: index + 1,
              title: m.title,
              remoteId: m.id,
            }))
            setModules(loadedModules)
          }
          
          setCourseId(course.id)
        }
      } catch (error) {
        console.error("Error loading course:", error)
        toast({ title: "Ошибка", description: "Не удалось загрузить курс", variant: "destructive" })
      } finally {
        setHydrated(true)
      }
    }
    
    loadCourse()
  }, [editId])

  // Auto-save course basic info
  const saveCourseBasic = async () => {
    if (!title.trim() || saving) return

    setSaving(true)
    try {
      const endpoint = courseId ? `/api/admin-courses/courses/${courseId}/basic` : `/api/admin-courses/courses/new/basic`

      const response = await apiFetch<any>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: title.trim(),
          difficulty,
          price: free ? 0 : price,
          isFree: free,
          isPublished: false,
        }),
      })
      
      if (response?.id && !courseId) {
        setCourseId(response.id)
        // Update URL with new course ID, staying in step-by-step editor
        const params = new URLSearchParams(search.toString())
        params.set("edit", response.id)
        router.replace(`/admin/courses/new-step?${params.toString()}`)
      }
      
      console.log("Course basic info saved")
    } catch (error) {
      console.error("Error saving course basic info:", error)
    } finally {
      setSaving(false)
    }
  }

  // Auto-save when basic info changes
  useEffect(() => {
    if (!hydrated) return
    const timer = setTimeout(saveCourseBasic, 1000)
    return () => clearTimeout(timer)
  }, [title, author, difficulty, free, price, hydrated])

  const addModule = async () => {
    if (!courseId) {
      toast({ title: "Сначала создайте курс", description: "Введите название курса и нажмите Enter", variant: "destructive" })
      return
    }
    
    // Ensure local module IDs stay sequential (1..N) and aligned with visual order
    const nextId = modules.length + 1
    const newModule: ModuleItem = { id: nextId, title: `Модуль ${nextId}` }
    
    try {
      const response = await apiFetch<any>(`/api/admin-courses/courses/${courseId}/modules`, {
        method: "POST",
        body: JSON.stringify({
          title: newModule.title,
          description: "",
          orderIndex: nextId - 1,
          lessons: [],
        }),
      })
      
      if (response?.id) {
        newModule.remoteId = response.id
        // Rebuild the modules array to keep ids sequential after adding
        const updated = [...modules, newModule].map((m, index) => ({ ...m, id: index + 1 }))
        setModules(updated)
        toast({ title: "Модуль создан", description: "Модуль успешно сохранен в базе данных" })
      }
    } catch (error) {
      console.error("Error creating module:", error)
      toast({ title: "Ошибка", description: "Не удалось создать модуль", variant: "destructive" })
    }
  }

  const renameModule = async (id: number, newTitle: string) => {
    const module = modules.find(m => m.id === id)
    if (!module || !module.remoteId) return
    
    try {
      await apiFetch(`/api/admin-courses/modules/${module.remoteId}`, {
        method: "PUT",
        body: JSON.stringify({ title: newTitle }),
      })
      
      setModules(prev => prev.map(m => m.id === id ? { ...m, title: newTitle } : m))
      console.log("Module renamed")
    } catch (error) {
      console.error("Error renaming module:", error)
      toast({ title: "Ошибка", description: "Не удалось переименовать модуль", variant: "destructive" })
    }
  }

  const removeModule = async (id: number) => {
    const module = modules.find(m => m.id === id)
    if (!module || !module.remoteId) return
    
    const ok = await confirm({ 
      title: `Удалить модуль?`, 
      description: `Вы уверены, что хотите удалить этот модуль? Все уроки и вопросы в этом модуле также будут удалены. Это действие невозможно отменить.`,
      confirmText: 'Удалить', 
      cancelText: 'Отмена',
      variant: 'danger' 
    })
    if (!ok) return
    
    try {
      await apiFetch(`/api/admin-courses/modules/${module.remoteId}`, {
        method: "DELETE",
      })
      
      // After deletion, reindex local module ids so they stay 1..N
      setModules(prev => {
        const filtered = prev.filter((m) => m.id !== id)
        return filtered.map((m, index) => ({ ...m, id: index + 1 }))
      })
      toast({ title: 'Модуль удалён', description: 'Модуль успешно удалён из базы данных' })
    } catch (error) {
      console.error("Error removing module:", error)
      toast({ title: "Ошибка", description: "Не удалось удалить модуль", variant: "destructive" })
    }
  }

  const reorderModules = (fromId: number, toId: number) => {
    setModules((prev) => {
      const list = [...prev]
      const fromIdx = list.findIndex((m) => m.id === fromId)
      const toIdx = list.findIndex((m) => m.id === toId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [item] = list.splice(fromIdx, 1)
      list.splice(toIdx, 0, item)
      // Reindex ids to keep them sequential and matching visual order
      return list.map((m, index) => ({ ...m, id: index + 1 }))
    })
  }

  const openModule = (moduleId: number) => {
    if (!courseId) {
      toast({ title: "Сначала создайте курс", description: "Введите название курса", variant: "destructive" })
      return
    }
    
    const module = modules.find(m => m.id === moduleId)
    if (!module || !module.remoteId) {
      toast({ title: "Сначала сохраните модуль", description: "Дождитесь сохранения модуля", variant: "destructive" })
      return
    }
    
    router.push(`/admin/courses/new-step/${moduleId}?edit=${courseId}`)
  }

  const publish = async () => {
    if (!title.trim()) {
      toast({ title: "Введите название курса", variant: "destructive" })
      return
    }
    
    if (!courseId) {
      toast({ title: "Сначала создайте курс", description: "Введите название курса и дождитесь сохранения", variant: "destructive" })
      return
    }
    
    const ok = await confirm({ 
      title: 'Опубликовать курс?', 
      description: 'Вы уверены, что хотите опубликовать этот курс? После публикации он станет доступен всем пользователям.',
      confirmText: 'Опубликовать', 
      cancelText: 'Отмена' 
    })
    if (!ok) return
    
    try {
      // Update course to published
      await apiFetch(`/api/admin-courses/courses/${courseId}/basic`, {
        method: "PUT",
        body: JSON.stringify({
          title: title.trim(),
          description: title.trim(),
          difficulty,
          price: free ? 0 : price,
          isFree: free,
          isPublished: true,
        }),
      })
      
      toast({ title: "Курс успешно опубликован", description: "Курс доступен для студентов" })
      router.push("/admin/courses")
    } catch (error) {
      console.error("Error publishing course:", error)
      toast({ title: "Ошибка публикации", description: "Не удалось опубликовать курс", variant: "destructive" })
    }
  }

  if (!hydrated) {
    return (
      <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
        <div className="max-w-2xl space-y-5">
          <div className="bg-[#16161c] border border-[#636370]/20 rounded-2xl p-5 text-white animate-pulse">
            <div className="h-8 bg-white/20 rounded mb-3"></div>
            <div className="h-6 bg-white/20 rounded w-3/4"></div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white text-xl font-medium">{editId ? "Редактировать курс" : "Создать курс"}</h2>
        <div className="flex items-center gap-3">
          {saving && (
            <span className="text-sm text-[var(--color-text-3)]">Сохранение...</span>
          )}
          <button
            onClick={() => {
              if (!courseId) {
                toast({ title: "Сначала создайте курс", description: "Введите название курса", variant: "destructive" })
                return
              }
              router.push(`/admin/courses/${encodeURIComponent(courseId)}/quiz`)
            }}
            className="rounded-full bg-[#00a3ff] hover:bg-[#0088cc] text-black font-medium px-4 py-2"
          >
            Игра
          </button>
        </div>
      </div>

      <div className="max-w-2xl space-y-5">
        
        <div className="bg-[#16161c] border border-[#636370]/20 rounded-2xl p-5 text-white relative">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название курса *"
            className="w-full bg-transparent outline-none text-2xl md:text-3xl font-semibold placeholder-white/40"
          />
          <div className="mt-3 flex items-center gap-3 relative">
            <button
              type="button"
              onClick={() => setShowFilters((s)=>!s)}
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
                  {( ["Легкий","Средний","Сложный"] as string[] ).map((lvl) => (
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
                  <button onClick={()=>setShowFilters(false)} className="text-xs px-3 py-1 rounded-lg bg-[var(--color-border-2)] hover:bg-[var(--color-border-hover-1)] text-[var(--color-text-2)]">Готово</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {editId && (
          <div className="pt-2">
            <button
              onClick={async () => {
                const ok = await confirm({ title: 'Удалить этот курс?', confirmText: 'Удалить', cancelText: 'Отмена', variant: 'danger' })
                if (!ok) return
                try {
                  await apiFetch(`/api/admin/courses/${editId}` as any, { method: 'DELETE' })
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
                onClick={() => openModule(m.id)}
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
            <span className="w-7 h-7 rounded-full bg-[var(--color-border-2)] text-[var(--color-text-2)] flex items-center justify-center text-xs">+</span>
            <span className="font-medium">Добавить модуль</span>
          </div>
          <LogIn className="w-5 h-5 text-[var(--color-text-4)]" />
        </button>

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

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={publish}
            className="rounded-2xl bg-[var(--color-accent-warm)] hover:bg-[#0088cc] text-black font-medium py-4 flex items-center justify-center gap-2 transition-colors"
          >
            Опубликовать
            <ArrowUpRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </main>
  )
}