"use client"
import { useEffect, useMemo, useState } from "react"
import { QrCode, Users, Play, Clock, CheckCircle2, Download, StopCircle } from "lucide-react"
import QRCode from "react-qr-code"
import { apiFetch, getTokens } from "@/lib/api"
import { Button } from "@/components/ui/button"

interface Group {
    id: string
    name: string
    kruzhokTitle: string
    studentsCount: number
}

interface LessonRow {
    user: { id: string; fullName: string; email?: string }
    status: "PRESENT" | "LATE" | "ABSENT"
    grade?: number | null
    summary?: string | null
    comment?: string | null
    markedAt?: string
    isEnrolled?: boolean
}

interface LessonState {
    schedule: { id: string; title: string; date: string; status: string; startedAt?: string | null }
    rows: LessonRow[]
}

export default function QrGenerateTab() {
    const [groups, setGroups] = useState<Group[]>([])
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
    const [token, setToken] = useState<string>("")
    const [scheduleId, setScheduleId] = useState<string>("")
    const [startedAt, setStartedAt] = useState<string | null>(null)
    const [rows, setRows] = useState<LessonRow[]>([])
    const [loading, setLoading] = useState(true)
    const [isLive, setIsLive] = useState(false)
    const [timeOffsetMs, setTimeOffsetMs] = useState(0)
    const [elapsedMs, setElapsedMs] = useState(0)
    const [savingIds, setSavingIds] = useState<Record<string, boolean>>({})

    useEffect(() => {
        loadGroups()
    }, [])

    useEffect(() => {
        if (!scheduleId) return

        const poll = async () => {
            try {
                const state = await apiFetch<LessonState>(`/attendance-live/${scheduleId}/state`)
                const normalized = (state.rows || []).map((r: any) => ({
                    ...r,
                    status: (r.status || "ABSENT").toUpperCase(),
                    comment: r.comment ?? r.summary ?? ""
                }))
                setRows(normalized)
                if (state.schedule?.startedAt) setStartedAt(state.schedule.startedAt)
            } catch {
                // ignore transient errors
            }
        }

        poll()
        const interval = setInterval(poll, 4000)
        return () => clearInterval(interval)
    }, [scheduleId])

    useEffect(() => {
        if (!scheduleId) return
        const refresh = async () => {
            try {
                const res = await apiFetch<{ token: string; serverTime: number }>(`/attendance-live/${scheduleId}/qr`)
                if (res?.token) setToken(res.token)
                if (typeof res?.serverTime === "number") {
                    setTimeOffsetMs(res.serverTime - Date.now())
                }
            } catch {
                // ignore
            }
        }
        refresh()
        const interval = setInterval(refresh, 30000)
        return () => clearInterval(interval)
    }, [scheduleId])

    useEffect(() => {
        if (!startedAt) return
        const start = new Date(startedAt).getTime()
        const tick = () => {
            const nowServer = Date.now() + timeOffsetMs
            setElapsedMs(Math.max(0, nowServer - start))
        }
        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [startedAt, timeOffsetMs])

    const loadGroups = async () => {
        setLoading(true)
        try {
            const data = await apiFetch<Group[]>("/mentor/groups")
            setGroups(data || [])
        } catch (err) {
            console.error("Failed to load groups:", err)
            setGroups([])
        } finally {
            setLoading(false)
        }
    }

    const startLesson = async (group: Group) => {
        setSelectedGroup(group)
        try {
            const res = await apiFetch<any>("/attendance-live/start", {
                method: "POST",
                body: JSON.stringify({ classId: group.id })
            })
            setToken(res.token || "")
            setScheduleId(res.schedule?.id)
            setStartedAt(res.startedAt ? new Date(res.startedAt).toISOString() : null)
            const serverTime = res.serverTime || Date.now()
            setTimeOffsetMs(serverTime - Date.now())
            setIsLive(true)
        } catch (err) {
            console.error("Failed to start lesson:", err)
        }
    }

    const endLesson = async () => {
        if (!scheduleId) return
        try {
            await apiFetch(`/attendance-live/${scheduleId}/end`, { method: "POST" })
        } catch (err) {
            console.error("Failed to end lesson:", err)
        } finally {
            setToken("")
            setScheduleId("")
            setRows([])
            setIsLive(false)
            setSelectedGroup(null)
        }
    }

    const updateRow = async (studentId: string, updates: Partial<LessonRow>) => {
        if (!scheduleId) return
        setSavingIds((prev) => ({ ...prev, [studentId]: true }))
        try {
            const current = rows.find((r) => r.user.id === studentId)
            const next = {
                status: updates.status || current?.status,
                grade: updates.grade ?? current?.grade ?? null,
                summary: updates.summary ?? current?.summary ?? "",
                comment: updates.comment ?? current?.comment ?? ""
            }
            await apiFetch("/attendance-live/update-record", {
                method: "POST",
                body: JSON.stringify({
                    scheduleId,
                    studentId,
                    status: next.status,
                    grade: next.grade,
                    workSummary: next.summary,
                    comment: next.comment
                })
            })
            setRows((prev) =>
                prev.map((row) => (row.user.id === studentId ? { ...row, ...updates } : row))
            )
        } catch (err) {
            console.error("Failed to update attendance:", err)
        } finally {
            setSavingIds((prev) => ({ ...prev, [studentId]: false }))
        }
    }

    const handleExport = async () => {
        if (!scheduleId) return
        const tokens = getTokens()
        const apiUrl = typeof window !== "undefined" && (window as any).ENV_API_URL
            ? (window as any).ENV_API_URL
            : (process.env.NEXT_PUBLIC_API_URL || "")
        const url = apiUrl ? `${apiUrl}/attendance-live/${scheduleId}/export` : `/api/attendance-live/${scheduleId}/export`

        const res = await fetch(url, {
            headers: tokens?.accessToken ? { authorization: `Bearer ${tokens.accessToken}` } : undefined
        })
        if (!res.ok) return
        const blob = await res.blob()
        const downloadUrl = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = downloadUrl
        link.download = `lesson-${scheduleId}.xlsx`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(downloadUrl)
    }

    const elapsedLabel = useMemo(() => {
        const totalSeconds = Math.floor(elapsedMs / 1000)
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60
        return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    }, [elapsedMs])

    const statusStyle = (status: string) => {
        switch (status) {
            case "PRESENT":
                return "bg-green-500/20 text-green-500"
            case "LATE":
                return "bg-yellow-500/20 text-yellow-500"
            case "ABSENT":
                return "bg-red-500/20 text-red-500"
            default:
                return "bg-[var(--color-surface-2)] text-[var(--color-text-2)]"
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-[var(--color-text-3)]">Loading...</div>
            </div>
        )
    }

    if (isLive && selectedGroup && token) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-500 rounded-full mb-2">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Lesson in progress</span>
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--color-text-1)]">{selectedGroup.name}</h2>
                        <p className="text-[var(--color-text-3)]">{selectedGroup.kruzhokTitle}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-[var(--color-text-2)]">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">{elapsedLabel}</span>
                        </div>
                        <Button onClick={handleExport} variant="outline" className="gap-2">
                            <Download className="w-4 h-4" />
                            Export
                        </Button>
                        <Button onClick={endLesson} variant="outline" className="gap-2 border-red-500/40 text-red-500 hover:bg-red-500/10">
                            <StopCircle className="w-4 h-4" />
                            End lesson
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6">
                    <div className="card p-6">
                        <div className="text-center">
                            <QrCode className="w-10 h-10 mx-auto text-[#00a3ff] mb-2" />
                            <h3 className="text-lg font-semibold text-[var(--color-text-1)]">Attendance QR</h3>
                            <p className="text-[var(--color-text-3)] text-sm">Students scan to check in</p>
                        </div>
                    <div className="bg-white rounded-2xl p-4 mt-4">
                        <QRCode value={token} size={220} style={{ height: "auto", width: "100%" }} />
                    </div>
                    <div className="text-xs text-[var(--color-text-3)] mt-3 text-center">
                        QR refreshes every 30 seconds.
                    </div>
                        <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-text-3)]">
                            <span>Students</span>
                            <span className="text-[var(--color-text-1)] font-semibold">{selectedGroup.studentsCount}</span>
                        </div>
                    </div>

                    <div className="card p-4 overflow-x-auto">
                        <table className="w-full min-w-[980px] text-base">
                            <thead className="text-[var(--color-text-3)]">
                                <tr>
                                    <th className="text-left py-2 px-2">Student</th>
                                    <th className="text-left py-2 px-2">Status</th>
                                    <th className="text-left py-2 px-2">Grade</th>
                                    <th className="text-left py-2 px-2">Activity</th>
                                    <th className="text-left py-2 px-2">Comment to parent</th>
                                    <th className="text-left py-2 px-2">Save</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-6 text-center text-[var(--color-text-3)]">
                                            No attendance yet.
                                        </td>
                                    </tr>
                                )}
                                {rows.map((row) => (
                                    <tr key={row.user.id} className="border-t border-[var(--color-border-1)]">
                                        <td className="py-3 px-2">
                                            <div className="text-[var(--color-text-1)] font-medium">{row.user.fullName}</div>
                                            <div className="text-xs text-[var(--color-text-3)]">{row.user.email || ""}</div>
                                        </td>
                                        <td className="py-3 px-2">
                                            <div className="flex flex-wrap gap-2">
                                                {(["PRESENT", "LATE", "ABSENT"] as const).map((status) => (
                                                    <button
                                                        key={status}
                                                        onClick={() => updateRow(row.user.id, { status })}
                                                        className={`px-4 py-2 rounded-full text-sm font-semibold ${statusStyle(status)} ${row.status === status ? "ring-1 ring-white" : "opacity-70"}`}
                                                    >
                                                        {status}
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-3 px-2">
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4, 5].map((g) => (
                                                    <button
                                                        key={g}
                                                        onClick={() => updateRow(row.user.id, { grade: g })}
                                                        className={`w-10 h-10 rounded-lg text-sm font-semibold ${row.grade === g ? "bg-[#00a3ff] text-white" : "bg-[var(--color-surface-2)] text-[var(--color-text-1)]"}`}
                                                    >
                                                        {g}
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-3 px-2">
                                            <input
                                                value={row.summary || ""}
                                                onChange={(e) => setRows((prev) => prev.map((r) => r.user.id === row.user.id ? { ...r, summary: e.target.value } : r))}
                                                onBlur={() => updateRow(row.user.id, { summary: row.summary || "" })}
                                                placeholder="What did the student work on?"
                                                className="w-full h-12 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-3 py-2 text-[var(--color-text-1)] text-base"
                                            />
                                        </td>
                                        <td className="py-3 px-2">
                                            <input
                                                value={row.comment || ""}
                                                onChange={(e) => setRows((prev) => prev.map((r) => r.user.id === row.user.id ? { ...r, comment: e.target.value } : r))}
                                                onBlur={() => updateRow(row.user.id, { comment: row.comment || "" })}
                                                placeholder="Optional note to parent"
                                                className="w-full h-12 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-3 py-2 text-[var(--color-text-1)] text-base"
                                            />
                                        </td>
                                        <td className="py-3 px-2">
                                            <button
                                                onClick={() => updateRow(row.user.id, row)}
                                                className="text-sm px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white"
                                            >
                                                {savingIds[row.user.id] ? "Saving..." : "Save"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
                <QrCode className="w-16 h-16 mx-auto mb-4 text-[#00a3ff]" />
                <h2 className="text-2xl font-bold text-[var(--color-text-1)]">Start a lesson</h2>
                <p className="text-[var(--color-text-3)]">Choose a group to generate a live QR and open attendance table.</p>
            </div>

            {groups.length === 0 ? (
                <div className="card p-8 text-center">
                    <Users className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-3)] opacity-50" />
                    <p className="text-[var(--color-text-3)]">No groups available.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {groups.map((group) => (
                        <div
                            key={group.id}
                            className="card p-4 hover:border-[#00a3ff]/50 transition-all cursor-pointer"
                            onClick={() => startLesson(group)}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-[var(--color-text-1)]">{group.name}</h3>
                                    <p className="text-sm text-[var(--color-text-3)]">{group.kruzhokTitle}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <div className="text-sm text-[var(--color-text-3)]">Students</div>
                                        <div className="font-bold text-[var(--color-text-1)]">{group.studentsCount}</div>
                                    </div>
                                    <Button size="sm" className="bg-[#00a3ff] text-white hover:bg-[#0088cc]">
                                        <Play className="w-4 h-4 mr-2" />
                                        Start
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
