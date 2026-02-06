"use client"

import { useEffect, useMemo, useState } from "react"
import { BadgeCheck, BookOpen, CalendarDays, CheckCircle2, Users, Wallet } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"

interface PlanClass {
    id: string
    name: string
    description?: string
    kruzhokTitle?: string
    scheduleDescription?: string | null
    mentor?: { id?: string; fullName?: string; email?: string } | null
    maxStudents: number
    seatsTaken: number
    seatsAvailable: number
    isFull: boolean
    nextLessons: Array<{ date: string; time: string }>
}

interface ClassPlan {
    id: string
    title: string
    description?: string
    ageMin?: number | null
    ageMax?: number | null
    priceMonthly: number
    currency: string
    classes: PlanClass[]
}

interface Child {
    id: string
    fullName: string
    email: string
}

interface EnrollmentRequest {
    id: string
    status: "PENDING" | "APPROVED" | "REJECTED"
    planTitle: string
    paymentCode: string
    paymentAmount: number
    currency: string
    comment?: string
    preferredSchedule?: string
    requestedAt?: string
}

export default function ClassesTab() {
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [plans, setPlans] = useState<ClassPlan[]>([])
    const [children, setChildren] = useState<Child[]>([])
    const [requests, setRequests] = useState<EnrollmentRequest[]>([])

    const [dialogOpen, setDialogOpen] = useState(false)
    const [activePlan, setActivePlan] = useState<ClassPlan | null>(null)
    const [selectedChildren, setSelectedChildren] = useState<Record<string, boolean>>({})
    const [classSelections, setClassSelections] = useState<Record<string, string>>({})
    const [comment, setComment] = useState("")
    const [preferredSchedule, setPreferredSchedule] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState<null | { paymentCode: string; amount: number; currency: string }>(null)

    const loadData = async () => {
        setLoading(true)
        try {
            const [plansRes, childrenRes, requestsRes] = await Promise.all([
                apiFetch<ClassPlan[]>("/parent/class-plans").catch(() => []),
                apiFetch<Child[]>("/parent/children").catch(() => []),
                apiFetch<EnrollmentRequest[]>("/parent/enrollment-requests").catch(() => [])
            ])
            setPlans(plansRes || [])
            setChildren(childrenRes || [])
            setRequests(requestsRes || [])
        } catch {
            setPlans([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const resetForm = () => {
        setSelectedChildren({})
        setClassSelections({})
        setComment("")
        setPreferredSchedule("")
        setSubmitting(false)
        setSuccess(null)
    }

    const openPlan = (plan: ClassPlan) => {
        setActivePlan(plan)
        resetForm()
        setDialogOpen(true)
    }

    const selectedChildIds = useMemo(
        () => Object.entries(selectedChildren).filter(([, v]) => v).map(([id]) => id),
        [selectedChildren]
    )

    const totalAmount = useMemo(() => {
        if (!activePlan) return 0
        return selectedChildIds.length * (activePlan.priceMonthly || 0)
    }, [activePlan, selectedChildIds])

    const formatCurrency = (amount: number, currency = "KZT") => {
        const label = currency === "KZT" ? "тг" : currency
        return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount || 0)} ${label}`
    }

    const getScheduleLabel = (cls?: PlanClass) => {
        if (!cls) return ""
        if (cls.scheduleDescription) return cls.scheduleDescription
        if (cls.nextLessons?.length) {
            return cls.nextLessons
                .map((item) => {
                    const date = new Date(item.date).toLocaleDateString("ru-RU")
                    return `${date} ${item.time || ""}`.trim()
                })
                .join(", ")
        }
        return "Расписание уточняется"
    }

    const missingClassForAny = selectedChildIds.some((id) => !classSelections[id])

    const handleSubmit = async () => {
        if (!activePlan) return
        if (selectedChildIds.length === 0) {
            toast({ title: "Выберите учеников", description: "Нужно выбрать хотя бы одного ребёнка." })
            return
        }
        if (missingClassForAny && !preferredSchedule.trim()) {
            toast({
                title: "Укажите время",
                description: "Если вы не выбрали класс, напишите желаемое время.",
                variant: "destructive"
            })
            return
        }

        setSubmitting(true)
        try {
            const payload = {
                planId: activePlan.id,
                comment: comment.trim() || undefined,
                preferredSchedule: preferredSchedule.trim() || undefined,
                students: selectedChildIds.map((childId) => ({
                    studentId: childId,
                    desiredClassId: classSelections[childId] || undefined
                }))
            }

            const res = await apiFetch<{ paymentCode: string; amount: number; currency: string }>("/parent/enrollment-requests", {
                method: "POST",
                body: JSON.stringify(payload)
            })

            setSuccess({ paymentCode: res.paymentCode, amount: res.amount, currency: res.currency })
            loadData()
        } catch (err: any) {
            toast({
                title: "Не удалось отправить заявку",
                description: err?.message || "Попробуйте ещё раз",
                variant: "destructive"
            })
        } finally {
            setSubmitting(false)
        }
    }

    const statusBadge = (status: EnrollmentRequest["status"]) => {
        switch (status) {
            case "APPROVED":
                return <Badge className="bg-green-500/20 text-green-400">Одобрено</Badge>
            case "REJECTED":
                return <Badge className="bg-red-500/20 text-red-400">Отклонено</Badge>
            default:
                return <Badge className="bg-yellow-500/20 text-yellow-400">Ожидает</Badge>
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-[var(--color-text-3)]">Загрузка...</div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[{
                    icon: BadgeCheck,
                    title: "Почему мы",
                    text: "Проектное обучение: дети собирают и программируют реальные проекты."
                }, {
                    icon: Users,
                    title: "Небольшие группы",
                    text: "До 10 учеников в группе — внимание каждому и быстрый прогресс."
                }, {
                    icon: CalendarDays,
                    title: "Гибкое расписание",
                    text: "Выбирайте удобные группы или оставьте запрос на другое время."
                }].map((item) => {
                    const Icon = item.icon
                    return (
                        <div key={item.title} className="card p-5 flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#00a3ff]/20 flex items-center justify-center">
                                <Icon className="w-5 h-5 text-[#00a3ff]" />
                            </div>
                            <div>
                                <div className="text-[var(--color-text-1)] font-semibold">{item.title}</div>
                                <div className="text-sm text-[var(--color-text-3)] mt-1">{item.text}</div>
                            </div>
                        </div>
                    )
                })}
            </section>

            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[var(--color-text-1)] flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-[#00a3ff]" />
                        Абонементы
                    </h2>
                </div>

                {plans.length === 0 ? (
                    <div className="card p-8 text-center text-[var(--color-text-3)]">
                        Абонементы пока не созданы. Пожалуйста, обратитесь к администратору.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {plans.map((plan) => (
                            <div key={plan.id} className="card p-5 flex flex-col gap-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="text-lg font-semibold text-[var(--color-text-1)]">{plan.title}</div>
                                        <div className="text-sm text-[var(--color-text-3)] mt-1">{plan.description || "Описание будет обновлено."}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-bold text-[#00a3ff]">{formatCurrency(plan.priceMonthly, plan.currency)}</div>
                                        <div className="text-xs text-[var(--color-text-3)]">в месяц</div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-3)]">
                                    {plan.ageMin !== null && plan.ageMax !== null && (
                                        <Badge variant="outline">{plan.ageMin}–{plan.ageMax} жас</Badge>
                                    )}
                                    <Badge variant="outline">Классов: {plan.classes.length}</Badge>
                                </div>
                                <div className="flex items-center justify-between mt-auto">
                                    <div className="text-sm text-[var(--color-text-3)]">
                                        Доступно мест: {plan.classes.reduce((sum, cls) => sum + (cls.seatsAvailable || 0), 0)}
                                    </div>
                                    <Button className="bg-[#00a3ff] hover:bg-[#0088cc]" onClick={() => openPlan(plan)}>
                                        Выбрать
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[var(--color-text-1)] flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-[#00a3ff]" />
                        Мои заявки
                    </h2>
                </div>

                {requests.length === 0 ? (
                    <div className="card p-8 text-center text-[var(--color-text-3)]">
                        Заявок пока нет. Выберите абонемент, чтобы записать ребёнка.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {requests.map((req) => (
                            <div key={req.id} className="card p-5 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="font-semibold text-[var(--color-text-1)]">{req.planTitle}</div>
                                    {statusBadge(req.status)}
                                </div>
                                <div className="text-sm text-[var(--color-text-3)]">
                                    Сумма: {formatCurrency(req.paymentAmount, req.currency)}
                                </div>
                                {req.paymentCode && req.status === "PENDING" && (
                                    <div className="text-xs text-[var(--color-text-3)]">
                                        Код оплаты: <span className="text-[var(--color-text-1)] font-medium">{req.paymentCode}</span>
                                    </div>
                                )}
                                {req.requestedAt && (
                                    <div className="text-xs text-[var(--color-text-3)]">
                                        Отправлено: {new Date(req.requestedAt).toLocaleDateString("ru-RU")}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open)
                if (!open) {
                    resetForm()
                }
            }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{success ? "Оплата" : "Запись на абонемент"}</DialogTitle>
                    </DialogHeader>

                    {!activePlan ? (
                        <div className="text-sm text-[var(--color-text-3)]">План не выбран.</div>
                    ) : success ? (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-[#00a3ff]/30 bg-[#00a3ff]/10 p-4">
                                <div className="text-sm text-[var(--color-text-3)]">Код оплаты</div>
                                <div className="text-2xl font-bold text-[#00a3ff] tracking-widest">{success.paymentCode}</div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-3"
                                    onClick={() => navigator.clipboard?.writeText(success.paymentCode)}
                                >
                                    Скопировать код
                                </Button>
                            </div>

                            <div className="space-y-2 text-sm text-[var(--color-text-2)]">
                                <div>Отправьте оплату через Kaspi на номер:</div>
                                <div className="text-lg font-semibold text-[var(--color-text-1)]">+7 776 045 7776</div>
                                <div>Сумма к оплате: <strong>{formatCurrency(success.amount, success.currency)}</strong></div>
                                <div>В комментарии перевода укажите код, который показан выше.</div>
                                <div className="text-[var(--color-text-3)]">После оплаты ожидайте подтверждения в течение 1–2 часов.</div>
                                <div className="text-[var(--color-text-3)]">Система напомнит о продлении абонемента заранее.</div>
                            </div>

                            <Button className="w-full" onClick={() => setDialogOpen(false)}>
                                Понятно
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="space-y-1">
                                <div className="text-sm text-[var(--color-text-3)]">Абонемент</div>
                                <div className="text-[var(--color-text-1)] font-semibold">{activePlan.title}</div>
                                <div className="text-sm text-[var(--color-text-3)]">{activePlan.description}</div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--color-text-1)]">Выберите учеников</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {children.map((child) => {
                                        const checked = !!selectedChildren[child.id]
                                        return (
                                            <button
                                                key={child.id}
                                                onClick={() => {
                                                    setSelectedChildren((prev) => ({ ...prev, [child.id]: !checked }))
                                                    if (checked) {
                                                        setClassSelections((prev) => {
                                                            const next = { ...prev }
                                                            delete next[child.id]
                                                            return next
                                                        })
                                                    }
                                                }}
                                                className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${checked ? "border-[#00a3ff] bg-[#00a3ff]/10" : "border-[var(--color-border-1)] bg-[var(--color-surface-2)]"}`}
                                            >
                                                <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${checked ? "border-[#00a3ff] bg-[#00a3ff]" : "border-[var(--color-border-1)]"}`}>
                                                    {checked && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                </div>
                                                <div>
                                                    <div className="text-sm text-[var(--color-text-1)]">{child.fullName}</div>
                                                    <div className="text-xs text-[var(--color-text-3)]">{child.email}</div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {selectedChildIds.length > 0 && (
                                <div className="space-y-3">
                                    <div className="text-sm font-medium text-[var(--color-text-1)]">Выберите классы</div>
                                    {selectedChildIds.map((childId) => {
                                        const child = children.find((c) => c.id === childId)
                                        const selectedClassId = classSelections[childId] || ""
                                        const selectedClass = activePlan.classes.find((cls) => cls.id === selectedClassId)

                                        return (
                                            <div key={childId} className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] p-3 space-y-2">
                                                <div className="text-sm text-[var(--color-text-1)] font-medium">{child?.fullName}</div>
                                                <Select
                                                    value={selectedClassId}
                                                    onValueChange={(value) => setClassSelections((prev) => ({ ...prev, [childId]: value }))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Выберите класс" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {activePlan.classes.map((cls) => (
                                                            <SelectItem key={cls.id} value={cls.id} disabled={cls.isFull}>
                                                                {cls.name} • {cls.kruzhokTitle} • {getScheduleLabel(cls)} {cls.isFull ? "(мест нет)" : `(${cls.seatsAvailable} мест)`}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {selectedClass && (
                                                    <div className="text-xs text-[var(--color-text-3)]">
                                                        Расписание: {getScheduleLabel(selectedClass)}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--color-text-1)]">Желаемое время (если нет подходящего класса)</div>
                                <Input
                                    value={preferredSchedule}
                                    onChange={(e) => setPreferredSchedule(e.target.value)}
                                    placeholder="Например: Вт/Чт после 18:00"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--color-text-1)]">Комментарий</div>
                                <Textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Дополнительные пожелания"
                                />
                            </div>

                            <div className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] p-3 flex items-center justify-between">
                                <div className="text-sm text-[var(--color-text-3)]">Итого за месяц</div>
                                <div className="text-lg font-semibold text-[var(--color-text-1)]">{formatCurrency(totalAmount, activePlan.currency)}</div>
                            </div>

                            <Button
                                className="w-full bg-[#00a3ff] hover:bg-[#0088cc]"
                                onClick={handleSubmit}
                                disabled={submitting}
                            >
                                {submitting ? "Отправка..." : "Отправить заявку"}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
