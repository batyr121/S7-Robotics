"use client"
import { useState, useEffect } from "react"
import { TrendingUp, Calendar, Clock, BookOpen, Award, Users, BarChart3 } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { Badge } from "@/components/ui/badge"

interface Child {
    id: string
    fullName: string
    level: number
    experiencePoints: number
}

interface ChildProgress {
    courseId: string
    courseTitle: string
    difficulty: string
    progressPercentage: number
    completedLessons: number
    totalLessons: number
}

interface Attendance {
    id: string
    status: string
    markedAt: string
    schedule?: {
        title: string
        scheduledDate: string
    }
}

interface AnalyticsData {
    children: Child[]
    selectedChild: Child | null
    progress: ChildProgress[]
    attendance: Attendance[]
    stats: {
        totalLessons: number
        attendanceRate: number
        avgProgress: number
        totalXP: number
    }
}

export default function AnalyticsTab() {
    const [data, setData] = useState<AnalyticsData>({
        children: [],
        selectedChild: null,
        progress: [],
        attendance: [],
        stats: { totalLessons: 0, attendanceRate: 0, avgProgress: 0, totalXP: 0 }
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
            console.error("Failed to load analytics:", err)
        } finally {
            setLoading(false)
        }
    }

    const loadChildData = async (childId: string) => {
        try {
            const [progress, attendance] = await Promise.all([
                apiFetch<ChildProgress[]>(`/parent/child/${childId}/progress`).catch(() => []),
                apiFetch<Attendance[]>(`/parent/child/${childId}/attendance`).catch(() => [])
            ])

            const child = data.children.find(c => c.id === childId)

            // Calculate stats
            const totalLessons = attendance?.length || 0
            const presentCount = attendance?.filter(a => a.status === "PRESENT" || a.status === "LATE").length || 0
            const attendanceRate = totalLessons > 0 ? Math.round((presentCount / totalLessons) * 100) : 0
            const avgProgress = progress && progress.length > 0
                ? Math.round(progress.reduce((sum, p) => sum + p.progressPercentage, 0) / progress.length)
                : 0

            setData(prev => ({
                ...prev,
                selectedChild: child || null,
                progress: progress || [],
                attendance: attendance || [],
                stats: {
                    totalLessons,
                    attendanceRate,
                    avgProgress,
                    totalXP: child?.experiencePoints || 0
                }
            }))
        } catch (err) {
            console.error("Failed to load child data:", err)
        }
    }

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
                <h3 className="text-lg font-medium text-[var(--color-text-1)] mb-2">Нет привязанных детей</h3>
                <p className="text-[var(--color-text-3)]">
                    Привяжите ребенка во вкладке "Дети" для просмотра аналитики
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Child Selector */}
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

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card text-center p-5">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-blue-500/20 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-text-1)]">{data.stats.totalLessons}</div>
                    <div className="text-sm text-[var(--color-text-3)]">Занятий посещено</div>
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
                        <BookOpen className="w-6 h-6 text-purple-500" />
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-text-1)]">{data.stats.avgProgress}%</div>
                    <div className="text-sm text-[var(--color-text-3)]">Сред. прогресс</div>
                </div>

                <div className="card text-center p-5">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                        <Award className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-text-1)]">{data.stats.totalXP}</div>
                    <div className="text-sm text-[var(--color-text-3)]">Опыт (XP)</div>
                </div>
            </div>

            {/* Course Progress */}
            <div className="card">
                <h3 className="text-lg font-medium text-[var(--color-text-1)] mb-4">Прогресс по курсам</h3>
                {data.progress.length === 0 ? (
                    <div className="text-center py-8 text-[var(--color-text-3)]">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Нет активных курсов</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {data.progress.map((course) => (
                            <div key={course.courseId} className="p-4 bg-[var(--color-surface-2)] rounded-lg">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h4 className="font-medium text-[var(--color-text-1)]">{course.courseTitle}</h4>
                                        <Badge className="mt-1 bg-[var(--color-surface-3)] text-[var(--color-text-3)]">
                                            {course.difficulty}
                                        </Badge>
                                    </div>
                                    <div className="text-2xl font-bold text-[#00a3ff]">
                                        {Math.round(course.progressPercentage)}%
                                    </div>
                                </div>
                                <div className="w-full bg-[var(--color-surface-3)] rounded-full h-2 mb-2">
                                    <div
                                        className="bg-[#00a3ff] h-2 rounded-full transition-all"
                                        style={{ width: `${course.progressPercentage}%` }}
                                    />
                                </div>
                                <p className="text-sm text-[var(--color-text-3)]">
                                    {course.completedLessons} из {course.totalLessons} уроков
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Recent Attendance */}
            <div className="card">
                <h3 className="text-lg font-medium text-[var(--color-text-1)] mb-4">Последние посещения</h3>
                {data.attendance.length === 0 ? (
                    <div className="text-center py-8 text-[var(--color-text-3)]">
                        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Нет записей о посещениях</p>
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
                                        {record.schedule?.title || "Занятие"}
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
                                    {record.status === "PRESENT" ? "Был" : record.status === "LATE" ? "Опоздал" : "Пропустил"}
                                </Badge>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
