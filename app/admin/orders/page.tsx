"use client"
import { useState, useEffect } from "react"
import { apiFetch } from "@/lib/api"
import { ShoppingBag, Search, User, Calendar as CalendarIcon } from "lucide-react"

interface Order {
    id: string
    createdAt: string
    amount: number
    reason: string
    user: { id: string; fullName: string; email: string }
    shopItem?: { id: string; title: string }
}

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")

    useEffect(() => {
        apiFetch<Order[]>("/shop/admin/orders")
            .then(setOrders)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const filtered = orders.filter(o =>
        o.user.fullName.toLowerCase().includes(search.toLowerCase()) ||
        o.user.email.toLowerCase().includes(search.toLowerCase()) ||
        (o.shopItem?.title || o.reason).toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-[var(--color-text-1)] flex items-center gap-2">
                    <ShoppingBag className="w-6 h-6" /> Заказы
                </h1>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-3)]" />
                    <input
                        type="text"
                        placeholder="Поиск заказа..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg pl-10 pr-4 py-2 text-sm text-[var(--color-text-1)] outline-none focus:border-[var(--color-primary)]"
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center text-[var(--color-text-3)] py-12">Загрузка...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center text-[var(--color-text-3)] py-12 card">Нет заказов</div>
            ) : (
                <div className="card overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[var(--color-surface-2)] text-[var(--color-text-3)] text-sm border-b border-[var(--color-border-1)]">
                                <th className="p-4 font-medium">Пользователь</th>
                                <th className="p-4 font-medium">Товар / Причина</th>
                                <th className="p-4 font-medium">Сумма</th>
                                <th className="p-4 font-medium">Дата</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border-1)]">
                            {filtered.map((order) => (
                                <tr key={order.id} className="text-[var(--color-text-1)] hover:bg-[var(--color-surface-2)] transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-[var(--color-surface-3)] flex items-center justify-center text-xs font-bold text-[var(--color-text-2)]">
                                                {order.user.fullName.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-medium">{order.user.fullName}</div>
                                                <div className="text-xs text-[var(--color-text-3)]">{order.user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {order.shopItem ? (
                                            <span className="font-medium">{order.shopItem.title}</span>
                                        ) : (
                                            <span className="text-[var(--color-text-3)]">{order.reason}</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <span className={order.amount > 0 ? "text-green-500" : "text-[var(--color-text-1)]"}>
                                            {Math.abs(order.amount)} S7 100
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-[var(--color-text-3)]">
                                        {new Date(order.createdAt).toLocaleDateString()}
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
