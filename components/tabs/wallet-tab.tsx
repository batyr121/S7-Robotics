"use client"
import { useState, useEffect } from "react"
import { Wallet, TrendingUp, Clock, DollarSign, CreditCard, ChevronRight, Calendar } from "lucide-react"
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

interface WalletData {
    balance: number
    pendingBalance: number
    totalEarned: number
    lessonsCount: number
    ratePerHour: number
}

export default function WalletTab() {
    const [wallet, setWallet] = useState<WalletData | null>(null)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadWalletData()
    }, [])

    const loadWalletData = async () => {
        setLoading(true)
        try {
            // Try to fetch wallet data, use mock if API doesn't exist yet
            const [walletData, transactionsData] = await Promise.all([
                apiFetch<WalletData>("/mentor/wallet").catch(() => ({
                    balance: 0,
                    pendingBalance: 0,
                    totalEarned: 0,
                    lessonsCount: 0,
                    ratePerHour: 0
                })),
                apiFetch<Transaction[]>("/mentor/wallet/transactions").catch(() => [])
            ])

            setWallet(walletData)
            setTransactions(transactionsData)
        } catch (err) {
            console.error("Failed to load wallet data:", err)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'KZT',
            minimumFractionDigits: 0
        }).format(amount)
    }

    const getTransactionIcon = (type: string) => {
        switch (type) {
            case "income": return <TrendingUp className="w-4 h-4 text-green-500" />
            case "withdrawal": return <DollarSign className="w-4 h-4 text-red-500" />
            case "bonus": return <CreditCard className="w-4 h-4 text-yellow-500" />
            default: return <Clock className="w-4 h-4 text-gray-500" />
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
        <div className="space-y-6">
            {/* Main Balance Card */}
            <div className="card bg-gradient-to-br from-[#00a3ff]/10 to-[#0066cc]/10 border-[#00a3ff]/30">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <p className="text-sm text-[var(--color-text-3)] mb-1">Текущий баланс</p>
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
                        <span>В обработке: {formatCurrency(wallet?.pendingBalance || 0)}</span>
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card">
                    <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        <span className="text-sm text-[var(--color-text-3)]">Всего заработано</span>
                    </div>
                    <div className="text-xl font-bold text-[var(--color-text-1)]">
                        {formatCurrency(wallet?.totalEarned || 0)}
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center gap-3 mb-2">
                        <Calendar className="w-5 h-5 text-blue-500" />
                        <span className="text-sm text-[var(--color-text-3)]">Проведено занятий</span>
                    </div>
                    <div className="text-xl font-bold text-[var(--color-text-1)]">
                        {wallet?.lessonsCount || 0}
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center gap-3 mb-2">
                        <DollarSign className="w-5 h-5 text-yellow-500" />
                        <span className="text-sm text-[var(--color-text-3)]">Ставка/час</span>
                    </div>
                    <div className="text-xl font-bold text-[var(--color-text-1)]">
                        {formatCurrency(wallet?.ratePerHour || 0)}
                    </div>
                </div>
            </div>

            {/* Transactions History */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-[var(--color-text-1)]">История операций</h3>
                    <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">
                        {transactions.length} записей
                    </Badge>
                </div>

                {transactions.length === 0 ? (
                    <div className="text-center py-8 text-[var(--color-text-3)]">
                        <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>История операций пуста</p>
                        <p className="text-sm mt-1">Здесь будут отображаться ваши начисления</p>
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
                                            {new Date(tx.createdAt).toLocaleDateString('ru-RU', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-bold ${tx.type === 'withdrawal' ? 'text-red-500' : 'text-green-500'}`}>
                                        {tx.type === 'withdrawal' ? '-' : '+'}{formatCurrency(tx.amount)}
                                    </div>
                                    <Badge
                                        className={`text-xs ${tx.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                                                tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                                                    'bg-red-500/20 text-red-500'
                                            }`}
                                    >
                                        {tx.status === 'completed' ? 'Выполнено' :
                                            tx.status === 'pending' ? 'Ожидает' : 'Ошибка'}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Withdrawal Info */}
            <div className="card bg-[var(--color-surface-2)]">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#00a3ff]/20 flex items-center justify-center flex-shrink-0">
                        <CreditCard className="w-5 h-5 text-[#00a3ff]" />
                    </div>
                    <div>
                        <h4 className="font-medium text-[var(--color-text-1)] mb-1">Вывод средств</h4>
                        <p className="text-sm text-[var(--color-text-3)]">
                            Для вывода средств обратитесь к администратору. Минимальная сумма вывода - 10 000 ₸.
                            Выплаты производятся 1 и 15 числа каждого месяца.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
