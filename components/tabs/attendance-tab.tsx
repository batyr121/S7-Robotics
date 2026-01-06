"use client"
import { useState, useEffect } from "react"
import { Calendar, Check, X, Clock, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface Student {
    id: string
    fullName: string
}

interface AttendanceRecord {
    id?: string
    studentId: string
    date: string
    status: "present" | "absent" | "late" | "excused"
    grade?: number
    activity?: string
    comment?: string
}

interface Group {
    id: string
    name: string
    kruzhokTitle: string
    students: Student[]
}

export default function AttendanceTab() {
    const [groups, setGroups] = useState<Group[]>([])
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
    const [loading, setLoading] = useState(true)
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
    const [dates, setDates] = useState<string[]>([])
    const [currentMonth, setCurrentMonth] = useState(new Date())

    // Edit dialog
    const [editOpen, setEditOpen] = useState(false)
    const [editCell, setEditCell] = useState<{ studentId: string, date: string } | null>(null)
    const [editData, setEditData] = useState<Partial<AttendanceRecord>>({})

    useEffect(() => {
        loadGroups()
    }, [])

    useEffect(() => {
        generateDates()
    }, [currentMonth])

    useEffect(() => {
        if (selectedGroup) {
            loadAttendance(selectedGroup.id)
        }
    }, [selectedGroup, currentMonth])

    const generateDates = () => {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        const newDates: string[] = []
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d)
            newDates.push(date.toISOString().split('T')[0])
        }
        setDates(newDates)
    }

    const loadGroups = async () => {
        setLoading(true)
        try {
            const kruzhoks = await apiFetch<any[]>("/mentor/my-kruzhoks")
            const allGroups: Group[] = []
            for (const k of kruzhoks || []) {
                for (const cls of k.classes || []) {
                    const students = await apiFetch<Student[]>(`/mentor/class/${cls.id}/students`).catch(() => [])
                    allGroups.push({
                        id: cls.id,
                        name: cls.name,
                        kruzhokTitle: k.title,
                        students: students || []
                    })
                }
            }
            setGroups(allGroups)
            if (allGroups.length > 0) {
                setSelectedGroup(allGroups[0])
            }
        } catch (err) {
            console.error("Failed to load groups:", err)
        } finally {
            setLoading(false)
        }
    }

    const loadAttendance = async (groupId: string) => {
        try {
            const year = currentMonth.getFullYear()
            const month = currentMonth.getMonth() + 1
            const data = await apiFetch<AttendanceRecord[]>(`/mentor/class/${groupId}/attendance?year=${year}&month=${month}`).catch(() => [])
            setAttendance(data || [])
        } catch {
            setAttendance([])
        }
    }

    const getAttendance = (studentId: string, date: string): AttendanceRecord | undefined => {
        return attendance.find(a => a.studentId === studentId && a.date === date)
    }

    const getStatusColor = (status?: string) => {
        switch (status) {
            case "present": return "bg-green-500"
            case "absent": return "bg-red-500"
            case "late": return "bg-yellow-500"
            case "excused": return "bg-blue-500"
            default: return "bg-[var(--color-surface-2)]"
        }
    }

    const getStatusIcon = (status?: string) => {
        switch (status) {
            case "present": return <Check className="w-3 h-3" />
            case "absent": return <X className="w-3 h-3" />
            case "late": return <Clock className="w-3 h-3" />
            default: return null
        }
    }

    const openEditDialog = (studentId: string, date: string) => {
        const record = getAttendance(studentId, date)
        setEditCell({ studentId, date })
        setEditData(record || { status: "present" })
        setEditOpen(true)
    }

    const saveAttendance = async () => {
        if (!editCell || !selectedGroup) return
        try {
            await apiFetch(`/mentor/class/${selectedGroup.id}/attendance`, {
                method: "POST",
                body: JSON.stringify({
                    studentId: editCell.studentId,
                    date: editCell.date,
                    ...editData
                })
            })
            setEditOpen(false)
            loadAttendance(selectedGroup.id)
        } catch (err) {
            console.error("Failed to save attendance:", err)
        }
    }

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
    }

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
    }

    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-[var(--color-text-3)]">Загрузка...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-[var(--color-text-1)]">Табель посещаемости</h2>
                    <p className="text-sm text-[var(--color-text-3)]">Excel-подобная таблица учёта</p>
                </div>

                {/* Group Selector */}
                <select
                    value={selectedGroup?.id || ""}
                    onChange={(e) => {
                        const g = groups.find(gr => gr.id === e.target.value)
                        setSelectedGroup(g || null)
                    }}
                    className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-4 py-2 text-[var(--color-text-1)] outline-none"
                >
                    {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name} — {g.kruzhokTitle}</option>
                    ))}
                </select>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={prevMonth}>
                    <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-lg font-medium text-[var(--color-text-1)]">
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </span>
                <Button variant="outline" size="sm" onClick={nextMonth}>
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-500"></div>
                    <span className="text-[var(--color-text-3)]">Присутствует</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500"></div>
                    <span className="text-[var(--color-text-3)]">Отсутствует</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-yellow-500"></div>
                    <span className="text-[var(--color-text-3)]">Опоздал</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-500"></div>
                    <span className="text-[var(--color-text-3)]">Уважительная</span>
                </div>
            </div>

            {/* Excel-like Table */}
            {selectedGroup && (
                <div className="card overflow-x-auto">
                    <table className="w-full border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-[var(--color-border-1)]">
                                <th className="sticky left-0 bg-[var(--color-surface-1)] z-10 p-3 text-left text-sm font-medium text-[var(--color-text-1)] min-w-[200px]">
                                    Ученик
                                </th>
                                {dates.map(date => {
                                    const d = new Date(date)
                                    const day = d.getDate()
                                    const weekDay = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][d.getDay()]
                                    const isWeekend = d.getDay() === 0 || d.getDay() === 6
                                    return (
                                        <th
                                            key={date}
                                            className={`p-2 text-center text-xs min-w-[40px] ${isWeekend ? 'bg-[var(--color-surface-2)]' : ''}`}
                                        >
                                            <div className="text-[var(--color-text-1)]">{day}</div>
                                            <div className="text-[var(--color-text-3)]">{weekDay}</div>
                                        </th>
                                    )
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {selectedGroup.students.length === 0 ? (
                                <tr>
                                    <td colSpan={dates.length + 1} className="p-8 text-center text-[var(--color-text-3)]">
                                        Нет учеников в группе
                                    </td>
                                </tr>
                            ) : (
                                selectedGroup.students.map((student, idx) => (
                                    <tr key={student.id} className={idx % 2 === 0 ? '' : 'bg-[var(--color-surface-2)]/30'}>
                                        <td className="sticky left-0 bg-[var(--color-surface-1)] z-10 p-3 text-sm font-medium text-[var(--color-text-1)] border-r border-[var(--color-border-1)]">
                                            {student.fullName}
                                        </td>
                                        {dates.map(date => {
                                            const record = getAttendance(student.id, date)
                                            const d = new Date(date)
                                            const isWeekend = d.getDay() === 0 || d.getDay() === 6
                                            return (
                                                <td
                                                    key={date}
                                                    className={`p-1 text-center ${isWeekend ? 'bg-[var(--color-surface-2)]/50' : ''}`}
                                                >
                                                    <button
                                                        onClick={() => openEditDialog(student.id, date)}
                                                        className={`w-8 h-8 rounded flex items-center justify-center text-white transition-all hover:scale-110 ${getStatusColor(record?.status)}`}
                                                        title={record?.comment || "Нажмите для редактирования"}
                                                    >
                                                        {getStatusIcon(record?.status)}
                                                        {record?.grade && (
                                                            <span className="text-xs font-bold">{record.grade}</span>
                                                        )}
                                                    </button>
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="bg-[var(--color-bg)] border-[var(--color-border-1)]">
                    <DialogHeader>
                        <DialogTitle className="text-[var(--color-text-1)]">Редактирование</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        {/* Status */}
                        <div>
                            <label className="text-sm text-[var(--color-text-3)] mb-2 block">Статус</label>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { value: "present", label: "Был", color: "bg-green-500" },
                                    { value: "absent", label: "Нет", color: "bg-red-500" },
                                    { value: "late", label: "Опоздал", color: "bg-yellow-500" },
                                    { value: "excused", label: "Ув.", color: "bg-blue-500" },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setEditData({ ...editData, status: opt.value as any })}
                                        className={`p-2 rounded text-sm text-white ${opt.color} ${editData.status === opt.value ? 'ring-2 ring-white' : 'opacity-60'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Grade */}
                        <div>
                            <label className="text-sm text-[var(--color-text-3)] mb-2 block">Оценка (1-5)</label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setEditData({ ...editData, grade: g })}
                                        className={`w-10 h-10 rounded text-sm font-bold ${editData.grade === g ? 'bg-[#00a3ff] text-white' : 'bg-[var(--color-surface-2)] text-[var(--color-text-1)]'}`}
                                    >
                                        {g}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setEditData({ ...editData, grade: undefined })}
                                    className={`w-10 h-10 rounded text-xs ${!editData.grade ? 'bg-[#00a3ff] text-white' : 'bg-[var(--color-surface-2)] text-[var(--color-text-3)]'}`}
                                >
                                    —
                                </button>
                            </div>
                        </div>

                        {/* Activity */}
                        <div>
                            <label className="text-sm text-[var(--color-text-3)] mb-2 block">Активность</label>
                            <input
                                value={editData.activity || ""}
                                onChange={(e) => setEditData({ ...editData, activity: e.target.value })}
                                placeholder="Чем занимался"
                                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-3 py-2 text-[var(--color-text-1)] outline-none"
                            />
                        </div>

                        {/* Comment */}
                        <div>
                            <label className="text-sm text-[var(--color-text-3)] mb-2 block">Комментарий</label>
                            <textarea
                                value={editData.comment || ""}
                                onChange={(e) => setEditData({ ...editData, comment: e.target.value })}
                                placeholder="Заметки"
                                rows={2}
                                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-3 py-2 text-[var(--color-text-1)] outline-none"
                            />
                        </div>

                        <Button onClick={saveAttendance} className="w-full bg-[#00a3ff] text-white hover:bg-[#0088cc]">
                            Сохранить
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
