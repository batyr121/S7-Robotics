"use client"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-context"
import { apiFetch } from "@/lib/api"
import UserLayout from "@/components/layout/user-layout"
import { Calendar, Users, Award, BarChart3, MessageSquare, Clock, User, CheckCircle, XCircle, Coins } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface MentorDashboardProps {
    user: any
}

interface Student {
    id: string
    fullName: string
    email: string
    level: number
    experiencePoints: number
    coinBalance: number
    classes: { id: string; name: string; kruzhokTitle: string }[]
}

interface ScheduleItem {
    id: string
    title: string
    scheduledDate: string
    scheduledTime: string
    durationMinutes: number
    status: string
    kruzhok?: { id: string; title: string }
    class?: { id: string; name: string }
    attendances?: { studentId: string; status: string }[]
}

interface Stats {
    totalHours: number
    totalSessions: number
    studentCount: number
    upcomingSessions: number
    kruzhokCount: number
}

type Tab = "schedule" | "students" | "stats" | "coins"

export default function MentorDashboard({ user }: MentorDashboardProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const activeTab = (searchParams.get("tab") as Tab) || "schedule"

    const [schedule, setSchedule] = useState<ScheduleItem[]>([])
    const [students, setStudents] = useState<Student[]>([])
    const [stats, setStats] = useState<Stats | null>(null)
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
    const [loading, setLoading] = useState(true)

    // Award coins state
    const [awardAmount, setAwardAmount] = useState(100)
    const [awardReason, setAwardReason] = useState("")
    const [awarding, setAwarding] = useState(false)

    // Comment state
    const [comment, setComment] = useState("")
    const [commenting, setCommenting] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [scheduleData, studentsData, statsData] = await Promise.all([
                apiFetch<ScheduleItem[]>("/mentor/schedule"),
                apiFetch<Student[]>("/mentor/students"),
                apiFetch<Stats>("/mentor/stats")
            ])
            setSchedule(scheduleData || [])
            setStudents(studentsData || [])
            setStats(statsData || null)
        } catch (err) {
            console.error("Failed to load mentor data:", err)
        } finally {
            setLoading(false)
        }
    }

    const setActiveTab = (tab: Tab) => {
        const params = new URLSearchParams(window.location.search)
        params.set('tab', tab)
        router.push(`/dashboard?${params.toString()}`)
    }

    const handleAwardCoins = async () => {
        if (!selectedStudent || !awardReason.trim() || awardAmount <= 0) return
        setAwarding(true)
        try {
            await apiFetch("/mentor/award-coins", {
                method: "POST",
                body: JSON.stringify({
                    studentId: selectedStudent.id,
                    amount: awardAmount,
                    reason: awardReason
                })
            })
            toast({
                title: "Успешно!",
                description: `${selectedStudent.fullName} получил ${awardAmount} S7 100`
            })
            setAwardReason("")
            // Refresh students
            const studentsData = await apiFetch<Student[]>("/mentor/students")
            setStudents(studentsData || [])
        } catch (err: any) {
            toast({
                title: "Ошибка",
                description: err?.message || "Не удалось начислить монеты",
                variant: "destructive"
            })
        } finally {
            setAwarding(false)
        }
    }

    const handleSendComment = async () => {
        if (!selectedStudent || !comment.trim()) return
        setCommenting(true)
        try {
            await apiFetch("/mentor/comment", {
                method: "POST",
                body: JSON.stringify({
                    studentId: selectedStudent.id,
                    comment: comment
                })
            })
            toast({
                title: "Отправлено!",
                description: "Комментарий отправлен ученику и родителю"
            })
            setComment("")
        } catch (err: any) {
            toast({
                title: "Ошибка",
                description: err?.message || "Не удалось отправить комментарий",
                variant: "destructive"
            })
        } finally {
            setCommenting(false)
        }
    }

    const getTabTitle = () => {
        switch (activeTab) {
            case "schedule": return "Расписание занятий"
            case "students": return "Мои ученики"
            case "stats": return "Статистика"
            case "coins": return "Награды S7 100"
            default: return "Кабинет ментора"
        }
    }

    const renderScheduleTab = () => {
        const today = new Date()
        const upcoming = schedule.filter(s => new Date(s.scheduledDate) >= today && s.status === "SCHEDULED")
        const past = schedule.filter(s => s.status === "COMPLETED")

        return (
            <div className="space-y-6">
                <div className="card">
                    <h3 className="text-lg font-semibold text-[var(--color-text-1)] mb-4">Предстоящие занятия</h3>
                    {upcoming.length === 0 ? (
                        <p className="text-[var(--color-text-3)]">Нет предстоящих занятий</p>
                    ) : (
                        <div className="space-y-3">
                            {upcoming.slice(0, 10).map((s) => (
                                <div key={s.id} className="flex items-center justify-between p-4 bg-[var(--color-surface-2)] rounded-lg">
                                    <div>
                                        <h4 className="font-medium text-[var(--color-text-1)]">{s.title}</h4>
                                        <p className="text-sm text-[var(--color-text-3)]">{s.kruzhok?.title} • {s.class?.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[var(--color-text-1)]">{new Date(s.scheduledDate).toLocaleDateString("ru-RU")}</p>
                                        <p className="text-sm text-[var(--color-text-3)]">{s.scheduledTime} • {s.durationMinutes} мин</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card">
                    <h3 className="text-lg font-semibold text-[var(--color-text-1)] mb-4">Проведённые занятия</h3>
                    {past.length === 0 ? (
                        <p className="text-[var(--color-text-3)]">Нет проведённых занятий</p>
                    ) : (
                        <div className="space-y-3">
                            {past.slice(0, 10).map((s) => (
                                <div key={s.id} className="flex items-center justify-between p-4 bg-[var(--color-surface-2)] rounded-lg opacity-75">
                                    <div>
                                        <h4 className="font-medium text-[var(--color-text-1)]">{s.title}</h4>
                                        <p className="text-sm text-[var(--color-text-3)]">{s.kruzhok?.title}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[var(--color-text-1)]">{new Date(s.scheduledDate).toLocaleDateString("ru-RU")}</p>
                                        <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">Завершено</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const renderStudentsTab = () => (
        <div className="space-y-6">
            {students.length === 0 ? (
                <div className="text-center text-[var(--color-text-3)] py-12">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Нет учеников</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {students.map((student) => (
                        <div
                            key={student.id}
                            onClick={() => setSelectedStudent(student)}
                            className={`card cursor-pointer transition-all hover:scale-102 ${selectedStudent?.id === student.id ? "border-[var(--color-primary)]" : ""}`}
                        >
                            <div className="card__aura" />
                            <div className="flex items-center gap-3 mb-4 relative z-10">
                                <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-bold">
                                    {student.fullName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-[var(--color-text-1)]">{student.fullName}</h4>
                                    <p className="text-xs text-[var(--color-text-3)]">Уровень {student.level}</p>
                                </div>
                            </div>
                            <div className="flex justify-between text-sm relative z-10">
                                <span className="text-[var(--color-text-3)]">XP: {student.experiencePoints}</span>
                                <span className="text-yellow-500">{student.coinBalance} S7</span>
                            </div>
                            {student.classes.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-[var(--color-border-1)] relative z-10">
                                    <p className="text-xs text-[var(--color-text-3)]">Классы:</p>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {student.classes.map((c) => (
                                            <span key={c.id} className="text-xs px-2 py-0.5 bg-[var(--color-surface-2)] rounded">
                                                {c.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Selected student details + comment */}
            {selectedStudent && (
                <div className="card">
                    <h3 className="text-lg font-semibold text-[var(--color-text-1)] mb-4">
                        Комментарий для {selectedStudent.fullName}
                    </h3>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Напишите комментарий или рекомендацию..."
                        className="w-full p-3 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] resize-none h-24 focus:outline-none focus:border-[var(--color-primary)]"
                    />
                    <button
                        onClick={handleSendComment}
                        disabled={commenting || !comment.trim()}
                        className="btn mt-3 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
                    >
                        {commenting ? "Отправка..." : "Отправить комментарий"}
                    </button>
                    <p className="text-xs text-[var(--color-text-3)] mt-2">Комментарий будет отправлен ученику и родителю</p>
                </div>
            )}
        </div>
    )

    const renderStatsTab = () => (
        <div className="space-y-6">
            {!stats ? (
                <div className="text-center text-[var(--color-text-3)] py-12">Загрузка статистики...</div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="card text-center p-6">
                            <Clock className="w-8 h-8 mx-auto mb-2 text-[var(--color-primary)]" />
                            <div className="text-2xl font-bold text-[var(--color-text-1)]">{stats.totalHours}</div>
                            <div className="text-sm text-[var(--color-text-3)]">Часов проведено</div>
                        </div>
                        <div className="card text-center p-6">
                            <Calendar className="w-8 h-8 mx-auto mb-2 text-green-500" />
                            <div className="text-2xl font-bold text-[var(--color-text-1)]">{stats.totalSessions}</div>
                            <div className="text-sm text-[var(--color-text-3)]">Занятий проведено</div>
                        </div>
                        <div className="card text-center p-6">
                            <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                            <div className="text-2xl font-bold text-[var(--color-text-1)]">{stats.studentCount}</div>
                            <div className="text-sm text-[var(--color-text-3)]">Учеников</div>
                        </div>
                        <div className="card text-center p-6">
                            <BarChart3 className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                            <div className="text-2xl font-bold text-[var(--color-text-1)]">{stats.upcomingSessions}</div>
                            <div className="text-sm text-[var(--color-text-3)]">Предстоящих</div>
                        </div>
                    </div>

                    <div className="card">
                        <h3 className="text-lg font-semibold text-[var(--color-text-1)] mb-4">Сводка</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between p-3 bg-[var(--color-surface-2)] rounded-lg">
                                <span className="text-[var(--color-text-3)]">Активных кружков</span>
                                <span className="font-semibold text-[var(--color-text-1)]">{stats.kruzhokCount}</span>
                            </div>
                            <div className="flex justify-between p-3 bg-[var(--color-surface-2)] rounded-lg">
                                <span className="text-[var(--color-text-3)]">Среднее учеников на занятие</span>
                                <span className="font-semibold text-[var(--color-text-1)]">
                                    {stats.totalSessions > 0 ? Math.round(stats.studentCount / Math.max(1, stats.kruzhokCount)) : 0}
                                </span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )

    const renderCoinsTab = () => (
        <div className="space-y-6">
            <div className="card">
                <h3 className="text-lg font-semibold text-[var(--color-text-1)] mb-4">Начислить S7 100</h3>

                {!selectedStudent ? (
                    <p className="text-[var(--color-text-3)]">Выберите ученика во вкладке "Ученики"</p>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 bg-[var(--color-surface-2)] rounded-lg">
                            <p className="text-[var(--color-text-3)]">Ученик:</p>
                            <p className="text-lg font-semibold text-[var(--color-text-1)]">{selectedStudent.fullName}</p>
                            <p className="text-sm text-yellow-500">Текущий баланс: {selectedStudent.coinBalance} S7 100</p>
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--color-text-3)] mb-2">Количество</label>
                            <input
                                type="number"
                                value={awardAmount}
                                onChange={(e) => setAwardAmount(Math.max(1, Math.min(10000, parseInt(e.target.value) || 0)))}
                                className="w-full px-4 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] focus:outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--color-text-3)] mb-2">Причина награды</label>
                            <input
                                type="text"
                                value={awardReason}
                                onChange={(e) => setAwardReason(e.target.value)}
                                placeholder="За отличную работу на уроке..."
                                className="w-full px-4 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] focus:outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>

                        <button
                            onClick={handleAwardCoins}
                            disabled={awarding || !awardReason.trim() || awardAmount <= 0}
                            className="btn w-full bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50 justify-center"
                        >
                            <Coins className="w-5 h-5" />
                            {awarding ? "Начисление..." : `Начислить ${awardAmount} S7 100`}
                        </button>
                    </div>
                )}
            </div>

            {/* Quick award buttons */}
            {selectedStudent && (
                <div className="card">
                    <h3 className="text-lg font-semibold text-[var(--color-text-1)] mb-4">Быстрые награды</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { amount: 50, reason: "Хорошая работа" },
                            { amount: 100, reason: "Отличный урок" },
                            { amount: 200, reason: "Выдающийся результат" },
                            { amount: 500, reason: "Особое достижение" }
                        ].map((preset) => (
                            <button
                                key={preset.amount}
                                onClick={() => {
                                    setAwardAmount(preset.amount)
                                    setAwardReason(preset.reason)
                                }}
                                className="p-3 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg hover:border-[var(--color-primary)] transition-colors text-left"
                            >
                                <div className="text-lg font-bold text-yellow-500">{preset.amount}</div>
                                <div className="text-xs text-[var(--color-text-3)]">{preset.reason}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )

    const renderContent = () => {
        if (loading) {
            return <div className="text-center text-[var(--color-text-3)] py-12">Загрузка...</div>
        }

        switch (activeTab) {
            case "schedule": return renderScheduleTab()
            case "students": return renderStudentsTab()
            case "stats": return renderStatsTab()
            case "coins": return renderCoinsTab()
            default: return null
        }
    }

    return (
        <UserLayout title={getTabTitle()} activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as Tab)}>
            <div className="p-4 md:p-6 animate-fade-in">
                {/* Content */}
                {renderContent()}
            </div>
        </UserLayout>
    )
}
