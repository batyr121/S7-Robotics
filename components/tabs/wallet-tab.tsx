"use client"
import { useState, useEffect } from "react"
import { Wallet, TrendingUp, Clock, DollarSign, CreditCard, Calendar, Star } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { Badge } from "@/components/ui/badge"

interface Transaction {
    id: string
    amount: number
    type: "income" | "withdrawal" | "bonus"
    description: string
    createdAt: string
    status: "completed" | "pending" | "failed"
}

interface LessonItem {
    id: string
    title?: string
    className?: string
    kruzhokTitle?: string
    completedAt?: string
    durationMinutes?: number
    amount?: number
}

interface WalletData {
    balance: number
    pendingBalance: number
    totalEarned: number
    lessonsCount: number
    ratePerHour: number
    grade?: string
    ratingAvg?: number
    ratingCount?: number
    rank?: number
    rankTotal?: number
}

export default function WalletTab() {
    const [wallet, setWallet] = useState<WalletData | null>(null)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [lessons, setLessons] = useState<LessonItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadWalletData()
    }, [])

    const loadWalletData = async () => {
        setLoading(true)
        try {
            const [walletData, transactionsData, lessonsData] = await Promise.all([
                apiFetch<WalletData>("/mentor/wallet").catch(() => ({
                    balance: 0,
                    pendingBalance: 0,
                    totalEarned: 0,
                    lessonsCount: 0,
                    ratePerHour: 0,
                    grade: "-",
                    ratingAvg: 0,
                    ratingCount: 0,
                    rank: 0,
                    rankTotal: 0
                })),
                apiFetch<Transaction[]>("/mentor/wallet/transactions").catch(() => []),
                apiFetch<LessonItem[]>("/mentor/payroll/lessons").catch(() => [])
            ])

            setWallet(walletData)
            setTransactions(transactionsData)
            setLessons(lessonsData)
        } catch (err) {
            console.error("Failed to load wallet data:", err)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "KZT",
            minimumFractionDigits: 0
        }).format(amount)
    }

    const formatDate = (value?: string) => {
        if (!value) return "-"
        return new Date(value).toLocaleDateString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        })
    }

    const formatDuration = (minutes?: number) => {
        if (!minutes) return "0 min"
        return `${minutes} min`
    }

    const getTransactionIcon = (type: string) => {
        switch (type) {
            case "income":
                return <TrendingUp className="w-4 h-4 text-green-500" />
            case "withdrawal":
                return <DollarSign className="w-4 h-4 text-red-500" />
            case "bonus":
                return <CreditCard className="w-4 h-4 text-yellow-500" />
            default:
                return <Clock className="w-4 h-4 text-gray-500" />
        }
    }

    const renderStars = (rating: number) => {
        const filled = Math.round(rating)
        return Array.from({ length: 5 }).map((_, index) => (
            <Star
                key={index}
                className={`w-4 h-4 ${index < filled ? "text-yellow-500" : "text-[var(--color-border-1)]"}`}
                fill={index < filled ? "currentColor" : "none"}
            />
        ))
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-[var(--color-text-3)]">Loading payroll...</div>
            </div>
        )
    }

    const ratingAvg = wallet?.ratingAvg || 0
    const ratingCount = wallet?.ratingCount || 0
    const ratingLabel = ratingCount > 0 ? `${ratingAvg.toFixed(1)} (${ratingCount} reviews)` : "No ratings yet"
    const payrollTotal = lessons.reduce((sum, lesson) => sum + (lesson.amount || 0), 0)

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="card bg-gradient-to-br from-[#00a3ff]/10 to-[#0066cc]/10 border-[#00a3ff]/30 lg:col-span-2">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <p className="text-sm text-[var(--color-text-3)] mb-1">Current balance</p>
                            <h2 className="text-3xl font-bold text-[var(--color-text-1)]">
                                {formatCurrency(wallet?.balance || 0)}
                            </h2>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-[#00a3ff] flex items-center justify-center">
                            <Wallet className="w-6 h-6 text-white" />
                        </div>
                    </div>

                    {(wallet?.pendingBalance || 0) > 0 && (
                        <div className="flex items-center gap-2 text-sm text-yellow-500">
                            <Clock className="w-4 h-4" />
                            <span>Pending payout: {formatCurrency(wallet?.pendingBalance || 0)}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                        <div className="card">
                            <div className="flex items-center gap-3 mb-2">
                                <TrendingUp className="w-5 h-5 text-green-500" />
                                <span className="text-sm text-[var(--color-text-3)]">Total earned</span>
                            </div>
                            <div className="text-xl font-bold text-[var(--color-text-1)]">
                                {formatCurrency(wallet?.totalEarned || 0)}
                            </div>
                        </div>

                        <div className="card">
                            <div className="flex items-center gap-3 mb-2">
                                <Calendar className="w-5 h-5 text-blue-500" />
                                <span className="text-sm text-[var(--color-text-3)]">Lessons completed</span>
                            </div>
                            <div className="text-xl font-bold text-[var(--color-text-1)]">
                                {wallet?.lessonsCount || 0}
                            </div>
                        </div>

                        <div className="card">
                            <div className="flex items-center gap-3 mb-2">
                                <DollarSign className="w-5 h-5 text-yellow-500" />
                                <span className="text-sm text-[var(--color-text-3)]">Rate per hour</span>
                            </div>
                            <div className="text-xl font-bold text-[var(--color-text-1)]">
                                {formatCurrency(wallet?.ratePerHour || 0)}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-[var(--color-text-3)]">Mentor grade</p>
                            <div className="text-3xl font-bold text-[var(--color-text-1)]">
                                {wallet?.grade || "-"}
                            </div>
                        </div>
                        <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">
                            Rank {wallet?.rank || 0}/{wallet?.rankTotal || 0}
                        </Badge>
                    </div>

                    <div className="mt-4">
                        <div className="flex items-center gap-2">
                            {renderStars(ratingAvg)}
                            <span className="text-sm text-[var(--color-text-2)]">{ratingLabel}</span>
                        </div>
                        <p className="text-xs text-[var(--color-text-3)] mt-2">Based on student feedback</p>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-[var(--color-surface-2)] rounded-lg p-3">
                            <div className="text-[var(--color-text-3)]">Certificates</div>
                            <div className="text-[var(--color-text-1)] font-semibold">0</div>
                        </div>
                        <div className="bg-[var(--color-surface-2)] rounded-lg p-3">
                            <div className="text-[var(--color-text-3)]">Rank percentile</div>
                            <div className="text-[var(--color-text-1)] font-semibold">
                                {wallet?.rank && wallet?.rankTotal ? Math.round((wallet.rank / wallet.rankTotal) * 100) : 0}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-[var(--color-text-1)]">Payroll detail</h3>
                    <div className="flex items-center gap-2">
                        <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">
                            {lessons.length} lessons
                        </Badge>
                        <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">
                            Total {formatCurrency(payrollTotal)}
                        </Badge>
                    </div>
                </div>

                {lessons.length === 0 ? (
                    <div className="text-center py-8 text-[var(--color-text-3)]">
                        <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No completed lessons yet.</p>
                        <p className="text-sm mt-1">Completed lessons will appear here with payroll amounts.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-sm">
                            <thead className="text-[var(--color-text-3)]">
                                <tr>
                                    <th className="text-left py-2 px-2">Lesson</th>
                                    <th className="text-left py-2 px-2">Group</th>
                                    <th className="text-left py-2 px-2">Date</th>
                                    <th className="text-left py-2 px-2">Duration</th>
                                    <th className="text-left py-2 px-2">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lessons.map((lesson) => (
                                    <tr key={lesson.id} className="border-t border-[var(--color-border-1)]">
                                        <td className="py-3 px-2">
                                            <div className="font-medium text-[var(--color-text-1)]">
                                                {lesson.title || lesson.kruzhokTitle || "Lesson"}
                                            </div>
                                            <div className="text-xs text-[var(--color-text-3)]">
                                                {lesson.kruzhokTitle || "Program"}
                                            </div>
                                        </td>
                                        <td className="py-3 px-2 text-[var(--color-text-2)]">
                                            {lesson.className || "-"}
                                        </td>
                                        <td className="py-3 px-2 text-[var(--color-text-2)]">
                                            {formatDate(lesson.completedAt)}
                                        </td>
                                        <td className="py-3 px-2">
                                            <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-2)]">
                                                {formatDuration(lesson.durationMinutes)}
                                            </Badge>
                                        </td>
                                        <td className="py-3 px-2 font-semibold text-[var(--color-text-1)]">
                                            {formatCurrency(lesson.amount || 0)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-[var(--color-text-1)]">Transactions</h3>
                    <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">
                        {transactions.length} items
                    </Badge>
                </div>

                {transactions.length === 0 ? (
                    <div className="text-center py-8 text-[var(--color-text-3)]">
                        <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No transactions yet.</p>
                        <p className="text-sm mt-1">Payouts and bonuses will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {transactions.map((tx) => (
                            <div
                                key={tx.id}
                                className="flex items-center justify-between p-3 bg-[var(--color-surface-2)] rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-1)] flex items-center justify-center">
                                        {getTransactionIcon(tx.type)}
                                    </div>
                                    <div>
                                        <div className="font-medium text-[var(--color-text-1)]">{tx.description}</div>
                                        <div className="text-xs text-[var(--color-text-3)]">
                                            {formatDate(tx.createdAt)}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-bold ${tx.type === "withdrawal" ? "text-red-500" : "text-green-500"}`}>
                                        {tx.type === "withdrawal" ? "-" : "+"}{formatCurrency(tx.amount)}
                                    </div>
                                    <Badge
                                        className={`text-xs ${tx.status === "completed"
                                                ? "bg-green-500/20 text-green-500"
                                                : tx.status === "pending"
                                                    ? "bg-yellow-500/20 text-yellow-500"
                                                    : "bg-red-500/20 text-red-500"
                                            }`}
                                    >
                                        {tx.status === "completed" ? "Completed"
                                            : tx.status === "pending" ? "Pending" : "Failed"}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="card bg-[var(--color-surface-2)]">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#00a3ff]/20 flex items-center justify-center flex-shrink-0">
                        <CreditCard className="w-5 h-5 text-[#00a3ff]" />
                    </div>
                    <div>
                        <h4 className="font-medium text-[var(--color-text-1)] mb-1">Payouts</h4>
                        <p className="text-sm text-[var(--color-text-3)]">
                            Payouts are processed on the 1st and 15th of each month. Minimum payout amount is 10,000 KZT.
                            Please ensure your payment details are up to date in your profile.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
