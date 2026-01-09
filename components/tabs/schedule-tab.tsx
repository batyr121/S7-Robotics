"use client"
import { useState, useEffect } from "react"
import { apiFetch } from "@/lib/api"
import { Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react"
import { LiveLessonView } from "@/components/mentor/live-lesson-view"

interface ScheduleItem {
    id: string
    title: string
    scheduledDate: string
    scheduledTime: string
    durationMinutes: number
    status: string
    kruzhok?: { id: string; title: string }
    class?: { id: string; name: string }
}

export default function ScheduleTab() {
    const [schedules, setSchedules] = useState<ScheduleItem[]>([])
    const [loading, setLoading] = useState(true)
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [activeLesson, setActiveLesson] = useState<{ scheduleId: string; token: string; startedAt?: string; serverTime?: number } | null>(null)

    useEffect(() => {
        loadSchedule()
    }, [])

    const loadSchedule = async () => {
        setLoading(true)
        try {
            const data = await apiFetch<any>("/clubs/mine")

            const allSessions: ScheduleItem[] = []

            if (Array.isArray(data)) {
                for (const club of data) {
                    if (club.classes) {
                        for (const cls of club.classes) {
                            if (cls.sessions) {
                                for (const session of cls.sessions) {
                                    allSessions.push({
                                        id: session.id,
                                        title: cls.title || cls.name || "Lesson",
                                        scheduledDate: session.date,
                                        scheduledTime: "",
                                        durationMinutes: 60,
                                        status: session.status || "scheduled",
                                        kruzhok: { id: club.id, title: club.name },
                                        class: { id: cls.id, name: cls.title || cls.name }
                                    })
                                }
                            }
                            if (cls.scheduleItems) {
                                for (const si of cls.scheduleItems) {
                                    allSessions.push({
                                        id: si.id,
                                        title: cls.title || cls.name || "Lesson",
                                        scheduledDate: new Date().toISOString(),
                                        scheduledTime: si.startTime,
                                        durationMinutes: 60,
                                        status: "recurring",
                                        kruzhok: { id: club.id, title: club.name },
                                        class: { id: cls.id, name: cls.title || cls.name }
                                    })
                                }
                            }
                        }
                    }
                }
            }

            setSchedules(allSessions)
        } catch (err) {
            console.error("Failed to load schedule:", err)
            setSchedules([])
        } finally {
            setLoading(false)
        }
    }

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear()
        const month = date.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const daysInMonth = lastDay.getDate()
        const startDayOfWeek = firstDay.getDay() || 7

        return { daysInMonth, startDayOfWeek, year, month }
    }

    const getEventsForDay = (day: number) => {
        const { year, month } = getDaysInMonth(currentMonth)
        return schedules.filter(s => {
            const sessionDate = new Date(s.scheduledDate)
            return sessionDate.getDate() === day &&
                sessionDate.getMonth() === month &&
                sessionDate.getFullYear() === year
        })
    }

    const { daysInMonth, startDayOfWeek, year, month } = getDaysInMonth(currentMonth)
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1))
    const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1))

    const today = new Date()
    const isToday = (day: number) => {
        return day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
    }

    const upcomingSessions = schedules
        .filter(s => new Date(s.scheduledDate) >= new Date())
        .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
        .slice(0, 5)

    const handleStartLesson = async (session: ScheduleItem) => {
        try {
            setLoading(true)
            const res = await apiFetch<any>("/attendance-live/start", {
                method: "POST",
                body: JSON.stringify({
                    classId: session.class?.id,
                    kruzhokId: session.kruzhok?.id,
                    title: session.title
                })
            })

            if (res.error) throw new Error(res.error)

            setActiveLesson({
                scheduleId: res.schedule.id,
                token: res.token,
                startedAt: res.startedAt ? new Date(res.startedAt).toISOString() : undefined,
                serverTime: res.serverTime
            })
        } catch (e: any) {
            console.error(e)
            alert("Failed to start lesson: " + e.message)
        } finally {
            setLoading(false)
        }
    }

    if (activeLesson) {
        return (
            <div className="min-h-screen bg-background p-4 animate-in fade-in">
                <LiveLessonView
                    scheduleId={activeLesson.scheduleId}
                    initialToken={activeLesson.token}
                    initialStartedAt={activeLesson.startedAt}
                    initialServerTime={activeLesson.serverTime}
                    onClose={() => {
                        setActiveLesson(null)
                        loadSchedule()
                    }}
                />
            </div>
        )
    }

    return (
        <div className="p-6 md:p-8 space-y-8 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold text-[var(--color-text-1)]">Schedule</h2>
                <p className="text-[var(--color-text-3)]">Upcoming lessons and calendar overview.</p>
            </div>

            {loading ? (
                <div className="text-center text-[var(--color-text-3)] py-12">Loading schedule...</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-[var(--color-surface-1)] border border-[var(--color-border-1)] rounded-xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <button
                                onClick={prevMonth}
                                className="p-2 hover:bg-[var(--color-surface-2)] rounded-lg transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5 text-[var(--color-text-3)]" />
                            </button>
                            <h3 className="text-lg font-semibold text-[var(--color-text-1)]">
                                {monthNames[month]} {year}
                            </h3>
                            <button
                                onClick={nextMonth}
                                className="p-2 hover:bg-[var(--color-surface-2)] rounded-lg transition-colors"
                            >
                                <ChevronRight className="w-5 h-5 text-[var(--color-text-3)]" />
                            </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {dayNames.map(day => (
                                <div key={day} className="text-center text-sm font-medium text-[var(--color-text-3)] py-2">
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: startDayOfWeek - 1 }, (_, i) => (
                                <div key={`empty-${i}`} className="aspect-square" />
                            ))}

                            {Array.from({ length: daysInMonth }, (_, i) => {
                                const day = i + 1
                                const events = getEventsForDay(day)
                                const hasEvents = events.length > 0

                                return (
                                    <div
                                        key={day}
                                        className={`aspect-square p-1 rounded-lg transition-colors cursor-pointer hover:bg-[var(--color-surface-2)] ${isToday(day) ? "bg-[var(--color-primary)]/20 ring-2 ring-[var(--color-primary)]" : ""}`}
                                    >
                                        <div className={`text-sm text-center ${isToday(day) ? "text-[var(--color-primary)] font-bold" : "text-[var(--color-text-1)]"}`}>
                                            {day}
                                        </div>
                                        {hasEvents && (
                                            <div className="flex justify-center mt-1 gap-0.5">
                                                {events.slice(0, 3).map((_, ei) => (
                                                    <div key={ei} className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-1)] rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-[var(--color-text-1)] mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            Upcoming lessons
                        </h3>

                        {upcomingSessions.length === 0 ? (
                            <p className="text-[var(--color-text-3)] text-sm">No upcoming lessons scheduled.</p>
                        ) : (
                            <div className="space-y-3">
                                {upcomingSessions.map((session) => (
                                    <div key={session.id} className="p-3 bg-[var(--color-surface-2)] rounded-lg">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-medium text-[var(--color-text-1)]">{session.title}</h4>
                                                <p className="text-sm text-[var(--color-text-3)]">{session.kruzhok?.title}</p>
                                            </div>
                                            {new Date(session.scheduledDate).toDateString() === new Date().toDateString() && (
                                                <button
                                                    onClick={() => handleStartLesson(session)}
                                                    className="bg-[#00a3ff] text-white px-3 py-1 text-xs rounded hover:bg-[#0088cc] shadow-sm transition-all"
                                                >
                                                    Start
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-3)]">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(session.scheduledDate).toLocaleDateString("en-US")}
                                            </span>
                                            {session.scheduledTime && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {session.scheduledTime}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {schedules.length > 0 && (
                <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-1)] rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-[var(--color-text-1)] mb-4">All scheduled lessons</h3>
                    <div className="space-y-3">
                        {schedules.slice(0, 20).map((session) => (
                            <div key={session.id} className="flex items-center justify-between p-4 bg-[var(--color-surface-2)] rounded-lg">
                                <div>
                                    <h4 className="font-medium text-[var(--color-text-1)]">{session.title}</h4>
                                    <p className="text-sm text-[var(--color-text-3)]">{session.kruzhok?.title} - {session.class?.name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[var(--color-text-1)]">{new Date(session.scheduledDate).toLocaleDateString("en-US")}</p>
                                    {session.scheduledTime && (
                                        <p className="text-sm text-[var(--color-text-3)]">{session.scheduledTime}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
