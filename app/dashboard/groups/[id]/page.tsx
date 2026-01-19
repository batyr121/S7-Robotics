"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
    Users,
    Calendar,
    ArrowLeft,
    Clock,
    Download,
    CheckCircle,
    AlertCircle,
    BookOpen,
    Star,
    Save
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
                console.error("Failed to load group data", err)
                setError(err.message || "Failed to load group data")
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
                setReportRows(res.rows || [])
            } catch (err) {
                console.error("Failed to load report", err)
            } finally {
                setReportLoading(false)
            }
        }
        loadReport()
    }, [id, selectedScheduleId])

    const handleSaveRow = async (rowIndex: number) => {
        const row = reportRows[rowIndex]
        // Can't update if no record? We can upsert if we have scheduleId and studentId.

        const targetSchedule = history.find(h => h.id === selectedScheduleId)
        if (!targetSchedule) return

        try {
            await apiFetch(`/mentor/class/${id}/attendance`, {
                method: "POST",
                body: JSON.stringify({
                    scheduleId: targetSchedule.id,
                    studentId: row.student.id,
                    date: targetSchedule.scheduledDate.split('T')[0], // Fallback
                    status: row.status.toLowerCase(),
                    grade: row.grade,
                    comment: row.feedback
                })
            })
            // Show success toast or visual indicator?
        } catch (err) {
            console.error("Failed to save", err)
            alert("Failed to save changes")
        }
    }

    const handleDownloadReport = async () => {
        try {
            // Direct navigation to trigger download
            const token = localStorage.getItem("token")
            // We can't use apiFetch for file download easily if we want browser to handle it naturally,
            // but we need auth header.
            // Alternative: Fetch blob and create object URL.

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/mentor/groups/${id}/export`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (!res.ok) throw new Error("Download failed")

            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `gradebook-${group?.name}.csv`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

        } catch (err) {
            console.error("Download failed", err)
            alert("Failed to download report")
        }
    }

    if (loading) return <div className="p-8 text-center text-[var(--color-text-3)]">Loading...</div>
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>
    if (!group) return <div className="p-8 text-center">Group not found</div>

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
                                {group.isActive ? "Active" : "Paused"}
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button variant="outline" className="gap-2" onClick={handleDownloadReport}>
                        <Download className="w-4 h-4" />
                        Download Report
                    </Button>
                    <Button
                        onClick={() => router.push(`/dashboard?tab=lesson&groupId=${group.id}`)}
                        className="bg-[#00a3ff] text-white hover:bg-[#0088cc]"
                    >
                        Start Lesson
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
                                <div className="text-sm text-[var(--color-text-3)]">History</div>
                                <div className="font-semibold">Gradebook</div>
                            </div>
                        </div>

                        <div className="w-[200px]">
                            <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Date" />
                                </SelectTrigger>
                                <SelectContent>
                                    {history.length === 0 && <SelectItem value="none" disabled>No history</SelectItem>}
                                    {history.map(h => (
                                        <SelectItem key={h.id} value={h.id}>
                                            {new Date(h.scheduledDate).toLocaleDateString()}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Card className="bg-[var(--color-surface-2)] border-[var(--color-border-1)] overflow-hidden">
                        {reportLoading ? (
                            <div className="p-12 text-center text-[var(--color-text-3)]">Loading report...</div>
                        ) : history.length === 0 ? (
                            <div className="p-12 text-center text-[var(--color-text-3)]">No past lessons found. Start a lesson to see data here.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-[var(--color-text-3)] uppercase bg-[var(--color-surface-1)] border-b border-[var(--color-border-1)]">
                                        <tr>
                                            <th className="px-6 py-3 font-medium">Student Name</th>
                                            <th className="px-6 py-3 font-medium">Date</th>
                                            <th className="px-6 py-3 font-medium">Attendance</th>
                                            <th className="px-6 py-3 font-medium w-24">Grade</th>
                                            <th className="px-6 py-3 font-medium">Feedback</th>
                                            <th className="px-6 py-3 font-medium">Student Rating</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportRows.map((row, idx) => (
                                            <tr key={idx} className="border-b border-[var(--color-border-1)] hover:bg-[var(--color-surface-3)] transition-colors">
                                                <td className="px-6 py-4 font-medium flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00a3ff] to-[#0055ff] flex items-center justify-center text-white text-xs">
                                                        {row.student.fullName.charAt(0)}
                                                    </div>
                                                    {row.student.fullName}
                                                </td>
                                                <td className="px-6 py-4 text-[var(--color-text-3)]">
                                                    {history.find(h => h.id === selectedScheduleId) ? new Date(history.find(h => h.id === selectedScheduleId)!.scheduledDate).toLocaleDateString() : "-"}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Select
                                                        value={row.status}
                                                        onValueChange={(val) => {
                                                            const newRows = [...reportRows]
                                                            newRows[idx].status = val
                                                            setReportRows(newRows)
                                                            handleSaveRow(idx)
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-8 w-[120px]">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="PRESENT">Present</SelectItem>
                                                            <SelectItem value="ABSENT">Absent</SelectItem>
                                                            <SelectItem value="LATE">Late</SelectItem>
                                                            <SelectItem value="EXCUSED">Excused</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        max={10}
                                                        className="h-8 w-16"
                                                        value={row.grade || ""}
                                                        onChange={(e) => {
                                                            const val = e.target.value ? Number(e.target.value) : null
                                                            const newRows = [...reportRows]
                                                            newRows[idx].grade = val
                                                            setReportRows(newRows)
                                                        }}
                                                        onBlur={() => handleSaveRow(idx)}
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Input
                                                        className="h-8 min-w-[150px]"
                                                        placeholder="Feedback"
                                                        value={row.feedback || ""}
                                                        onChange={(e) => {
                                                            const newRows = [...reportRows]
                                                            newRows[idx].feedback = e.target.value
                                                            setReportRows(newRows)
                                                        }}
                                                        onBlur={() => handleSaveRow(idx)}
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1 text-yellow-500">
                                                        {row.studentRating ? (
                                                            <>
                                                                {[...Array(row.studentRating)].map((_, i) => (
                                                                    <Star key={i} className="w-3 h-3 fill-current" />
                                                                ))}
                                                                {row.studentComment && (
                                                                    <span className="text-xs text-[var(--color-text-3)] ml-2 truncate max-w-[100px]" title={row.studentComment}>
                                                                        - {row.studentComment}
                                                                    </span>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-xs text-[var(--color-text-3)] opacity-50">No rating</span>
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
                            Program Info
                        </h3>

                        <div className="space-y-3">
                            <div>
                                <div className="text-sm text-[var(--color-text-3)]">Course</div>
                                <div className="font-medium">{group.programTitle || "General Program"}</div>
                            </div>
                            <div className="flex justify-between">
                                <div>
                                    <div className="text-sm text-[var(--color-text-3)]">Total Lessons</div>
                                    <div className="font-medium">{group.programLessons || "-"}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-[var(--color-text-3)]">Students</div>
                                    <div className="font-medium text-[#00a3ff]">{group.studentsCount}</div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-5 bg-[var(--color-surface-2)] border-[var(--color-border-1)] space-y-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Clock className="w-5 h-5 text-[#00a3ff]" />
                            Next Lesson
                        </h3>

                        <div className="space-y-3">
                            {group.nextLesson ? (
                                <div className="p-3 rounded-lg bg-[#00a3ff]/10 border border-[#00a3ff]/20">
                                    <div className="text-sm text-[#00a3ff] mb-1 font-medium">Upcoming</div>
                                    <div className="font-medium">{new Date(group.nextLesson.date).toLocaleDateString()}</div>
                                    <div className="text-sm opacity-80">{group.nextLesson.time} • {group.nextLesson.title}</div>
                                </div>
                            ) : (
                                <div className="text-sm text-[var(--color-text-3)]">No upcoming lessons scheduled.</div>
                            )}

                            <div className="p-3 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border-1)]">
                                <div className="text-sm text-[var(--color-text-3)] mb-1">Regular Schedule</div>
                                <div className="font-medium flex items-center gap-2 text-sm">
                                    {group.schedule || "Not set"}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}
