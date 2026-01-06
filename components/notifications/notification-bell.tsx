"use client"
import { useState, useEffect } from "react"
import { Bell, Check } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface Notification {
    id: string
    title: string
    message: string
    type: string
    isRead: boolean
    createdAt: string
}

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)

    const fetchNotifications = async () => {
        try {
            const res = await apiFetch<any>("/notifications")
            if (res) {
                setNotifications(res.notifications || [])
                setUnreadCount(res.unreadCount || 0)
            }
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => {
        fetchNotifications()
        // Poll every 60 seconds
        const interval = setInterval(fetchNotifications, 60000)
        return () => clearInterval(interval)
    }, [])

    const markAsRead = async (id: string) => {
        try {
            await apiFetch(`/notifications/read/${id}`, { method: "POST" })
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
            setUnreadCount(prev => Math.max(0, prev - 1))
        } catch (err) {
            console.error(err)
        }
    }

    const markAllRead = async () => {
        try {
            await apiFetch(`/notifications/read-all`, { method: "POST" })
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
            setUnreadCount(0)
        } catch (err) {
            console.error(err)
        }
    }

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <div className="relative cursor-pointer p-2 hover:bg-[var(--color-surface-2)] rounded-full transition-colors">
                    <Bell className="w-6 h-6 text-[var(--color-text-2)] hover:text-[var(--color-text-1)]" />
                    {unreadCount > 0 && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-[var(--color-bg)]">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </div>
                    )}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 bg-[var(--color-bg)] border-[var(--color-border-1)] text-[var(--color-text-1)]" align="end">
                <div className="p-4 border-b border-[var(--color-border-1)] flex justify-between items-center">
                    <h4 className="font-semibold">Уведомления</h4>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-[var(--color-primary)] h-auto p-0 hover:bg-transparent"
                            onClick={markAllRead}
                        >
                            Прочитать все
                        </Button>
                    )}
                </div>
                <div className="max-h-[70vh] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center text-[var(--color-text-3)] text-sm">
                            Нет новых уведомлений
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--color-border-1)]">
                            {notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className={cn(
                                        "p-4 hover:bg-[var(--color-surface-2)] transition-colors relative group",
                                        !n.isRead && "bg-[var(--color-surface-1)]"
                                    )}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1">
                                            <h5 className={cn("text-sm mb-1", !n.isRead ? "font-semibold text-[var(--color-text-1)]" : "font-medium text-[var(--color-text-2)]")}>
                                                {n.title}
                                            </h5>
                                            <p className="text-xs text-[var(--color-text-3)] mb-2">
                                                {n.message}
                                            </p>
                                            <div className="text-[10px] text-[var(--color-text-3)] opacity-70">
                                                {new Date(n.createdAt).toLocaleString('ru-RU')}
                                            </div>
                                        </div>
                                        {!n.isRead && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    markAsRead(n.id)
                                                }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-[var(--color-bg)] rounded"
                                                title="Отметить как прочитанное"
                                            >
                                                <Check className="w-4 h-4 text-[var(--color-primary)]" />
                                            </button>
                                        )}
                                    </div>
                                    {!n.isRead && (
                                        <div className="absolute top-4 right-4 w-2 h-2 bg-[var(--color-primary)] rounded-full md:hidden" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
