"use client"
import { useState, useEffect } from "react"
import { Users, UserPlus, Mail, Award, Coins, TrendingUp, Bell, Calendar, ChevronRight, X } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Child {
    id: string
    fullName: string
    email: string
    level: number
    experiencePoints: number
    coinBalance: number
}

interface Notification {
    id: string
    title: string
    message: string
    isRead: boolean
    createdAt: string
}

interface AttendanceRecord {
    id: string
    markedAt: string
    status: string
    schedule: {
        title: string
        kruzhok: { title: string }
    }
}

export default function ChildrenTab() {
    const [children, setChildren] = useState<Child[]>([])
    const [loading, setLoading] = useState(true)
    const [linkEmail, setLinkEmail] = useState("")
    const [linking, setLinking] = useState(false)

    // Notifications state
    const [notificationsOpen, setNotificationsOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loadingNotes, setLoadingNotes] = useState(false)

    // Child Activity state
    const [selectedChild, setSelectedChild] = useState<Child | null>(null)
    const [activityOpen, setActivityOpen] = useState(false)
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
    const [loadingActivity, setLoadingActivity] = useState(false)

    useEffect(() => {
        loadChildren()
    }, [])

    const loadChildren = async () => {
        setLoading(true)
        try {
            const data = await apiFetch<Child[]>("/parent/children")
            setChildren(data || [])
        } catch (err) {
            console.error("Failed to load children:", err)
        } finally {
            setLoading(false)
        }
    }

    const loadNotifications = async () => {
        setLoadingNotes(true)
        try {
            const data = await apiFetch<Notification[]>("/parent/notifications")
            setNotifications(data || [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoadingNotes(false)
        }
    }

    const openNotifications = () => {
        setNotificationsOpen(true)
        loadNotifications()
    }

    const openChildActivity = async (child: Child) => {
        setSelectedChild(child)
        setActivityOpen(true)
        setLoadingActivity(true)
        try {
            const data = await apiFetch<AttendanceRecord[]>(`/parent/child/${child.id}/attendance`)
            setAttendance(data || [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoadingActivity(false)
        }
    }

    const handleLinkChild = async () => {
        if (!linkEmail.trim()) {
            toast({ title: "Ошибка", description: "Введите email ребенка", variant: "destructive" })
            return
        }

        setLinking(true)
        try {
            await apiFetch("/parent/link-child", {
                method: "POST",
                body: JSON.stringify({ childEmail: linkEmail.trim() })
            })
            toast({ title: "Успешно!", description: "Ребенок успешно привязан" })
            setLinkEmail("")
            loadChildren()
        } catch (err: any) {
            toast({
                title: "Ошибка",
                description: err?.message || "Не удалось привязать ребенка",
                variant: "destructive"
            })
        } finally {
            setLinking(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-[var(--color-text-3)]">Загрузка...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Link Child Section */}
            <div className="card">
                <h3 className="text-lg font-medium text-[var(--color-text-1)] mb-4 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-[#00a3ff]" />
                    Привязать ребенка
                </h3>
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1 relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-3)]" />
                        <input
                            type="email"
                            value={linkEmail}
                            onChange={(e) => setLinkEmail(e.target.value)}
                            placeholder="Email ребенка"
                            className="w-full pl-10 pr-4 py-3 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] focus:outline-none focus:border-[#00a3ff]"
                        />
                    </div>
                    <button
                        onClick={handleLinkChild}
                        disabled={linking || !linkEmail.trim()}
                        className="px-6 py-3 bg-[#00a3ff] hover:bg-[#0088cc] text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        {linking ? "Привязка..." : "Привязать"}
                    </button>
                </div>
                <p className="mt-3 text-sm text-[var(--color-text-3)]">
                    Введите email аккаунта ребенка для привязки к вашему кабинету
                </p>
            </div>

            {/* Children List */}
            {children.length === 0 ? (
                <div className="card text-center py-12">
                    <Users className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-3)] opacity-50" />
                    <h3 className="text-lg font-medium text-[var(--color-text-1)] mb-2">
                        Нет привязанных детей
                    </h3>
                    <p className="text-[var(--color-text-3)]">
                        Привяжите ребенка, указав его email выше
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {children.map((child) => (
                        <div
                            key={child.id}
                            className="card hover:border-[#00a3ff]/50 transition-all"
                        >
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#00a3ff] to-[#0066cc] flex items-center justify-center text-white text-xl font-bold">
                                    {child.fullName.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-[var(--color-text-1)] truncate">
                                        {child.fullName}
                                    </h4>
                                    <p className="text-sm text-[var(--color-text-3)] truncate">
                                        {child.email}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center p-3 bg-[var(--color-surface-2)] rounded-lg">
                                    <div className="flex items-center justify-center mb-1">
                                        <Award className="w-4 h-4 text-purple-500" />
                                    </div>
                                    <div className="text-lg font-bold text-[var(--color-text-1)]">
                                        {child.level}
                                    </div>
                                    <div className="text-xs text-[var(--color-text-3)]">Уровень</div>
                                </div>

                                <div className="text-center p-3 bg-[var(--color-surface-2)] rounded-lg">
                                    <div className="flex items-center justify-center mb-1">
                                        <TrendingUp className="w-4 h-4 text-green-500" />
                                    </div>
                                    <div className="text-lg font-bold text-[var(--color-text-1)]">
                                        {child.experiencePoints}
                                    </div>
                                    <div className="text-xs text-[var(--color-text-3)]">XP</div>
                                </div>

                                <div className="text-center p-3 bg-[var(--color-surface-2)] rounded-lg">
                                    <div className="flex items-center justify-center mb-1">
                                        <Coins className="w-4 h-4 text-yellow-500" />
                                    </div>
                                    <div className="text-lg font-bold text-[var(--color-text-1)]">
                                        {child.coinBalance}
                                    </div>
                                    <div className="text-xs text-[var(--color-text-3)]">S7</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
