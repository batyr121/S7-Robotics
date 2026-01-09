"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowUpRight, Trash2 } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm"
import { Badge } from "@/components/ui/badge"

function MCItem({
  title,
  badge,
  location,
  date,
  price,
  onDelete,
  onView,
}: {
  title: string
  badge: string
  location?: string
  date?: string
  price?: string
  onDelete?: () => void
  onView?: () => void
}) {
  return (
    <div className="card p-6 relative">
      <div className="absolute top-4 right-4 text-[var(--color-text-3)]">
        <div className="flex items-center gap-2">
          <button onClick={onDelete} className="p-1 rounded hover:bg-[var(--color-surface-2)]" title="Delete">
            <Trash2 className="w-5 h-5 text-red-400" />
          </button>
          <ArrowUpRight className="w-6 h-6" />
        </div>
      </div>
      <div className="text-[var(--color-text-1)] text-lg font-medium mb-3">{title}</div>
      <Badge className="bg-[#00a3ff] text-white text-xs font-medium mb-4">{badge}</Badge>
      <div className="text-[var(--color-text-3)] text-sm space-y-1">
        {location && <div>Location: {location}</div>}
        {date && <div>Date: {date}</div>}
        {price && <div>Price: {price}</div>}
      </div>
      <div className="mt-4">
        <button onClick={onView} className="text-xs bg-[var(--color-surface-2)] text-[var(--color-text-1)] rounded-full px-3 py-1 hover:bg-[var(--color-surface-3)]">View registrations</button>
      </div>
    </div>
  )
}

interface AdminEvent { id: string; title: string; date?: string; format?: string; isFree?: boolean; price?: number; location?: string }

export default function Page() {
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [openRegs, setOpenRegs] = useState<{ open: boolean; eventId?: string; title?: string }>({ open: false })
  const [regs, setRegs] = useState<Array<{ id: string; status: string; contactPhone?: string; user: { id: string; email: string; fullName?: string } }>>([])
  const confirm = useConfirm()

  useEffect(() => {
    apiFetch<AdminEvent[]>("/api/admin/events")
      .then((list) => setEvents(list || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  const deleteEvent = async (id: string) => {
    const ok = await confirm({ title: "Delete this event?", confirmText: "Delete", cancelText: "Cancel", variant: "danger" })
    if (!ok) return
    try {
      await apiFetch(`/api/admin/events/${id}`, { method: "DELETE" })
      setEvents((prev) => prev.filter((e) => e.id !== id))
      toast({ title: "Event deleted" })
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to delete event", variant: "destructive" as any })
    }
  }

  const viewRegs = async (eventId: string, title: string) => {
    setOpenRegs({ open: true, eventId, title })
    try {
      const list = await apiFetch<Array<{ id: string; status: string; contactPhone?: string; user: { id: string; email: string; fullName?: string } }>>(`/api/admin/events/${eventId}/registrations`)
      setRegs(list || [])
    } catch {
      setRegs([])
    }
  }

  const bulkDelete = async () => {
    const ok = await confirm({ title: "Delete all events?", confirmText: "Delete", cancelText: "Cancel", variant: "danger" })
    if (!ok) return
    try {
      await apiFetch(`/api/admin/events`, { method: "DELETE" })
      setEvents([])
      toast({ title: "All events deleted" })
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to delete events", variant: "destructive" as any })
    }
  }

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--color-text-1)]">Masterclasses</h2>
          <p className="text-sm text-[var(--color-text-3)]">Manage public events and registrations.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={bulkDelete} className="text-xs bg-red-500/20 text-red-400 rounded-full px-3 py-1 hover:bg-red-500/30">Delete all</button>
          <Link href="/admin/masterclass/new" className="px-4 py-2 rounded-lg bg-[#00a3ff] text-white hover:bg-[#0090e0]">Create event</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
        {loading ? (
          <div className="text-[var(--color-text-3)]">Loading...</div>
        ) : events.length > 0 ? (
          events.map((it) => (
            <MCItem
              key={it.id}
              title={it.title}
              badge={it.format ? it.format.toUpperCase() : "EVENT"}
              location={it.location}
              date={it.date ? new Date(it.date).toLocaleString("en-US") : undefined}
              price={it.isFree ? "Free" : `${Number(it.price || 0).toLocaleString()} KZT`}
              onDelete={() => deleteEvent(it.id)}
              onView={() => viewRegs(it.id, it.title)}
            />
          ))
        ) : (
          <div className="text-[var(--color-text-3)]">No events found.</div>
        )}
      </div>

      {openRegs.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-full max-w-xl card p-6">
            <div className="text-lg font-medium text-[var(--color-text-1)] mb-4">Registrations: {openRegs.title}</div>
            {regs.length === 0 ? (
              <div className="text-[var(--color-text-3)]">No registrations yet.</div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {regs.map((r) => (
                  <div key={r.id} className="flex items-center justify-between bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-3 py-2">
                    <div>
                      <div className="text-[var(--color-text-1)]">{r.user.fullName || r.user.email}</div>
                      <div className="text-[var(--color-text-3)] text-xs">{r.contactPhone || "-"} • {r.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 text-right">
              <button onClick={() => setOpenRegs({ open: false })} className="rounded-lg bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] py-2 px-3 text-[var(--color-text-1)]">Close</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
