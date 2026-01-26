"use client"
import { useEffect, useMemo, useState } from "react"
import { apiFetch } from "@/lib/api"
import { Coins, Loader2, Search, Plus, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"

interface SalaryStat {
    mentorId: string
    fullName: string
    email: string
    lessonsCount: number
    dueTotal: number
    paidTotal: number
    balanceDue: number
    missingWageLessons: number
    lastPaymentDate: string | null
}

interface SalaryPayment {
    id: string
    userId: string
    amount: number
    period: string
    status: string
    createdAt: string
    paidAt?: string | null
    user?: { id: string; fullName?: string; email?: string }
}

const getPeriodKey = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    return `${year}-${month}`
}

export default function AdminSalariesPage() {
    const [stats, setStats] = useState<SalaryStat[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [period, setPeriod] = useState(getPeriodKey(new Date()))
    const [selectedMentor, setSelectedMentor] = useState<SalaryStat | null>(null)
    const [payments, setPayments] = useState<SalaryPayment[]>([])
    const [paymentsLoading, setPaymentsLoading] = useState(false)
    const [paymentAmount, setPaymentAmount] = useState("")
    const [savingPayment, setSavingPayment] = useState(false)

    const loadStats = async (activePeriod: string) => {
        setLoading(true)
        try {
            const res = await apiFetch<{ period: string; stats: SalaryStat[] }>(
                `/salaries/stats?period=${encodeURIComponent(activePeriod)}`
            )
            setStats(res?.stats || [])
        } catch (error) {
            console.error("Failed to load salary stats", error)
            setStats([])
        } finally {
            setLoading(false)
        }
    }

    const loadPayments = async (mentorId: string, activePeriod: string) => {
        setPaymentsLoading(true)
        try {
            const res = await apiFetch<SalaryPayment[]>(
                `/salaries/payments?mentorId=${encodeURIComponent(mentorId)}&period=${encodeURIComponent(activePeriod)}`
            )
            setPayments(res || [])
        } catch (error) {
            console.error("Не удалось загрузить выплаты", error)
            setPayments([])
        } finally {
            setPaymentsLoading(false)
        }
    }

    useEffect(() => {
        loadStats(period)
    }, [period])

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return stats
        return stats.filter((s) =>
            s.fullName.toLowerCase().includes(query) || s.email.toLowerCase().includes(query)
        )
    }, [search, stats])

    const openMentor = async (stat: SalaryStat) => {
        setSelectedMentor(stat)
        setPaymentAmount("")
        await loadPayments(stat.mentorId, period)
    }

    const handleAddPayment = async () => {
        if (!selectedMentor) return
        const amount = Number(paymentAmount)
        if (!amount || amount <= 0) {
            toast({ title: "Некорректная сумма", description: "Введите положительную сумму." })
            return
        }
        setSavingPayment(true)
        try {
            await apiFetch("/salaries/pay", {
                method: "POST",
                body: JSON.stringify({
                    userId: selectedMentor.mentorId,
                    amount,
                    period
                })
            })
            toast({ title: "Выплата сохранена", description: "Запись о выплате добавлена." })
            setPaymentAmount("")
            await loadPayments(selectedMentor.mentorId, period)
            await loadStats(period)
        } catch (error: any) {
            toast({ title: "Не удалось сохранить выплату", description: error?.message || "Попробуйте еще раз.", variant: "destructive" as any })
        } finally {
            setSavingPayment(false)
        }
    }

    const handleDeletePayment = async (paymentId: string) => {
        if (!selectedMentor) return
        if (!confirm("Удалить запись о выплате?")) return
        try {
            await apiFetch(`/salaries/payments/${paymentId}`, { method: "DELETE" })
            await loadPayments(selectedMentor.mentorId, period)
            await loadStats(period)
        } catch (error: any) {
            toast({ title: "Не удалось удалить", description: error?.message || "Попробуйте еще раз.", variant: "destructive" as any })
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h1 className="text-2xl font-bold text-[var(--color-text-1)] flex items-center gap-2">
                    <Coins className="w-6 h-6" /> Зарплаты менторов
                </h1>
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="relative w-56">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-3)]" />
                        <input
                            type="text"
                            placeholder="Поиск менторов..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg pl-10 pr-4 py-2 text-sm text-[var(--color-text-1)] outline-none focus:border-[var(--color-primary)]"
                        />
                    </div>
                    <Input
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        placeholder="ГГГГ-ММ"
                        className="w-28 bg-[var(--color-surface-2)] border-[var(--color-border-1)] text-sm"
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center text-[var(--color-text-3)] py-12">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                    Загрузка данных по зарплатам...
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center text-[var(--color-text-3)] py-12 card bg-[var(--color-surface-1)]">
                    Нет данных по зарплатам за этот период.
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--color-surface-2)] border-b border-[var(--color-border-1)] text-sm font-medium text-[var(--color-text-3)]">
                            <tr>
                                <th className="p-4">Ментор</th>
                                <th className="p-4">Уроки</th>
                                <th className="p-4">Начислено</th>
                                <th className="p-4">Выплачено</th>
                                <th className="p-4">К выплате</th>
                                <th className="p-4 text-right">Управление</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border-1)] text-[var(--color-text-1)]">
                            {filtered.map((stat) => (
                                <tr key={stat.mentorId} className="hover:bg-[var(--color-surface-2)] transition-colors">
                                    <td className="p-4">
                                        <div className="font-medium">{stat.fullName}</div>
                                        <div className="text-xs text-[var(--color-text-3)]">{stat.email}</div>
                                        {stat.missingWageLessons > 0 && (
                                            <div className="text-xs text-yellow-500 mt-1">
                                                {stat.missingWageLessons} уроков без ставки
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4">{stat.lessonsCount}</td>
                                    <td className="p-4 font-semibold text-[var(--color-text-1)]">{stat.dueTotal.toLocaleString()} KZT</td>
                                    <td className="p-4 text-[var(--color-text-2)]">{stat.paidTotal.toLocaleString()} KZT</td>
                                    <td className="p-4 font-semibold text-green-500">{stat.balanceDue.toLocaleString()} KZT</td>
                                    <td className="p-4 text-right">
                                        <Button size="sm" variant="outline" onClick={() => openMentor(stat)}>
                                            Открыть
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Dialog open={!!selectedMentor} onOpenChange={(open) => { if (!open) setSelectedMentor(null) }}>
                <DialogContent className="bg-[var(--color-bg)] border-[var(--color-border-1)] max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Выплаты</DialogTitle>
                    </DialogHeader>
                    {selectedMentor && (
                        <div className="space-y-4">
                            <div className="text-sm text-[var(--color-text-3)]">
                                {selectedMentor.fullName} — {selectedMentor.email}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    placeholder="Сумма"
                                    className="bg-[var(--color-surface-2)] border-[var(--color-border-1)]"
                                />
                                <Button onClick={handleAddPayment} disabled={savingPayment}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    {savingPayment ? "Сохранение..." : "Добавить выплату"}
                                </Button>
                            </div>
                            <div className="text-xs text-[var(--color-text-3)]">Период: {period}</div>

                            {paymentsLoading ? (
                                <div className="text-center text-[var(--color-text-3)] py-6">
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                    Загрузка выплат...
                                </div>
                            ) : payments.length === 0 ? (
                                <div className="text-sm text-[var(--color-text-3)]">Пока нет выплат.</div>
                            ) : (
                                <div className="space-y-2">
                                    {payments.map((payment) => (
                                        <div key={payment.id} className="flex items-center justify-between bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-3 py-2 text-sm">
                                            <div>
                                                <div className="font-medium text-[var(--color-text-1)]">{Number(payment.amount).toLocaleString()} KZT</div>
                                                <div className="text-xs text-[var(--color-text-3)]">
                                                    {payment.period} — {new Date(payment.createdAt).toLocaleDateString("ru-RU")}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeletePayment(payment.id)}
                                                className="text-red-400 hover:text-red-300"
                                                aria-label="Удалить выплату"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
