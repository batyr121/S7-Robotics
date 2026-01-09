"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowUpRight, Plus, Trash2, Users, Calendar, MapPin, Globe } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm"
import { Badge } from "@/components/ui/badge"

interface Event {
    id: string
    title: string
    description?: string
    date?: string
    format: "online" | "offline" | "hybrid"
    isFree: boolean
    price: number
    location?: string
    status: string
    _count?: {
        registrations: number
    }
}

function MCItem({ item, onDelete }: { item: Event; onDelete: (id: string) => void }) {
    return (
        <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in hover:border-[var(--color-border-2)] transition-colors">
            <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg text-[var(--color-text-1)]">{item.title}</h3>
                    <Badge className={
                        item.status === 'published' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                            item.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                'bg-red-500/10 text-red-500 border-red-500/20'
                    }>
                        {item.status}
                    </Badge>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-[var(--color-text-3)]">
                    <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {item.date ? new Date(item.date).toLocaleDateString("ru-RU", { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "No date"}
                    </div>
                    <div className="flex items-center gap-1">
                        {item.format === 'online' ? <Globe className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                        {item.format === 'offline' ? item.location : item.format}
                    </div>
                    <div className="flex items-center gap-1 text-[var(--color-text-2)] font-medium">
                        {item.isFree ? "Free" : `${item.price.toLocaleString()} KZT`}
                    </div>
                </div>

                {item.description && (
                    <p className="text-sm text-[var(--color-text-3)] line-clamp-1 italic max-w-xl">
                        {item.description}
                    </p>
                )}
            </div>

            <div className="flex items-center gap-3">
                <div className="flex flex-col items-end mr-2">
                    <div className="flex items-center gap-1 text-[var(--color-text-1)] font-medium">
                        <Users className="w-4 h-4 text-[#00a3ff]" />
                        {item._count?.registrations || 0}
                    </div>
                    <div className="text-[10px] text-[var(--color-text-3)]">registrations</div>
                </div>

                <button
                    onClick={() => onDelete(item.id)}
                    className="p-2 rounded-lg bg-[var(--color-surface-2)] text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Delete event"
                >
                    <Trash2 className="w-5 h-5" />
                </button>

                <Link
                    href={`/admin/masterclass/${item.id}`}
                    className="p-2 rounded-lg bg-[#00a3ff] text-black hover:bg-[#0088cc] transition-colors"
                >
                    <ArrowUpRight className="w-5 h-5" />
                </Link>
            </div>
        </div>
    )
}

export default function MasterclassAdminPage() {
    const [events, setEvents] = useState<Event[]>([])
    const [loading, setLoading] = useState(true)
    const confirm = useConfirm()

    const fetchEvents = async () => {
        try {
            setLoading(true)
            const data = await apiFetch<Event[]>("/api/admin/events")
            setEvents(data || [])
        } catch (e: any) {
            toast({
                title: "Error",
                description: e?.message || "Failed to load events",
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchEvents()
    }, [])

    const handleDelete = async (id: string) => {
        const ok = await confirm({
            title: "Delete event?",
            description: "This action cannot be undone. All registrations for this event will also be deleted.",
            confirmText: "Delete",
            cancelText: "Cancel",
            variant: "danger"
        })

        if (!ok) return

        try {
            await apiFetch(`/api/admin/events/${id}`, { method: "DELETE" })
            toast({ title: "Event deleted" })
            setEvents(prev => prev.filter(e => e.id !== id))
        } catch (e: any) {
            toast({
                title: "Error",
                description: e?.message || "Failed to delete event",
                variant: "destructive"
            })
        }
    }

    return (
        <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-semibold text-[var(--color-text-1)]">Masterclasses & Events</h1>
                    <p className="text-sm text-[var(--color-text-3)]">Manage public workshops, coding sessions, and events.</p>
                </div>

                <Link
                    href="/admin/masterclass/new"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00a3ff] text-black font-medium hover:bg-[#0088cc] transition-all transform active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    <span>New event</span>
                </Link>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 grayscale opacity-50">
                    <div className="w-8 h-8 border-2 border-[var(--color-text-1)] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-[var(--color-text-1)]">Loading events...</span>
                </div>
            ) : events.length === 0 ? (
                <div className="card p-12 flex flex-col items-center justify-center text-center space-y-4 border-dashed">
                    <div className="w-16 h-16 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center">
                        <Calendar className="w-8 h-8 text-[var(--color-text-3)]" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-[var(--color-text-1)]">No events found</h3>
                        <p className="text-sm text-[var(--color-text-3)] max-w-sm mx-auto">
                            You haven't created any events yet. Click "New event" to set up your first masterclass.
                        </p>
                    </div>
                    <Link
                        href="/admin/masterclass/new"
                        className="text-[#00a3ff] hover:underline text-sm font-medium"
                    >
                        Create your first event →
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {events.map(event => (
                        <MCItem key={event.id} item={event} onDelete={handleDelete} />
                    ))}
                </div>
            )}
        </main>
    )
}
