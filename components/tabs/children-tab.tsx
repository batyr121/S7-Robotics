"use client"
import { useState, useEffect } from "react"
import { Users, UserPlus, Search, KeyRound, Award, Coins, TrendingUp, Bell } from "lucide-react"
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

interface ChildCandidate {
    id: string
    fullName: string
    email: string
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
    grade?: number | null
    workSummary?: string | null
    notes?: string | null
}

interface SubscriptionItem {
    id: string
    childName: string
    planLabel: string
    amount: number
    expiresAt: string
    isActive: boolean
}

export default function ChildrenTab() {
    const [children, setChildren] = useState<Child[]>([])
    const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([])
    const [loading, setLoading] = useState(true)
    const [childQuery, setChildQuery] = useState("")
    const [childResults, setChildResults] = useState<ChildCandidate[]>([])
    const [searchLoading, setSearchLoading] = useState(false)
    const [selectedCandidate, setSelectedCandidate] = useState<ChildCandidate | null>(null)
    const [linkCode, setLinkCode] = useState("")
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

    useEffect(() => {
        if (!childQuery.trim()) {
            setChildResults([])
            return
        }
        const timeout = setTimeout(async () => {
            setSearchLoading(true)
            try {
                const res = await apiFetch<ChildCandidate[]>(`/parent/child-search?query=${encodeURIComponent(childQuery.trim())}`)
                setChildResults(res || [])
            } catch {
                setChildResults([])
            } finally {
                setSearchLoading(false)
            }
        }, 300)
        return () => clearTimeout(timeout)
    }, [childQuery])

    const loadChildren = async () => {
        setLoading(true)
        try {
            const [childrenData, subsData] = await Promise.all([
                apiFetch<Child[]>("/parent/children"),
                apiFetch<SubscriptionItem[]>("/parent/subscriptions").catch(() => [])
            ])
            setChildren(childrenData || [])
            setSubscriptions(subsData || [])
        } catch (err) {
            console.error("Не удалось загрузить детей:", err)
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
        if (!selectedCandidate) {
            toast({ title: "Выберите ученика", description: "Сначала найдите и выберите ребенка.", variant: "destructive" })
            return
        }
        if (!linkCode.trim() || linkCode.trim().length !== 6) {
            toast({ title: "Неверный код", description: "Введите 6‑значный код из профиля ученика.", variant: "destructive" })
            return
        }

        setLinking(true)
        try {
            await apiFetch("/parent/link-child", {
                method: "POST",
                body: JSON.stringify({ childId: selectedCandidate.id, code: linkCode.trim() })
            })
            toast({ title: "Ребенок привязан", description: "Аккаунт ученика успешно связан." })
            setChildQuery("")
            setChildResults([])
            setSelectedCandidate(null)
            setLinkCode("")
            loadChildren()
        } catch (err: any) {
            toast({
                title: "Не удалось привязать",
                description: err?.message || "Попробуйте еще раз.",
                variant: "destructive"
            })
        } finally {
            setLinking(false)
        }
    }


    const getNextPayment = (childName: string) => {
        const matches = subscriptions.filter((s) => s.childName === childName && s.expiresAt)
        if (matches.length === 0) return null
        return matches.sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())[0]
    }

    const formatCurrency = (amount: number) => {
        return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount)} KZT`
    }


    const unreadCount = notifications.filter((n) => !n.isRead).length


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
                    Привязать аккаунт ребенка
                </h3>
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-3)]" />
                        <input
                            value={childQuery}
                            onChange={(e) => {
                                const value = e.target.value
                                setChildQuery(value)
                                if (selectedCandidate && value.trim() !== selectedCandidate.fullName) {
                                    setSelectedCandidate(null)
                                }
                            }}
                            placeholder="Поиск по ФИО или почте"
                            className="w-full pl-10 pr-4 py-3 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] focus:outline-none focus:border-[#00a3ff]"
                        />
                    </div>

                    {searchLoading && (
                        <div className="text-xs text-[var(--color-text-3)]">Поиск...</div>
                    )}

                    {childResults.length > 0 && (
                        <div className="border border-[var(--color-border-1)] rounded-lg bg-[var(--color-surface-2)]">
                            {childResults.map((child) => (
                                <button
                                    key={child.id}
                                    onClick={() => {
                                        setSelectedCandidate(child)
                                        setChildQuery(child.fullName)
                                        setChildResults([])
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-[var(--color-surface-1)] flex items-center justify-between"
                                >
                                    <div>
                                        <div className="text-sm text-[var(--color-text-1)]">{child.fullName}</div>
                                        <div className="text-xs text-[var(--color-text-3)]">{child.email}</div>
                                    </div>
                                    <UserPlus className="w-4 h-4 text-[#00a3ff]" />
                                </button>
                            ))}
                        </div>
                    )}

                    {selectedCandidate && (
                        <div className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] p-3 text-sm text-[var(--color-text-3)]">
                            Выбран: <span className="text-[var(--color-text-1)]">{selectedCandidate.fullName}</span>
                        </div>
                    )}

                    <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-3)]" />
                        <input
                            value={linkCode}
                            onChange={(e) => setLinkCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="Введите 6‑значный код"
                            className="w-full pl-10 pr-4 py-3 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] focus:outline-none focus:border-[#00a3ff]"
                        />
                    </div>

                    <button
                        onClick={handleLinkChild}
                        disabled={linking || !selectedCandidate || linkCode.trim().length !== 6}
                        className="px-6 py-3 bg-[#00a3ff] hover:bg-[#0088cc] text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        {linking ? "Привязка..." : "Привязать"}
                    </button>
                </div>
                <p className="mt-3 text-sm text-[var(--color-text-3)]">
                    Попросите ребенка открыть профиль и сообщить 6‑значный код.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" className="gap-2" onClick={openNotifications}>
                    <Bell className="w-4 h-4" />
                    Уведомления
                    {unreadCount > 0 && (
                        <Badge className="ml-1 bg-[#00a3ff]/20 text-[#00a3ff]">{unreadCount}</Badge>
                    )}
                </Button>
            </div>

            {/* Children List */}
            {children.length === 0 ? (
                <div className="card text-center py-12">
                    <Users className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-3)] opacity-50" />
                    <h3 className="text-lg font-medium text-[var(--color-text-1)] mb-2">
                        Нет привязанных детей
                    </h3>
                    <p className="text-[var(--color-text-3)]">
                        Привяжите ребенка, чтобы видеть посещаемость, отзывы и оплаты.
                    </p>
                </div>
            ) : (

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {children.map((child) => {
                        const nextPayment = getNextPayment(child.fullName)
                        return (
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

                                <div className="mt-4 flex items-center justify-between gap-3">
                                    <div className="text-xs text-[var(--color-text-3)]">
                                        {nextPayment ? (
                                            <>
                                                Следующая оплата: {new Date(nextPayment.expiresAt).toLocaleDateString("ru-RU")} • {formatCurrency(nextPayment.amount)}
                                            </>
                                        ) : (
                                            <>Нет ближайших оплат</>
                                        )}
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => openChildActivity(child)}>
                                        История уроков
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <DialogContent className="bg-[var(--color-bg)] border-[var(--color-border-1)]">
                <DialogHeader>
                    <DialogTitle className="text-[var(--color-text-1)]">Уведомления</DialogTitle>
                    <DialogDescription className="text-[var(--color-text-3)]">Обновления по посещаемости и отзывам ментора.</DialogDescription>
                </DialogHeader>
                {loadingNotes ? (
                    <div className="text-[var(--color-text-3)]">Загрузка уведомлений...</div>
                ) : notifications.length === 0 ? (
                    <div className="text-[var(--color-text-3)]">Уведомлений пока нет.</div>
                ) : (
                    <ScrollArea className="max-h-[320px] pr-2">
                        <div className="space-y-3">
                            {notifications.map((note) => (
                                <div key={note.id} className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="text-[var(--color-text-1)] font-medium">{note.title}</div>
                                        <Badge className={note.isRead ? "bg-[var(--color-surface-1)] text-[var(--color-text-3)]" : "bg-[#00a3ff]/20 text-[#00a3ff]"}>
                                            {note.isRead ? "Прочитано" : "Новое"}
                                        </Badge>
                                    </div>
                                    <div className="text-sm text-[var(--color-text-3)]">{note.message}</div>
                                    <div className="text-xs text-[var(--color-text-3)] mt-2">{new Date(note.createdAt).toLocaleString("ru-RU")}</div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>

        <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
            <DialogContent className="bg-[var(--color-bg)] border-[var(--color-border-1)]">
                <DialogHeader>
                    <DialogTitle className="text-[var(--color-text-1)]">История уроков</DialogTitle>
                    <DialogDescription className="text-[var(--color-text-3)]">
                        {selectedChild ? `Активность: ${selectedChild.fullName}` : "Посещаемость и заметки ментора"}
                    </DialogDescription>
                </DialogHeader>
                {loadingActivity ? (
                    <div className="text-[var(--color-text-3)]">Загрузка истории...</div>
                ) : attendance.length === 0 ? (
                    <div className="text-[var(--color-text-3)]">Записей пока нет.</div>
                ) : (
                    <ScrollArea className="max-h-[360px] pr-2">
                        <div className="space-y-3">
                            {attendance.map((record) => (
                                <div key={record.id} className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="text-[var(--color-text-1)] font-medium">{record.schedule?.title || "Урок"}</div>
                                        <Badge className="bg-[var(--color-surface-1)] text-[var(--color-text-2)]">
                                            {record.status}
                                        </Badge>
                                    </div>
                                    <div className="text-sm text-[var(--color-text-3)]">{record.schedule?.kruzhok?.title || "Программа"}</div>
                                    <div className="text-xs text-[var(--color-text-3)] mt-2">{new Date(record.markedAt).toLocaleString("ru-RU")}</div>
                                    {(record.grade || record.notes || record.workSummary) && (
                                        <div className="mt-2 text-xs text-[var(--color-text-3)] space-y-1">
                                            {record.grade && <div>Оценка: {record.grade}</div>}
                                            {record.workSummary && <div>Итог: {record.workSummary}</div>}
                                            {record.notes && <div>Комментарий ментора: {record.notes}</div>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>

        </div>
    )
}
