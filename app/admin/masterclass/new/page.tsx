"use client"
import { useEffect, useState } from "react"
import { ArrowUpRight, LogIn } from "lucide-react"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm"

export default function Page() {
  const router = useRouter()
  const confirm = useConfirm()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [format, setFormat] = useState<"online" | "offline" | "hybrid">("offline")
  const [isFree, setIsFree] = useState(true)
  const [price, setPrice] = useState<number>(0)
  const [date, setDate] = useState<string>("")
  const [location, setLocation] = useState<string>("")
  const [url, setUrl] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const categories = [
    { value: "Robotics", label: "Робототехника" },
    { value: "Coding", label: "Программирование" },
    { value: "AI", label: "ИИ" },
    { value: "Design", label: "Дизайн" },
  ]
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [customCats, setCustomCats] = useState("")

  useEffect(() => {
    try {
      const raw = localStorage.getItem("s7_admin_mc_draft")
      if (!raw) return
      const d = JSON.parse(raw)
      if (d.title) setTitle(d.title)
      if (d.description) setDescription(d.description)
      if (d.format) setFormat(d.format)
      if (typeof d.isFree === "boolean") setIsFree(d.isFree)
      if (typeof d.price === "number") setPrice(d.price)
      if (d.date) setDate(d.date)
      if (d.location) setLocation(d.location)
      if (d.url) setUrl(d.url)
      if (Array.isArray(d.categories)) {
        const map: Record<string, boolean> = {}
        d.categories.forEach((c: string) => map[c] = true)
        setSelected(map)
      }
      if (d.customCats) setCustomCats(d.customCats)
    } catch {}
  }, [])

  const publish = async () => {
    if (!title.trim()) {
      toast({ title: "Название обязательно" })
      return
    }
    const ok = await confirm({ title: "Опубликовать это событие?", confirmText: "Опубликовать", cancelText: "Отмена" })
    if (!ok) return
    setLoading(true)
    try {
      const cats = [
        ...Object.keys(selected).filter((k) => selected[k]),
        ...customCats.split(",").map((s) => s.trim()).filter(Boolean)
      ]
      await apiFetch("/api/admin/events", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          audience: cats.join(", ") || undefined,
          format,
          isFree,
          price: isFree ? 0 : Number(price || 0),
          date: date ? new Date(date).toISOString() : undefined,
          location: location.trim() || undefined,
          url: url.trim() || undefined,
          status: "published"
        })
      })
      toast({ title: "Событие опубликовано" })
      try { localStorage.removeItem("s7_admin_mc_draft") } catch {}
      router.push("/admin/masterclass")
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось опубликовать событие", variant: "destructive" as any })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--color-text-1)]">Создать событие</h2>
          <p className="text-sm text-[var(--color-text-3)]">Настройте мастер‑класс или публичное событие.</p>
        </div>
      </div>

      <div className="max-w-2xl space-y-5">
        <div className="card p-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название события"
            className="w-full bg-transparent outline-none text-2xl md:text-3xl font-semibold text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)]"
          />
          <div className="mt-3 flex items-center gap-3">
            <span className="inline-flex items-center text-xs font-medium px-3 py-1 rounded-full bg-[#f59e0b] text-black">
              Мастер‑класс
            </span>
            <select value={format} onChange={(e) => setFormat(e.target.value as any)} className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] text-[var(--color-text-1)] text-xs rounded-full px-3 py-1 outline-none">
              <option value="offline">Офлайн</option>
              <option value="online">Онлайн</option>
              <option value="hybrid">Гибрид</option>
            </select>
          </div>
        </div>

        <div className="card p-4 space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-2)] flex items-center justify-center text-xs">1</span>
            <span className="font-medium text-[var(--color-text-1)]">Описание</span>
            <LogIn className="w-5 h-5 text-[var(--color-text-3)]" />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="Опишите событие..."
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl p-4 text-[var(--color-text-1)] outline-none"
          />
        </div>

        <div className="card p-4">
          <div className="text-[var(--color-text-2)] mb-2">Категории</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {categories.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setSelected((s) => ({ ...s, [c.value]: !s[c.value] }))}
                className={`text-xs font-medium px-3 py-1 rounded-full border ${selected[c.value] ? "bg-[#00a3ff] text-white border-[#00a3ff]" : "bg-transparent text-[var(--color-text-2)] border-[var(--color-border-1)]"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Добавить свои категории (через запятую)"
            value={customCats}
            onChange={(e) => setCustomCats(e.target.value)}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-3 py-2 outline-none text-[var(--color-text-1)]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-4">
            <div className="text-[var(--color-text-3)] text-xs mb-1">Дата и время</div>
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent outline-none w-full text-[var(--color-text-1)]" />
          </div>
          <div className="card p-4">
            <div className="text-[var(--color-text-3)] text-xs mb-1">Место</div>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Город / площадка" className="bg-transparent outline-none w-full text-[var(--color-text-1)]" />
          </div>
          {format !== "offline" && (
            <div className="card p-4">
              <div className="text-[var(--color-text-3)] text-xs mb-1">Ссылка онлайн</div>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className="bg-transparent outline-none w-full text-[var(--color-text-1)]" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const cats = [
                ...Object.keys(selected).filter((k) => selected[k]),
                ...customCats.split(",").map((s) => s.trim()).filter(Boolean)
              ]
              try {
                localStorage.setItem("s7_admin_mc_draft", JSON.stringify({ title, description, format, isFree, price, date, location, url, categories: cats, customCats }))
                toast({ title: "Черновик сохранен" })
              } catch {}
            }}
            className="flex-1 rounded-2xl bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-1)] font-medium py-4 transition-colors"
          >
            Сохранить черновик
          </button>
          <button onClick={publish} disabled={loading} className="flex-1 rounded-2xl bg-[#00a3ff] hover:bg-[#0088cc] disabled:opacity-60 text-black font-medium py-4 flex items-center justify-center gap-2 transition-colors">
            {loading ? "Публикация..." : "Опубликовать"}
            <ArrowUpRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[var(--color-text-3)]">Стоимость</span>
          <div className="rounded-full border border-[var(--color-border-1)] p-1 flex items-center bg-[var(--color-surface-2)]">
            <button
              onClick={() => setIsFree(false)}
              className={`px-4 py-1 rounded-full text-sm ${!isFree ? "bg-[var(--color-surface-1)] text-[var(--color-text-1)]" : "text-[var(--color-text-3)]"}`}
            >
              Платно
            </button>
            <button
              onClick={() => setIsFree(true)}
              className={`px-4 py-1 rounded-full text-sm ${isFree ? "bg-white text-black" : "text-[var(--color-text-3)]"}`}
            >
              Бесплатно
            </button>
          </div>
        </div>
        {!isFree && (
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            placeholder="Цена в KZT"
            className="w-40 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] text-[var(--color-text-1)] rounded-lg px-3 py-2 outline-none"
          />
        )}
      </div>
    </main>
  )
}
