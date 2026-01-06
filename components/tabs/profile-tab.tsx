"use client"
import { User as UserIcon, Trophy, ExternalLink, Plus } from "lucide-react"
import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth/auth-context"
import { toast } from "@/hooks/use-toast"
import { apiFetch } from "@/lib/api"
import { useRouter } from "next/navigation"

export default function ProfileTab() {
  const router = useRouter()
  const { user, updateProfile, loading } = useAuth()
  const [fullName, setFullName] = useState("")
  const [institution, setInstitution] = useState("")
  const [achievements, setAchievements] = useState<{ id: string; text: string; createdAt: number }[]>([])
  const [subs, setSubs] = useState<Array<{ id: string; title: string; description?: string; placement?: string; venue?: string; eventDate?: string; status: "pending" | "approved" | "rejected"; imageUrl?: string }>>([])
  const [openAdd, setOpenAdd] = useState(false)
  const [form, setForm] = useState({ title: "", description: "", projectSummary: "", venue: "", placement: "", eventDate: "" })
  const [myTeams, setMyTeams] = useState<Array<{ id: string; role: string; status: string; joinedAt: string; team: { id: string; name: string; description?: string } }>>([])

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "")
      // Fix: Use educationalInstitution instead of institution
      setInstitution((user as any).educationalInstitution || (user as any).institution || "")
    }
  }, [user])

  useEffect(() => {
    reloadAchievements().catch(() => { })
  }, [])

  const reloadAchievements = async () => {
    if (!user?.id) return
    try {
      const list = await apiFetch<any[]>(`/achievements/mine`)
      setAchievements(list || [])
    } catch (e: any) {
      console.warn("Failed to load achievements:", e?.message)
      // Не отображаем ошибку пользователю, но логируем в консоль
      setAchievements([])
    }
  }

  useEffect(() => {
    apiFetch<Array<{ id: string; title: string; description?: string; placement?: string; venue?: string; eventDate?: string; status: "pending" | "approved" | "rejected"; imageUrl?: string }>>("/submissions/competitions/mine")
      .then(setSubs)
      .catch(() => setSubs([]))
  }, [])

  useEffect(() => {
    apiFetch<Array<{ id: string; role: string; status: string; joinedAt: string; team: { id: string; name: string; description?: string } }>>('/teams/mine')
      .then(setMyTeams)
      .catch(() => setMyTeams([]))
  }, [])

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-8 animate-slide-up">
        <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
          <div className="text-[var(--color-text-1)] text-center">Загрузка профиля...</div>
        </div>
      </div>
    )
  }
  return (
    <div className="flex-1 p-4 md:p-8 animate-slide-up">
      <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">

        <div
          className="bg-[var(--color-surface-2)] rounded-xl p-4 md:p-6 border border-[var(--color-border-1)] animate-slide-up"
          style={{ animationDelay: "100ms" }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-[#00a3ff] to-[#0080cc] rounded-full flex items-center justify-center">
              <UserIcon className="w-8 h-8 md:w-10 md:h-10 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                <h2 className="text-[var(--color-text-1)] text-xl md:text-2xl font-medium">{user?.fullName || "Пользователь"}</h2>
                <span className="bg-[#00a3ff] text-white px-3 py-1 rounded-full text-sm font-medium w-fit">
                  {user?.level ?? 1} Уровень
                </span>
              </div>
              <div className="text-[var(--color-text-3)] text-sm space-y-1">
                <p>
                  <span className="text-[var(--color-text-1)]">Почта:</span> {user?.email || 'Не указано'}
                </p>
                <p>
                  <span className="text-[var(--color-text-1)]">Учреждение:</span> {(user as any)?.educationalInstitution || (user as any)?.institution || 'Не указано'}
                </p>
                {user?.primaryRole && (
                  <p>
                    <span className="text-[var(--color-text-1)]">Роль:</span> {user.primaryRole}
                  </p>
                )}
                {typeof user?.age === 'number' && (
                  <p>
                    <span className="text-[var(--color-text-1)]">Возраст:</span> {user?.age}
                  </p>
                )}
                <p>
                  <span className="text-[var(--color-text-1)]">XP:</span> {user?.xp ?? 0}
                </p>
              </div>
            </div>
          </div>
        </div>


        {(!user?.fullName || !(user as any)?.educationalInstitution) && (
          <div className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20">
            <h3 className="text-white text-lg font-medium mb-4">Заполните профиль</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="ФИО"
                className="bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2 text-white outline-none"
              />
              <input
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Место обучения"
                className="bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2 text-white outline-none"
              />
            </div>
            <button
              onClick={() => {
                updateProfile({ fullName: fullName.trim(), institution: institution.trim() })
                toast({ title: "Профиль обновлён" })
              }}
              className="mt-4 w-full md:w-auto rounded-lg bg-[#00a3ff] hover:bg-[#0088cc] text-black font-medium px-4 py-2"
            >
              Сохранить
            </button>
          </div>
        )}

        {/* Password Reset Section */}
        <div className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20">
          <h3 className="text-white text-lg font-medium mb-4">Безопасность</h3>
          <button
            onClick={() => router.push(`/forgot-password${user?.email ? `?email=${encodeURIComponent(user.email)}` : ''}`)}
            className="rounded-lg bg-[#2a2a35] hover:bg-[#333344] text-white px-4 py-2 transition-colors"
          >
            Сбросить пароль
          </button>
        </div>


        <div
          className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20 animate-slide-up"
          style={{ animationDelay: "200ms" }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-white text-lg font-medium">{user?.level ?? 1}</span>
            <span className="text-white text-lg font-medium">{(user?.level ?? 1) + 1}</span>
          </div>
          <div className="w-full bg-[#636370]/20 rounded-full h-2 mb-4">
            <div
              className="bg-gradient-to-r from-[#00a3ff] to-[#0080cc] h-2 rounded-full"
              style={{
                width: `${Math.min(((user?.xp || 0) % 1000) / 10, 100)}%`
              }}
            ></div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#a0a0b0]">Не знаешь как поднимать уровень?</span>
            <button className="text-[#00a3ff] hover:text-[#0080cc] transition-colors duration-200 flex items-center gap-1">
              Смотри гайд <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>


        <div
          className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20 animate-slide-up"
          style={{ animationDelay: "300ms" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-lg font-medium">Достижения</h3>
            <button onClick={reloadAchievements} className="text-sm rounded-lg bg-[#2a2a35] hover:bg-[#333344] px-3 py-1 text-white/80">Обновить</button>
          </div>
          {achievements.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {achievements.map((a) => (
                <div key={a.id} className="bg-[#0e0e12] rounded-lg p-4 border border-[#636370]/10 group hover:border-[#00a3ff]/30 transition-all duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-medium">Достижение</h4>
                    <ExternalLink className="w-4 h-4 text-[#a0a0b0] group-hover:text-[#00a3ff] transition-colors duration-200" />
                  </div>
                  <p className="text-[#a0a0b0] text-xs mb-2">{a.text}</p>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#00ff88] text-black px-2 py-1 rounded text-xs">Получен</span>
                    <span className="text-[#a0a0b0] text-xs">{new Date(a.createdAt).toLocaleDateString('ru-RU')}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#0e0e12] rounded-lg p-4 border border-[#636370]/10 text-center">
              <Trophy className="w-8 h-8 text-[#636370] mx-auto mb-2" />
              <p className="text-[#a0a0b0] text-sm">Достижений пока нет</p>
            </div>
          )}
        </div>

        {/* Certificates Section */}
        <div
          className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20 animate-slide-up"
          style={{ animationDelay: "350ms" }}
        >
          <h3 className="text-white text-lg font-medium mb-4">Сертификаты</h3>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-[#636370]/20 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#636370]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h4 className="text-white font-medium mb-2">Сертификатов пока нет</h4>
            <p className="text-[#a0a0b0] text-sm">Завершите курсы, чтобы получить сертификаты</p>
          </div>
        </div>


        <div className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20 animate-slide-up" style={{ animationDelay: "350ms" }}>
          <h3 className="text-white text-lg font-medium mb-4">Мои команды</h3>
          {myTeams.length === 0 ? (
            <div className="text-white/60">Вы пока не в командах</div>
          ) : (
            <div className="space-y-3">
              {myTeams.map((m) => (
                <div key={m.id} className="bg-[#0e0e12] rounded-lg p-4 border border-[#636370]/10 flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">{m.team.name}</div>
                    {m.team.description && <div className="text-white/70 text-sm">{m.team.description}</div>}
                    <div className="text-white/60 text-xs mt-1">{new Date(m.joinedAt).toLocaleDateString('ru-RU')}</div>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="inline-block text-xs px-2 py-1 rounded-full bg-[#2a2a35] text-white/80">{m.role}</span>
                    <div>
                      <span className={`inline-block text-xs px-2 py-1 rounded-full ${m.status === 'approved' || m.status === 'active' ? 'bg-[#22c55e]/20 text-[#22c55e]' : m.status === 'rejected' ? 'bg-[#ef4444]/20 text-[#ef4444]' : 'bg-[#f59e0b]/20 text-[#f59e0b]'}`}>{m.status === 'pending' ? 'На проверке' : m.status === 'active' ? 'Активен' : m.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


        <div
          className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20 animate-slide-up"
          style={{ animationDelay: "400ms" }}
        >
          <h3 className="text-white text-lg font-medium mb-4">Пройденные курсы</h3>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-[#636370]/20 rounded-full flex items-center justify-center mb-4">
              <Trophy className="w-8 h-8 text-[#636370]" />
            </div>
            <h4 className="text-white font-medium mb-2">Пройденных курсов нет</h4>
            <p className="text-[#a0a0b0] text-sm">С нетерпением ждем ваших результатов</p>
          </div>
        </div>


        <div className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20 animate-slide-up" style={{ animationDelay: "500ms" }}>
          <h3 className="text-white text-lg font-medium mb-4">Мои соревнования</h3>
          {subs.length > 0 ? (
            <div className="space-y-3">
              {subs.map((s) => (
                <div key={s.id} className="bg-[#0e0e12] rounded-lg p-4 border border-[#636370]/10">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-medium">{s.title}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${s.status === 'approved' ? 'bg-[#22c55e]/20 text-[#22c55e]' : s.status === 'rejected' ? 'bg-[#ef4444]/20 text-[#ef4444]' : 'bg-[#f59e0b]/20 text-[#f59e0b]'}`}>{s.status === 'pending' ? 'На проверке' : s.status === 'approved' ? 'Одобрено' : 'Отклонено'}</span>
                  </div>
                  {s.imageUrl && <img src={s.imageUrl} alt="image" className="w-full h-40 object-cover rounded-md mb-2" />}
                  <div className="text-[#a0a0b0] text-sm space-y-1">
                    {s.description && <p>{s.description}</p>}
                    {s.placement && (<p><span className="text-white">Место:</span> {s.placement}</p>)}
                    {s.venue && (<p><span className="text-white">Локация:</span> {s.venue}</p>)}
                    {s.eventDate && (<p><span className="text-white">Дата:</span> {new Date(s.eventDate).toLocaleDateString('ru-RU')}</p>)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-white/70 text-sm">Пока нет заявок</div>
          )}

          <div className="mt-6 pt-6 border-t border-[#636370]/20">
            <p className="text-[#a0a0b0] text-sm mb-4">Участвовал в соревновании? Отправь заявку — админ проверит и опубликует:</p>
            <button onClick={() => setOpenAdd(true)} className="w-12 h-12 bg-[#00a3ff] hover:bg-[#0088cc] rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105">
              <Plus className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>


        {openAdd && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
            <div className="w-full max-w-lg bg-[#16161c] border border-[#2a2a35] rounded-2xl p-6 text-white animate-slide-up">
              <div className="text-lg font-medium mb-4">Добавить соревнование</div>
              <div className="grid grid-cols-1 gap-3">
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Название соревнования" className="bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2 outline-none" />
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Описание проекта" rows={4} className="bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2 outline-none" />
                <input value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })} placeholder="Занятое место (например, 1 место)" className="bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2 outline-none" />
                <input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Где проходило" className="bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2 outline-none" />
                <input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} className="bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2 outline-none" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => setOpenAdd(false)} className="rounded-lg bg-[#2a2a35] hover:bg-[#333344] py-2">Отмена</button>
                <button onClick={async () => {
                  if (!form.title.trim()) return
                  try {
                    await apiFetch('/submissions/competitions', { method: 'POST', body: JSON.stringify(form) })
                    toast({ title: 'Отправлено на модерацию' })
                    setOpenAdd(false)
                    setForm({ title: "", description: "", projectSummary: "", venue: "", placement: "", eventDate: "" })
                    const list = await apiFetch<Array<any>>('/submissions/competitions/mine')
                    setSubs(list)
                  } catch (e: any) {
                    toast({ title: 'Ошибка', description: e?.message || 'Не удалось отправить', variant: 'destructive' as any })
                  }
                }} className="rounded-lg bg-[#00a3ff] hover:bg-[#0088cc] text-black font-medium py-2">Отправить</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
