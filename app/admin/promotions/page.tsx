"use client"
import { useEffect, useState } from "react"
import { Plus, Pencil, Trash2, Tag } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { useConfirm } from "@/components/ui/confirm"

interface PromotionItem {
  id: string
  title: string
  description?: string | null
  percent: number
  validUntil?: string | null
  isActive: boolean
  createdAt: string
}

type FormState = {
  title: string
  description: string
  percent: string
  validUntil: string
  isActive: boolean
}

const emptyForm: FormState = {
  title: "",
  description: "",
  percent: "0",
  validUntil: "",
  isActive: true
}

export default function PromotionsAdminPage() {
  const [items, setItems] = useState<PromotionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const { toast } = useToast()
  const confirm = useConfirm()

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiFetch<PromotionItem[]>("/promotions")
      setItems(data || [])
    } catch (error: any) {
      toast({ title: "Не удалось загрузить акции", description: error?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const toDateInput = (value?: string | null) => {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    return date.toISOString().slice(0, 10)
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const openEdit = (item: PromotionItem) => {
    setEditingId(item.id)
    setForm({
      title: item.title,
      description: item.description || "",
      percent: String(item.percent ?? 0),
      validUntil: toDateInput(item.validUntil),
      isActive: item.isActive
    })
    setOpen(true)
  }

  const save = async () => {
    if (!form.title.trim()) {
      toast({ title: "Название обязательно", variant: "destructive" })
      return
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      percent: Math.min(100, Math.max(0, Number(form.percent) || 0)),
      validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
      isActive: form.isActive
    }
    try {
      if (editingId) {
        await apiFetch(`/promotions/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        })
        toast({ title: "Акция обновлена" })
      } else {
        await apiFetch("/promotions", {
          method: "POST",
          body: JSON.stringify(payload)
        })
        toast({ title: "Акция создана" })
      }
      setOpen(false)
      setEditingId(null)
      setForm(emptyForm)
      load()
    } catch (error: any) {
      toast({ title: "Не удалось сохранить", description: error?.message, variant: "destructive" })
    }
  }

  const removeItem = async (item: PromotionItem) => {
    const ok = await confirm({
      title: "Удалить акцию?",
      description: `Удалить "${item.title}" навсегда.`,
      confirmText: "Удалить",
      cancelText: "Отмена",
      variant: "danger"
    })
    if (!ok) return
    try {
      await apiFetch(`/promotions/${item.id}`, { method: "DELETE" })
      toast({ title: "Акция удалена" })
      load()
    } catch (error: any) {
      toast({ title: "Не удалось удалить", description: error?.message, variant: "destructive" })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-1)] flex items-center gap-2">
            <Tag className="w-6 h-6" /> Акции и скидки
          </h1>
          <p className="text-sm text-[var(--color-text-3)]">Управление скидками для родителей.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Новая акция
        </Button>
      </div>

      <div className="rounded-xl border border-[var(--color-border-1)] overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-[var(--color-surface-2)] text-[var(--color-text-2)]">
            <tr>
              <th className="p-3">Название</th>
              <th className="p-3">Процент</th>
              <th className="p-3">Действует до</th>
              <th className="p-3">Статус</th>
              <th className="p-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-1)]">
            {loading ? (
              <tr>
                <td className="p-4 text-[var(--color-text-3)]" colSpan={5}>Загрузка акций...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="p-4 text-[var(--color-text-3)]" colSpan={5}>Пока нет акций.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-[var(--color-surface-1)]">
                  <td className="p-3">
                    <div className="font-medium text-[var(--color-text-1)]">{item.title}</div>
                    {item.description && (
                      <div className="text-xs text-[var(--color-text-3)]">{item.description}</div>
                    )}
                  </td>
                  <td className="p-3 text-[var(--color-text-1)]">{item.percent}%</td>
                  <td className="p-3 text-[var(--color-text-3)]">
                    {item.validUntil ? new Date(item.validUntil).toLocaleDateString("ru-RU") : "Без срока"}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.isActive ? "bg-green-500/20 text-green-500" : "bg-yellow-500/20 text-yellow-500"}`}>
                      {item.isActive ? "Активна" : "Пауза"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeItem(item)}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[var(--color-bg)] border-[var(--color-border-1)] text-[var(--color-text-1)]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Редактировать акцию" : "Новая акция"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[var(--color-text-3)]">Название</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="например, Весенняя скидка"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--color-text-3)]">Описание</label>
              <Input
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Короткое описание для родителей"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-[var(--color-text-3)]">Процент</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.percent}
                  onChange={(e) => setForm((prev) => ({ ...prev, percent: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-[var(--color-text-3)]">Действует до</label>
                <Input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm((prev) => ({ ...prev, validUntil: e.target.value }))}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-2)]">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Активна
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button onClick={save}>Сохранить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
