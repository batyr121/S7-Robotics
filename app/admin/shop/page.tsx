"use client"
import { useState, useEffect } from "react"
import { apiFetch } from "@/lib/api"
import { Plus, Edit2, Trash2, Package, Loader2, EyeOff, Eye } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { FileUpload } from "@/components/ui/file-upload"

interface ShopItem {
    id: string
    title: string
    description?: string
    priceCoins: number
    imageUrl?: string
    type: string
    isHidden: boolean
    createdAt: string
}

const ITEM_TYPES = [
    { value: "MERCH", label: "Мерч" },
    { value: "BONUS_LESSON", label: "Бонусный урок" },
    { value: "MATERIAL", label: "Материал" },
    { value: "DISCOUNT", label: "Скидка" }
]

export default function AdminShopPage() {
    const [items, setItems] = useState<ShopItem[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingItem, setEditingItem] = useState<ShopItem | null>(null)
    const [saving, setSaving] = useState(false)

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        priceCoins: 100,
        imageUrl: "",
        type: "MERCH",
        isHidden: false
    })

    useEffect(() => {
        loadItems()
    }, [])

    const loadItems = async () => {
        setLoading(true)
        try {
            const data = await apiFetch<ShopItem[]>("/shop/admin/items")
            setItems(data || [])
        } catch (err) {
            console.error("Не удалось загрузить товары магазина:", err)
            toast({
                title: "Ошибка",
                description: "Не удалось загрузить товары",
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    const openCreateModal = () => {
        setEditingItem(null)
        setFormData({
            title: "",
            description: "",
            priceCoins: 100,
            imageUrl: "",
            type: "MERCH",
            isHidden: false
        })
        setShowModal(true)
    }

    const openEditModal = (item: ShopItem) => {
        setEditingItem(item)
        setFormData({
            title: item.title,
            description: item.description || "",
            priceCoins: item.priceCoins,
            imageUrl: item.imageUrl || "",
            type: item.type,
            isHidden: item.isHidden
        })
        setShowModal(true)
    }

    const handleSave = async () => {
        if (!formData.title.trim() || formData.priceCoins <= 0) {
            toast({
                title: "Ошибка",
                description: "Название и цена обязательны",
                variant: "destructive"
            })
            return
        }

        setSaving(true)
        try {
            if (editingItem) {
                await apiFetch(`/shop/admin/items/${editingItem.id}`, {
                    method: "PUT",
                    body: JSON.stringify(formData)
                })
                toast({ title: "Товар обновлен", description: "Изменения сохранены" })
            } else {
                await apiFetch("/shop/admin/items", {
                    method: "POST",
                    body: JSON.stringify(formData)
                })
                toast({ title: "Товар создан", description: "Новый товар добавлен" })
            }
            setShowModal(false)
            loadItems()
        } catch (err: any) {
            toast({
                title: "Ошибка",
                description: err?.message || "Не удалось сохранить товар",
                variant: "destructive"
            })
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (item: ShopItem) => {
        if (!confirm(`Удалить "${item.title}"?`)) return

        try {
            await apiFetch(`/shop/admin/items/${item.id}`, { method: "DELETE" })
            toast({ title: "Товар удален" })
            loadItems()
        } catch (err) {
            toast({
                title: "Ошибка",
                description: "Не удалось удалить товар",
                variant: "destructive"
            })
        }
    }

    const toggleVisibility = async (item: ShopItem) => {
        try {
            await apiFetch(`/shop/admin/items/${item.id}`, {
                method: "PUT",
                body: JSON.stringify({ isHidden: !item.isHidden })
            })
            loadItems()
        } catch (err) {
            toast({
                title: "Ошибка",
                description: "Не удалось обновить видимость",
                variant: "destructive"
            })
        }
    }

    return (
        <div className="p-6 md:p-8 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-1)]">Бонусный магазин</h1>
                    <p className="text-[var(--color-text-3)]">Управляйте товарами и видимостью.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Новый товар
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-[var(--color-text-3)]">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin mb-4" />
                    Загрузка...
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-12">
                    <Package className="w-12 h-12 mx-auto text-[var(--color-text-3)] mb-4" />
                    <p className="text-[var(--color-text-3)]">Пока нет товаров.</p>
                </div>
            ) : (
                <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-1)] rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-[var(--color-surface-2)]">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-3)]">Товар</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-3)]">Тип</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-3)]">Цена (S7)</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-3)]">Видимость</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-[var(--color-text-3)]">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.id} className="border-t border-[var(--color-border-1)]">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[var(--color-surface-2)] rounded-lg flex items-center justify-center">
                                                <Package className="w-5 h-5 text-[var(--color-text-3)]" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-[var(--color-text-1)]">{item.title}</div>
                                                {item.description && (
                                                    <div className="text-sm text-[var(--color-text-3)] line-clamp-1">{item.description}</div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-[var(--color-text-1)]">
                                        {ITEM_TYPES.find(t => t.value === item.type)?.label || item.type}
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-[var(--color-primary)]">{item.priceCoins}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-xs ${item.isHidden ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                                            {item.isHidden ? "Скрыт" : "Виден"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => toggleVisibility(item)}
                                                className="p-2 text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface-2)] rounded-lg transition-colors"
                                                title={item.isHidden ? "Показать" : "Скрыть"}
                                            >
                                                {item.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => openEditModal(item)}
                                                className="p-2 text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface-2)] rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item)}
                                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-1)] rounded-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-[var(--color-text-1)] mb-6">
                            {editingItem ? "Редактировать товар" : "Создать товар"}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--color-text-3)] mb-2">Название *</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-4 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] focus:outline-none focus:border-[var(--color-primary)]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-[var(--color-text-3)] mb-2">Описание</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] focus:outline-none focus:border-[var(--color-primary)] h-20 resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-[var(--color-text-3)] mb-2">Цена (S7 100) *</label>
                                    <input
                                        type="number"
                                        value={formData.priceCoins}
                                        onChange={(e) => setFormData({ ...formData, priceCoins: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] focus:outline-none focus:border-[var(--color-primary)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--color-text-3)] mb-2">Тип</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full px-4 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] focus:outline-none focus:border-[var(--color-primary)]"
                                    >
                                        {ITEM_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <FileUpload
                                    label="Изображение товара"
                                    value={formData.imageUrl}
                                    onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                                />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isHidden}
                                    onChange={(e) => setFormData({ ...formData, isHidden: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <span className="text-[var(--color-text-3)]">Скрыть в магазине</span>
                            </label>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 px-4 py-2 bg-[var(--color-surface-2)] text-[var(--color-text-1)] rounded-lg hover:bg-[var(--color-surface-3)] transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {editingItem ? "Сохранить" : "Создать"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
