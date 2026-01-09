"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import QRCode from "react-qr-code"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Clock, Download, StopCircle } from "lucide-react"
import { apiFetch, getTokens } from "@/lib/api"
import { toast } from "@/hooks/use-toast"

interface StudentRow {
    user: { id: string; fullName: string; email: string }
    status: string
    grade: number | null
    summary: string | null
    comment?: string | null
    recordId: string | null
    isEnrolled: boolean
    markedAt?: string
}

interface LiveState {
    schedule: {
        id: string
        title: string
        date: string
        status: string
        startedAt?: string | null
        completedAt?: string | null
    }
    rows: StudentRow[]
}

const STATUS_OPTIONS = ["PRESENT", "LATE", "ABSENT"] as const

export function LiveLessonView({
    scheduleId,
    initialToken,
    initialStartedAt,
    initialServerTime,
    onClose
}: {
    scheduleId: string
    initialToken: string
    initialStartedAt?: string | null
    initialServerTime?: number
    onClose: () => void
}) {
    const [state, setState] = useState<LiveState | null>(null)
    const [loading, setLoading] = useState(true)
    const [token, setToken] = useState(initialToken)
    const [startedAt, setStartedAt] = useState<string | null>(initialStartedAt || null)
    const [timeOffsetMs, setTimeOffsetMs] = useState(initialServerTime ? initialServerTime - Date.now() : 0)
    const [elapsedMs, setElapsedMs] = useState(0)
    const [savingIds, setSavingIds] = useState<Record<string, boolean>>({})
    const [ending, setEnding] = useState(false)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

    const fetchData = useCallback(async () => {
        try {
            const data = await apiFetch<LiveState>(`/attendance-live/${scheduleId}/state`)
            const normalizedRows = (data.rows || []).map((row) => ({
                ...row,
                status: (row.status || "ABSENT").toUpperCase(),
                summary: row.summary ?? "",
                comment: row.comment ?? ""
            }))
            setState({ ...data, rows: normalizedRows })
            if (data.schedule?.startedAt) setStartedAt(data.schedule.startedAt)
            setLastUpdated(new Date())
        } catch (e: any) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [scheduleId])

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 5000)
        return () => clearInterval(interval)
    }, [fetchData])

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
        const interval = setInterval(refresh, 45000)
        return () => clearInterval(interval)
    }, [scheduleId])

    useEffect(() => {
        if (!startedAt) return
        const startMs = new Date(startedAt).getTime()
        const tick = () => {
            const nowServer = Date.now() + timeOffsetMs
            setElapsedMs(Math.max(0, nowServer - startMs))
        }
        tick()
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [startedAt, timeOffsetMs])

    const elapsedLabel = useMemo(() => {
        const totalSeconds = Math.floor(elapsedMs / 1000)
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60
        return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    }, [elapsedMs])

    const updateLocalRow = (studentId: string, updates: Partial<StudentRow>) => {
        setState((prev) => {
            if (!prev) return prev
            return {
                ...prev,
                rows: prev.rows.map((row) => row.user.id === studentId ? { ...row, ...updates } : row)
            }
        })
    }

    const updateRow = async (studentId: string, updates: Partial<StudentRow>) => {
        setSavingIds((prev) => ({ ...prev, [studentId]: true }))
        try {
            const current = state?.rows.find((r) => r.user.id === studentId)
            const payload = {
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
                    status: payload.status,
                    grade: payload.grade,
                    workSummary: payload.summary,
                    comment: payload.comment
                })
            })
            updateLocalRow(studentId, updates)
        } catch (e: any) {
            toast({ title: "Update failed", description: e?.message || "Please try again.", variant: "destructive" as any })
            fetchData()
        } finally {
            setSavingIds((prev) => ({ ...prev, [studentId]: false }))
        }
    }

    const handleExport = async () => {
        try {
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
        } catch {
            toast({ title: "Export failed", description: "Please try again." })
        }
    }

    const endLesson = async () => {
        setEnding(true)
        try {
            await apiFetch(`/attendance-live/${scheduleId}/end`, { method: "POST" })
            onClose()
        } catch (e: any) {
            toast({ title: "Failed to end lesson", description: e?.message || "Please try again." })
        } finally {
            setEnding(false)
        }
    }

    const presentCount = state?.rows.filter((r) => r.status === "PRESENT").length || 0
    const lateCount = state?.rows.filter((r) => r.status === "LATE").length || 0

    const statusBadge = (status: string) => {
        switch (status) {
            case "PRESENT": return "bg-green-500/20 text-green-500"
            case "LATE": return "bg-yellow-500/20 text-yellow-500"
            case "ABSENT": return "bg-red-500/20 text-red-500"
            default: return "bg-[var(--color-surface-2)] text-[var(--color-text-2)]"
        }
    }

    if (loading && !state) return <div className="p-8 text-center">Loading lesson...</div>

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 bg-white">
                    <CardHeader>
                        <CardTitle className="text-center text-lg">Scan to join</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center p-6">
                        <div className="bg-white p-2 border-4 border-gray-900 rounded-lg">
                            <QRCode
                                value={token}
                                size={200}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                viewBox={`0 0 256 256`}
                            />
                        </div>
                        <p className="mt-4 text-sm text-gray-500 text-center">
                            Students scan this QR from their profile to check in.
                        </p>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>{state?.schedule.title || "Lesson"}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                {presentCount} present, {lateCount} late, {state?.rows.length || 0} total
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-2)]">
                                <Clock className="w-3 h-3 mr-1" /> {elapsedLabel}
                            </Badge>
                            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
                                <Download className="h-4 w-4" /> Export
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 border-red-500/40 text-red-500 hover:bg-red-500/10"
                                onClick={endLesson}
                                disabled={ending}
                            >
                                <StopCircle className="h-4 w-4" /> {ending ? "Ending..." : "End"}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {lastUpdated && (
                            <div className="text-xs text-muted-foreground mb-3">
                                Last update: {lastUpdated.toLocaleTimeString("en-US")}
                            </div>
                        )}
                        <div className="max-h-[60vh] overflow-y-auto pr-2">
                            <div className="card p-0 overflow-x-auto">
                                <table className="w-full min-w-[900px] text-sm">
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
                                        {state?.rows.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="py-6 text-center text-[var(--color-text-3)]">
                                                    No students yet.
                                                </td>
                                            </tr>
                                        )}
                                        {state?.rows.map((row) => (
                                            <tr key={row.user.id} className="border-t border-[var(--color-border-1)]">
                                                <td className="py-3 px-2">
                                                    <div className="font-medium text-[var(--color-text-1)]">{row.user.fullName}</div>
                                                    <div className="text-xs text-[var(--color-text-3)]">{row.user.email || ""}</div>
                                                </td>
                                                <td className="py-3 px-2">
                                                    <div className="flex flex-wrap gap-2">
                                                        {STATUS_OPTIONS.map((status) => (
                                                            <button
                                                                key={status}
                                                                onClick={() => updateRow(row.user.id, { status })}
                                                                className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge(status)} ${row.status === status ? "ring-1 ring-white" : "opacity-70"}`}
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
                                                                className={`w-9 h-9 rounded-lg text-xs font-semibold ${row.grade === g ? "bg-[#00a3ff] text-white" : "bg-[var(--color-surface-2)] text-[var(--color-text-1)]"}`}
                                                            >
                                                                {g}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-2">
                                                    <Input
                                                        value={row.summary || ""}
                                                        onChange={(e) => updateLocalRow(row.user.id, { summary: e.target.value })}
                                                        onBlur={() => updateRow(row.user.id, { summary: row.summary || "" })}
                                                        placeholder="What did the student work on?"
                                                        className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)]"
                                                    />
                                                </td>
                                                <td className="py-3 px-2">
                                                    <Input
                                                        value={row.comment || ""}
                                                        onChange={(e) => updateLocalRow(row.user.id, { comment: e.target.value })}
                                                        onBlur={() => updateRow(row.user.id, { comment: row.comment || "" })}
                                                        placeholder="Optional note to parent"
                                                        className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)]"
                                                    />
                                                </td>
                                                <td className="py-3 px-2">
                                                    <button
                                                        onClick={() => updateRow(row.user.id, row)}
                                                        className="text-xs px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white"
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
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
