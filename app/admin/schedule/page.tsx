"use client"
import { useState, useEffect } from "react"
import { apiFetch } from "@/lib/api"
import { Calendar, Clock, MapPin, Search } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

interface Session {
    id: string
    kruzhokId: string
    date: string
    topic: string | null
    kruzhok: { id: string; name: string }
}

export default function AdminSchedulePage() {
    const [sessions, setSessions] = useState<Session[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("")

    useEffect(() => {
        // We need to implement this endpoint in kruzhok.ts
        apiFetch<Session[]>("/kruzhok/admin/all-sessions")
            .then(setSessions)
            .catch(err => {
                console.error(err)
                // Fallback or empty if not implemented yet
                setSessions([])
            })
            .finally(() => setLoading(false))
    }, [])

    const filtered = sessions.filter(s =>
        s.kruzhok.name.toLowerCase().includes(filter.toLowerCase()) ||
        (s.topic && s.topic.toLowerCase().includes(filter.toLowerCase()))
    )

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-[var(--color-text-1)] flex items-center gap-2">
                    <Calendar className="w-6 h-6" /> Расписание занятий
                </h1>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-3)]" />
                    <input
                        type="text"
                        placeholder="Поиск..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg pl-10 pr-4 py-2 text-sm text-[var(--color-text-1)] outline-none focus:border-[var(--color-primary)]"
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center text-[var(--color-text-3)] py-12">Загрузка...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center text-[var(--color-text-3)] py-12 card bg-[var(--color-surface-1)]">
                    Нет занятий или функционал в разработке
                </div>
            ) : (
                <div className="grid gap-4">
                    {filtered.map((session, i) => (
                        <div key={i} className="card p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-[var(--color-surface-2)] rounded-lg text-[var(--color-primary)]">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-[var(--color-text-1)]">{session.kruzhok.name}</h3>
                                    <p className="text-sm text-[var(--color-text-3)]">{session.topic || "Нет темы"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6 text-sm text-[var(--color-text-2)]">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    {format(new Date(session.date), "d MMMM yyyy", { locale: ru })}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    {format(new Date(session.date), "HH:mm")}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
