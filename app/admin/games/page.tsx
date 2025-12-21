"use client"

import { useState, useEffect } from "react"
import { apiFetch } from "@/lib/api"
import { Plus, Trash2, Edit2, Gamepad2, Search, ExternalLink } from "lucide-react"
import { useConfirm } from "@/components/ui/confirm"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea" // Assuming this exists, fallback to standard textarea if not
import { FileUpload } from "@/components/ui/file-upload" // Using shared component

interface Game {
  id: string
  title: string
  description?: string
  coverUrl?: string
  gameUrl: string
  isPublished: boolean
}

export default function AdminGamesPage() {
  const confirm = useConfirm()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Modal State
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    gameUrl: "",
    coverUrl: "",
    isPublished: true
  })

  useEffect(() => {
    loadGames()
  }, [])

  const loadGames = async () => {
    setLoading(true)
    try {
      const data = await apiFetch<Game[]>("/api/games")
      setGames(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingId(null)
    setFormData({ title: "", description: "", gameUrl: "", coverUrl: "", isPublished: true })
    setIsOpen(true)
  }

  const handleOpenEdit = (g: Game) => {
    setEditingId(g.id)
    setFormData({
      title: g.title,
      description: g.description || "",
      gameUrl: g.gameUrl,
      coverUrl: g.coverUrl || "",
      isPublished: g.isPublished
    })
    setIsOpen(true)
  }

  const handleSave = async () => {
    if (!formData.title || !formData.gameUrl) {
      toast({ title: "Ошибка", description: "Заполните название и URL игры", variant: "destructive" })
      return
    }

    try {
      if (editingId) {
        await apiFetch(`/api/games/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(formData)
        })
        toast({ title: "Игра обновлена" })
      } else {
        await apiFetch("/api/games", {
          method: "POST",
          body: JSON.stringify(formData)
        })
        toast({ title: "Игра создана" })
      }
      setIsOpen(false)
      loadGames()
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message || "Не удалось сохранить", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: "Удалить игру?", confirmText: "Удалить", variant: "danger" })
    if (!ok) return

    try {
      await apiFetch(`/api/games/${id}`, { method: "DELETE" })
      toast({ title: "Игра удалена" })
      loadGames()
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message || "Не удалось удалить", variant: "destructive" })
    }
  }

  const filtered = games.filter(g => g.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-white text-2xl font-bold flex items-center gap-3">
            <Gamepad2 className="w-8 h-8 text-purple-500" />
            Игры
          </h1>
          <p className="text-white/60 text-sm mt-1">Управление обучающими играми</p>
        </div>

        <Button onClick={handleOpenCreate} className="bg-[#00a3ff] hover:bg-[#0082cc] text-white">
          <Plus className="w-4 h-4 mr-2" /> Добавить игру
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6 bg-[#16161c] p-2 rounded-xl border border-[#2a2a35] max-w-md">
        <Search className="w-5 h-5 text-white/40 ml-2" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск игр..."
          className="bg-transparent border-none outline-none text-white w-full placeholder:text-white/30"
        />
      </div>

      {loading ? (
        <div className="text-white/60 text-center py-12">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className="text-white/60 text-center py-12 bg-[#16161c] rounded-2xl border border-[#2a2a35]">
          Игры не найдены. Добавьте первую игру!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(game => (
            <div key={game.id} className="group bg-[#16161c] border border-[#2a2a35] rounded-2xl overflow-hidden hover:border-[#00a3ff]/50 transition-colors">
              <div className="aspect-video bg-[#0f0f14] relative">
                {game.coverUrl ? (
                  <img src={game.coverUrl} alt={game.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/20">
                    <Gamepad2 className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => handleOpenEdit(game)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(game.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-white text-lg line-clamp-1" title={game.title}>{game.title}</h3>
                  <a href={game.gameUrl} target="_blank" rel="noreferrer" className="text-white/40 hover:text-[#00a3ff]">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <p className="text-white/60 text-sm line-clamp-2 min-h-[2.5em]">{game.description || "Нет описания"}</p>
                <div className="mt-4 pt-3 border-t border-[#2a2a35] flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded-full ${game.isPublished ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                    {game.isPublished ? "Опубликовано" : "Черновик"}
                  </span>
                  <span className="text-white/40 text-xs">ID: {game.id.slice(-4)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-[#1b1b22] border-[#2a2a35] text-white">
          <DialogHeader>
            <DialogTitle>{editingId ? "Редактировать игру" : "Новая игра"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-white/60">Название</label>
              <Input
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="bg-[#16161c] border-[#2a2a35]"
                placeholder="Например: Minecraft Coding"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/60">URL Игры / Iframe</label>
              <Input
                value={formData.gameUrl}
                onChange={e => setFormData({ ...formData, gameUrl: e.target.value })}
                className="bg-[#16161c] border-[#2a2a35]"
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/60">Обложка</label>
              <FileUpload
                value={formData.coverUrl}
                onChange={url => setFormData({ ...formData, coverUrl: url })}
                endpoint="image"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/60">Описание</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-[#16161c] border border-[#2a2a35] rounded-lg p-2 min-h-[80px] text-sm text-white"
                placeholder="Краткое описание механик..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pub"
                checked={formData.isPublished}
                onChange={e => setFormData({ ...formData, isPublished: e.target.checked })}
                className="w-4 h-4 rounded border-[#2a2a35] bg-[#16161c]"
              />
              <label htmlFor="pub" className="text-sm text-white">Опубликовать сразу</label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} className="border-[#2a2a35] hover:bg-[#2a2a35] text-white">Отмена</Button>
            <Button onClick={handleSave} className="bg-[#00a3ff] hover:bg-[#0082cc] text-white">Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
