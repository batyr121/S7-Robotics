"use client"
import { useEffect, useMemo, useState } from "react"
import { apiFetch } from "@/lib/api"
import { Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react"
import { LiveLessonView } from "@/components/mentor/live-lesson-view"
import { useAuth } from "@/components/auth/auth-context"

interface MentorScheduleItem {
    id: string
    title: string
    scheduledDate: string
    scheduledTime?: string | null
    durationMinutes?: number
    status?: string
    kruzhok?: { id: string; title: string }
    class?: { id: string; name: string }
}

interface StudentGroup {
    id: string
    name: string
    kruzhokTitle?: string
    scheduleDescription?: string | null
    mentor?: { fullName?: string; email?: string }
}

export default function ScheduleTab() {
    const { user } = useAuth() as any
    const role = String(user?.role || "").toLowerCase()
    const isMentor = role === "mentor" || role === "admin"

    const [mentorSchedule, setMentorSchedule] = useState<MentorScheduleItem[]>([])
    const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [activeLesson, setActiveLesson] = useState<{ scheduleId: string; token: string; startedAt?: string; serverTime?: number } | null>(null)

    useEffect(() => {
        if (!isMentor) {
            loadStudentSchedule()
            return
        }
        loadMentorSchedule(currentMonth)
    }, [isMentor, currentMonth])

    const loadStudentSchedule = async () => {
        setLoading(true)
        try {
            const res = await apiFetch<{ groups: StudentGroup[] }>("/student/groups")
            setStudentGroups(res?.groups || [])
        } catch {
            setStudentGroups([])
        } finally {
            setLoading(false)
        }
    }

    const loadMentorSchedule = async (date: Date) => {
        setLoading(true)
        try {
            const start = new Date(date.getFullYear(), date.getMonth(), 1)
            const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
            const query = new URLSearchParams({
                from: start.toISOString(),
                to: end.toISOString()
            })
            const data = await apiFetch<MentorScheduleItem[]>(`/mentor/schedule?${query}`)
            setMentorSchedule(data || [])
        } catch {
            setMentorSchedule([])
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
        return mentorSchedule.filter((s) => {
            const sessionDate = new Date(s.scheduledDate)
            return sessionDate.getDate() === day &&
                sessionDate.getMonth() === month &&
                sessionDate.getFullYear() === year
        })
    }

    const { daysInMonth, startDayOfWeek, year, month } = getDaysInMonth(currentMonth)
    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
    const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

    const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1))
    const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1))

    const today = new Date()
    const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

    const upcomingMentorLessons = useMemo(() => {
        return mentorSchedule
            .filter((s) => new Date(s.scheduledDate).getTime() >= new Date().setHours(0, 0, 0, 0))
            .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
            .slice(0, 6)
    }, [mentorSchedule])

    const handleStartLesson = async (session: MentorScheduleItem) => {
        if (!session.class?.id || !session.kruzhok?.id) return
        try {
            setLoading(true)
            const res = await apiFetch<any>("/attendance-live/start", {
                method: "POST",
                body: JSON.stringify({
                    classId: session.class.id,
                    kruzhokId: session.kruzhok.id,
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
                        loadMentorSchedule(currentMonth)
                    }}
                />
            </div>
        )
    }

    if (!isMentor) {
        return (
            <div className="p-6 md:p-8 space-y-6 animate-fade-in">
                <div>
                <h2 className="text-2xl font-bold text-[var(--color-text-1)]">Расписание</h2>
                <p className="text-[var(--color-text-3)]">Ближайшие занятия и уроки.</p>
                </div>

                {loading ? (
                <div className="text-[var(--color-text-3)]">Загрузка расписания...</div>
            ) : studentGroups.length === 0 ? (
                <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl p-6 text-center">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-3)] opacity-50" />
                    <p className="text-[var(--color-text-3)]">Нет назначенных занятий.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {studentGroups.map((group) => (
                        <div key={group.id} className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-xl p-4">
                            <div className="text-[var(--color-text-1)] font-medium">{group.name}</div>
                            <div className="text-sm text-[var(--color-text-3)]">{group.kruzhokTitle || "Программа"}</div>
                            <div className="text-xs text-[var(--color-text-3)] mt-2">{group.scheduleDescription || "Расписание уточняется"}</div>
                            {group.mentor?.fullName && (
                                <div className="text-xs text-[var(--color-text-3)] mt-2">Ментор: {group.mentor.fullName}</div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            </div>
        )
    }

    return (
        <div className="p-6 md:p-8 space-y-8 animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold text-[var(--color-text-1)]">Расписание</h2>
                <p className="text-[var(--color-text-3)]">Ближайшие уроки и календарь.</p>
            </div>

            {loading ? (
                <div className="text-center text-[var(--color-text-3)] py-12">Загрузка расписания...</div>
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
                            {dayNames.map((day) => (
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
                            Ближайшие уроки
                        </h3>

                        {upcomingMentorLessons.length === 0 ? (
                            <p className="text-[var(--color-text-3)] text-sm">Ближайших уроков нет.</p>
                        ) : (
                            <div className="space-y-3">
                                {upcomingMentorLessons.map((session) => (
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
                                                    Начать
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-3)]">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(session.scheduledDate).toLocaleDateString("ru-RU")}
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

            {mentorSchedule.length > 0 && (
                <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-1)] rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-[var(--color-text-1)] mb-4">Все запланированные уроки</h3>
                    <div className="space-y-3">
                        {mentorSchedule.slice(0, 20).map((session) => (
                            <div key={session.id} className="flex items-center justify-between p-4 bg-[var(--color-surface-2)] rounded-lg">
                                <div>
                                    <h4 className="font-medium text-[var(--color-text-1)]">{session.title}</h4>
                                    <p className="text-sm text-[var(--color-text-3)]">{session.kruzhok?.title} — {session.class?.name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[var(--color-text-1)]">{new Date(session.scheduledDate).toLocaleDateString("ru-RU")}</p>
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
