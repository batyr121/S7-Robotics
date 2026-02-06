"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BadgeCheck, ClipboardList, Plus, RefreshCw, Tag, Users } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useConfirm } from "@/components/ui/confirm"

interface GroupOption {
  id: string
  name: string
  kruzhokTitle?: string
  scheduleDescription?: string | null
  maxStudents?: number
  seatsTaken?: number
  isActive?: boolean
}

interface PlanClassAdmin {
  id: string
  name: string
  kruzhokTitle: string
  scheduleDescription?: string
  maxStudents: number
  seatsTaken: number
  isActive: boolean
}

interface ClassPlanAdmin {
  id: string
  title: string
  description?: string
  ageMin?: number | null
  ageMax?: number | null
  priceMonthly: number
  currency: string
  isActive: boolean
  classes: PlanClassAdmin[]
}

interface RequestSummary {
  id: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  parent: { id: string; fullName: string; email: string }
  planTitle: string
  paymentCode: string
  paymentAmount: number
  currency: string
  studentsCount: number
  requestedAt?: string
  reviewedAt?: string | null
}

interface RequestDetail {
  id: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  paymentCode: string
  paymentAmount: number
  currency: string
  comment?: string
  preferredSchedule?: string
  requestedAt?: string
  reviewedAt?: string | null
  adminNotes?: string
  parent: { id: string; fullName: string; email: string; profile?: { phone?: string } }
  plan: { id: string; title: string; priceMonthly: number; currency: string }
  students: Array<{
    id: string
    studentId: string
    fullName: string
    email: string
    phone?: string
    desiredClassId?: string | null
    desiredClassName?: string
    assignedClassId?: string | null
    assignedClassName?: string
    status?: string
  }>
  availableClasses: Array<{
    id: string
    name: string
    kruzhokTitle: string
    scheduleDescription?: string
    maxStudents: number
    seatsTaken: number
    seatsAvailable: number
    isFull: boolean
    isActive: boolean
  }>
}

const formatCurrency = (amount: number, currency = "KZT") => {
  const label = currency === "KZT" ? "тг" : currency
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount || 0)} ${label}`
}

export default function EnrollmentAdminTab() {
  const { toast } = useToast()
  const confirm = useConfirm()
  const [loading, setLoading] = useState(false)
  const [plans, setPlans] = useState<ClassPlanAdmin[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [requests, setRequests] = useState<RequestSummary[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<ClassPlanAdmin | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    ageMin: "",
    ageMax: "",
    priceMonthly: 0,
    isActive: true,
    classIds: [] as string[]
  })

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<RequestDetail | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [adminNotes, setAdminNotes] = useState("")
  const [startDate, setStartDate] = useState("")
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)
  const [paymentConfirmationNote, setPaymentConfirmationNote] = useState("")

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch<ClassPlanAdmin[]>("/admin/class-plans")
      setPlans(res || [])
    } catch {
      setPlans([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchGroups = useCallback(async () => {
    try {
      const res = await apiFetch<{ groups: GroupOption[] }>("/admin/groups")
      setGroups(res?.groups || [])
    } catch {
      setGroups([])
    }
  }, [])

  const fetchRequests = useCallback(async () => {
    try {
      const res = await apiFetch<RequestSummary[]>("/admin/enrollment-requests")
      setRequests(res || [])
    } catch {
      setRequests([])
    }
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchPlans(), fetchGroups(), fetchRequests()])
  }, [fetchPlans, fetchGroups, fetchRequests])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      ageMin: "",
      ageMax: "",
      priceMonthly: 0,
      isActive: true,
      classIds: []
    })
  }

  const openCreate = () => {
    setEditingPlan(null)
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (plan: ClassPlanAdmin) => {
    setEditingPlan(plan)
    setFormData({
      title: plan.title,
      description: plan.description || "",
      ageMin: plan.ageMin?.toString() || "",
      ageMax: plan.ageMax?.toString() || "",
      priceMonthly: Number(plan.priceMonthly || 0),
      isActive: plan.isActive !== false,
      classIds: plan.classes.map((cls) => cls.id)
    })
    setFormOpen(true)
  }

  const toggleClass = (id: string) => {
    setFormData((prev) => {
      const exists = prev.classIds.includes(id)
      return {
        ...prev,
        classIds: exists ? prev.classIds.filter((cid) => cid !== id) : [...prev.classIds, id]
      }
    })
  }

  const handleSavePlan = async () => {
    if (!formData.title.trim()) {
      toast({ title: "Название обязательно", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        ageMin: formData.ageMin ? Number(formData.ageMin) : undefined,
        ageMax: formData.ageMax ? Number(formData.ageMax) : undefined,
        priceMonthly: Number(formData.priceMonthly || 0),
        isActive: formData.isActive,
        classIds: formData.classIds
      }

      if (editingPlan) {
        await apiFetch(`/admin/class-plans/${editingPlan.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        })
      } else {
        await apiFetch("/admin/class-plans", {
          method: "POST",
          body: JSON.stringify(payload)
        })
      }

      toast({ title: "Сохранено" })
      setFormOpen(false)
      setEditingPlan(null)
      resetForm()
      fetchPlans()
    } catch (err: any) {
      toast({ title: "Ошибка", description: err?.message || "Не удалось сохранить", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSeedDefaults = async () => {
    const ok = await confirm({
      title: "Создать базовые абонементы",
      description: "Добавим WeDo 2.0, Spike и Arduino. Продолжить?"
    })
    if (!ok) return
    try {
      await apiFetch("/admin/class-plans/seed-defaults", { method: "POST" })
      toast({ title: "Готово", description: "Базовые абонементы добавлены" })
      fetchPlans()
    } catch (err: any) {
      toast({ title: "Ошибка", description: err?.message || "Не удалось создать" })
    }
  }

  const openRequestDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await apiFetch<RequestDetail>(`/admin/enrollment-requests/${id}`)
      setDetail(res)
      const initialAssignments: Record<string, string> = {}
      res.students.forEach((s) => {
        const preferred = s.assignedClassId || s.desiredClassId || ""
        if (preferred) {
          initialAssignments[s.id] = preferred
        }
      })
      setAssignments(initialAssignments)
      setAdminNotes(res.adminNotes || "")
      setPaymentConfirmed(false)
      setPaymentConfirmationNote("")
    } catch (err: any) {
      toast({ title: "Ошибка", description: err?.message || "Не удалось загрузить заявку", variant: "destructive" })
      setDetail(null)
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const approveRequest = async () => {
    if (!detail) return
    if (!paymentConfirmed) {
      toast({ title: "Подтвердите оплату", description: "Перед одобрением нужно подтвердить, что перевод от родителя проверен по коду.", variant: "destructive" })
      return
    }
    const missing = detail.students.filter((s) => !assignments[s.id])
    if (missing.length > 0) {
      toast({ title: "Назначьте классы", description: "Для каждого ученика нужно выбрать класс.", variant: "destructive" })
      return
    }

    const payload = {
      adminNotes: adminNotes.trim() || undefined,
      paymentConfirmed: true as const,
      paymentConfirmationNote: paymentConfirmationNote.trim() || undefined,
      startDate: startDate ? new Date(`${startDate}T00:00:00`).toISOString() : undefined,
      assignments: detail.students.map((s) => ({
        requestStudentId: s.id,
        assignedClassId: assignments[s.id]
      }))
    }

    try {
      await apiFetch(`/admin/enrollment-requests/${detail.id}/approve`, {
        method: "POST",
        body: JSON.stringify(payload)
      })
      toast({ title: "Заявка одобрена" })
      setDetailOpen(false)
      setDetail(null)
      fetchRequests()
      fetchPlans()
    } catch (err: any) {
      toast({ title: "Ошибка", description: err?.message || "Не удалось одобрить", variant: "destructive" })
    }
  }

  const rejectRequest = async () => {
    if (!detail) return
    if (!adminNotes.trim()) {
      toast({ title: "Укажите причину", variant: "destructive" })
      return
    }
    try {
      await apiFetch(`/admin/enrollment-requests/${detail.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ adminNotes })
      })
      toast({ title: "Заявка отклонена" })
      setDetailOpen(false)
      setDetail(null)
      fetchRequests()
    } catch (err: any) {
      toast({ title: "Ошибка", description: err?.message || "Не удалось отклонить", variant: "destructive" })
    }
  }

  const statusBadge = (status: RequestSummary["status"]) => {
    switch (status) {
      case "APPROVED":
        return <Badge className="bg-green-500/20 text-green-400">Одобрено</Badge>
      case "REJECTED":
        return <Badge className="bg-red-500/20 text-red-400">Отклонено</Badge>
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-400">Ожидает</Badge>
    }
  }

  const sortedRequests = useMemo(() => {
    const pending = requests.filter((r) => r.status === "PENDING")
    const rest = requests.filter((r) => r.status !== "PENDING")
    return [...pending, ...rest]
  }, [requests])

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Tag className="w-5 h-5 text-[#00a3ff]" />
            Абонементы
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Обновить
            </Button>
            <Button variant="outline" size="sm" onClick={handleSeedDefaults}>
              Добавить базовые
            </Button>
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-[#00a3ff] hover:bg-[#0088cc]" onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Новый абонемент
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingPlan ? "Редактировать абонемент" : "Создать абонемент"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-[var(--color-text-3)] mb-1">Название</div>
                    <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                  </div>
                  <div>
                    <div className="text-sm text-[var(--color-text-3)] mb-1">Описание</div>
                    <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <div className="text-sm text-[var(--color-text-3)] mb-1">Возраст от</div>
                      <Input value={formData.ageMin} onChange={(e) => setFormData({ ...formData, ageMin: e.target.value })} />
                    </div>
                    <div>
                      <div className="text-sm text-[var(--color-text-3)] mb-1">Возраст до</div>
                      <Input value={formData.ageMax} onChange={(e) => setFormData({ ...formData, ageMax: e.target.value })} />
                    </div>
                    <div>
                      <div className="text-sm text-[var(--color-text-3)] mb-1">Цена в месяц (KZT)</div>
                      <Input
                        type="number"
                        value={formData.priceMonthly}
                        onChange={(e) => setFormData({ ...formData, priceMonthly: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={formData.isActive} onCheckedChange={(v) => setFormData({ ...formData, isActive: v })} />
                    <div className="text-sm">Активен</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-[var(--color-text-3)]">Классы в абонементе</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-lg border border-[var(--color-border-1)] p-2">
                      {groups.map((group) => {
                        const checked = formData.classIds.includes(group.id)
                        return (
                          <button
                            key={group.id}
                            type="button"
                            className={`flex items-center justify-between rounded-md border px-3 py-2 text-left ${checked ? "border-[#00a3ff] bg-[#00a3ff]/10" : "border-[var(--color-border-1)]"}`}
                            onClick={() => toggleClass(group.id)}
                          >
                            <div>
                              <div className="text-sm text-[var(--color-text-1)]">{group.name}</div>
                              <div className="text-xs text-[var(--color-text-3)]">{group.kruzhokTitle || ""}</div>
                            </div>
                            {checked && <BadgeCheck className="w-4 h-4 text-[#00a3ff]" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setFormOpen(false)}>Отмена</Button>
                  <Button onClick={handleSavePlan} disabled={submitting}>
                    {submitting ? "Сохранение..." : "Сохранить"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {plans.length === 0 ? (
          <div className="card p-8 text-center text-[var(--color-text-3)]">Абонементы пока не созданы.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((plan) => (
              <div key={plan.id} className="card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-semibold text-[var(--color-text-1)]">{plan.title}</div>
                    <div className="text-sm text-[var(--color-text-3)]">{plan.description || ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-[#00a3ff]">{formatCurrency(plan.priceMonthly, plan.currency)}</div>
                    <div className="text-xs text-[var(--color-text-3)]">в месяц</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-3)]">
                  <Badge variant="outline">Классов: {plan.classes.length}</Badge>
                  {plan.ageMin !== null && plan.ageMax !== null && (
                    <Badge variant="outline">{plan.ageMin}–{plan.ageMax} жас</Badge>
                  )}
                  <Badge variant="outline" className={plan.isActive ? "text-green-400 border-green-400/30" : "text-red-400 border-red-400/30"}>
                    {plan.isActive ? "Активен" : "Выключен"}
                  </Badge>
                </div>
                <Button variant="outline" size="sm" onClick={() => openEdit(plan)}>
                  Редактировать
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#00a3ff]" />
            Заявки
          </h2>
        </div>

        {sortedRequests.length === 0 ? (
          <div className="card p-8 text-center text-[var(--color-text-3)]">Заявок пока нет.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedRequests.map((req) => (
              <div key={req.id} className="card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[var(--color-text-1)] font-semibold">{req.planTitle}</div>
                  {statusBadge(req.status)}
                </div>
                <div className="text-sm text-[var(--color-text-3)]">
                  Родитель: {req.parent?.fullName} ({req.parent?.email})
                </div>
                <div className="text-sm text-[var(--color-text-3)]">
                  Сумма: {formatCurrency(req.paymentAmount, req.currency)} • Ученики: {req.studentsCount}
                </div>
                <div className="text-xs text-[var(--color-text-3)]">Код оплаты: {req.paymentCode}</div>
                {req.requestedAt && (
                  <div className="text-xs text-[var(--color-text-3)]">Дата: {new Date(req.requestedAt).toLocaleDateString("ru-RU")}</div>
                )}
                <Button variant="outline" size="sm" onClick={() => openRequestDetail(req.id)}>
                  Открыть
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Заявка на абонемент</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="text-sm text-[var(--color-text-3)]">Загрузка...</div>
          ) : !detail ? (
            <div className="text-sm text-[var(--color-text-3)]">Заявка не найдена.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] p-3">
                  <div className="text-sm text-[var(--color-text-3)]">Родитель</div>
                  <div className="font-semibold text-[var(--color-text-1)]">{detail.parent.fullName}</div>
                  <div className="text-xs text-[var(--color-text-3)]">{detail.parent.email}</div>
                  {detail.parent.profile?.phone && (
                    <div className="text-xs text-[var(--color-text-3)]">Тел: {detail.parent.profile.phone}</div>
                  )}
                </div>
                <div className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] p-3">
                  <div className="text-sm text-[var(--color-text-3)]">Оплата</div>
                  <div className="font-semibold text-[var(--color-text-1)]">{formatCurrency(detail.paymentAmount, detail.currency)}</div>
                  <div className="text-xs text-[var(--color-text-3)]">Код: {detail.paymentCode}</div>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] p-3 space-y-1">
                <div className="text-sm text-[var(--color-text-3)]">Комментарий</div>
                <div className="text-sm text-[var(--color-text-1)]">{detail.comment || "—"}</div>
                <div className="text-sm text-[var(--color-text-3)]">Желаемое время: {detail.preferredSchedule || "—"}</div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--color-text-1)]">Ученики</div>
                {detail.students.map((student) => (
                  <div key={student.id} className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-[var(--color-text-1)]">{student.fullName}</div>
                        <div className="text-xs text-[var(--color-text-3)]">{student.email}</div>
                        {student.phone && <div className="text-xs text-[var(--color-text-3)]">Тел: {student.phone}</div>}
                      </div>
                      {student.desiredClassName && (
                        <Badge variant="outline">Желает: {student.desiredClassName}</Badge>
                      )}
                    </div>
                    <Select
                      value={assignments[student.id] || ""}
                      onValueChange={(value) => setAssignments((prev) => ({ ...prev, [student.id]: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Назначьте класс" />
                      </SelectTrigger>
                      <SelectContent>
                        {detail.availableClasses.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id} disabled={cls.isFull}>
                            {cls.name} • {cls.kruzhokTitle} • {cls.scheduleDescription || "Расписание уточняется"} {cls.isFull ? "(мест нет)" : `(${cls.seatsAvailable} мест)`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-sm text-[var(--color-text-3)] mb-1">Примечание администратора</div>
                  <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-3)] mb-1">Дата старта (необязательно)</div>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
              </div>

              <div className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[var(--color-text-1)]">Проверка оплаты</div>
                    <div className="text-xs text-[var(--color-text-3)]">Подтвердите, что перевод от родителя проверен по коду и сумме.</div>
                  </div>
                  <Switch checked={paymentConfirmed} onCheckedChange={setPaymentConfirmed} />
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-3)] mb-1">Комментарий проверки (необязательно)</div>
                  <Input
                    value={paymentConfirmationNote}
                    onChange={(e) => setPaymentConfirmationNote(e.target.value)}
                    placeholder="Например: Проверено в Kaspi, код совпадает"
                  />
                </div>
              </div>
            </div>
          )}
          {detail && !detailLoading && (
            <DialogFooter className="mt-4 gap-2">
              <Button variant="outline" onClick={rejectRequest}>Отклонить</Button>
              <Button onClick={approveRequest} disabled={!paymentConfirmed}>Одобрить</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
