"use client"
import { ArrowUpRight, Star } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "@/hooks/use-toast"
import { apiFetch } from "@/lib/api"
import { Badge } from "@/components/ui/badge"

type Role = "USER" | "ADMIN" | "STUDENT" | "PARENT" | "MENTOR" | "GUEST"
interface Overview {
  user: {
    id: string
    email: string
    fullName?: string
    role: Role
  }
  registrations: { id: string; status: string; event: { id: string; title: string; date?: string } }[]
  mentorStats?: {
    ratingAvg: number
    ratingCount: number
    lessonsCompleted: number
    recentReviews: Array<{
      id: string
      rating: number
      comment?: string
      createdAt: string
      student: { id: string; fullName: string }
      schedule: { id: string; title: string; scheduledDate: string }
    }>
  }
}

export default function Page({ params }: { params: { id: string } }) {
  const [name, setName] = useState<string>("")
  const [role, setRole] = useState<Role | "">("")
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(true)

  useEffect(() => {
    apiFetch<Overview>(`/api/admin/users/${params.id}/overview`)
      .then((o) => {
        setOverview(o)
        setName(o.user.fullName || o.user.email || params.id)
        setRole(o.user.role)
      })
      .catch(() => {
        setOverview(null)
        setName(params.id)
      })
      .finally(() => setLoadingOverview(false))
  }, [params.id])

  const approveReg = async (eventId: string, regId: string) => {
    try {
      await apiFetch(`/api/admin/events/${eventId}/registrations/${regId}/approve`, { method: "POST" })
      setOverview((prev) => prev ? { ...prev, registrations: prev.registrations.map(r => r.id === regId ? { ...r, status: "approved" } : r) } : prev)
      toast({ title: "Регистрация подтверждена" })
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось подтвердить регистрацию", variant: "destructive" as any })
    }
  }

  const rejectReg = async (eventId: string, regId: string) => {
    try {
      await apiFetch(`/api/admin/events/${eventId}/registrations/${regId}/reject`, { method: "POST" })
      setOverview((prev) => prev ? { ...prev, registrations: prev.registrations.map(r => r.id === regId ? { ...r, status: "rejected" } : r) } : prev)
      toast({ title: "Регистрация отклонена" })
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось отклонить регистрацию", variant: "destructive" as any })
    }
  }

  const promote = async () => {
    try {
      await apiFetch(`/api/admin/users/${params.id}`, {
        method: "PUT",
        body: JSON.stringify({ role: "ADMIN" })
      })
      setRole("ADMIN")
      toast({ title: "Роль обновлена", description: "Пользователь теперь админ." })
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось повысить пользователя", variant: "destructive" as any })
    }
  }

  const demote = async () => {
    try {
      await apiFetch(`/api/admin/users/${params.id}`, {
        method: "PUT",
        body: JSON.stringify({ role: "USER" })
      })
      setRole("USER")
      toast({ title: "Роль обновлена", description: "Пользователь теперь обычный пользователь." })
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось понизить пользователя", variant: "destructive" as any })
    }
  }

  const roleLabel = (value?: Role | "") => {
    switch (value) {
      case "ADMIN": return "Админ"
      case "MENTOR": return "Ментор"
      case "PARENT": return "Родитель"
      case "STUDENT": return "Ученик"
      case "USER": return "Пользователь"
      default: return "-"
    }
  }

  const regStatusLabel = (status: string) => {
    switch (status) {
      case "approved": return "подтверждена"
      case "rejected": return "отклонена"
      case "pending": return "ожидание"
      default: return status
    }
  }

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
      <div className="max-w-4xl space-y-6">
        <div className="card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)] w-10 h-10 text-sm text-[var(--color-text-2)]">
              {params.id.slice(-2).toUpperCase()}
            </span>
            <div>
              <div className="font-medium text-[var(--color-text-1)]">{name}</div>
              <div className="text-xs text-[var(--color-text-3)]">{overview?.user.email}</div>
            </div>
          </div>
          <ArrowUpRight className="w-5 h-5 text-[var(--color-text-3)]" />
        </div>

        <section className="card p-4 space-y-3">
          <div className="text-[var(--color-text-1)] font-medium">Управление ролью</div>
          <div className="text-[var(--color-text-3)] text-sm">Текущая роль: <span className="text-[var(--color-text-1)] font-semibold">{roleLabel(role)}</span></div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={promote} className="rounded-lg bg-[#00a3ff] hover:bg-[#0088cc] text-black font-medium py-2">Сделать админом</button>
            <button onClick={demote} className="rounded-lg bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] py-2 text-[var(--color-text-1)]">Сделать пользователем</button>
          </div>
        </section>

        {overview?.mentorStats && (
          <section className="card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[var(--color-text-1)] font-medium">Показатели ментора</div>
                <div className="text-sm text-[var(--color-text-3)]">Рейтинг и последние отзывы</div>
              </div>
              <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">
                {overview.mentorStats.ratingCount} отзывов
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                <div className="text-xs text-[var(--color-text-3)]">Средний рейтинг</div>
                <div className="text-lg font-semibold text-[var(--color-text-1)] flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" /> {overview.mentorStats.ratingAvg.toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                <div className="text-xs text-[var(--color-text-3)]">Уроков проведено</div>
                <div className="text-lg font-semibold text-[var(--color-text-1)]">{overview.mentorStats.lessonsCompleted}</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                <div className="text-xs text-[var(--color-text-3)]">Количество отзывов</div>
                <div className="text-lg font-semibold text-[var(--color-text-1)]">{overview.mentorStats.ratingCount}</div>
              </div>
            </div>
            {overview.mentorStats.recentReviews.length === 0 ? (
              <div className="text-sm text-[var(--color-text-3)]">Пока нет отзывов.</div>
            ) : (
              <div className="space-y-2">
                {overview.mentorStats.recentReviews.map((review) => (
                  <div key={review.id} className="p-3 rounded-lg bg-[var(--color-surface-2)] text-sm">
                    <div className="flex items-center justify-between">
                      <div className="text-[var(--color-text-1)] font-medium">{review.student.fullName}</div>
                      <div className="text-[var(--color-text-3)]">{new Date(review.createdAt).toLocaleDateString("ru-RU")}</div>
                    </div>
                    <div className="text-[var(--color-text-3)]">Урок: {review.schedule.title}</div>
                    <div className="text-[var(--color-text-1)]">Оценка: {review.rating}</div>
                    {review.comment && <div className="text-[var(--color-text-2)] mt-1">{review.comment}</div>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="card p-4 space-y-4">
          <div className="text-[var(--color-text-1)] font-medium">Регистрации на события</div>
          {loadingOverview ? (
            <div className="text-[var(--color-text-3)]">Загрузка...</div>
          ) : overview && overview.registrations.length > 0 ? (
            <div className="space-y-2 text-sm">
              {overview.registrations.map((r) => (
                <div key={r.id} className="flex items-center justify-between bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-3 py-2">
                  <div>
                    <div className="text-[var(--color-text-1)]">{r.event.title}</div>
                    <div className="text-[var(--color-text-3)] text-xs">{r.event.date ? new Date(r.event.date).toLocaleString("ru-RU") : ""}</div>
                    <div className="text-[var(--color-text-3)] text-xs">Статус: {regStatusLabel(r.status)}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => approveReg(r.event.id, r.id)} className="px-3 py-1 text-xs rounded bg-green-500 text-black">Подтвердить</button>
                    <button onClick={() => rejectReg(r.event.id, r.id)} className="px-3 py-1 text-xs rounded bg-red-500 text-white">Отклонить</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[var(--color-text-3)]">Пока нет регистраций.</div>
          )}
        </section>

        
      </div>
    </main>
  )
}
