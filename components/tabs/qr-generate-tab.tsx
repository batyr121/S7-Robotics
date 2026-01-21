"use client"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
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
    const [autoStartedGroupId, setAutoStartedGroupId] = useState<string | null>(null)

    const searchParams = useSearchParams()
    const router = useRouter()
    const urlGroupId = searchParams?.get("groupId")

    useEffect(() => {
        loadGroups()
    }, [])

    // Auto-select group from URL if available and groups are loaded
    useEffect(() => {
        if (urlGroupId && groups.length > 0 && !selectedGroup && !isLive && autoStartedGroupId !== urlGroupId) {
            const target = groups.find(g => g.id === urlGroupId)
            if (target) {
                setAutoStartedGroupId(urlGroupId)
                startLesson(target)
            }
        }
    }, [urlGroupId, groups, isLive, selectedGroup, autoStartedGroupId])

    useEffect(() => {
        if (!urlGroupId) setAutoStartedGroupId(null)
    }, [urlGroupId])

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
            router.replace("/dashboard?tab=lesson")
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
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm mb-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Lesson in progress</span>
                        </div>
                        <h2 className="text-xl font-bold text-[var(--color-text-1)]">{selectedGroup.name}</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-[var(--color-text-2)] font-mono text-lg bg-[var(--color-surface-1)] px-3 py-1 rounded border border-[var(--color-border-1)]">
                            <Clock className="w-4 h-4" />
                            <span>{elapsedLabel}</span>
                        </div>
                        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
                            <Download className="w-4 h-4" />
                            Export
                        </Button>
                        <Button onClick={endLesson} variant="destructive" size="sm" className="gap-2">
                            <StopCircle className="w-4 h-4" />
                            End
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[250px,1fr] gap-4">
                    {/* QR Column */}
                    <div className="card p-4 h-fit">
                        <div className="text-center mb-2">
                            <h3 className="font-semibold text-[var(--color-text-1)]">Scan Attendance</h3>
                        </div>
                        <div className="bg-white rounded-lg p-3 mx-auto w-56 h-56 flex items-center justify-center">
                            <QRCode value={token} size={220} style={{ height: "auto", width: "100%" }} />
                        </div>
                        <div className="text-[10px] text-[var(--color-text-3)] mt-2 text-center">
                            Refreshes every 30s
                        </div>
                        <div className="mt-3 pt-3 border-t border-[var(--color-border-1)] flex items-center justify-between text-sm">
                            <span className="text-[var(--color-text-3)]">Students</span>
                            <span className="font-bold text-[var(--color-text-1)]">{selectedGroup.studentsCount}</span>
                        </div>
                    </div>

                    {/* Excel-style Table */}
                    <div className="card overflow-hidden flex flex-col h-[calc(100vh-250px)] min-h-[400px]">
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-sm border-collapse">
                                <thead className="bg-[var(--color-surface-1)] sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="text-left py-2 px-3 border-b border-r border-[var(--color-border-1)] font-medium text-[var(--color-text-2)] w-[250px]">Student</th>
                                        <th className="text-left py-2 px-3 border-b border-r border-[var(--color-border-1)] font-medium text-[var(--color-text-2)] w-[280px]">Status</th>
                                        <th className="text-left py-2 px-3 border-b border-r border-[var(--color-border-1)] font-medium text-[var(--color-text-2)] w-[180px]">Grade (1-5)</th>
                                        <th className="text-left py-2 px-3 border-b border-r border-[var(--color-border-1)] font-medium text-[var(--color-text-2)] min-w-[200px]">Work Summary</th>
                                        <th className="text-left py-2 px-3 border-b border-[var(--color-border-1)] font-medium text-[var(--color-text-2)] min-w-[200px]">Parent Comment</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-[var(--color-surface-2)]">
                                    {rows.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-[var(--color-text-3)]">
                                                Waiting for students to join...
                                            </td>
                                        </tr>
                                    )}
                                    {rows.map((row) => (
                                        <tr key={row.user.id} className="group hover:bg-[var(--color-surface-1)] transition-colors">
                                            <td className="py-1 px-3 border-b border-r border-[var(--color-border-1)]">
                                                <div className="font-medium text-[var(--color-text-1)]">{row.user.fullName}</div>
                                                <div className="text-[10px] text-[var(--color-text-3)]">{row.user.email}</div>
                                            </td>
                                            <td className="py-1 px-3 border-b border-r border-[var(--color-border-1)]">
                                                <div className="flex gap-1">
                                                    {(["PRESENT", "LATE", "ABSENT"] as const).map((status) => (
                                                        <button
                                                            key={status}
                                                            onClick={() => updateRow(row.user.id, { status })}
                                                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider transition-all
                                                                ${row.status === status
                                                                    ? status === 'PRESENT' ? 'bg-green-500 text-white'
                                                                        : status === 'LATE' ? 'bg-yellow-500 text-white'
                                                                            : 'bg-red-500 text-white'
                                                                    : 'bg-[var(--color-surface-1)] text-[var(--color-text-3)] hover:bg-[var(--color-border-1)]'
                                                                }`}
                                                        >
                                                            {status[0]}
                                                        </button>
                                                    ))}
                                                    <span className={`ml-2 text-xs font-medium self-center ${row.status === 'PRESENT' ? 'text-green-500' :
                                                        row.status === 'LATE' ? 'text-yellow-500' :
                                                            'text-red-500'
                                                        }`}>{row.status}</span>
                                                </div>
                                            </td>
                                            <td className="py-1 px-3 border-b border-r border-[var(--color-border-1)]">
                                                <div className="flex gap-0.5">
                                                    {[1, 2, 3, 4, 5].map((g) => (
                                                        <button
                                                            key={g}
                                                            onClick={() => updateRow(row.user.id, { grade: g })}
                                                            className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all
                                                                ${row.grade === g
                                                                    ? 'bg-[#00a3ff] text-white'
                                                                    : 'text-[var(--color-text-3)] hover:bg-[var(--color-border-1)]'
                                                                }`}
                                                        >
                                                            {g}
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-0 px-0 border-b border-r border-[var(--color-border-1)]">
                                                <input
                                                    value={row.summary || ""}
                                                    onChange={(e) => setRows((prev) => prev.map((r) => r.user.id === row.user.id ? { ...r, summary: e.target.value } : r))}
                                                    onBlur={() => updateRow(row.user.id, { summary: row.summary || "" })}
                                                    className="w-full h-full min-h-[3rem] px-3 bg-transparent border-none text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)]/50 focus:ring-0 text-sm"
                                                    placeholder="Topic..."
                                                />
                                            </td>
                                            <td className="py-0 px-0 border-b border-[var(--color-border-1)]">
                                                <input
                                                    value={row.comment || ""}
                                                    onChange={(e) => setRows((prev) => prev.map((r) => r.user.id === row.user.id ? { ...r, comment: e.target.value } : r))}
                                                    onBlur={() => updateRow(row.user.id, { comment: row.comment || "" })}
                                                    className="w-full h-full min-h-[3rem] px-3 bg-transparent border-none text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)]/50 focus:ring-0 text-sm"
                                                    placeholder="Generic comment..."
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
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
