"use client"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-context"
import { apiFetch } from "@/lib/api"
import UserLayout from "@/components/layout/user-layout"
import { Calendar, Users, Award, BarChart3, MessageSquare, Clock, User, CheckCircle, XCircle, Coins, Plus, Edit2, CheckSquare } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

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
    attendances?: { studentId: string; status: string; student?: { fullName: string } }[]
}

interface Kruzhok {
    id: string
    title: string
    classes: { id: string; name: string }[]
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
    const [kruzhoks, setKruzhoks] = useState<Kruzhok[]>([])
    const [stats, setStats] = useState<Stats | null>(null)
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
    const [loading, setLoading] = useState(true)

    // Create Lesson State
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newLesson, setNewLesson] = useState({
        kruzhokId: "",
        classId: "",
        title: "",
        date: new Date().toISOString().split('T')[0],
        time: "10:00",
        duration: 60
    })
    const [creating, setCreating] = useState(false)

    // Attendance State
    const [isAttendanceOpen, setIsAttendanceOpen] = useState(false)
    const [selectedSession, setSelectedSession] = useState<ScheduleItem | null>(null)
    const [attendanceData, setAttendanceData] = useState<Record<string, string>>({}) // studentId -> status
    const [savingAttendance, setSavingAttendance] = useState(false)

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
            const [scheduleData, studentsData, statsData, kruzhoksData] = await Promise.all([
                apiFetch<ScheduleItem[]>("/mentor/schedule"),
                apiFetch<Student[]>("/mentor/students"),
                apiFetch<Stats>("/mentor/stats"),
                apiFetch<Kruzhok[]>("/mentor/my-kruzhoks")
            ])
            setSchedule(scheduleData || [])
            setStudents(studentsData || [])
            setStats(statsData || null)
            setKruzhoks(kruzhoksData || [])
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

    // --- Actions ---

    const handleCreateLesson = async () => {
        if (!newLesson.title || !newLesson.kruzhokId || !newLesson.date || !newLesson.time) {
            toast({ title: "Ошибка", description: "Заполните все обязательные поля", variant: "destructive" })
            return
        }

        setCreating(true)
        try {
            await apiFetch("/mentor/schedule", {
                method: "POST",
                body: JSON.stringify({
                    kruzhokId: newLesson.kruzhokId,
                    classId: newLesson.classId || undefined,
                    title: newLesson.title,
                    scheduledDate: new Date(newLesson.date).toISOString(),
                    scheduledTime: newLesson.time,
                    durationMinutes: Number(newLesson.duration)
                })
            })
            toast({ title: "Успешно", description: "Занятие добавлено в расписание" })
            setIsCreateOpen(false)
            setNewLesson({ ...newLesson, title: "" })
            // Refresh schedule
            const s = await apiFetch<ScheduleItem[]>("/mentor/schedule")
            setSchedule(s || [])
        } catch (e: any) {
            toast({ title: "Ошибка", description: e.message || "Не удалось создать занятие", variant: "destructive" })
        } finally {
            setCreating(false)
        }
    }

    const openAttendanceModal = (session: ScheduleItem) => {
        setSelectedSession(session)
        // Pre-fill existing attendance or default to PRESENT
        const initial: Record<string, string> = {}
        const sessionStudents = students.filter(s =>
            s.classes.some(c => c.id === session.class?.id)
        )

        sessionStudents.forEach(s => {
            const existing = session.attendances?.find(a => a.studentId === s.id)
            initial[s.id] = existing ? existing.status : "PRESENT"
        })
        setAttendanceData(initial)
        setIsAttendanceOpen(true)
    }

    const handleSaveAttendance = async () => {
        if (!selectedSession) return
        setSavingAttendance(true)
        try {
            const payload = Object.entries(attendanceData).map(([studentId, status]) => ({
                studentId,
                status
            }))

            await apiFetch(`/mentor/schedule/${selectedSession.id}/attendance`, {
                method: "POST",
                body: JSON.stringify({ attendances: payload })
            })
            // Also mark session as completed if it wasn't
            if (selectedSession.status !== "COMPLETED") {
                await apiFetch(`/mentor/schedule/${selectedSession.id}`, {
                    method: "PUT",
                    body: JSON.stringify({ status: "COMPLETED" })
                })
            }

            toast({ title: "Успешно", description: "Посещаемость отмечена" })
            setIsAttendanceOpen(false)
            // Refresh schedule
            const s = await apiFetch<ScheduleItem[]>("/mentor/schedule")
            setSchedule(s || [])
        } catch (e: any) {
            toast({ title: "Ошибка", description: e.message || "Не удалось сохранить", variant: "destructive" })
        } finally {
            setSavingAttendance(false)
        }
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
        const upcoming = schedule.filter(s => new Date(s.scheduledDate) >= today || s.status === "SCHEDULED") // Show all scheduled even if slightly in past but not completed
        const past = schedule.filter(s => s.status === "COMPLETED")

        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-[var(--color-text-1)]">Расписание</h3>
                    <Button onClick={() => setIsCreateOpen(true)} className="bg-[#00a3ff] hover:bg-[#0082cc] text-white">
                        <Plus className="w-4 h-4 mr-2" /> Добавить занятие
                    </Button>
                </div>

                <div className="space-y-6">
                    <div className="card">
                        <h3 className="text-md font-medium text-[var(--color-text-1)] mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-400" /> Активные и предстоящие
                        </h3>
                        {upcoming.length === 0 ? (
                            <p className="text-[var(--color-text-3)]">Нет запланированных занятий</p>
                        ) : (
                            <div className="space-y-3">
                                {upcoming.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()).map((s) => (
                                    <div key={s.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-[var(--color-surface-2)] rounded-lg border border-[var(--color-border-1)] gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge className="bg-blue-500/20 text-blue-400">{s.scheduledTime}</Badge>
                                                <h4 className="font-medium text-[var(--color-text-1)]">{s.title}</h4>
                                            </div>
                                            <p className="text-sm text-[var(--color-text-3)]">{s.kruzhok?.title} • {s.class?.name || "Без класса"}</p>
                                            <p className="text-xs text-[var(--color-text-3)] mt-1">
                                                {new Date(s.scheduledDate).toLocaleDateString("ru-RU", { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Button variant="outline" size="sm" onClick={() => openAttendanceModal(s)} className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10">
                                                <CheckSquare className="w-4 h-4 mr-2" /> Отметить
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="card opacity-90">
                        <h3 className="text-md font-medium text-[var(--color-text-1)] mb-4 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400" /> Проведённые
                        </h3>
                        {past.length === 0 ? (
                            <p className="text-[var(--color-text-3)]">История пуста</p>
                        ) : (
                            <div className="space-y-3">
                                {past.sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()).map((s) => (
                                    <div key={s.id} className="flex items-center justify-between p-4 bg-[var(--color-surface-2)] rounded-lg">
                                        <div>
                                            <h4 className="font-medium text-[var(--color-text-1)] line-through opacity-75">{s.title}</h4>
                                            <p className="text-sm text-[var(--color-text-3)]">{s.kruzhok?.title} • {new Date(s.scheduledDate).toLocaleDateString()}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge className="bg-green-500/20 text-green-400">Завершено</Badge>
                                            <Button variant="ghost" size="icon" onClick={() => openAttendanceModal(s)} title="Изменить посещаемость">
                                                <Edit2 className="w-4 h-4 text-[var(--color-text-3)]" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Create Lesson Modal */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent className="bg-[#1b1b22] border-[#2a2a35] text-white">
                        <DialogHeader>
                            <DialogTitle>Новое занятие</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm text-[#a0a0b0]">Кружок</label>
                                <Select
                                    value={newLesson.kruzhokId}
                                    onValueChange={(v) => {
                                        // Reset class when kruzhok changes
                                        const k = kruzhoks.find(k => k.id === v)
                                        setNewLesson({ ...newLesson, kruzhokId: v, classId: k?.classes[0]?.id || "" })
                                    }}
                                >
                                    <SelectTrigger className="bg-[#16161c] border-[#2a2a35]">
                                        <SelectValue placeholder="Выберите кружок" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1b1b22] border-[#2a2a35]">
                                        {kruzhoks.map(k => (
                                            <SelectItem key={k.id} value={k.id}>{k.title}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-[#a0a0b0]">Класс (группа)</label>
                                <Select
                                    value={newLesson.classId}
                                    onValueChange={(v) => setNewLesson({ ...newLesson, classId: v })}
                                    disabled={!newLesson.kruzhokId}
                                >
                                    <SelectTrigger className="bg-[#16161c] border-[#2a2a35]">
                                        <SelectValue placeholder="Выберите класс" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1b1b22] border-[#2a2a35]">
                                        {kruzhoks.find(k => k.id === newLesson.kruzhokId)?.classes.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        )) || <SelectItem value="none" disabled>Нет классов</SelectItem>}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-[#a0a0b0]">Тема занятия</label>
                                <Input
                                    value={newLesson.title}
                                    onChange={e => setNewLesson({ ...newLesson, title: e.target.value })}
                                    className="bg-[#16161c] border-[#2a2a35]"
                                    placeholder="Введение в робототехнику"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm text-[#a0a0b0]">Дата</label>
                                    <Input
                                        type="date"
                                        value={newLesson.date}
                                        onChange={e => setNewLesson({ ...newLesson, date: e.target.value })}
                                        className="bg-[#16161c] border-[#2a2a35]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm text-[#a0a0b0]">Время</label>
                                    <Input
                                        type="time"
                                        value={newLesson.time}
                                        onChange={e => setNewLesson({ ...newLesson, time: e.target.value })}
                                        className="bg-[#16161c] border-[#2a2a35]"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-[#a0a0b0]">Длительность (мин)</label>
                                <Input
                                    type="number"
                                    value={newLesson.duration}
                                    onChange={e => setNewLesson({ ...newLesson, duration: Number(e.target.value) })}
                                    className="bg-[#16161c] border-[#2a2a35]"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="border-[#2a2a35] text-white hover:bg-[#2a2a35]">Отмена</Button>
                            <Button onClick={handleCreateLesson} disabled={creating} className="bg-[#00a3ff] hover:bg-[#0082cc] text-white">
                                {creating ? "Создание..." : "Создать"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Attendance Modal */}
                <Dialog open={isAttendanceOpen} onOpenChange={setIsAttendanceOpen}>
                    <DialogContent className="bg-[#1b1b22] border-[#2a2a35] text-white max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Отметка посещаемости</DialogTitle>
                            <p className="text-sm text-[#a0a0b0]">{selectedSession?.title} • {new Date(selectedSession?.scheduledDate || "").toLocaleDateString()}</p>
                        </DialogHeader>

                        <div className="py-4 space-y-2">
                            {/* Filter students by selectedSession's class */}
                            {students.filter(s => s.classes.some(c => c.id === selectedSession?.class?.id)).length === 0 ? (
                                <p className="text-[#a0a0b0] text-center">Нет студентов в этой группе</p>
                            ) : (
                                students.filter(s => s.classes.some(c => c.id === selectedSession?.class?.id)).map(student => (
                                    <div key={student.id} className="flex items-center justify-between p-3 bg-[#16161c] rounded-lg border border-[#2a2a35]">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#2a2a35] flex items-center justify-center text-xs">
                                                {student.fullName.charAt(0)}
                                            </div>
                                            <span>{student.fullName}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            {["PRESENT", "LATE", "ABSENT"].map((status) => (
                                                <button
                                                    key={status}
                                                    onClick={() => setAttendanceData(prev => ({ ...prev, [student.id]: status }))}
                                                    className={`px-3 py-1 text-xs rounded transition-colors ${attendanceData[student.id] === status
                                                            ? status === "PRESENT" ? "bg-green-500 text-white"
                                                                : status === "LATE" ? "bg-yellow-500 text-white"
                                                                    : "bg-red-500 text-white"
                                                            : "bg-[#2a2a35] text-[#a0a0b0] hover:bg-[#333344]"
                                                        }`}
                                                >
                                                    {status === "PRESENT" ? "Присутствовал" : status === "LATE" ? "Опоздал" : "Нет"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAttendanceOpen(false)} className="border-[#2a2a35] text-white hover:bg-[#2a2a35]">Отмена</Button>
                            <Button onClick={handleSaveAttendance} disabled={savingAttendance} className="bg-green-600 hover:bg-green-700 text-white">
                                {savingAttendance ? "Сохранение..." : "Сохранить и завершить"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
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
