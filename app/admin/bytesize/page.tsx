"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowUpRight, Eye, Trash2, Plus } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm"
import { Badge } from "@/components/ui/badge"

function BSCard({ id, title, tag, views, openHref, onDelete }: { id?: string; title: string; tag: string; views: number; openHref?: string; onDelete?: (id: string) => void }) {
  return (
    <div
      className="card p-4 min-h-[170px] relative cursor-pointer"
      onClick={() => { if (openHref) window.open(openHref, "_blank") }}
      role={openHref ? "button" : undefined}
      tabIndex={openHref ? 0 : -1}
    >
      <div className="flex items-center justify-between text-[var(--color-text-3)] mb-6">
        <div className="inline-flex items-center gap-2 text-xs">
          <Eye className="w-4 h-4" /> {views}
        </div>
        <div className="flex items-center gap-2">
          {id && (
            <button onClick={(e) => { e.stopPropagation(); onDelete?.(id) }} className="p-1 rounded hover:bg-[var(--color-surface-2)]" title="Delete">
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          )}
          {openHref ? (
            <a href={openHref} target="_blank" rel="noreferrer" title="Open" className="p-1 rounded hover:bg-[var(--color-surface-2)]">
              <ArrowUpRight className="w-5 h-5" />
            </a>
          ) : (
            <ArrowUpRight className="w-5 h-5" />
          )}
        </div>
      </div>
      <div className="text-xl font-semibold text-[var(--color-text-1)] mb-6">{title}</div>
      <Badge className="bg-[#00a3ff] text-white text-xs">{tag}</Badge>
    </div>
  )
}

interface AdminBS { id: string; title: string; description?: string; videoUrl: string; coverImageUrl?: string; createdAt: string; tags?: string[]; _count?: { likes: number }; _views?: number }

export default function Page() {
  const [items, setItems] = useState<AdminBS[]>([])
  const [loading, setLoading] = useState(true)
  const confirm = useConfirm()

  useEffect(() => {
    Promise.all([
      apiFetch<AdminBS[]>("/api/admin/bytesize").catch(() => [] as AdminBS[]),
      apiFetch<Array<{ id: string; views?: number }>>("/bytesize").catch(() => [] as Array<{ id: string; views?: number }>),
    ])
      .then(([adminList, feed]) => {
        const vMap = new Map(feed.map((f) => [f.id, f.views ?? 0]))
        const merged = (adminList || []).map((a) => ({ ...a, _views: vMap.get(a.id) ?? 0 }))
        setItems(merged)
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const remove = async (id: string) => {
    const ok = await confirm({ title: "Delete ByteSize item?", confirmText: "Delete", cancelText: "Cancel", variant: "danger" })
    if (!ok) return
    try {
      await apiFetch(`/api/admin/bytesize/${id}`, { method: "DELETE" })
      setItems((prev) => prev.filter((x) => x.id !== id))
      toast({ title: "Item deleted" })
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to delete item", variant: "destructive" as any })
    }
  }

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--color-text-1)]">ByteSize feed</h2>
          <p className="text-sm text-[var(--color-text-3)]">Short videos for parents and community.</p>
        </div>
        <Link href="/admin/bytesize/new" className="flex items-center gap-2 px-4 py-2 bg-[#00a3ff] hover:bg-[#0090e0] text-white rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          New ByteSize
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
        {loading ? (
          <div className="text-[var(--color-text-3)]">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-[var(--color-text-3)]">No ByteSize items yet.</div>
        ) : (
          items.map((v) => (
            <BSCard
              key={v.id}
              id={v.id}
              title={v.title}
              tag={Array.isArray(v.tags) && v.tags.length ? v.tags[0] : "ByteSize"}
              views={v._views ?? 0}
              openHref={v.videoUrl}
              onDelete={remove}
            />
          ))
        )}
      </div>
    </main>
  )
}
