"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiFetch, getTokens } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
    Calendar,
    ArrowLeft,
    Clock,
    Download,
    BookOpen,
    Star
} from "lucide-react"

interface GroupDetails {
    id: string
    name: string
    kruzhokTitle: string
    programTitle?: string
    programLessons?: number
    studentsCount: number
    schedule?: string
    nextLesson?: {
        date: string
        time: string
        title: string
    }
    isActive?: boolean
}

interface GradebookEntry {
    recordId?: string
    student: {
        id: string
        fullName: string
        email: string
        paymentStatus?: "PAID" | "DEBTOR" // Might need to fetch fresh if not in report, but simplified for now
    }
    status: string
    grade: number | null
    workSummary?: string
    feedback: string
    studentRating: number | null
    studentComment: string | null
}

interface LessonSchedule {
    id: string
    title: string
    scheduledDate: string
    status: string
    completedAt?: string
}

export default function GroupDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const id = params?.id as string

    const [group, setGroup] = useState<GroupDetails | null>(null)
    const [history, setHistory] = useState<LessonSchedule[]>([])
    const [selectedScheduleId, setSelectedScheduleId] = useState<string>("latest")
    const [reportRows, setReportRows] = useState<GradebookEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [reportLoading, setReportLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Load Group & History
    useEffect(() => {
        if (!id) return;
        const loadData = async () => {
            setLoading(true)
            try {
                const [groupData, historyData] = await Promise.all([
                    apiFetch<GroupDetails>(`/mentor/groups/${id}`),
                    apiFetch<LessonSchedule[]>(`/mentor/groups/${id}/gradebook`)
                ])
                setGroup(groupData)
                setHistory(historyData)

                // Select latest lesson if available
                if (historyData.length > 0) {
                    setSelectedScheduleId(historyData[0].id)
                }
            } catch (err: any) {
                console.error("Не удалось загрузить данные группы", err)
                setError(err.message || "Не удалось загрузить данные группы")
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [id])

    // Load specific report when selection changes
    useEffect(() => {
        if (!id || selectedScheduleId === "latest" || !selectedScheduleId) return

        const loadReport = async () => {
            setReportLoading(true)
            try {
                const res = await apiFetch<any>(`/mentor/groups/${id}/report/${selectedScheduleId}`)
                const normalized = (res.rows || []).map((row: GradebookEntry) => ({
                    ...row,
                    status: row.status || "ABSENT",
                    feedback: row.feedback || "",
                    workSummary: row.workSummary || ""
                }))
                setReportRows(normalized)
            } catch (err) {
                console.error("Failed to load report", err)
            } finally {
                setReportLoading(false)
            }
        }
        loadReport()
    }, [id, selectedScheduleId])

    const selectedSchedule = history.find((h) => h.id === selectedScheduleId)
    const selectedDateLabel = selectedSchedule
        ? new Date(selectedSchedule.scheduledDate).toLocaleDateString("ru-RU")
        : "-"

    const handleSaveRow = async (row: GradebookEntry) => {
        if (!selectedSchedule) return

        try {
            const normalizedStatus = row.status === "EXCUSED" ? "absent" : row.status.toLowerCase()
            const payload: any = {
                scheduleId: selectedSchedule.id,
                studentId: row.student.id,
                date: selectedSchedule.scheduledDate.split('T')[0], // Fallback
                status: normalizedStatus,
                workSummary: row.workSummary || undefined,
                comment: row.feedback || undefined
            }
            if (typeof row.grade === "number") payload.grade = row.grade
            await apiFetch(`/mentor/class/${id}/attendance`, {
                method: "POST",
                body: JSON.stringify(payload)
            })
            // Show success toast or visual indicator?
        } catch (err) {
            console.error("Не удалось сохранить", err)
            alert("Не удалось сохранить изменения")
        }
    }

    const handleDownloadReport = async () => {
        try {
            const tokens = getTokens()
            const apiUrl = typeof window !== "undefined" && (window as any).ENV_API_URL
                ? (window as any).ENV_API_URL
                : (process.env.NEXT_PUBLIC_API_URL || "")
            const exportUrl = apiUrl ? `${apiUrl}/mentor/groups/${id}/export` : `/api/mentor/groups/${id}/export`

            const res = await fetch(exportUrl, {
                headers: tokens?.accessToken ? { authorization: `Bearer ${tokens.accessToken}` } : undefined
            })

            if (!res.ok) throw new Error("Не удалось скачать")

            const blob = await res.blob()
            const downloadUrl = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = downloadUrl
            a.download = `gradebook-${group?.name || id}.xlsx`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(downloadUrl)
            document.body.removeChild(a)

        } catch (err) {
            console.error("Не удалось скачать", err)
            alert("Не удалось скачать отчет")
        }
    }

    const statusTone = (status: string) => {
        switch (status) {
            case "PRESENT":
                return "border-green-500/40 bg-green-500/10 text-green-400"
            case "LATE":
                return "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
            case "ABSENT":
                return "border-red-500/40 bg-red-500/10 text-red-400"
            case "EXCUSED":
                return "border-blue-500/40 bg-blue-500/10 text-blue-400"
            default:
                return "border-[var(--color-border-1)] bg-[var(--color-surface-2)] text-[var(--color-text-2)]"
        }
    }

    const rowTone = (status: string) => {
        switch (status) {
            case "PRESENT":
                return "bg-green-500/5"
            case "LATE":
                return "bg-yellow-500/5"
            case "ABSENT":
                return "bg-red-500/5"
            case "EXCUSED":
                return "bg-blue-500/5"
            default:
                return ""
        }
    }

    if (loading) return <div className="p-8 text-center text-[var(--color-text-3)]">Загрузка...</div>
    if (error) return <div className="p-8 text-center text-red-500">Ошибка: {error}</div>
    if (!group) return <div className="p-8 text-center">Группа не найдена</div>

    return (
        <div className="space-y-6 animate-slide-up pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--color-text-1)]">{group.name}</h1>
                        <div className="flex items-center gap-2 text-[var(--color-text-3)] text-sm">
                            <span>{group.kruzhokTitle}</span>
                            <span>•</span>
                            <Badge variant="outline" className={group.isActive ? "text-green-500 border-green-500/20" : "text-yellow-500 border-yellow-500/20"}>
                                {group.isActive ? "Активна" : "Пауза"}
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button
                        onClick={() => router.push(`/dashboard?tab=lesson&groupId=${group.id}`)}
                        className="bg-[#00a3ff] text-white hover:bg-[#0088cc]"
                    >
                        Начать урок
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Main Content - Gradebook */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="flex items- center justify-between bg-[var(--color-surface-2)] p-4 rounded-xl border border-[var(--color-border-1)]">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-[var(--color-surface-1)] rounded-lg">
                                <Calendar className="w-5 h-5 text-[#00a3ff]" />
                            </div>
                            <div>
                                <div className="text-sm text-[var(--color-text-3)]">История</div>
                                <div className="font-semibold">Табель</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" className="gap-2" onClick={handleDownloadReport}>
                                <Download className="w-4 h-4" />
                                Скачать отчет
                            </Button>
                            <div className="w-[200px]">
                                <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Выберите дату" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {history.length === 0 && <SelectItem value="none" disabled>Нет истории</SelectItem>}
                                        {history.map(h => (
                                            <SelectItem key={h.id} value={h.id}>
                                                {new Date(h.scheduledDate).toLocaleDateString("ru-RU")}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <Card className="bg-[var(--color-surface-2)] border-[var(--color-border-1)] overflow-hidden">
                        {reportLoading ? (
                            <div className="p-12 text-center text-[var(--color-text-3)]">Загрузка отчета...</div>
                        ) : history.length === 0 ? (
                            <div className="p-12 text-center text-[var(--color-text-3)]">Прошлых уроков нет. Проведите урок, чтобы увидеть данные.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse min-w-[1100px]">
                                    <thead className="text-xs text-[var(--color-text-3)] uppercase bg-[var(--color-surface-1)] border-b border-[var(--color-border-1)] sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 font-medium border-r border-[var(--color-border-1)] w-[240px]">Имя ученика</th>
                                            <th className="px-4 py-3 font-medium border-r border-[var(--color-border-1)] w-[140px]">Дата</th>
                                            <th className="px-4 py-3 font-medium border-r border-[var(--color-border-1)] w-[160px]">Посещаемость</th>
                                            <th className="px-4 py-3 font-medium border-r border-[var(--color-border-1)] min-w-[200px]">Причина опоздания</th>
                                            <th className="px-4 py-3 font-medium border-r border-[var(--color-border-1)] w-[110px]">Оценка ментора</th>
                                            <th className="px-4 py-3 font-medium border-r border-[var(--color-border-1)] min-w-[200px]">Комментарий ментора</th>
                                            <th className="px-4 py-3 font-medium min-w-[180px]">Оценка ученика</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportRows.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-3)]">
                                                    Ученики не найдены.
                                                </td>
                                            </tr>
                                        )}
                                        {reportRows.map((row, idx) => (
                                            <tr key={idx} className={`border-b border-[var(--color-border-1)] hover:bg-[var(--color-surface-3)] transition-colors ${rowTone(row.status)}`}>
                                                <td className="px-4 py-3 font-medium border-r border-[var(--color-border-1)]">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00a3ff] to-[#0055ff] flex items-center justify-center text-white text-xs">
                                                            {row.student.fullName.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="text-[var(--color-text-1)]">{row.student.fullName}</div>
                                                            <div className="text-xs text-[var(--color-text-3)]">{row.student.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-[var(--color-text-3)] border-r border-[var(--color-border-1)]">
                                                    {selectedDateLabel}
                                                </td>
                                                <td className="px-4 py-3 border-r border-[var(--color-border-1)]">
                                                    <Select
                                                        value={row.status}
                                                        onValueChange={(val) => {
                                                            const newRows = [...reportRows]
                                                            const updated = { ...newRows[idx], status: val }
                                                            newRows[idx] = updated
                                                            setReportRows(newRows)
                                                            handleSaveRow(updated)
                                                        }}
                                                    >
                                                        <SelectTrigger className={`h-9 w-[140px] ${statusTone(row.status)}`}>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="PRESENT">Присутствовал</SelectItem>
                                                            <SelectItem value="ABSENT">Отсутствовал</SelectItem>
                                                            <SelectItem value="LATE">Опоздал</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="px-4 py-3 border-r border-[var(--color-border-1)]">
                                                    <Input
                                                        className={`h-9 min-w-[160px] ${row.status === "LATE" ? "border-yellow-500/40 bg-yellow-500/10" : ""}`}
                                                        placeholder={row.status === "LATE" ? "Причина опоздания" : "Причина (необязательно)"}
                                                        value={row.workSummary || ""}
                                                        disabled={row.status !== "LATE"}
                                                        onChange={(e) => {
                                                            const newRows = [...reportRows]
                                                            newRows[idx].workSummary = e.target.value
                                                            setReportRows(newRows)
                                                        }}
                                                        onBlur={() => handleSaveRow(reportRows[idx])}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 border-r border-[var(--color-border-1)]">
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        max={10}
                                                        className="h-9 w-20"
                                                        value={row.grade ?? ""}
                                                        onChange={(e) => {
                                                            const val = e.target.value ? Number(e.target.value) : null
                                                            const newRows = [...reportRows]
                                                            newRows[idx].grade = val
                                                            setReportRows(newRows)
                                                        }}
                                                        onBlur={() => handleSaveRow(reportRows[idx])}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 border-r border-[var(--color-border-1)]">
                                                    <Input
                                                        className="h-9 min-w-[180px]"
                                                        placeholder="Комментарий"
                                                        value={row.feedback || ""}
                                                        onChange={(e) => {
                                                            const newRows = [...reportRows]
                                                            newRows[idx].feedback = e.target.value
                                                            setReportRows(newRows)
                                                        }}
                                                        onBlur={() => handleSaveRow(reportRows[idx])}
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1 text-yellow-500">
                                                        {row.studentRating ? (
                                                            <>
                                                                {[...Array(row.studentRating)].map((_, i) => (
                                                                    <Star key={i} className="w-3 h-3 fill-current" />
                                                                ))}
                                                                {row.studentComment && (
                                                                    <span className="text-xs text-[var(--color-text-3)] ml-2 truncate max-w-[120px]" title={row.studentComment}>
                                                                        - {row.studentComment}
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-xs text-[var(--color-text-3)] opacity-50">Нет оценки</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <Card className="p-5 bg-[var(--color-surface-2)] border-[var(--color-border-1)] space-y-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-[#00a3ff]" />
                            Учебная программа
                        </h3>

                        <div className="space-y-3">
                            <div>
                                <div className="text-sm text-[var(--color-text-3)]">Программа</div>
                                <div className="font-medium">{group.programTitle || "Общая программа"}</div>
                            </div>
                            <div className="flex justify-between">
                                <div>
                                    <div className="text-sm text-[var(--color-text-3)]">Всего уроков</div>
                                    <div className="font-medium">{group.programLessons || "-"}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-[var(--color-text-3)]">Ученики</div>
                                    <div className="font-medium text-[#00a3ff]">{group.studentsCount}</div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-5 bg-[var(--color-surface-2)] border-[var(--color-border-1)] space-y-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Clock className="w-5 h-5 text-[#00a3ff]" />
                            Следующий урок
                        </h3>

                        <div className="space-y-3">
                            {group.nextLesson ? (
                                <div className="p-3 rounded-lg bg-[#00a3ff]/10 border border-[#00a3ff]/20">
                                    <div className="text-sm text-[#00a3ff] mb-1 font-medium">Ближайший урок</div>
                                    <div className="font-medium">{new Date(group.nextLesson.date).toLocaleDateString("ru-RU")}</div>
                                    <div className="text-sm opacity-80">{group.nextLesson.time} • {group.nextLesson.title}</div>
                                </div>
                            ) : (
                                <div className="text-sm text-[var(--color-text-3)]">Ближайших уроков нет.</div>
                            )}

                            <div className="p-3 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border-1)]">
                                <div className="text-sm text-[var(--color-text-3)] mb-1">Регулярное расписание</div>
                                <div className="font-medium flex items-center gap-2 text-sm">
                                    {group.schedule || "Не задано"}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}
