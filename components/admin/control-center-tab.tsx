"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldCheck, UserCog, Users } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"

type RiskDashboard = {
    kpis: {
        pendingRequests: number
        overdueRequests: number
        waitlistOpen: number
        expiringSubscriptions7d: number
        classesNearCapacity: number
    }
    classesNearCapacity: Array<{
        id: string
        name: string
        seatsTaken: number
        maxStudents: number
        load: number
    }>
}

type PaymentQueueItem = {
    id: string
    status: "PENDING" | "APPROVED" | "REJECTED"
    parent: { id: string; fullName: string; email: string }
    planTitle: string
    paymentCode: string
    amount: number
    expectedAmount: number
    currency: string
    studentsCount: number
    requestedAt: string
    reviewedAt?: string | null
    ageMinutes: number
    slaStatus: "NORMAL" | "AT_RISK" | "OVERDUE"
    minutesToDeadline: number
    suspicious: boolean
}

type WaitlistEntry = {
    id: string
    status: "WAITING" | "CONTACTED" | "PROMOTED" | "CLOSED"
    preferredSchedule?: string | null
    note?: string | null
    parent: { id: string; fullName: string; email: string }
    student: { id: string; fullName: string; email: string }
    plan?: { id: string; title: string } | null
    class?: { id: string; name: string } | null
}

type GroupOption = {
    id: string
    name: string
    kruzhok?: { id: string; title: string } | null
}

type PermissionUser = {
    id: string
    fullName: string
    email: string
    deniedPermissions: string[]
    effectiveCount: number
}

type PermissionDetail = {
    user: { id: string; fullName: string; email: string; role: string }
    effectivePermissions: string[]
    deniedPermissions: string[]
}

type AuditLog = {
    id: string
    action: string
    entityType: string
    entityId?: string | null
    reason?: string | null
    createdAt: string
    actor?: { id: string; fullName?: string; email?: string } | null
    targetUser?: { id: string; fullName?: string; email?: string } | null
}

type NotificationTemplate = {
    id: string
    key: string
    channel: string
    isActive: boolean
    version: number
    updatedAt: string
}

const formatCurrency = (amount: number, currency = "KZT") => {
    const label = currency === "KZT" ? "тг" : currency
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount || 0)} ${label}`
}

const formatAgo = (minutes: number) => {
    if (minutes < 60) return `${minutes} мин`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours} ч ${mins} мин` : `${hours} ч`
}

export default function ControlCenterTab() {
    const { toast } = useToast()

    const [loading, setLoading] = useState(false)
    const [risk, setRisk] = useState<RiskDashboard | null>(null)
    const [paymentQueue, setPaymentQueue] = useState<PaymentQueueItem[]>([])
    const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
    const [groups, setGroups] = useState<GroupOption[]>([])
    const [waitlistTargetClass, setWaitlistTargetClass] = useState<Record<string, string>>({})
    const [permissionCatalog, setPermissionCatalog] = useState<string[]>([])
    const [permissionUsers, setPermissionUsers] = useState<PermissionUser[]>([])
    const [selectedPermissionUserId, setSelectedPermissionUserId] = useState("")
    const [permissionDetail, setPermissionDetail] = useState<PermissionDetail | null>(null)
    const [logs, setLogs] = useState<AuditLog[]>([])
    const [templates, setTemplates] = useState<NotificationTemplate[]>([])

    const loadRisk = useCallback(async () => {
        const data = await apiFetch<RiskDashboard>("/admin/risk-dashboard")
        setRisk(data)
    }, [])

    const loadPaymentQueue = useCallback(async () => {
        const data = await apiFetch<{ items: PaymentQueueItem[] }>("/admin/payment-queue?status=PENDING&limit=100")
        setPaymentQueue(data?.items || [])
    }, [])

    const loadWaitlist = useCallback(async () => {
        const data = await apiFetch<{ entries: WaitlistEntry[] }>("/admin/waitlist?status=ALL&limit=200")
        setWaitlist(data?.entries || [])
    }, [])

    const loadGroups = useCallback(async () => {
        const data = await apiFetch<{ groups: GroupOption[] }>("/admin/groups")
        setGroups(data?.groups || [])
    }, [])

    const loadPermissions = useCallback(async () => {
        const [catalog, users] = await Promise.all([
            apiFetch<{ permissions: string[] }>("/admin/permissions/catalog"),
            apiFetch<{ users: PermissionUser[] }>("/admin/permissions/users")
        ])
        setPermissionCatalog(catalog?.permissions || [])
        setPermissionUsers(users?.users || [])
    }, [])

    const loadPermissionUserDetail = useCallback(async (userId: string) => {
        if (!userId) {
            setPermissionDetail(null)
            return
        }
        const detail = await apiFetch<PermissionDetail>(`/admin/permissions/users/${userId}`)
        setPermissionDetail(detail)
    }, [])

    const loadLogs = useCallback(async () => {
        const data = await apiFetch<{ logs: AuditLog[] }>("/admin/audit-logs?limit=120")
        setLogs(data?.logs || [])
    }, [])

    const loadTemplates = useCallback(async () => {
        const data = await apiFetch<{ templates: NotificationTemplate[] }>("/admin/notification-templates")
        setTemplates(data?.templates || [])
    }, [])

    const refreshAll = useCallback(async () => {
        setLoading(true)
        try {
            await Promise.all([
                loadRisk(),
                loadPaymentQueue(),
                loadWaitlist(),
                loadGroups(),
                loadPermissions(),
                loadLogs(),
                loadTemplates()
            ])
        } finally {
            setLoading(false)
        }
    }, [loadGroups, loadLogs, loadPaymentQueue, loadPermissions, loadRisk, loadTemplates, loadWaitlist])

    useEffect(() => {
        refreshAll().catch((err: any) => {
            toast({ title: "Ошибка", description: err?.message || "Не удалось загрузить control center", variant: "destructive" })
        })
    }, [refreshAll, toast])

    useEffect(() => {
        if (!selectedPermissionUserId && permissionUsers.length > 0) {
            setSelectedPermissionUserId(permissionUsers[0].id)
        }
    }, [permissionUsers, selectedPermissionUserId])

    useEffect(() => {
        if (!selectedPermissionUserId) return
        loadPermissionUserDetail(selectedPermissionUserId).catch(() => setPermissionDetail(null))
    }, [loadPermissionUserDetail, selectedPermissionUserId])

    const requestSensitiveConfirmation = useCallback(async (params: {
        action: string
        entityType?: string
        entityId?: string
        reason?: string
    }) => {
        const challenge = await apiFetch<{ challengeId: string; expiresAt: string }>("/admin/sensitive-actions/challenge", {
            method: "POST",
            body: JSON.stringify({
                action: params.action,
                entityType: params.entityType,
                entityId: params.entityId,
                reason: params.reason
            })
        })

        const code = window.prompt(`Код подтверждения для ${params.action} отправлен администратору. Введите код:`)
        if (!code || !code.trim()) {
            throw new Error("Операция отменена: код подтверждения не введен")
        }

        return {
            challengeId: challenge.challengeId,
            code: code.trim(),
            reason: params.reason
        }
    }, [])

    const handleWaitlistContact = useCallback(async (entry: WaitlistEntry) => {
        try {
            const note = window.prompt("Комментарий родителю по листу ожидания:", entry.note || "") || ""
            const confirmation = await requestSensitiveConfirmation({
                action: "WAITLIST_CONTACT",
                entityType: "WAITLIST_ENTRY",
                entityId: entry.id,
                reason: note || undefined
            })

            await apiFetch(`/admin/waitlist/${entry.id}/contact`, {
                method: "POST",
                body: JSON.stringify({ note: note || undefined, confirmation })
            })

            toast({ title: "Отправлено", description: "Родитель получил обновление по листу ожидания" })
            await Promise.all([loadWaitlist(), loadLogs()])
        } catch (err: any) {
            toast({ title: "Ошибка", description: err?.message || "Не удалось связаться с родителем", variant: "destructive" })
        }
    }, [loadLogs, loadWaitlist, requestSensitiveConfirmation, toast])

    const handleWaitlistPromote = useCallback(async (entry: WaitlistEntry) => {
        const classId = waitlistTargetClass[entry.id] || entry.class?.id || ""
        if (!classId) {
            toast({ title: "Выберите класс", description: "Нужно выбрать целевой класс для перевода", variant: "destructive" })
            return
        }

        try {
            const confirmation = await requestSensitiveConfirmation({
                action: "WAITLIST_PROMOTE",
                entityType: "WAITLIST_ENTRY",
                entityId: entry.id,
                reason: `Promote to class ${classId}`
            })

            await apiFetch(`/admin/waitlist/${entry.id}/promote`, {
                method: "POST",
                body: JSON.stringify({ classId, confirmation })
            })

            toast({ title: "Готово", description: "Ученик переведен в класс" })
            await Promise.all([loadWaitlist(), loadLogs(), loadRisk()])
        } catch (err: any) {
            toast({ title: "Ошибка", description: err?.message || "Не удалось перевести ученика", variant: "destructive" })
        }
    }, [loadLogs, loadRisk, loadWaitlist, requestSensitiveConfirmation, toast, waitlistTargetClass])

    const handlePermissionToggle = useCallback(async (permission: string) => {
        if (!permissionDetail) return
        const allowedNow = permissionDetail.effectivePermissions.includes(permission)
        const nextAllowed = !allowedNow
        try {
            const confirmation = await requestSensitiveConfirmation({
                action: "PERMISSION_UPDATE",
                entityType: "ADMIN_PERMISSION_GRANT",
                entityId: permissionDetail.user.id,
                reason: `${permission} -> ${nextAllowed ? "allow" : "deny"}`
            })

            await apiFetch(`/admin/permissions/users/${permissionDetail.user.id}/grants`, {
                method: "POST",
                body: JSON.stringify({
                    permission,
                    allowed: nextAllowed,
                    confirmation
                })
            })

            toast({ title: "Права обновлены", description: `${permission}: ${nextAllowed ? "разрешено" : "запрещено"}` })
            await Promise.all([
                loadPermissions(),
                loadPermissionUserDetail(permissionDetail.user.id),
                loadLogs()
            ])
        } catch (err: any) {
            toast({ title: "Ошибка", description: err?.message || "Не удалось обновить право", variant: "destructive" })
        }
    }, [loadLogs, loadPermissionUserDetail, loadPermissions, permissionDetail, requestSensitiveConfirmation, toast])

    const handleSeedTemplates = useCallback(async () => {
        try {
            await apiFetch("/admin/notification-templates/seed-defaults", { method: "POST" })
            toast({ title: "Готово", description: "Базовые шаблоны уведомлений обновлены" })
            await Promise.all([loadTemplates(), loadLogs()])
        } catch (err: any) {
            toast({ title: "Ошибка", description: err?.message || "Не удалось обновить шаблоны", variant: "destructive" })
        }
    }, [loadLogs, loadTemplates, toast])

    const sortedPayments = useMemo(() => {
        const rows = [...paymentQueue]
        rows.sort((a, b) => b.ageMinutes - a.ageMinutes)
        return rows
    }, [paymentQueue])

    return (
        <div className="space-y-8">
            <section className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold text-[var(--color-text-1)]">Control Center</h2>
                    <div className="text-sm text-[var(--color-text-3)]">Риски, оплата, лист ожидания, права и аудит.</div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSeedTemplates}>
                        Шаблоны уведомлений
                    </Button>
                    <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        Обновить
                    </Button>
                </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="card p-4">
                    <div className="text-xs text-[var(--color-text-3)]">Ожидают проверки</div>
                    <div className="text-2xl font-semibold text-[var(--color-text-1)]">{risk?.kpis?.pendingRequests ?? 0}</div>
                </div>
                <div className="card p-4">
                    <div className="text-xs text-[var(--color-text-3)]">Просрочены SLA</div>
                    <div className="text-2xl font-semibold text-red-400">{risk?.kpis?.overdueRequests ?? 0}</div>
                </div>
                <div className="card p-4">
                    <div className="text-xs text-[var(--color-text-3)]">Лист ожидания</div>
                    <div className="text-2xl font-semibold text-[var(--color-text-1)]">{risk?.kpis?.waitlistOpen ?? 0}</div>
                </div>
                <div className="card p-4">
                    <div className="text-xs text-[var(--color-text-3)]">Продление 7 дней</div>
                    <div className="text-2xl font-semibold text-[var(--color-text-1)]">{risk?.kpis?.expiringSubscriptions7d ?? 0}</div>
                </div>
                <div className="card p-4">
                    <div className="text-xs text-[var(--color-text-3)]">Классы на пределе</div>
                    <div className="text-2xl font-semibold text-[var(--color-text-1)]">{risk?.kpis?.classesNearCapacity ?? 0}</div>
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex items-center gap-2 text-[var(--color-text-1)] font-semibold">
                    <Clock3 className="w-4 h-4" />
                    Очередь оплат
                </div>
                {sortedPayments.length === 0 ? (
                    <div className="card p-5 text-sm text-[var(--color-text-3)]">Очередь пуста.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {sortedPayments.map((item) => (
                            <div key={item.id} className="card p-4 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="font-semibold text-[var(--color-text-1)] truncate">{item.parent?.fullName || item.parent?.email}</div>
                                    <div className="flex gap-2">
                                        <Badge className={item.slaStatus === "OVERDUE" ? "bg-red-500/20 text-red-400" : item.slaStatus === "AT_RISK" ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"}>
                                            {item.slaStatus}
                                        </Badge>
                                        {item.suspicious && <Badge className="bg-red-500/20 text-red-400">Risk</Badge>}
                                    </div>
                                </div>
                                <div className="text-sm text-[var(--color-text-3)]">{item.planTitle}</div>
                                <div className="text-sm text-[var(--color-text-2)]">
                                    Код: <span className="font-medium">{item.paymentCode}</span> • Сумма: {formatCurrency(item.amount, item.currency)}
                                </div>
                                <div className="text-xs text-[var(--color-text-3)]">
                                    Ожидание: {formatAgo(item.ageMinutes)} • До дедлайна: {formatAgo(item.minutesToDeadline)}
                                </div>
                                <div className="text-xs text-[var(--color-text-3)]">Ожидаемая сумма: {formatCurrency(item.expectedAmount, item.currency)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="space-y-3">
                <div className="flex items-center gap-2 text-[var(--color-text-1)] font-semibold">
                    <Users className="w-4 h-4" />
                    Лист ожидания
                </div>
                {waitlist.length === 0 ? (
                    <div className="card p-5 text-sm text-[var(--color-text-3)]">Записей нет.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {waitlist.map((entry) => (
                            <div key={entry.id} className="card p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="font-semibold text-[var(--color-text-1)]">{entry.student?.fullName}</div>
                                        <div className="text-xs text-[var(--color-text-3)]">{entry.parent?.fullName} • {entry.parent?.email}</div>
                                    </div>
                                    <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-2)]">{entry.status}</Badge>
                                </div>
                                <div className="text-xs text-[var(--color-text-3)]">
                                    План: {entry.plan?.title || "—"} • Текущий класс: {entry.class?.name || "не назначен"}
                                </div>
                                <div className="text-xs text-[var(--color-text-3)]">
                                    Желаемое время: {entry.preferredSchedule || "не указано"}
                                </div>
                                <Select
                                    value={waitlistTargetClass[entry.id] || entry.class?.id || ""}
                                    onValueChange={(value) => setWaitlistTargetClass((prev) => ({ ...prev, [entry.id]: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Выберите класс для перевода" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {groups.map((group) => (
                                            <SelectItem key={group.id} value={group.id}>
                                                {group.name}{group.kruzhok?.title ? ` • ${group.kruzhok.title}` : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleWaitlistContact(entry)}>
                                        Связаться
                                    </Button>
                                    <Button size="sm" onClick={() => handleWaitlistPromote(entry)}>
                                        Перевести в класс
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="space-y-3">
                <div className="flex items-center gap-2 text-[var(--color-text-1)] font-semibold">
                    <UserCog className="w-4 h-4" />
                    Права админов
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-3">
                    <div className="card p-3 space-y-2 max-h-[420px] overflow-y-auto">
                        {permissionUsers.length === 0 ? (
                            <div className="text-sm text-[var(--color-text-3)]">Нет администраторов.</div>
                        ) : permissionUsers.map((adminUser) => (
                            <button
                                key={adminUser.id}
                                onClick={() => setSelectedPermissionUserId(adminUser.id)}
                                className={`w-full text-left rounded-lg border px-3 py-2 ${selectedPermissionUserId === adminUser.id ? "border-[#00a3ff] bg-[#00a3ff]/10" : "border-[var(--color-border-1)] bg-[var(--color-surface-2)]"}`}
                            >
                                <div className="text-sm text-[var(--color-text-1)]">{adminUser.fullName || adminUser.email}</div>
                                <div className="text-xs text-[var(--color-text-3)]">{adminUser.email}</div>
                                <div className="text-xs text-[var(--color-text-3)]">Доступов: {adminUser.effectiveCount}</div>
                            </button>
                        ))}
                    </div>
                    <div className="card p-3 space-y-2 max-h-[420px] overflow-y-auto">
                        {!permissionDetail ? (
                            <div className="text-sm text-[var(--color-text-3)]">Выберите администратора.</div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-[var(--color-text-1)]">{permissionDetail.user.fullName || permissionDetail.user.email}</div>
                                    <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-2)]">{permissionDetail.user.role}</Badge>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {permissionCatalog.map((permission) => {
                                        const allowed = permissionDetail.effectivePermissions.includes(permission)
                                        return (
                                            <button
                                                key={permission}
                                                onClick={() => handlePermissionToggle(permission)}
                                                className={`rounded-lg border px-3 py-2 text-left ${allowed ? "border-green-400/40 bg-green-500/10" : "border-red-400/40 bg-red-500/10"}`}
                                            >
                                                <div className="text-sm text-[var(--color-text-1)]">{permission}</div>
                                                <div className={`text-xs ${allowed ? "text-green-400" : "text-red-400"}`}>{allowed ? "allowed" : "denied"}</div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex items-center gap-2 text-[var(--color-text-1)] font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    Журнал действий
                </div>
                {logs.length === 0 ? (
                    <div className="card p-5 text-sm text-[var(--color-text-3)]">Записей нет.</div>
                ) : (
                    <div className="card p-0 overflow-hidden">
                        <div className="max-h-[420px] overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">
                                    <tr>
                                        <th className="p-3">Время</th>
                                        <th className="p-3">Действие</th>
                                        <th className="p-3">Кто</th>
                                        <th className="p-3">Цель</th>
                                        <th className="p-3">Причина</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-border-1)]">
                                    {logs.map((log) => (
                                        <tr key={log.id}>
                                            <td className="p-3 text-[var(--color-text-3)]">{new Date(log.createdAt).toLocaleString("ru-RU")}</td>
                                            <td className="p-3 text-[var(--color-text-1)]">
                                                <div className="font-medium">{log.action}</div>
                                                <div className="text-xs text-[var(--color-text-3)]">{log.entityType}{log.entityId ? ` • ${log.entityId}` : ""}</div>
                                            </td>
                                            <td className="p-3 text-[var(--color-text-2)]">{log.actor?.fullName || log.actor?.email || "system"}</td>
                                            <td className="p-3 text-[var(--color-text-2)]">{log.targetUser?.fullName || log.targetUser?.email || "—"}</td>
                                            <td className="p-3 text-[var(--color-text-3)]">{log.reason || "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </section>

            <section className="space-y-3">
                <div className="flex items-center gap-2 text-[var(--color-text-1)] font-semibold">
                    <AlertTriangle className="w-4 h-4" />
                    Шаблоны уведомлений
                </div>
                {templates.length === 0 ? (
                    <div className="card p-5 text-sm text-[var(--color-text-3)]">Шаблоны не настроены.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {templates.map((template) => (
                            <div key={template.id} className="card p-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-[var(--color-text-1)]">{template.key}</div>
                                    <Badge className={template.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                                        {template.isActive ? "active" : "inactive"}
                                    </Badge>
                                </div>
                                <div className="text-xs text-[var(--color-text-3)] mt-1">
                                    {template.channel} • v{template.version} • {new Date(template.updatedAt).toLocaleString("ru-RU")}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <div className="text-xs text-[var(--color-text-3)] flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Для редактирования содержимого шаблонов можно использовать API `PUT /admin/notification-templates/:id`.
                </div>
            </section>
        </div>
    )
}

