"use client"
import {
  User as UserIcon,
  Trophy,
  Coins,
  GraduationCap,
  Link2,
  Copy,
  RefreshCw,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth/auth-context"
import { toast } from "@/hooks/use-toast"
import { apiFetch } from "@/lib/api"
import { useRouter } from "next/navigation"
import MyCertificates from "@/components/profile/my-certificates"

type MentorContact = {
  id: string
  fullName: string
  email: string
  phone?: string | null
  groups: Array<{ className?: string; kruzhokTitle?: string }>
}

type ProfileTabKey = "overview" | "certificates"

export default function ProfileTab() {
  const router = useRouter()
  const { user, updateProfile, loading } = useAuth()
  const [fullName, setFullName] = useState("")
  const [institution, setInstitution] = useState("")
  const [mentors, setMentors] = useState<MentorContact[]>([])
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("overview")
  const [linkCode, setLinkCode] = useState<string | null>(null)
  const [linkCodeExpiresAt, setLinkCodeExpiresAt] = useState<string | null>(null)
  const [linkCodeLoading, setLinkCodeLoading] = useState(false)
  const [linkedToParent, setLinkedToParent] = useState(false)

  const role = (user as any)?.role
  const isStudent = ["student", "STUDENT"].includes(String(role))

  const xp = Number((user as any)?.xp ?? (user as any)?.experiencePoints ?? 0)
  const level = useMemo(() => {
    const fallbackLevel = Math.floor(xp / 100) + 1
    return typeof (user as any)?.level === "number" && (user as any).level > 0
      ? (user as any).level
      : fallbackLevel
  }, [user, xp])
  const xpInLevel = xp % 100
  const levelProgress = Math.min(100, Math.round((xpInLevel / 100) * 100))
  const xpToNext = 100 - xpInLevel
  const coins = Number((user as any)?.coinBalance ?? 0)

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "")
      setInstitution((user as any).educationalInstitution || (user as any).institution || "")
    }
  }, [user])

  useEffect(() => {
    if (!isStudent) return
    apiFetch<{ mentors: MentorContact[] }>("/student/mentors")
      .then((res) => setMentors(res?.mentors || []))
      .catch(() => setMentors([]))
  }, [isStudent])

  useEffect(() => {
    if (!isStudent) return
    const loadLinkCode = async () => {
      setLinkCodeLoading(true)
      try {
        const res = await apiFetch<any>("/student/link-code")
        setLinkedToParent(!!res?.linked)
        setLinkCode(res?.code || null)
        setLinkCodeExpiresAt(res?.expiresAt || null)
      } catch {
        setLinkCode(null)
      } finally {
        setLinkCodeLoading(false)
      }
    }
    loadLinkCode()
  }, [isStudent])

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-8 animate-slide-up">
        <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
          <div className="text-[var(--color-text-1)] text-center">Загрузка профиля...</div>
        </div>
      </div>
    )
  }

  const statsCards = [
    { label: "Уровень", value: level, icon: GraduationCap },
    { label: "XP", value: xp, icon: Trophy },
    { label: "Бонусы", value: coins, icon: Coins },
  ]

  const refreshLinkCode = async () => {
    if (!isStudent) return
    setLinkCodeLoading(true)
    try {
      const res = await apiFetch<any>("/student/link-code", { method: "POST" })
      setLinkedToParent(!!res?.linked)
      setLinkCode(res?.code || null)
      setLinkCodeExpiresAt(res?.expiresAt || null)
      toast({ title: "New code generated" })
    } catch (err: any) {
      toast({ title: "Failed to refresh code", description: err?.message || "Попробуйте позже", variant: "destructive" })
    } finally {
      setLinkCodeLoading(false)
    }
  }

  const copyLinkCode = async () => {
    if (!linkCode) return
    try {
      await navigator.clipboard.writeText(linkCode)
      toast({ title: "Code copied" })
    } catch {
      toast({ title: "Copy failed", description: "Please copy manually.", variant: "destructive" })
    }
  }

  return (
    <div className="flex-1 p-4 md:p-8 animate-slide-up">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
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
                <h2 className="text-[var(--color-text-1)] text-xl md:text-2xl font-medium">
                  {user?.fullName || "Профиль без имени"}
                </h2>
                <span className="bg-[#00a3ff] text-white px-3 py-1 rounded-full text-sm font-medium w-fit">
                  Level {level}
                </span>
              </div>
              <div className="text-[var(--color-text-3)] text-sm space-y-1">
                <p>
                  <span className="text-[var(--color-text-1)]">Почта:</span>{" "}
                  {user?.email || "Не указана"}
                </p>
                <p>
                  <span className="text-[var(--color-text-1)]">Учебное заведение:</span>{" "}
                  {(user as any)?.educationalInstitution || (user as any)?.institution || "Не указано"}
                </p>
                {user?.primaryRole && (
                  <p>
                    <span className="text-[var(--color-text-1)]">Роль:</span> {user.primaryRole}
                  </p>
                )}
                {typeof (user as any)?.age === "number" && (
                  <p>
                    <span className="text-[var(--color-text-1)]">Возраст:</span> {(user as any)?.age}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {isStudent && (
          <div className="flex flex-wrap gap-2 border-b border-[var(--color-border-1)] pb-2">
            {(["overview", "certificates"] as ProfileTabKey[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "border-b-2 border-[var(--color-primary)] text-[var(--color-text-1)]"
                    : "text-[var(--color-text-3)] hover:text-[var(--color-text-1)]"
                }`}
              >
                {tab === "overview" ? "Обзор" : "Сертификаты"}
              </button>
            ))}
          </div>
        )}

        {(!isStudent || activeTab === "overview") && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statsCards.map((item) => (
                <div key={item.label} className="bg-[#16161c] rounded-xl p-4 border border-[#636370]/20 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#0e0e12] flex items-center justify-center">
                    <item.icon className="w-6 h-6 text-[#00a3ff]" />
                  </div>
                  <div className="text-2xl font-bold text-white">{item.value}</div>
                  <div className="text-xs text-white/60">{item.label}</div>
                </div>
              ))}
            </div>

            {isStudent && (
              <div className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-[#00a3ff]" />
                    <span className="text-white text-lg font-medium">Код привязки родителя</span>
                  </div>
                  {linkedToParent && (
                    <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full">Привязано</span>
                  )}
                </div>

                {linkedToParent ? (
                  <p className="text-sm text-white/70">Родительский аккаунт уже привязан.</p>
                ) : linkCodeLoading ? (
                  <p className="text-sm text-white/70">Загрузка кода...</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-3xl font-bold tracking-[0.4em] text-white">
                        {linkCode || "------"}
                      </div>
                      <button
                        onClick={copyLinkCode}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#2a2a35] hover:bg-[#333344] text-white px-3 py-2 text-xs"
                      >
                        <Copy className="w-4 h-4" /> Копировать
                      </button>
                      <button
                        onClick={refreshLinkCode}
                        disabled={linkCodeLoading}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#00a3ff] hover:bg-[#0088cc] text-black px-3 py-2 text-xs disabled:opacity-60"
                      >
                        <RefreshCw className="w-4 h-4" /> Обновить
                      </button>
                    </div>
                    {linkCodeExpiresAt && (
                      <div className="text-xs text-white/60">
                        Действует до: {new Date(linkCodeExpiresAt).toLocaleString("ru-RU")}
                      </div>
                    )}
                    <p className="text-xs text-white/60">
                      Передайте этот код родителю для привязки аккаунтов.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20">
              <div className="flex items-center justify-between mb-4">
                    <span className="text-white text-lg font-medium">Прогресс уровня</span>
                <span className="text-white/70 text-sm">{xpToNext} XP до следующего уровня</span>
              </div>
              <div className="w-full bg-[#636370]/20 rounded-full h-2 mb-2">
                <div
                  className="bg-gradient-to-r from-[#00a3ff] to-[#0080cc] h-2 rounded-full"
                  style={{ width: `${levelProgress}%` }}
                />
              </div>
              <div className="text-xs text-[#a0a0b0]">Продолжайте, чтобы достичь следующего уровня.</div>
            </div>

            {mentors.length > 0 && (
              <div className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20">
                <h3 className="text-white text-lg font-medium mb-4">Контакты менторов</h3>
                <div className="space-y-3">
                  {mentors.map((mentor) => (
                    <div key={mentor.id} className="bg-[#0e0e12] rounded-lg p-4 border border-[#636370]/10">
                      <div className="text-white font-medium">{mentor.fullName}</div>
                      <div className="text-white/70 text-sm">{mentor.email}</div>
                      {mentor.phone && <div className="text-white/70 text-sm">{mentor.phone}</div>}
                      {mentor.groups?.length > 0 && (
                        <div className="text-white/50 text-xs mt-2">
                          {mentor.groups.map((g, idx) => (
                            <span key={`${mentor.id}-${idx}`}>
                              {g.className || "Группа"}
                              {g.kruzhokTitle ? ` - ${g.kruzhokTitle}` : ""}
                              {idx < mentor.groups.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                    placeholder="Школа или учебное заведение"
                    className="bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
                <button
                  onClick={() => {
                    updateProfile({ fullName: fullName.trim(), institution: institution.trim() })
                    toast({ title: "Профиль обновлен" })
                  }}
                  className="mt-4 w-full md:w-auto rounded-lg bg-[#00a3ff] hover:bg-[#0088cc] text-black font-medium px-4 py-2"
                >
                  Сохранить
                </button>
              </div>
            )}

            <div className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20">
              <h3 className="text-white text-lg font-medium mb-4">Сброс пароля</h3>
              <button
                onClick={() =>
                  router.push(`/forgot-password${user?.email ? `?email=${encodeURIComponent(user.email)}` : ""}`)
                }
                className="rounded-lg bg-[#2a2a35] hover:bg-[#333344] text-white px-4 py-2 transition-colors"
              >
                Сбросить пароль
              </button>
            </div>
          </div>
        )}

        {isStudent && activeTab === "certificates" && (
          <div className="space-y-6">
            <MyCertificates />
          </div>
        )}

      </div>
    </div>
  )
}
