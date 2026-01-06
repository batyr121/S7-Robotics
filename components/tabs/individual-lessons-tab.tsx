"use client"
import { useState, useEffect } from "react"
import { apiFetch } from "@/lib/api"
import {
    Calendar, Clock, User, Star, CheckCircle, XCircle,
    ChevronLeft, ChevronRight, Filter, Search, Loader2
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useAuth } from "@/components/auth/auth-context"

interface Mentor {
    id: string
    fullName: string
    email: string
    availableSlots?: number
}

interface Slot {
    id: string
    date: string
    startTime: string
    endTime: string
    duration: number
    price: number
    topic?: string
    isAvailable: boolean
    mentor: Mentor
}

interface Booking {
    id: string
    topic?: string
    notes?: string
    status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
    rating?: number
    feedback?: string
    xpAwarded: number
    coinsAwarded: number
    createdAt: string
    completedAt?: string
    slot: Slot
}

export default function IndividualLessonsTab() {
    const { user } = useAuth() as any
    const [view, setView] = useState<"browse" | "my-bookings">("browse")
    const [slots, setSlots] = useState<Slot[]>([])
    const [mentors, setMentors] = useState<Mentor[]>([])
    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedMentor, setSelectedMentor] = useState<string>("")
    const [bookingSlot, setBookingSlot] = useState<Slot | null>(null)
    const [bookingTopic, setBookingTopic] = useState("")
    const [bookingNotes, setBookingNotes] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [ratingBooking, setRatingBooking] = useState<Booking | null>(null)
    const [ratingValue, setRatingValue] = useState(5)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [slotsData, mentorsData, bookingsData] = await Promise.all([
                apiFetch<Slot[]>("/individual-lessons/slots"),
                apiFetch<Mentor[]>("/individual-lessons/mentors"),
                apiFetch<Booking[]>("/individual-lessons/my-bookings")
            ])
            setSlots(slotsData || [])
            setMentors(mentorsData || [])
            setBookings(bookingsData || [])
        } catch (err) {
            console.error("Failed to load individual lessons:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleBookSlot = async () => {
        if (!bookingSlot) return
        setSubmitting(true)

        try {
            await apiFetch(`/individual-lessons/book/${bookingSlot.id}`, {
                method: "POST",
                body: JSON.stringify({
                    topic: bookingTopic || undefined,
                    notes: bookingNotes || undefined
                })
            })

            toast({
                title: "Урок забронирован!",
                description: `Вы записались на ${new Date(bookingSlot.date).toLocaleDateString('ru-RU')} в ${bookingSlot.startTime}`
            })

            setBookingSlot(null)
            setBookingTopic("")
            setBookingNotes("")
            loadData()
        } catch (err: any) {
            toast({
                title: "Ошибка",
                description: err.message || "Не удалось забронировать урок",
                variant: "destructive" as any
            })
        } finally {
            setSubmitting(false)
        }
    }

    const handleCancelBooking = async (bookingId: string) => {
        if (!confirm("Вы уверены, что хотите отменить урок?")) return

        try {
            await apiFetch(`/individual-lessons/bookings/${bookingId}`, {
                method: "DELETE"
            })

            toast({ title: "Бронирование отменено" })
            loadData()
        } catch (err: any) {
            toast({
                title: "Ошибка",
                description: err.message || "Не удалось отменить бронирование",
                variant: "destructive" as any
            })
        }
    }

    const handleRateLesson = async () => {
        if (!ratingBooking) return

        try {
            await apiFetch(`/individual-lessons/bookings/${ratingBooking.id}/rate`, {
                method: "POST",
                body: JSON.stringify({ rating: ratingValue })
            })

            toast({ title: "Спасибо за оценку!" })
            setRatingBooking(null)
            loadData()
        } catch (err: any) {
            toast({
                title: "Ошибка",
                description: err.message,
                variant: "destructive" as any
            })
        }
    }

    const filteredSlots = selectedMentor
        ? slots.filter(s => s.mentor.id === selectedMentor)
        : slots

    // Group slots by date
    const slotsByDate = filteredSlots.reduce((acc, slot) => {
        const dateKey = new Date(slot.date).toLocaleDateString('ru-RU')
        if (!acc[dateKey]) acc[dateKey] = []
        acc[dateKey].push(slot)
        return acc
    }, {} as Record<string, Slot[]>)

    const scheduledBookings = bookings.filter(b => b.status === "SCHEDULED")
    const completedBookings = bookings.filter(b => b.status === "COMPLETED")
    const cancelledBookings = bookings.filter(b => b.status === "CANCELLED" || b.status === "NO_SHOW")

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "SCHEDULED":
                return <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">Запланировано</span>
            case "COMPLETED":
                return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Завершён</span>
            case "CANCELLED":
                return <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">Отменён</span>
            case "NO_SHOW":
                return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">Пропущен</span>
            default:
                return null
        }
    }

    return (
        <div className="p-6 md:p-8 space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--color-text-1)]">Индивидуальные уроки</h2>
                    <p className="text-[var(--color-text-3)]">Забронируйте персональное занятие с ментором</p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setView("browse")}
                        className={`px-4 py-2 rounded-lg transition-colors ${view === "browse"
                                ? "bg-[var(--color-primary)] text-black"
                                : "bg-[var(--color-surface-2)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-3)]"
                            }`}
                    >
                        Доступные слоты
                    </button>
                    <button
                        onClick={() => setView("my-bookings")}
                        className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${view === "my-bookings"
                                ? "bg-[var(--color-primary)] text-black"
                                : "bg-[var(--color-surface-2)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-3)]"
                            }`}
                    >
                        Мои уроки
                        {scheduledBookings.length > 0 && (
                            <span className="px-1.5 py-0.5 text-xs rounded-full bg-white/20">
                                {scheduledBookings.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-3)]" />
                </div>
            ) : view === "browse" ? (
                <>
                    {/* Mentor filter */}
                    {mentors.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setSelectedMentor("")}
                                className={`px-4 py-2 rounded-full text-sm transition-colors ${!selectedMentor
                                        ? "bg-[var(--color-primary)] text-black"
                                        : "bg-[var(--color-surface-2)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-3)]"
                                    }`}
                            >
                                Все менторы
                            </button>
                            {mentors.map(mentor => (
                                <button
                                    key={mentor.id}
                                    onClick={() => setSelectedMentor(mentor.id)}
                                    className={`px-4 py-2 rounded-full text-sm transition-colors flex items-center gap-2 ${selectedMentor === mentor.id
                                            ? "bg-[var(--color-primary)] text-black"
                                            : "bg-[var(--color-surface-2)] text-[var(--color-text-2)] hover:bg-[var(--color-surface-3)]"
                                        }`}
                                >
                                    <User className="w-4 h-4" />
                                    {mentor.fullName}
                                    {mentor.availableSlots !== undefined && (
                                        <span className="opacity-70">({mentor.availableSlots})</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Available slots */}
                    {Object.keys(slotsByDate).length === 0 ? (
                        <div className="text-center py-12 bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border-1)]">
                            <Calendar className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-4)]" />
                            <p className="text-[var(--color-text-3)]">Нет доступных слотов</p>
                            <p className="text-sm text-[var(--color-text-4)] mt-1">Менторы пока не добавили времени для занятий</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(slotsByDate).map(([date, dateSlots]) => (
                                <div key={date} className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border-1)] overflow-hidden">
                                    <div className="px-6 py-4 border-b border-[var(--color-border-1)] bg-[var(--color-surface-2)]">
                                        <h3 className="font-semibold text-[var(--color-text-1)] flex items-center gap-2">
                                            <Calendar className="w-5 h-5" />
                                            {date}
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                                        {dateSlots.map(slot => (
                                            <div key={slot.id} className="p-4 bg-[var(--color-surface-2)] rounded-lg hover:bg-[var(--color-surface-3)] transition-colors">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center">
                                                        <User className="w-5 h-5 text-[var(--color-primary)]" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-[var(--color-text-1)]">{slot.mentor.fullName}</p>
                                                        <p className="text-xs text-[var(--color-text-3)]">Ментор</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-2 mb-4">
                                                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-2)]">
                                                        <Clock className="w-4 h-4" />
                                                        {slot.startTime} - {slot.endTime} ({slot.duration} мин)
                                                    </div>
                                                    {slot.topic && (
                                                        <p className="text-sm text-[var(--color-text-3)]">
                                                            Тема: {slot.topic}
                                                        </p>
                                                    )}
                                                    <p className="text-lg font-semibold text-[var(--color-accent-warm)]">
                                                        {Number(slot.price).toLocaleString()} ₸
                                                    </p>
                                                </div>

                                                <button
                                                    onClick={() => setBookingSlot(slot)}
                                                    className="w-full py-2 bg-[var(--color-primary)] text-black rounded-lg font-medium hover:opacity-90 transition-opacity"
                                                >
                                                    Забронировать
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                /* My bookings view */
                <div className="space-y-8">
                    {/* Scheduled */}
                    {scheduledBookings.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-[var(--color-text-1)] mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-blue-400" />
                                Запланированные ({scheduledBookings.length})
                            </h3>
                            <div className="grid gap-4">
                                {scheduledBookings.map(booking => (
                                    <div key={booking.id} className="p-6 bg-[var(--color-surface-1)] rounded-xl border border-blue-500/30">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                    <User className="w-6 h-6 text-blue-400" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-[var(--color-text-1)]">{booking.slot.mentor.fullName}</p>
                                                    <p className="text-sm text-[var(--color-text-3)]">
                                                        {new Date(booking.slot.date).toLocaleDateString('ru-RU')} • {booking.slot.startTime}
                                                    </p>
                                                    {booking.topic && (
                                                        <p className="text-sm text-[var(--color-text-2)] mt-1">Тема: {booking.topic}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleCancelBooking(booking.id)}
                                                className="px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                                            >
                                                Отменить
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Completed */}
                    {completedBookings.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-[var(--color-text-1)] mb-4 flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                                Завершённые ({completedBookings.length})
                            </h3>
                            <div className="grid gap-4">
                                {completedBookings.map(booking => (
                                    <div key={booking.id} className="p-6 bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border-1)]">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                                                    <CheckCircle className="w-6 h-6 text-green-400" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-[var(--color-text-1)]">{booking.slot.mentor.fullName}</p>
                                                    <p className="text-sm text-[var(--color-text-3)]">
                                                        {new Date(booking.slot.date).toLocaleDateString('ru-RU')} • {booking.slot.startTime}
                                                    </p>
                                                    <p className="text-sm text-green-400 mt-1">
                                                        +{booking.xpAwarded} XP • +{booking.coinsAwarded} S7 100
                                                    </p>
                                                    {booking.feedback && (
                                                        <p className="text-sm text-[var(--color-text-2)] mt-2 italic">
                                                            "{booking.feedback}"
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                {booking.rating ? (
                                                    <div className="flex items-center gap-1">
                                                        {Array.from({ length: booking.rating }).map((_, i) => (
                                                            <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setRatingBooking(booking)}
                                                        className="px-4 py-2 text-sm bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary)]/30"
                                                    >
                                                        Оценить
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Cancelled */}
                    {cancelledBookings.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-[var(--color-text-1)] mb-4 flex items-center gap-2">
                                <XCircle className="w-5 h-5 text-red-400" />
                                Отменённые ({cancelledBookings.length})
                            </h3>
                            <div className="grid gap-4 opacity-60">
                                {cancelledBookings.map(booking => (
                                    <div key={booking.id} className="p-4 bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border-1)]">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                                <XCircle className="w-5 h-5 text-red-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-[var(--color-text-1)]">{booking.slot.mentor.fullName}</p>
                                                <p className="text-sm text-[var(--color-text-3)]">
                                                    {new Date(booking.slot.date).toLocaleDateString('ru-RU')} • {getStatusBadge(booking.status)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {bookings.length === 0 && (
                        <div className="text-center py-12 bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border-1)]">
                            <Calendar className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-4)]" />
                            <p className="text-[var(--color-text-3)]">У вас пока нет забронированных уроков</p>
                            <button
                                onClick={() => setView("browse")}
                                className="mt-4 px-6 py-2 bg-[var(--color-primary)] text-black rounded-lg font-medium"
                            >
                                Найти урок
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Booking modal */}
            {bookingSlot && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--color-surface-1)] rounded-2xl max-w-md w-full p-6 border border-[var(--color-border-1)]">
                        <h3 className="text-xl font-bold text-[var(--color-text-1)] mb-4">Забронировать урок</h3>

                        <div className="space-y-4 mb-6">
                            <div className="p-4 bg-[var(--color-surface-2)] rounded-lg">
                                <div className="flex items-center gap-3 mb-2">
                                    <User className="w-5 h-5 text-[var(--color-primary)]" />
                                    <span className="font-medium text-[var(--color-text-1)]">{bookingSlot.mentor.fullName}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-[var(--color-text-3)]">
                                    <Calendar className="w-4 h-4" />
                                    {new Date(bookingSlot.date).toLocaleDateString('ru-RU')}
                                    <Clock className="w-4 h-4 ml-2" />
                                    {bookingSlot.startTime} - {bookingSlot.endTime}
                                </div>
                                <p className="mt-2 text-lg font-semibold text-[var(--color-accent-warm)]">
                                    {Number(bookingSlot.price).toLocaleString()} ₸
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm text-[var(--color-text-3)] mb-2">Тема урока (опционально)</label>
                                <input
                                    type="text"
                                    value={bookingTopic}
                                    onChange={(e) => setBookingTopic(e.target.value)}
                                    placeholder="Например: Python основы"
                                    className="w-full px-4 py-3 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] placeholder:text-[var(--color-text-4)] focus:outline-none focus:border-[var(--color-primary)]"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-[var(--color-text-3)] mb-2">Заметки (опционально)</label>
                                <textarea
                                    value={bookingNotes}
                                    onChange={(e) => setBookingNotes(e.target.value)}
                                    placeholder="Что хотите изучить или уточнить?"
                                    rows={3}
                                    className="w-full px-4 py-3 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] placeholder:text-[var(--color-text-4)] focus:outline-none focus:border-[var(--color-primary)] resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setBookingSlot(null)}
                                className="flex-1 py-3 bg-[var(--color-surface-2)] text-[var(--color-text-2)] rounded-lg hover:bg-[var(--color-surface-3)]"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleBookSlot}
                                disabled={submitting}
                                className="flex-1 py-3 bg-[var(--color-primary)] text-black rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
                            >
                                {submitting ? "Бронирование..." : "Забронировать"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rating modal */}
            {ratingBooking && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[var(--color-surface-1)] rounded-2xl max-w-sm w-full p-6 border border-[var(--color-border-1)]">
                        <h3 className="text-xl font-bold text-[var(--color-text-1)] mb-4 text-center">Оцените урок</h3>

                        <div className="flex justify-center gap-2 mb-6">
                            {[1, 2, 3, 4, 5].map(star => (
                                <button
                                    key={star}
                                    onClick={() => setRatingValue(star)}
                                    className="p-1"
                                >
                                    <Star
                                        className={`w-8 h-8 transition-colors ${star <= ratingValue
                                                ? "fill-yellow-400 text-yellow-400"
                                                : "text-[var(--color-text-4)]"
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setRatingBooking(null)}
                                className="flex-1 py-3 bg-[var(--color-surface-2)] text-[var(--color-text-2)] rounded-lg"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleRateLesson}
                                className="flex-1 py-3 bg-[var(--color-primary)] text-black rounded-lg font-medium"
                            >
                                Оценить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
