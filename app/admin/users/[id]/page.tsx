"use client"
import { ArrowUpRight, Star, Users, CalendarDays, GraduationCap } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "@/hooks/use-toast"
import { apiFetch } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

type Role = "USER" | "ADMIN" | "STUDENT" | "PARENT" | "MENTOR" | "GUEST"
interface Overview {
  user: {
    id: string
    email: string
    fullName?: string
    role: Role
    banned?: boolean
    bannedReason?: string | null
    createdAt?: string
    parentId?: string | null
    profile?: { phone?: string | null } | null
    parent?: { id: string; fullName?: string; email: string; role: Role; createdAt?: string } | null
    children?: Array<{ id: string; fullName?: string; email: string; role: Role; createdAt?: string }>
  }
  registrations: { id: string; status: string; event: { id: string; title: string; date?: string } }[]
  enrollments: Array<{
    id: string
    classId: string
    status: string
    createdAt: string
    class: {
      id: string
      name: string
      isActive: boolean
      scheduleDescription?: string | null
      kruzhok?: { id: string; title: string }
      mentor?: { id: string; fullName?: string; email?: string }
      _count?: { enrollments: number }
    }
  }>
  attendance: {
    present: number
    late: number
    absent: number
    total: number
    averageGrade: number
    gradedCount: number
  }
  recentAttendance: Array<{
    id: string
    status: string
    grade?: number | null
    workSummary?: string | null
    notes?: string | null
    markedAt: string
    schedule: {
      id: string
      title: string
      scheduledDate: string
      scheduledTime?: string
      status: string
      class?: { id: string; name: string; kruzhok?: { id: string; title: string } } | null
    }
    markedBy?: { id: string; fullName?: string; email?: string }
  }>
  childrenOverview: Array<{
    child: { id: string; fullName?: string; email: string; role: Role; createdAt?: string }
    classes: Array<{
      createdAt: string
      status: string
      class: { id: string; name: string; isActive: boolean; scheduleDescription?: string | null; kruzhok?: { id: string; title: string }; mentor?: { id: string; fullName?: string } }
    }>
    attendance: { present: number; late: number; absent: number; total: number }
    grades: { avg: number; count: number }
  }>
  mentorStats?: {
    ratingAvg: number
    ratingCount: number
    lessonsCompleted: number
    classesMentored?: Array<{ id: string; name: string; isActive: boolean; scheduleDescription?: string | null; kruzhok?: { id: string; title: string }; _count?: { enrollments: number } }>
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

interface GroupOption {
  id: string
  name: string
  kruzhok?: { id: string; title: string }
}

export default function Page({ params }: { params: { id: string } }) {
  const [name, setName] = useState<string>("")
  const [role, setRole] = useState<Role | "">("")
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [savingControls, setSavingControls] = useState(false)
  const [controlForm, setControlForm] = useState({
    fullName: "",
    email: "",
    role: "USER" as Role,
    phone: "",
    parentId: ""
  })
  const [banReasonInput, setBanReasonInput] = useState("")
  const [parentSearch, setParentSearch] = useState("")
  const [parentOptions, setParentOptions] = useState<Array<{ id: string; fullName?: string; email: string }>>([])
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([])
  const [selectedClassId, setSelectedClassId] = useState("")

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true)
    try {
      const o = await apiFetch<Overview>(`/api/admin/users/${params.id}/overview`)
      setOverview(o)
      setName(o.user.fullName || o.user.email || params.id)
      setRole(o.user.role)
      setControlForm({
        fullName: o.user.fullName || "",
        email: o.user.email || "",
        role: o.user.role || "USER",
        phone: o.user.profile?.phone || "",
        parentId: o.user.parentId || ""
      })
      setBanReasonInput(o.user.bannedReason || "")
    } catch {
      setOverview(null)
      setName(params.id)
    } finally {
      setLoadingOverview(false)
    }
  }, [params.id])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    apiFetch<{ groups: GroupOption[] }>("/api/admin/groups")
      .then((res) => setGroupOptions(res?.groups || []))
      .catch(() => setGroupOptions([]))
  }, [])

  useEffect(() => {
    const q = parentSearch.trim()
    if (!q) {
      setParentOptions([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch<{ users: Array<{ id: string; fullName?: string; email: string }> }>(`/api/admin/users?role=PARENT&search=${encodeURIComponent(q)}&limit=8`)
        setParentOptions(res?.users || [])
      } catch {
        setParentOptions([])
      }
    }, 300)
    return () => clearTimeout(t)
  }, [parentSearch])

  const approveReg = async (eventId: string, regId: string) => {
    try {
      await apiFetch(`/api/admin/events/${eventId}/registrations/${regId}/approve`, { method: "POST" })
      setOverview((prev) => prev ? { ...prev, registrations: prev.registrations.map(r => r.id === regId ? { ...r, status: "approved" } : r) } : prev)
      toast({ title: "Р РµРіРёСЃС‚СЂР°С†РёСЏ РїРѕРґС‚РІРµСЂР¶РґРµРЅР°" })
    } catch (e: any) {
      toast({ title: "РћС€РёР±РєР°", description: e?.message || "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕРґС‚РІРµСЂРґРёС‚СЊ СЂРµРіРёСЃС‚СЂР°С†РёСЋ", variant: "destructive" as any })
    }
  }

  const rejectReg = async (eventId: string, regId: string) => {
    try {
      await apiFetch(`/api/admin/events/${eventId}/registrations/${regId}/reject`, { method: "POST" })
      setOverview((prev) => prev ? { ...prev, registrations: prev.registrations.map(r => r.id === regId ? { ...r, status: "rejected" } : r) } : prev)
      toast({ title: "Р РµРіРёСЃС‚СЂР°С†РёСЏ РѕС‚РєР»РѕРЅРµРЅР°" })
    } catch (e: any) {
      toast({ title: "РћС€РёР±РєР°", description: e?.message || "РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РєР»РѕРЅРёС‚СЊ СЂРµРіРёСЃС‚СЂР°С†РёСЋ", variant: "destructive" as any })
    }
  }

  const promote = async () => {
    try {
      await apiFetch(`/api/admin/users/${params.id}`, {
        method: "PUT",
        body: JSON.stringify({ role: "ADMIN" })
      })
      setRole("ADMIN")
      toast({ title: "Р РѕР»СЊ РѕР±РЅРѕРІР»РµРЅР°", description: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ С‚РµРїРµСЂСЊ Р°РґРјРёРЅ." })
    } catch (e: any) {
      toast({ title: "РћС€РёР±РєР°", description: e?.message || "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕРІС‹СЃРёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ", variant: "destructive" as any })
    }
  }

  const demote = async () => {
    try {
      await apiFetch(`/api/admin/users/${params.id}`, {
        method: "PUT",
        body: JSON.stringify({ role: "USER" })
      })
      setRole("USER")
      toast({ title: "Р РѕР»СЊ РѕР±РЅРѕРІР»РµРЅР°", description: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ С‚РµРїРµСЂСЊ РѕР±С‹С‡РЅС‹Р№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ." })
    } catch (e: any) {
      toast({ title: "РћС€РёР±РєР°", description: e?.message || "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕРЅРёР·РёС‚СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ", variant: "destructive" as any })
    }
  }

  const saveControls = async () => {
    setSavingControls(true)
    try {
      await apiFetch(`/api/admin/users/${params.id}`, {
        method: "PUT",
        body: JSON.stringify({
          fullName: controlForm.fullName.trim() || undefined,
          email: controlForm.email.trim() || undefined,
          role: controlForm.role,
          phone: controlForm.phone.trim() || null,
          parentId: controlForm.parentId || null
        })
      })
      toast({ title: "Сохранено", description: "Данные пользователя обновлены." })
      await loadOverview()
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось сохранить изменения", variant: "destructive" as any })
    } finally {
      setSavingControls(false)
    }
  }

  const banUser = async () => {
    try {
      await apiFetch(`/api/admin/users/${params.id}/ban`, {
        method: "POST",
        body: JSON.stringify({ reason: banReasonInput.trim() || undefined })
      })
      toast({ title: "Пользователь заблокирован" })
      await loadOverview()
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось заблокировать пользователя", variant: "destructive" as any })
    }
  }

  const unbanUser = async () => {
    try {
      await apiFetch(`/api/admin/users/${params.id}/unban`, { method: "POST" })
      toast({ title: "Блокировка снята" })
      await loadOverview()
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось снять блокировку", variant: "destructive" as any })
    }
  }

  const assignClassToUser = async () => {
    if (!selectedClassId) {
      toast({ title: "Выберите класс", variant: "destructive" as any })
      return
    }
    try {
      await apiFetch(`/api/admin/users/${params.id}/classes`, {
        method: "POST",
        body: JSON.stringify({ classId: selectedClassId })
      })
      toast({ title: "Класс назначен" })
      setSelectedClassId("")
      await loadOverview()
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось назначить класс", variant: "destructive" as any })
    }
  }

  const removeClassFromUser = async (classId: string) => {
    try {
      await apiFetch(`/api/admin/users/${params.id}/classes/${classId}`, { method: "DELETE" })
      toast({ title: "Класс снят" })
      await loadOverview()
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось снять класс", variant: "destructive" as any })
    }
  }

  const roleLabel = (value?: Role | "") => {
    switch (value) {
      case "ADMIN": return "РђРґРјРёРЅ"
      case "MENTOR": return "РњРµРЅС‚РѕСЂ"
      case "PARENT": return "Р РѕРґРёС‚РµР»СЊ"
      case "STUDENT": return "РЈС‡РµРЅРёРє"
      case "USER": return "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ"
      default: return "-"
    }
  }

  const regStatusLabel = (status: string) => {
    switch (status) {
      case "approved": return "РїРѕРґС‚РІРµСЂР¶РґРµРЅР°"
      case "rejected": return "РѕС‚РєР»РѕРЅРµРЅР°"
      case "pending": return "РѕР¶РёРґР°РЅРёРµ"
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
          <div className="flex items-center justify-between">
            <div className="text-[var(--color-text-1)] font-medium">РџСЂРѕС„РёР»СЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ</div>
            <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">{roleLabel(role)}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
              <div className="text-xs text-[var(--color-text-3)]">ID</div>
              <div className="text-[var(--color-text-1)] font-medium break-all">{overview?.user.id || params.id}</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
              <div className="text-xs text-[var(--color-text-3)]">РЎРѕР·РґР°РЅ</div>
              <div className="text-[var(--color-text-1)] font-medium">
                {overview?.user.createdAt ? new Date(overview.user.createdAt).toLocaleString("ru-RU") : "-"}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
              <div className="text-xs text-[var(--color-text-3)]">Email</div>
              <div className="text-[var(--color-text-1)] font-medium break-all">{overview?.user.email || "-"}</div>
            </div>
          </div>

          {(overview?.user.parent || (overview?.user.children && overview.user.children.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[var(--color-surface-2)] space-y-1">
                <div className="text-xs text-[var(--color-text-3)]">Р РѕРґРёС‚РµР»СЊ</div>
                {overview?.user.parent ? (
                  <Link href={`/admin/users/${overview.user.parent.id}`} className="text-[var(--color-text-1)] text-sm hover:text-white transition-colors">
                    {overview.user.parent.fullName || overview.user.parent.email}
                  </Link>
                ) : (
                  <div className="text-sm text-[var(--color-text-3)]">РќРµС‚</div>
                )}
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-surface-2)] space-y-1">
                <div className="text-xs text-[var(--color-text-3)]">Р”РµС‚Рё</div>
                {overview?.user.children && overview.user.children.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {overview.user.children.map((child) => (
                      <Link key={child.id} href={`/admin/users/${child.id}`} className="text-xs rounded-full border border-[var(--color-border-1)] px-2.5 py-1 text-[var(--color-text-2)] hover:text-white hover:border-[var(--color-text-2)] transition-colors">
                        {child.fullName || child.email}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--color-text-3)]">РќРµС‚</div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="card p-4 space-y-4">
          <div className="text-[var(--color-text-1)] font-medium">Оперативное управление</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-[var(--color-text-3)]">ФИО</div>
              <input
                value={controlForm.fullName}
                onChange={(e) => setControlForm((prev) => ({ ...prev, fullName: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-1)]"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-[var(--color-text-3)]">Email</div>
              <input
                value={controlForm.email}
                onChange={(e) => setControlForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-1)]"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-[var(--color-text-3)]">Роль</div>
              <select
                value={controlForm.role}
                onChange={(e) => setControlForm((prev) => ({ ...prev, role: e.target.value as Role }))}
                className="w-full rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-1)]"
              >
                {["USER", "STUDENT", "PARENT", "MENTOR", "ADMIN", "GUEST"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-[var(--color-text-3)]">Телефон</div>
              <input
                value={controlForm.phone}
                onChange={(e) => setControlForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-1)]"
                placeholder="+7 ..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-[var(--color-text-3)]">Привязка родителя</div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
              <input
                value={parentSearch}
                onChange={(e) => setParentSearch(e.target.value)}
                placeholder="Поиск родителя по имени/email"
                className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-1)]"
              />
              <button
                onClick={() => setControlForm((prev) => ({ ...prev, parentId: "" }))}
                className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-1)]"
              >
                Сбросить
              </button>
              <button
                onClick={saveControls}
                disabled={savingControls}
                className="rounded-lg bg-[#00a3ff] hover:bg-[#0088cc] px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
              >
                {savingControls ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
            {controlForm.parentId && (
              <div className="text-xs text-[var(--color-text-2)]">Текущий parentId: {controlForm.parentId}</div>
            )}
            {parentOptions.length > 0 && (
              <div className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] p-2 space-y-1">
                {parentOptions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setControlForm((prev) => ({ ...prev, parentId: p.id }))
                      setParentSearch("")
                      setParentOptions([])
                    }}
                    className="w-full text-left rounded-md px-2 py-1.5 hover:bg-[var(--color-surface-1)]"
                  >
                    <div className="text-sm text-[var(--color-text-1)]">{p.fullName || p.email}</div>
                    <div className="text-xs text-[var(--color-text-3)]">{p.email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
            <input
              value={banReasonInput}
              onChange={(e) => setBanReasonInput(e.target.value)}
              placeholder="Причина блокировки (необязательно)"
              className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-1)]"
            />
            <button onClick={banUser} className="rounded-lg bg-red-500/80 px-3 py-2 text-sm text-black font-medium">Заблокировать</button>
            <button onClick={unbanUser} className="rounded-lg bg-green-500/80 px-3 py-2 text-sm text-black font-medium">Разблокировать</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-1)]"
            >
              <option value="">Выберите класс для назначения</option>
              {groupOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}{g.kruzhok?.title ? ` • ${g.kruzhok.title}` : ""}
                </option>
              ))}
            </select>
            <button onClick={assignClassToUser} className="rounded-lg bg-[#00a3ff] hover:bg-[#0088cc] px-3 py-2 text-sm font-medium text-black">Назначить класс</button>
          </div>
        </section>

        <section className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[var(--color-text-1)] font-medium flex items-center gap-2">
                <Users className="w-4 h-4" /> РљР»Р°СЃСЃС‹ Рё РІСЃС‚СѓРїР»РµРЅРёРµ
              </div>
              <div className="text-sm text-[var(--color-text-3)]">Р“РґРµ СЃРѕСЃС‚РѕРёС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ Рё РєРѕРіРґР° РїСЂРёСЃРѕРµРґРёРЅРёР»СЃСЏ.</div>
            </div>
            <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">{overview?.enrollments?.length || 0}</Badge>
          </div>
          {loadingOverview ? (
            <div className="text-[var(--color-text-3)]">Р—Р°РіСЂСѓР·РєР°...</div>
          ) : overview?.enrollments && overview.enrollments.length > 0 ? (
            <div className="space-y-2 text-sm">
              {overview.enrollments.map((enr) => (
                <div key={enr.id} className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[var(--color-text-1)] font-medium">{enr.class?.name || "РљР»Р°СЃСЃ"}</div>
                    <div className="text-xs text-[var(--color-text-3)]">{new Date(enr.createdAt).toLocaleString("ru-RU")}</div>
                  </div>
                  <div className="text-xs text-[var(--color-text-3)]">ID РєР»Р°СЃСЃР°: <span className="text-[var(--color-text-2)]">{enr.classId}</span></div>
                  {enr.class?.kruzhok?.title && (
                    <div className="text-xs text-[var(--color-text-3)]">РќР°РїСЂР°РІР»РµРЅРёРµ: <span className="text-[var(--color-text-2)]">{enr.class.kruzhok.title}</span></div>
                  )}
                  {enr.class?.mentor && (
                    <div className="text-xs text-[var(--color-text-3)]">
                      РњРµРЅС‚РѕСЂ:{" "}
                      <Link href={`/admin/users/${enr.class.mentor.id}`} className="text-[var(--color-text-2)] hover:text-white transition-colors">
                        {enr.class.mentor.fullName || enr.class.mentor.email || enr.class.mentor.id}
                      </Link>
                    </div>
                  )}
                  {enr.class?.scheduleDescription && (
                    <div className="text-xs text-[var(--color-text-3)]">Р Р°СЃРїРёСЃР°РЅРёРµ: <span className="text-[var(--color-text-2)]">{enr.class.scheduleDescription}</span></div>
                  )}
                  <div className="pt-1">
                    <button
                      onClick={() => removeClassFromUser(enr.classId)}
                      className="px-2.5 py-1.5 text-xs rounded bg-red-500/80 text-black font-medium hover:bg-red-500"
                    >
                      Снять с класса
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[var(--color-text-3)]">РќРµС‚ РєР»Р°СЃСЃРѕРІ.</div>
          )}
        </section>

        {overview && overview.attendance.total > 0 && (
          <section className="card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[var(--color-text-1)] font-medium flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" /> РџРѕСЃРµС‰Р°РµРјРѕСЃС‚СЊ Рё РѕС†РµРЅРєРё
                </div>
                <div className="text-sm text-[var(--color-text-3)]">РЎРІРѕРґРєР° РїРѕ РѕС‚РјРµС‚РєР°Рј Рё РїРѕСЃР»РµРґРЅРёРµ РѕС†РµРЅРєРё.</div>
              </div>
              <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">{overview.attendance.total}</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                <div className="text-xs text-[var(--color-text-3)]">РџСЂРёСЃСѓС‚СЃС‚РІРѕРІР°Р»</div>
                <div className="text-[var(--color-text-1)] font-semibold">{overview.attendance.present}</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                <div className="text-xs text-[var(--color-text-3)]">РћРїРѕР·РґР°Р»</div>
                <div className="text-[var(--color-text-1)] font-semibold">{overview.attendance.late}</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                <div className="text-xs text-[var(--color-text-3)]">РћС‚СЃСѓС‚СЃС‚РІРѕРІР°Р»</div>
                <div className="text-[var(--color-text-1)] font-semibold">{overview.attendance.absent}</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                <div className="text-xs text-[var(--color-text-3)]">РЎСЂРµРґРЅСЏСЏ РѕС†РµРЅРєР°</div>
                <div className="text-[var(--color-text-1)] font-semibold">{overview.attendance.averageGrade.toFixed(2)}</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                <div className="text-xs text-[var(--color-text-3)]">РћС†РµРЅРѕРє</div>
                <div className="text-[var(--color-text-1)] font-semibold">{overview.attendance.gradedCount}</div>
              </div>
            </div>

            {overview.recentAttendance && overview.recentAttendance.length > 0 && (
              <div className="space-y-2 text-sm">
                {overview.recentAttendance.map((att) => (
                  <div key={att.id} className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] p-3 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[var(--color-text-1)] font-medium">{att.schedule?.title || "РЈСЂРѕРє"}</div>
                      <div className="text-xs text-[var(--color-text-3)]">{new Date(att.markedAt).toLocaleString("ru-RU")}</div>
                    </div>
                    <div className="text-xs text-[var(--color-text-3)] flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {att.schedule?.scheduledDate ? new Date(att.schedule.scheduledDate).toLocaleDateString("ru-RU") : "-"} {att.schedule?.scheduledTime || ""}
                    </div>
                    {att.schedule?.class?.name && (
                      <div className="text-xs text-[var(--color-text-3)]">РљР»Р°СЃСЃ: <span className="text-[var(--color-text-2)]">{att.schedule.class.name}</span></div>
                    )}
                    <div className="text-xs text-[var(--color-text-3)]">РЎС‚Р°С‚СѓСЃ: <span className="text-[var(--color-text-2)]">{att.status}</span></div>
                    {typeof att.grade === "number" && (
                      <div className="text-xs text-[var(--color-text-3)]">РћС†РµРЅРєР°: <span className="text-[var(--color-text-2)]">{att.grade}</span></div>
                    )}
                    {att.markedBy?.fullName && (
                      <div className="text-xs text-[var(--color-text-3)]">РћС‚РјРµС‚РёР»: <span className="text-[var(--color-text-2)]">{att.markedBy.fullName}</span></div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {overview?.mentorStats && (
          <section className="card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[var(--color-text-1)] font-medium">РџРѕРєР°Р·Р°С‚РµР»Рё РјРµРЅС‚РѕСЂР°</div>
                <div className="text-sm text-[var(--color-text-3)]">Р РµР№С‚РёРЅРі Рё РїРѕСЃР»РµРґРЅРёРµ РѕС‚Р·С‹РІС‹</div>
              </div>
              <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">
                {overview.mentorStats.ratingCount} РѕС‚Р·С‹РІРѕРІ
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                <div className="text-xs text-[var(--color-text-3)]">РЎСЂРµРґРЅРёР№ СЂРµР№С‚РёРЅРі</div>
                <div className="text-lg font-semibold text-[var(--color-text-1)] flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" /> {overview.mentorStats.ratingAvg.toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                <div className="text-xs text-[var(--color-text-3)]">РЈСЂРѕРєРѕРІ РїСЂРѕРІРµРґРµРЅРѕ</div>
                <div className="text-lg font-semibold text-[var(--color-text-1)]">{overview.mentorStats.lessonsCompleted}</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                <div className="text-xs text-[var(--color-text-3)]">РљРѕР»РёС‡РµСЃС‚РІРѕ РѕС‚Р·С‹РІРѕРІ</div>
                <div className="text-lg font-semibold text-[var(--color-text-1)]">{overview.mentorStats.ratingCount}</div>
              </div>
            </div>
            {overview.mentorStats.classesMentored && overview.mentorStats.classesMentored.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-[var(--color-text-3)]">РљР»Р°СЃСЃС‹ РјРµРЅС‚РѕСЂР°</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {overview.mentorStats.classesMentored.map((cls) => (
                    <div
                      key={cls.id}
                      className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] p-3 space-y-1"
                    >
                      <div className="text-[var(--color-text-1)] font-medium">{cls.name}</div>
                      {cls.kruzhok?.title && (
                        <div className="text-xs text-[var(--color-text-3)]">
                          РќР°РїСЂР°РІР»РµРЅРёРµ: <span className="text-[var(--color-text-2)]">{cls.kruzhok.title}</span>
                        </div>
                      )}
                      <div className="text-xs text-[var(--color-text-3)]">
                        РЈС‡РµРЅРёРєРё: <span className="text-[var(--color-text-2)]">{cls._count?.enrollments || 0}</span>
                      </div>
                      {cls.scheduleDescription && (
                        <div className="text-xs text-[var(--color-text-3)]">
                          Р Р°СЃРїРёСЃР°РЅРёРµ: <span className="text-[var(--color-text-2)]">{cls.scheduleDescription}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {overview.mentorStats.recentReviews.length === 0 ? (
              <div className="text-sm text-[var(--color-text-3)]">РџРѕРєР° РЅРµС‚ РѕС‚Р·С‹РІРѕРІ.</div>
            ) : (
              <div className="space-y-2">
                {overview.mentorStats.recentReviews.map((review) => (
                  <div key={review.id} className="p-3 rounded-lg bg-[var(--color-surface-2)] text-sm">
                    <div className="flex items-center justify-between">
                      <div className="text-[var(--color-text-1)] font-medium">{review.student.fullName}</div>
                      <div className="text-[var(--color-text-3)]">{new Date(review.createdAt).toLocaleDateString("ru-RU")}</div>
                    </div>
                    <div className="text-[var(--color-text-3)]">РЈСЂРѕРє: {review.schedule.title}</div>
                    <div className="text-[var(--color-text-1)]">РћС†РµРЅРєР°: {review.rating}</div>
                    {review.comment && <div className="text-[var(--color-text-2)] mt-1">{review.comment}</div>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {overview?.childrenOverview && overview.childrenOverview.length > 0 && (
          <section className="card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[var(--color-text-1)] font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" /> Р”РµС‚Рё Рё РёС… РґР°РЅРЅС‹Рµ
                </div>
                <div className="text-sm text-[var(--color-text-3)]">РљР»Р°СЃСЃС‹, РІСЃС‚СѓРїР»РµРЅРёРµ Рё РѕС†РµРЅРєРё РєР°Р¶РґРѕРіРѕ СЂРµР±С‘РЅРєР°.</div>
              </div>
              <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">
                {overview.childrenOverview.length}
              </Badge>
            </div>

            <div className="space-y-3 text-sm">
              {overview.childrenOverview.map((item) => (
                <div
                  key={item.child.id}
                  className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/admin/users/${item.child.id}`}
                      className="text-[var(--color-text-1)] font-medium hover:text-white transition-colors"
                    >
                      {item.child.fullName || item.child.email}
                    </Link>
                    <div className="text-xs text-[var(--color-text-3)]">
                      {item.child.createdAt ? new Date(item.child.createdAt).toLocaleDateString("ru-RU") : ""}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="rounded-md bg-[var(--color-surface-1)] px-2 py-1">
                      РџСЂРёСЃСѓС‚СЃС‚РІРѕРІР°Р»: <span className="text-[var(--color-text-2)]">{item.attendance.present}</span>
                    </div>
                    <div className="rounded-md bg-[var(--color-surface-1)] px-2 py-1">
                      РћРїРѕР·РґР°Р»: <span className="text-[var(--color-text-2)]">{item.attendance.late}</span>
                    </div>
                    <div className="rounded-md bg-[var(--color-surface-1)] px-2 py-1">
                      РћС‚СЃСѓС‚СЃС‚РІРѕРІР°Р»: <span className="text-[var(--color-text-2)]">{item.attendance.absent}</span>
                    </div>
                    <div className="rounded-md bg-[var(--color-surface-1)] px-2 py-1">
                      РЎСЂРµРґРЅСЏСЏ: <span className="text-[var(--color-text-2)]">{item.grades.avg.toFixed(2)}</span> ({item.grades.count})
                    </div>
                  </div>

                  {item.classes.length > 0 && (
                    <div className="space-y-1 text-xs">
                      {item.classes.map((cls, idx) => (
                        <div key={`${cls.class.id}-${idx}`} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-[var(--color-text-1)]">{cls.class.name}</span>
                          <span className="text-[var(--color-text-3)]">
                            РІСЃС‚СѓРїРёР»: {new Date(cls.createdAt).toLocaleDateString("ru-RU")}
                          </span>
                          {cls.class.mentor?.id && (
                            <Link
                              href={`/admin/users/${cls.class.mentor.id}`}
                              className="text-[var(--color-text-3)] hover:text-white transition-colors"
                            >
                              РјРµРЅС‚РѕСЂ: {cls.class.mentor.fullName || cls.class.mentor.id}
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="card p-4 space-y-4">
          <div className="text-[var(--color-text-1)] font-medium">Р РµРіРёСЃС‚СЂР°С†РёРё РЅР° СЃРѕР±С‹С‚РёСЏ</div>
          {loadingOverview ? (
            <div className="text-[var(--color-text-3)]">Р—Р°РіСЂСѓР·РєР°...</div>
          ) : overview && overview.registrations.length > 0 ? (
            <div className="space-y-2 text-sm">
              {overview.registrations.map((r) => (
                <div key={r.id} className="flex items-center justify-between bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-3 py-2">
                  <div>
                    <div className="text-[var(--color-text-1)]">{r.event.title}</div>
                    <div className="text-[var(--color-text-3)] text-xs">{r.event.date ? new Date(r.event.date).toLocaleString("ru-RU") : ""}</div>
                    <div className="text-[var(--color-text-3)] text-xs">РЎС‚Р°С‚СѓСЃ: {regStatusLabel(r.status)}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => approveReg(r.event.id, r.id)} className="px-3 py-1 text-xs rounded bg-green-500 text-black">РџРѕРґС‚РІРµСЂРґРёС‚СЊ</button>
                    <button onClick={() => rejectReg(r.event.id, r.id)} className="px-3 py-1 text-xs rounded bg-red-500 text-white">РћС‚РєР»РѕРЅРёС‚СЊ</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[var(--color-text-3)]">РџРѕРєР° РЅРµС‚ СЂРµРіРёСЃС‚СЂР°С†РёР№.</div>
          )}
        </section>

        
      </div>
    </main>
  )
}
