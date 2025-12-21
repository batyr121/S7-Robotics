"use client"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-context"
import { apiFetch } from "@/lib/api"
import UserLayout from "@/components/layout/user-layout"
import { Users, TrendingUp, Calendar, Bell, CreditCard, ChevronRight, Award, Clock, User } from "lucide-react"

interface ParentDashboardProps {
    user: any
}

interface Child {
    id: string
    fullName: string
    email: string
    level: number
    experiencePoints: number
    coinBalance: number
    _count?: {
        enrollments: number
        classEnrollments: number
    }
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
        kruzhok?: { title: string }
    }
}

type Tab = "children" | "progress" | "attendance" | "payments" | "notifications"

export default function ParentDashboard({ user }: ParentDashboardProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const activeTab = (searchParams.get("tab") as Tab) || "children"

    const [children, setChildren] = useState<Child[]>([])
    const [selectedChild, setSelectedChild] = useState<Child | null>(null)
    const [childProgress, setChildProgress] = useState<ChildProgress[]>([])
    const [childAttendance, setChildAttendance] = useState<Attendance[]>([])
    const [payments, setPayments] = useState<{ purchases: any[]; subscriptions: any[] }>({ purchases: [], subscriptions: [] })
    const [notifications, setNotifications] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [linkEmail, setLinkEmail] = useState("")
    const [linkError, setLinkError] = useState("")
    const [linkSuccess, setLinkSuccess] = useState("")

    // Load children on mount
    useEffect(() => {
        loadChildren()
        loadNotifications()
        loadPayments()
    }, [])

    const loadChildren = async () => {
        try {
            const data = await apiFetch<Child[]>("/parent/children")
            setChildren(data || [])
            if (data && data.length > 0 && !selectedChild) {
                setSelectedChild(data[0])
            }
        } catch (err) {
            console.error("Failed to load children:", err)
        } finally {
            setLoading(false)
        }
    }

    const loadNotifications = async () => {
        try {
            const data = await apiFetch<any[]>("/parent/notifications")
            setNotifications(data || [])
        } catch (err) {
            console.error("Failed to load notifications:", err)
        }
    }

    const loadPayments = async () => {
        try {
            const data = await apiFetch<{ purchases: any[]; subscriptions: any[] }>("/parent/payments")
            setPayments(data || { purchases: [], subscriptions: [] })
        } catch (err) {
            console.error("Failed to load payments:", err)
        }
    }

    const loadChildProgress = async (childId: string) => {
        try {
            const data = await apiFetch<ChildProgress[]>(`/parent/child/${childId}/progress`)
            setChildProgress(data || [])
        } catch (err) {
            console.error("Failed to load child progress:", err)
        }
    }

    const loadChildAttendance = async (childId: string) => {
        try {
            const data = await apiFetch<Attendance[]>(`/parent/child/${childId}/attendance`)
            setChildAttendance(data || [])
        } catch (err) {
            console.error("Failed to load child attendance:", err)
        }
    }

    const handleSelectChild = (child: Child) => {
        setSelectedChild(child)
        loadChildProgress(child.id)
        loadChildAttendance(child.id)
    }

    const handleLinkChild = async () => {
        setLinkError("")
        setLinkSuccess("")
        try {
            await apiFetch("/parent/link-child", {
                method: "POST",
                body: JSON.stringify({ childEmail: linkEmail })
            })
            setLinkSuccess("Ребёнок успешно привязан!")
            setLinkEmail("")
            loadChildren()
        } catch (err: any) {
            setLinkError(err?.message || "Не удалось привязать ребёнка")
        }
    }

    const setActiveTab = (tab: Tab) => {
        const params = new URLSearchParams(window.location.search)
        params.set('tab', tab)
        router.push(`/dashboard?${params.toString()}`)
    }

    const getTabTitle = () => {
        switch (activeTab) {
            case "children": return "Мои дети"
            case "progress": return "Прогресс ребёнка"
            case "attendance": return "Посещаемость"
            case "payments": return "История оплат"
            case "notifications": return "Уведомления"
            default: return "Кабинет родителя"
        }
    }

    const renderContent = () => {
        switch (activeTab) {
            case "children":
                return renderChildrenTab()
            case "progress":
                return renderProgressTab()
            case "attendance":
                return renderAttendanceTab()
            case "payments":
                return renderPaymentsTab()
            case "notifications":
                return renderNotificationsTab()
            default:
                return null
        }
    }

    const renderChildrenTab = () => (
        <div className="space-y-6">
            {/* Link new child */}
            <div className="card">
                <h3 className="text-lg font-semibold text-[var(--color-text-1)] mb-4">Привязать ребёнка</h3>
                <div className="flex flex-col md:flex-row gap-3">
                    <input
                        type="email"
                        value={linkEmail}
                        onChange={(e) => setLinkEmail(e.target.value)}
                        placeholder="Email ребёнка"
                        className="flex-1 px-4 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] focus:outline-none focus:border-[var(--color-primary)]"
                    />
                    <button
                        onClick={handleLinkChild}
                        className="btn bg-[var(--color-primary)] text-white border-transparent hover:bg-[var(--color-primary-dark)]"
                    >
                        Привязать
                    </button>
                </div>
                {linkError && <p className="mt-2 text-red-500 text-sm">{linkError}</p>}
                {linkSuccess && <p className="mt-2 text-green-500 text-sm">{linkSuccess}</p>}
            </div>

            {/* Children list */}
            {loading ? (
                <div className="text-[var(--color-text-3)]">Загрузка...</div>
            ) : children.length === 0 ? (
                <div className="card text-center p-8">
                    <Users className="w-12 h-12 mx-auto text-[var(--color-text-3)] mb-4" />
                    <p className="text-[var(--color-text-3)]">Нет привязанных детей</p>
                    <p className="text-[var(--color-text-3)] text-sm mt-2">Введите email ребёнка выше для привязки</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {children.map((child) => (
                        <div
                            key={child.id}
                            onClick={() => handleSelectChild(child)}
                            className={`card cursor-pointer transition-all hover:scale-102 ${selectedChild?.id === child.id ? "border-[var(--color-primary)]" : ""}`}
                        >
                            <div className="card__aura" style={{ background: `radial-gradient(circle at 50% 50%, rgba(var(--primary-rgb), 0.15) 0%, transparent 70%)` }} />
                            <div className="flex items-center gap-4 mb-4 relative z-10">
                                <div className="w-12 h-12 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-bold">
                                    {child.fullName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-[var(--color-text-1)]">{child.fullName}</h4>
                                    <p className="text-sm text-[var(--color-text-3)]">{child.email}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center relative z-10">
                                <div>
                                    <div className="text-lg font-bold text-[var(--color-primary)]">{child.level}</div>
                                    <div className="text-xs text-[var(--color-text-3)]">Уровень</div>
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-[var(--color-text-1)]">{child.experiencePoints}</div>
                                    <div className="text-xs text-[var(--color-text-3)]">XP</div>
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-yellow-500">{child.coinBalance}</div>
                                    <div className="text-xs text-[var(--color-text-3)]">S7 100</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )

    const renderProgressTab = () => (
        <div className="space-y-6">
            {!selectedChild ? (
                <div className="text-center text-[var(--color-text-3)] py-8">
                    Выберите ребёнка во вкладке "Мои дети"
                </div>
            ) : (
                <>
                    <div className="card p-4">
                        <p className="text-[var(--color-text-3)]">Прогресс для: <span className="text-[var(--color-text-1)] font-semibold">{selectedChild.fullName}</span></p>
                    </div>
                    {childProgress.length === 0 ? (
                        <div className="text-center text-[var(--color-text-3)] py-8">Нет данных о курсах</div>
                    ) : (
                        <div className="space-y-4">
                            {childProgress.map((p) => (
                                <div key={p.courseId} className="card p-5">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-semibold text-[var(--color-text-1)]">{p.courseTitle}</h4>
                                            <span className="text-xs px-2 py-1 bg-[var(--color-surface-2)] rounded text-[var(--color-text-3)]">{p.difficulty}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-[var(--color-primary)]">{Math.round(p.progressPercentage)}%</div>
                                        </div>
                                    </div>
                                    <div className="w-full bg-[var(--color-surface-2)] rounded-full h-2 mb-2">
                                        <div
                                            className="bg-[var(--color-primary)] h-2 rounded-full transition-all"
                                            style={{ width: `${p.progressPercentage}%` }}
                                        />
                                    </div>
                                    <p className="text-sm text-[var(--color-text-3)]">
                                        {p.completedLessons} из {p.totalLessons} уроков пройдено
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )

    const renderAttendanceTab = () => (
        <div className="space-y-6">
            {!selectedChild ? (
                <div className="text-center text-[var(--color-text-3)] py-8">
                    Выберите ребёнка во вкладке "Мои дети"
                </div>
            ) : (
                <>
                    <div className="card p-4">
                        <p className="text-[var(--color-text-3)]">Посещаемость: <span className="text-[var(--color-text-1)] font-semibold">{selectedChild.fullName}</span></p>
                    </div>
                    {childAttendance.length === 0 ? (
                        <div className="text-center text-[var(--color-text-3)] py-8">Нет записей посещаемости</div>
                    ) : (
                        <div className="space-y-3">
                            {childAttendance.map((a) => (
                                <div key={a.id} className="card p-4 flex items-center justify-between">
                                    <div>
                                        <h4 className="font-medium text-[var(--color-text-1)]">{a.schedule?.title || "Занятие"}</h4>
                                        <p className="text-sm text-[var(--color-text-3)]">{a.schedule?.kruzhok?.title}</p>
                                        <p className="text-xs text-[var(--color-text-3)]">{new Date(a.markedAt).toLocaleDateString("ru-RU")}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${a.status === "PRESENT" ? "bg-green-500/20 text-green-400" :
                                        a.status === "LATE" ? "bg-yellow-500/20 text-yellow-400" :
                                            "bg-red-500/20 text-red-400"
                                        }`}>
                                        {a.status === "PRESENT" ? "Присутствовал" : a.status === "LATE" ? "Опоздал" : "Отсутствовал"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )

    const renderPaymentsTab = () => (
        <div className="space-y-6">
            <div className="card p-6">
                <h3 className="text-lg font-semibold text-[var(--color-text-1)] mb-4">Покупки курсов</h3>
                {payments.purchases.length === 0 ? (
                    <p className="text-[var(--color-text-3)]">Нет покупок</p>
                ) : (
                    <div className="space-y-3">
                        {payments.purchases.map((p: any) => (
                            <div key={p.id} className="flex justify-between items-center p-3 bg-[var(--color-surface-2)] rounded-lg">
                                <div>
                                    <p className="text-[var(--color-text-1)]">{p.course?.title}</p>
                                    <p className="text-sm text-[var(--color-text-3)]">{p.user?.fullName}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-[var(--color-text-1)]">{Number(p.amount).toLocaleString()}₸</p>
                                    <p className={`text-xs ${p.status === "approved" ? "text-green-400" : "text-yellow-400"}`}>
                                        {p.status === "approved" ? "Оплачено" : "Ожидание"}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="card p-6">
                <h3 className="text-lg font-semibold text-[var(--color-text-1)] mb-4">Подписки</h3>
                {payments.subscriptions.length === 0 ? (
                    <p className="text-[var(--color-text-3)]">Нет подписок</p>
                ) : (
                    <div className="space-y-3">
                        {payments.subscriptions.map((s: any) => (
                            <div key={s.id} className="flex justify-between items-center p-3 bg-[var(--color-surface-2)] rounded-lg">
                                <div>
                                    <p className="text-[var(--color-text-1)]">{s.type === "MONTHLY_SUBSCRIPTION" ? "Месячная подписка" : "Разовая покупка"}</p>
                                    <p className="text-sm text-[var(--color-text-3)]">{s.user?.fullName}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-[var(--color-text-1)]">{Number(s.amount).toLocaleString()}₸</p>
                                    <p className={`text-xs ${s.status === "ACTIVE" ? "text-green-400" : s.status === "PENDING" ? "text-yellow-400" : "text-red-400"}`}>
                                        {s.status === "ACTIVE" ? "Активна" : s.status === "PENDING" ? "Ожидание" : "Неактивна"}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )

    const renderNotificationsTab = () => (
        <div className="space-y-4">
            {notifications.length === 0 ? (
                <div className="text-center text-[var(--color-text-3)] py-8">Нет уведомлений</div>
            ) : (
                notifications.map((n: any) => (
                    <div key={n.id} className={`card p-4 ${!n.isRead ? "border-l-4 border-l-[var(--color-primary)]" : ""}`}>
                        <div className="flex justify-between items-start">
                            <h4 className="font-semibold text-[var(--color-text-1)]">{n.title}</h4>
                            <span className="text-xs text-[var(--color-text-3)]">{new Date(n.createdAt).toLocaleDateString("ru-RU")}</span>
                        </div>
                        <p className="mt-2 text-[var(--color-text-3)]">{n.message}</p>
                    </div>
                ))
            )}
        </div>
    )

    return (
        <UserLayout title={getTabTitle()} activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as Tab)}>
            <div className="p-4 md:p-6 animate-fade-in">
                {/* Content - Tab navigation is now in Sidebar, so we just render content */}
                {renderContent()}
            </div>
        </UserLayout>
    )
}
