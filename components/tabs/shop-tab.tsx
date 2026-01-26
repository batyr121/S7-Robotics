"use client"
import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth/auth-context"
import { apiFetch } from "@/lib/api"
import { ShoppingBag, Zap, History, Package, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface ShopItem {
    id: string
    title: string
    description?: string
    priceCoins: number
    imageUrl?: string
    type: string
}

interface Transaction {
    id: string
    amount: number
    type: string
    reason: string
    createdAt: string
    shopItem?: { id: string; title: string }
}

type Tab = "shop" | "purchases" | "history"

export default function ShopTab() {
    const { user, refreshUser } = useAuth() as any
    const [activeTab, setActiveTab] = useState<Tab>("shop")
    const [items, setItems] = useState<ShopItem[]>([])
    const [purchases, setPurchases] = useState<Transaction[]>([])
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [purchasing, setPurchasing] = useState<string | null>(null)
    const [filter, setFilter] = useState("all")

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [itemsData, purchasesData, transactionsData] = await Promise.all([
                apiFetch<ShopItem[]>("/shop/items"),
                apiFetch<Transaction[]>("/shop/my-purchases"),
                apiFetch<Transaction[]>("/shop/transactions")
            ])
            setItems(itemsData || [])
            setPurchases(purchasesData || [])
            setTransactions(transactionsData || [])
        } catch (err) {
            console.error("Failed to load shop data:", err)
        } finally {
            setLoading(false)
        }
    }

    const handlePurchase = async (item: ShopItem) => {
        if (purchasing || (user?.coinBalance || 0) < item.priceCoins) return

        setPurchasing(item.id)
        try {
            await apiFetch<{ success: boolean; newBalance: number }>("/shop/purchase", {
                method: "POST",
                body: JSON.stringify({ itemId: item.id })
            })

            toast({
                title: "Покупка завершена",
                description: `Вы обменяли "${item.title}".`
            })

            if (refreshUser) refreshUser()
            loadData()
        } catch (err: any) {
            toast({
                title: "Не удалось купить",
                description: err?.message || "Попробуйте еще раз.",
                variant: "destructive"
            })
        } finally {
            setPurchasing(null)
        }
    }

    const filteredItems = filter === "all" ? items : items.filter(i => i.type === filter)

    const getTypeLabel = (type: string) => {
        switch (type) {
            case "MERCH": return "Мерч"
            case "BONUS_LESSON": return "Бонусный урок"
            case "MATERIAL": return "Материалы"
            case "DISCOUNT": return "Скидка"
            default: return type
        }
    }

    const getTypeColor = (type: string) => {
        switch (type) {
            case "MERCH": return "bg-purple-500/20 text-purple-400"
            case "BONUS_LESSON": return "bg-blue-500/20 text-blue-400"
            case "MATERIAL": return "bg-green-500/20 text-green-400"
            case "DISCOUNT": return "bg-orange-500/20 text-orange-400"
            default: return "bg-gray-500/20 text-gray-400"
        }
    }

    const renderShopTab = () => (
        <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-2">
                {["all", "MERCH", "BONUS_LESSON", "MATERIAL", "DISCOUNT"].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${filter === f
                                ? "bg-[var(--color-primary)] text-white"
                                : "bg-[var(--color-surface-1)] text-[var(--color-text-3)] hover:bg-[var(--color-surface-2)]"
                            }`}
                    >
                        {f === "all" ? "Все" : getTypeLabel(f)}
                    </button>
                ))}
            </div>

            {filteredItems.length === 0 ? (
                <div className="text-center text-[var(--color-text-3)] py-12">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Пока нет товаров.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredItems.map((item) => (
                        <div
                            key={item.id}
                            className="bg-[var(--color-surface-1)] border border-[var(--color-border-1)] rounded-xl overflow-hidden hover:shadow-lg transition-all group"
                        >
                            <div className="h-48 bg-[var(--color-surface-2)] flex items-center justify-center relative">
                                {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                                ) : (
                                    <ShoppingBag className="w-16 h-16 text-[var(--color-text-3)] opacity-50 group-hover:scale-110 transition-transform" />
                                )}
                                <div className={`absolute top-2 right-2 text-xs px-2 py-1 rounded ${getTypeColor(item.type)}`}>
                                    {getTypeLabel(item.type)}
                                </div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-semibold text-[var(--color-text-1)] mb-1">{item.title}</h3>
                                {item.description && (
                                    <p className="text-sm text-[var(--color-text-3)] mb-3 line-clamp-2">{item.description}</p>
                                )}
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-[var(--color-primary)] flex items-center gap-1">
                                        <Zap className="w-4 h-4" /> {item.priceCoins}
                                    </span>
                                    <button
                                        onClick={() => handlePurchase(item)}
                                        disabled={purchasing === item.id || (user?.coinBalance || 0) < item.priceCoins}
                                        className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 ${(user?.coinBalance || 0) >= item.priceCoins
                                                ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]"
                                                : "bg-[var(--color-surface-3)] text-[var(--color-text-3)] cursor-not-allowed"
                                            }`}
                                    >
                                        {purchasing === item.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            "Обменять"
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )

    const renderPurchasesTab = () => (
        <div className="space-y-4">
            {purchases.length === 0 ? (
                <div className="text-center text-[var(--color-text-3)] py-12">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Пока нет покупок.</p>
                </div>
            ) : (
                purchases.map((p) => (
                    <div key={p.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border-1)] rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[var(--color-surface-2)] rounded-lg flex items-center justify-center">
                                <Package className="w-6 h-6 text-[var(--color-text-3)]" />
                            </div>
                            <div>
                                <h4 className="font-medium text-[var(--color-text-1)]">{p.shopItem?.title || "Награда"}</h4>
                                <p className="text-sm text-[var(--color-text-3)]">{new Date(p.createdAt).toLocaleDateString("ru-RU")}</p>
                            </div>
                        </div>
                        <span className="font-bold text-[var(--color-primary)]">{Math.abs(p.amount)} S7</span>
                    </div>
                ))
            )}
        </div>
    )

    const renderHistoryTab = () => (
        <div className="space-y-4">
            {transactions.length === 0 ? (
                <div className="text-center text-[var(--color-text-3)] py-12">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Пока нет операций.</p>
                </div>
            ) : (
                transactions.map((t) => (
                    <div key={t.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border-1)] rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-[var(--color-text-1)]">{t.reason}</h4>
                            <p className="text-sm text-[var(--color-text-3)]">{new Date(t.createdAt).toLocaleDateString("ru-RU", {
                                day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
                            })}</p>
                        </div>
                        <span className={`font-bold ${t.amount > 0 ? "text-green-500" : "text-red-500"}`}>
                            {t.amount > 0 ? "+" : ""}{t.amount} S7
                        </span>
                    </div>
                ))
            )}
        </div>
    )

    const tabs = [
        { id: "shop" as Tab, label: "Магазин", icon: ShoppingBag },
        { id: "purchases" as Tab, label: "Мои награды", icon: Package },
        { id: "history" as Tab, label: "История", icon: History },
    ]

    return (
        <div className="p-6 md:p-8 space-y-8 animate-fade-in relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--color-text-1)]">Бонусный магазин</h2>
                    <p className="text-[var(--color-text-3)]">Обменивайте бонусы за посещаемость и своевременную оплату.</p>
                </div>
                <div className="flex items-center gap-2 bg-[var(--color-surface-2)] px-4 py-2 rounded-full border border-[var(--color-border-1)]">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    <span className="text-[var(--color-primary)] font-bold">{user?.coinBalance || 0} S7</span>
                </div>
            </div>

            <div className="flex gap-2 border-b border-[var(--color-border-1)] pb-1 overflow-x-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors ${activeTab === tab.id
                                ? "border-b-2 border-[var(--color-primary)] text-[var(--color-text-1)] font-medium"
                                : "text-[var(--color-text-3)] hover:text-[var(--color-text-1)]"
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="text-center text-[var(--color-text-3)] py-12">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin mb-4" />
                    Загрузка...
                </div>
            ) : (
                <div className="animate-fade-in">
                    {activeTab === "shop" && renderShopTab()}
                    {activeTab === "purchases" && renderPurchasesTab()}
                    {activeTab === "history" && renderHistoryTab()}
                </div>
            )}
        </div>
    )
}
