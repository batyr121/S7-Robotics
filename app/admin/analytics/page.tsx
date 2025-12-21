"use client"
import { useState, useEffect } from "react"
import { apiFetch } from "@/lib/api"
import { BarChart3, Users, BookOpen, GraduationCap, Coins, TrendingUp } from "lucide-react"

interface AnalyticsData {
    usersCount: number
    studentsCount: number
    mentorsCount: number
    coursesCount: number
    kruzhoksCount: number
    totalCoins: number
}

export default function AdminAnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        apiFetch<AnalyticsData>("/admin/analytics")
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    if (loading) {
        return <div className="p-8 text-center text-[var(--color-text-3)]">Загрузка аналитики...</div>
    }

    if (!data) return null

    const stats = [
        { label: "Всего пользователей", value: data.usersCount, icon: Users, color: "text-blue-500" },
        { label: "Учеников", value: data.studentsCount, icon: GraduationCap, color: "text-green-500" },
        { label: "Менторов", value: data.mentorsCount, icon: BookOpen, color: "text-purple-500" },
        { label: "Курсов", value: data.coursesCount, icon: BookOpen, color: "text-yellow-500" },
        { label: "Кружков", value: data.kruzhoksCount, icon: Users, color: "text-orange-500" },
        { label: "Всего S7 100", value: data.totalCoins.toLocaleString(), icon: Coins, color: "text-yellow-400" },
    ]

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-[var(--color-text-1)] flex items-center gap-2">
                <BarChart3 className="w-6 h-6" /> Аналитика платформы
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="card p-6 flex items-center justify-between">
                        <div>
                            <p className="text-[var(--color-text-3)] text-sm">{stat.label}</p>
                            <p className="text-3xl font-bold text-[var(--color-text-1)] mt-1">{stat.value}</p>
                        </div>
                        <div className={`p-3 rounded-full bg-[var(--color-surface-2)] ${stat.color}`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="card p-6">
                <h2 className="text-lg font-semibold text-[var(--color-text-1)] mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" /> Активность
                </h2>
                <div className="h-64 flex items-center justify-center border border-[var(--color-border-1)] rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-3)]">
                    График активности (в разработке)
                </div>
            </div>
        </div>
    )
}
