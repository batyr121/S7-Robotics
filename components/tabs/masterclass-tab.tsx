"use client"
import { useEffect, useState } from "react"
import { ExternalLink } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { useAuth } from "@/components/auth/auth-context"
import { toast } from "@/hooks/use-toast"

interface EventItem {
  id: string
  title: string
  description?: string
  date?: string
  imageUrl?: string
  url?: string
}

export default function MasterclassTab() {
  const { user } = useAuth()
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [openReg, setOpenReg] = useState<{ open: boolean; id?: string }>({ open: false })
  const [phone, setPhone] = useState("")
  const categories = [
    { value: "All", label: "Все" },
    { value: "Robotics", label: "Робототехника" },
    { value: "Coding", label: "Программирование" },
    { value: "AI", label: "ИИ" },
    { value: "Design", label: "Дизайн" }
  ]
  const [activeCat, setActiveCat] = useState<string>("All")

  const load = async (cat: string) => {
    setLoading(true)
    try {
      const qs = cat && cat !== "All" ? `?category=${encodeURIComponent(cat)}` : ""
      const list = await apiFetch<EventItem[]>(`/events${qs}`)
      setEvents(list || [])
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(activeCat)
  }, [activeCat])

  const openRegister = (id: string) => {
    if (!user) {
      toast({ title: "Нужен вход", description: "Войдите, чтобы записаться." })
      return
    }
    setOpenReg({ open: true, id })
  }

  const submitRegister = async () => {
    if (!openReg.id) return
    try {
      await apiFetch(`/events/${openReg.id}/register`, { method: "POST", body: JSON.stringify({ contactPhone: phone || undefined }) })
      toast({ title: "Заявка отправлена" })
      setPhone("")
      setOpenReg({ open: false })
    } catch (e: any) {
      toast({ title: "Не удалось отправить заявку", description: e?.message || "Попробуйте еще раз.", variant: "destructive" as any })
    }
  }

  return (
    <div className="flex-1 p-8 animate-slide-up">
      <div className="mb-8">
        <h2 className="text-white text-xl mb-6">Мастер‑классы и воркшопы</h2>
        <div className="flex items-center gap-2 mb-6">
          {categories.map((c) => (
            <button
              key={c.value}
              onClick={() => setActiveCat(c.value)}
              className={`text-xs font-medium px-3 py-1 rounded-full border ${activeCat === c.value ? "bg-[#00a3ff] text-white border-[#00a3ff]" : "bg-transparent text-white/80 border-[#2a2a35]"}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-white/70">Загрузка событий...</div>
        ) : events.length === 0 ? (
          <div className="text-center text-white/70 bg-[#16161c] border border-[#636370]/20 rounded-2xl p-10">Пока нет ближайших событий</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {events.map((e, index) => (
              <div key={e.id} className="bg-[#16161c] border border-[#636370]/20 rounded-lg p-6 hover:border-[#00a3ff]/50 transition-all duration-200 group animate-slide-up" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-white text-lg font-medium group-hover:text-[#00a3ff] transition-colors duration-200">{e.title}</h3>
                  {e.url && (
                    <a href={e.url} target="_blank" rel="noopener noreferrer" aria-label="Открыть ссылку на событие" className="inline-flex">
                      <ExternalLink className="w-5 h-5 text-[#a0a0b0] group-hover:text-[#00a3ff] transition-colors duration-200" />
                    </a>
                  )}
                </div>
                {e.imageUrl && <img src={e.imageUrl} alt={e.title} className="w-full h-40 object-cover rounded-md mb-3" />}
                <div className="space-y-2 text-sm text-[#a0a0b0]">
                  {e.description && <div>{e.description}</div>}
                  {e.date && <div>Дата: {new Date(e.date).toLocaleString("ru-RU")}</div>}
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => openRegister(e.id)} className="px-4 py-2 rounded-lg bg-[#00a3ff] hover:bg-[#0088cc] text-black font-medium">Записаться</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 animate-slide-up" style={{ animationDelay: "900ms" }}>
          <p className="text-[#a0a0b0] mb-4">Вопросы по событиям? Напишите нам:</p>
          <div className="flex gap-4">
            <a href="https://t.me/s7robotics" target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="w-12 h-12 bg-[#00a3ff] rounded-full flex items-center justify-center hover:bg-[#0088cc] transition-colors duration-200">
              <i className="bi bi-telegram text-white text-xl"></i>
            </a>
            <a href="https://wa.me/77760457776" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="w-12 h-12 bg-[#00a3ff] rounded-full flex items-center justify-center hover:bg-[#0088cc] transition-colors duration-200">
              <i className="bi bi-whatsapp text-white text-xl"></i>
            </a>
            <a href="https://www.instagram.com/s7.robotics?igsh=OGkyaW41enI0ZzQz" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-12 h-12 bg-[#00a3ff] rounded-full flex items-center justify-center hover:bg-[#0088cc] transition-colors duration-200">
              <i className="bi bi-instagram text-white text-xl"></i>
            </a>
          </div>
        </div>
      </div>

      {openReg.open && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in"
          onClick={() => setOpenReg({ open: false })}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="w-full max-w-sm bg-[#16161c] border border-[#2a2a35] rounded-2xl p-6 text-white animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Escape") setOpenReg({ open: false }) }}
            tabIndex={-1}
          >
            <div className="text-lg font-medium mb-3">Запись на событие</div>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Телефон для связи (необязательно)"
              className="w-full bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2 outline-none mb-3"
            />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setOpenReg({ open: false })} className="rounded-lg bg-[#2a2a35] hover:bg-[#333344] py-2">Отмена</button>
              <button onClick={submitRegister} className="rounded-lg bg-[#00a3ff] hover:bg-[#0088cc] text-black font-medium py-2">Отправить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
