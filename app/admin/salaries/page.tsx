"use client"
import { useState, useEffect } from "react"
import { apiFetch } from "@/lib/api"
import { Coins, Download, Loader2, Search, CheckCircle, AlertCircle } from "lucide-react"

interface SalaryStat {
    mentorId: string
    fullName: string
    email: string
    hourlyRate: number
    sessionsCount: number
    estimatedDue: number
    lastPaymentDate: string | null
}

export default function AdminSalariesPage() {
    const [stats, setStats] = useState<SalaryStat[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [paying, setPaying] = useState<string | null>(null)

    useEffect(() => {
        loadStats()
    }, [])

    const loadStats = () => {
        setLoading(true)
        apiFetch<SalaryStat[]>("/salaries/stats")
            .then(setStats)
            .catch(console.error)
            .finally(() => setLoading(false))
    }

    const handlePay = async (stat: SalaryStat) => {
        if (!confirm(`Подтвердить выплату ${stat.estimatedDue} для ${stat.fullName}?`)) return

        setPaying(stat.mentorId)
        try {
            await apiFetch("/salaries/pay", {
                method: "POST",
                body: JSON.stringify({
                    userId: stat.mentorId,
                    amount: stat.estimatedDue,
                    period: new Date().toISOString().slice(0, 7) // Current YYYY-MM
                })
            })
            alert("Выплата успешно записана")
            loadStats() // Reload to reset estimatedDue or update lastPaymentDate (backend logic dependent)
        } catch (error) {
            console.error("Payment failed", error)
            alert("Ошибка при выплате")
        } finally {
            setPaying(null)
        }
    }

    const filtered = stats.filter(s =>
        s.fullName.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-[var(--color-text-1)] flex items-center gap-2">
                    <Coins className="w-6 h-6" /> Зарплаты и выплаты
                </h1>
                <div className="flex gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-3)]" />
                        <input
                            type="text"
                            placeholder="Поиск ментора..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg pl-10 pr-4 py-2 text-sm text-[var(--color-text-1)] outline-none focus:border-[var(--color-primary)]"
                        />
                    </div>
                    {/* Placeholder for export */}
                    <button className="btn bg-[var(--color-surface-2)] text-[var(--color-text-1)] hover:bg-[var(--color-surface-3)]">
                        <Download className="w-4 h-4 mr-2" /> Экспорт
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center text-[var(--color-text-3)] py-12">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                    Загрузка...
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center text-[var(--color-text-3)] py-12 card bg-[var(--color-surface-1)]">
                    Сотрудники не найдены или нет данных за текущий период
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--color-surface-2)] border-b border-[var(--color-border-1)] text-sm font-medium text-[var(--color-text-3)]">
                            <tr>
                                <th className="p-4">Ментор</th>
                                <th className="p-4">Ставка (час)</th>
                                <th className="p-4">Уроков (тек. мес)</th>
                                <th className="p-4">К выплате</th>
                                <th className="p-4 text-right">Действия</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border-1)] text-[var(--color-text-1)]">
                            {filtered.map((stat) => (
                                <tr key={stat.mentorId} className="hover:bg-[var(--color-surface-2)] transition-colors">
                                    <td className="p-4">
                                        <div className="font-medium">{stat.fullName}</div>
                                        <div className="text-xs text-[var(--color-text-3)]">{stat.email}</div>
                                    </td>
                                    <td className="p-4">{stat.hourlyRate} ₸</td>
                                    <td className="p-4">{stat.sessionsCount}</td>
                                    <td className="p-4 font-bold text-green-500">{stat.estimatedDue} ₸</td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => handlePay(stat)}
                                            disabled={stat.estimatedDue <= 0 || paying === stat.mentorId}
                                            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium inline-flex items-center gap-2"
                                        >
                                            {paying === stat.mentorId ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <CheckCircle className="w-4 h-4" />
                                            )}
                                            Выплатить
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
