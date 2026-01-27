"use client"
import { useState, useEffect, useMemo } from "react"
import { TrendingUp, Calendar, Clock, Award, Users, BarChart3 } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { Badge } from "@/components/ui/badge"

interface Child {
    id: string
    fullName: string
    level: number
    experiencePoints: number
}

interface Attendance {
    id: string
    status: string
    markedAt: string
    grade?: number | null
    schedule?: {
        title: string
        scheduledDate: string
    }
}

interface AnalyticsData {
    children: Child[]
    selectedChild: Child | null
    attendance: Attendance[]
    stats: {
        totalLessons: number
        attendanceRate: number
        avgGrade: number
        totalXP: number
    }
}

export default function AnalyticsTab() {
    const [data, setData] = useState<AnalyticsData>({
        children: [],
        selectedChild: null,
        attendance: [],
        stats: { totalLessons: 0, attendanceRate: 0, avgGrade: 0, totalXP: 0 }
    })
    const [loading, setLoading] = useState(true)
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null)

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        if (selectedChildId) {
            loadChildData(selectedChildId)
        }
    }, [selectedChildId])

    const loadData = async () => {
        setLoading(true)
        try {
            const children = await apiFetch<Child[]>("/parent/children").catch(() => [])

            setData(prev => ({
                ...prev,
                children: children || []
            }))

            if (children && children.length > 0) {
                setSelectedChildId(children[0].id)
            }
        } catch (err) {
            console.error("Не удалось загрузить аналитику:", err)
        } finally {
            setLoading(false)
        }
    }

    const loadChildData = async (childId: string) => {
        try {
            const [attendance] = await Promise.all([
                apiFetch<Attendance[]>(`/parent/child/${childId}/attendance`).catch(() => [])
            ])

            const child = data.children.find(c => c.id === childId)

            const totalLessons = attendance?.length || 0
            const presentCount = attendance?.filter(a => a.status === "PRESENT").length || 0
            const lateCount = attendance?.filter(a => a.status === "LATE").length || 0
            const attendedCount = presentCount + lateCount
            const attendanceRate = totalLessons > 0 ? Math.round((attendedCount / totalLessons) * 100) : 0
            const gradeValues = attendance
                .map((a) => Number(a.grade))
                .filter((g) => Number.isFinite(g) && g > 0)
            const avgGrade = gradeValues.length
                ? Math.round((gradeValues.reduce((sum, g) => sum + g, 0) / gradeValues.length) * 10) / 10
                : 0

            setData(prev => ({
                ...prev,
                selectedChild: child || null,
                attendance: attendance || [],
                stats: {
                    totalLessons,
                    attendanceRate,
                    avgGrade,
                    totalXP: child?.experiencePoints || 0
                }
            }))
        } catch (err) {
            console.error("Не удалось загрузить данные ребенка:", err)
        }
    }

    const attendanceSummary = useMemo(() => {
        const present = data.attendance.filter(a => a.status === "PRESENT").length
        const late = data.attendance.filter(a => a.status === "LATE").length
        const absent = data.attendance.filter(a => a.status === "ABSENT").length
        const total = data.attendance.length
        return {
            present,
            late,
            absent,
            total,
            onTimeRate: total > 0 ? Math.round((present / total) * 100) : 0
        }
    }, [data.attendance])

    if (loading) {
        return (
        <div className="flex items-center justify-center py-12">
                <div className="text-[var(--color-text-3)]">Загрузка аналитики...</div>
            </div>
        )
    }

    if (data.children.length === 0) {
        return (
            <div className="card text-center py-12">
                <Users className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-3)] opacity-50" />
                <h3 className="text-lg font-medium text-[var(--color-text-1)] mb-2">Пока нет привязанных детей</h3>
                <p className="text-[var(--color-text-3)]">
                    Добавьте ребенка во вкладке «Дети», чтобы видеть прогресс и посещаемость.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {data.children.length > 1 && (
                <div className="card">
                    <h3 className="text-sm font-medium text-[var(--color-text-3)] mb-3">Выберите ребенка</h3>
                    <div className="flex flex-wrap gap-2">
                        {data.children.map((child) => (
                            <button
                                key={child.id}
                                onClick={() => setSelectedChildId(child.id)}
                                className={`px-4 py-2 rounded-lg transition-all ${selectedChildId === child.id
                                    ? "bg-[#00a3ff] text-white"
                                    : "bg-[var(--color-surface-2)] text-[var(--color-text-1)] hover:bg-[var(--color-surface-3)]"
                                    }`}
                            >
                                {child.fullName}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card text-center p-5">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-blue-500/20 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-text-1)]">{data.stats.totalLessons}</div>
                    <div className="text-sm text-[var(--color-text-3)]">Всего уроков</div>
                </div>

                <div className="card text-center p-5">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-text-1)]">{data.stats.attendanceRate}%</div>
                    <div className="text-sm text-[var(--color-text-3)]">Посещаемость</div>
                </div>

                <div className="card text-center p-5">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <Award className="w-6 h-6 text-purple-500" />
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-text-1)]">{data.stats.avgGrade}</div>
                    <div className="text-sm text-[var(--color-text-3)]">Средняя оценка</div>
                </div>

                <div className="card text-center p-5">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                        <Award className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-text-1)]">{data.stats.totalXP}</div>
                    <div className="text-sm text-[var(--color-text-3)]">Всего опыта</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card">
                    <h3 className="text-lg font-medium text-[var(--color-text-1)] mb-4">Статистика посещаемости</h3>
                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between text-xs text-[var(--color-text-3)] mb-1">
                                <span>Вовремя</span>
                                <span>{attendanceSummary.onTimeRate}%</span>
                            </div>
                            <div className="w-full bg-[var(--color-surface-3)] rounded-full h-2">
                                <div
                                    className="bg-green-500 h-2 rounded-full"
                                    style={{ width: `${attendanceSummary.onTimeRate}%` }}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                            <div className="bg-[var(--color-surface-2)] rounded-lg p-3 text-center">
                                <div className="text-[var(--color-text-1)] font-semibold">{attendanceSummary.present}</div>
                                <div className="text-[var(--color-text-3)] text-xs">Присутствовал</div>
                            </div>
                            <div className="bg-[var(--color-surface-2)] rounded-lg p-3 text-center">
                                <div className="text-[var(--color-text-1)] font-semibold">{attendanceSummary.late}</div>
                                <div className="text-[var(--color-text-3)] text-xs">Опоздал</div>
                            </div>
                            <div className="bg-[var(--color-surface-2)] rounded-lg p-3 text-center">
                                <div className="text-[var(--color-text-1)] font-semibold">{attendanceSummary.absent}</div>
                                <div className="text-[var(--color-text-3)] text-xs">Отсутствовал</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <h3 className="text-lg font-medium text-[var(--color-text-1)] mb-4">Последние оценки</h3>
                    {data.attendance.length === 0 ? (
                        <div className="text-center py-8 text-[var(--color-text-3)]">
                            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>Пока нет записей о посещаемости.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {data.attendance.slice(0, 5).map((record) => (
                                <div
                                    key={record.id}
                                    className="flex items-center justify-between p-3 bg-[var(--color-surface-2)] rounded-lg"
                                >
                                    <div>
                                        <div className="font-medium text-[var(--color-text-1)]">
                                            {record.schedule?.title || "Урок"}
                                        </div>
                                        <div className="text-sm text-[var(--color-text-3)]">
                                            {new Date(record.markedAt).toLocaleDateString("ru-RU", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric"
                                            })}
                                        </div>
                                    </div>
                                    <Badge className="bg-[var(--color-surface-1)] text-[var(--color-text-2)]">
                                        {record.grade ? `${record.grade}/5` : "Нет оценки"}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="card">
                <h3 className="text-lg font-medium text-[var(--color-text-1)] mb-4">Последние посещения</h3>
                {data.attendance.length === 0 ? (
                    <div className="text-center py-8 text-[var(--color-text-3)]">
                        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Пока нет записей о посещаемости.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {data.attendance.slice(0, 5).map((record) => (
                            <div
                                key={record.id}
                                className="flex items-center justify-between p-3 bg-[var(--color-surface-2)] rounded-lg"
                            >
                                <div>
                                    <div className="font-medium text-[var(--color-text-1)]">
                                        {record.schedule?.title || "Урок"}
                                    </div>
                                    <div className="text-sm text-[var(--color-text-3)]">
                                        {new Date(record.markedAt).toLocaleDateString("ru-RU", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric"
                                        })}
                                    </div>
                                </div>
                                <Badge
                                    className={`${record.status === "PRESENT"
                                        ? "bg-green-500/20 text-green-500"
                                        : record.status === "LATE"
                                            ? "bg-yellow-500/20 text-yellow-500"
                                        : "bg-red-500/20 text-red-500"
                                        }`}
                                >
                                    {record.status === "PRESENT" ? "Присутствовал" : record.status === "LATE" ? "Опоздал" : "Отсутствовал"}
                                </Badge>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
