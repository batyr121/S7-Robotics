"use client"

import { useState, useEffect, useCallback } from "react"
import QRCode from "react-qr-code"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, X, RefreshCw, UserCheck } from "lucide-react"
import { toast } from "sonner"

interface StudentRow {
    user: { id: string, fullName: string, email: string }
    status: string
    grade: number | null
    summary: string | null
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
    }
    rows: StudentRow[]
}

export function LiveLessonView({ scheduleId, initialToken, onClose }: { scheduleId: string, initialToken: string, onClose: () => void }) {
    const [state, setState] = useState<LiveState | null>(null)
    const [loading, setLoading] = useState(true)
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`/api/attendance-live/${scheduleId}/state`)
            if (!res.ok) throw new Error("Failed to fetch")
            const data = await res.json()
            setState(data)
            setLastUpdated(new Date())
        } catch (e) {
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

    const updateRecord = async (studentId: string, updates: any) => {
        try {
            // Optimistic update (simple)
            setState(prev => {
                if (!prev) return null
                return {
                    ...prev,
                    rows: prev.rows.map(row =>
                        row.user.id === studentId ? { ...row, ...updates } : row
                    )
                }
            })

            const res = await fetch("/api/attendance-live/update-record", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scheduleId,
                    studentId,
                    ...updates
                })
            })

            if (!res.ok) {
                toast.error("Не удалось сохранить изменения")
                fetchData() // Revert
            }
        } catch (e) {
            toast.error("Ошибка сети")
        }
    }

    if (loading && !state) return <div className="p-8 text-center">Загрузка урока...</div>

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* QR Code Section */}
                <Card className="md:col-span-1 bg-white">
                    <CardHeader>
                        <CardTitle className="text-center text-lg">Сканировать для входа</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center p-6">
                        <div className="bg-white p-2 text-primary-to-remove border-4 border-gray-900 rounded-lg">
                            <QRCode
                                value={initialToken}
                                size={200}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                viewBox={`0 0 256 256`}
                            />
                        </div>
                        <p className="mt-4 text-sm text-gray-500 text-center">
                            Ученики должны открыть сканер в своем профиле
                        </p>
                    </CardContent>
                </Card>

                {/* Live Stats Stats */}
                <Card className="md:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>{state?.schedule.title}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                {state?.rows.filter(r => r.status === 'PRESENT').length} из {state?.rows.length} присутствуют
                            </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchData}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Обновить
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-[60vh] overflow-y-auto pr-2">
                            <div className="space-y-4">
                                {state?.rows.map((row) => (
                                    <div key={row.user.id} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg border ${row.status === 'PRESENT' ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                                        <div className="flex items-center gap-3 mb-2 sm:mb-0 w-full sm:w-auto">
                                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${row.status === 'PRESENT' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                                                {row.status === 'PRESENT' ? <UserCheck size={20} /> : <X size={20} />}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{row.user.fullName}</p>
                                                <p className="text-xs text-muted-foreground">{row.isEnrolled ? "В группе" : "Гость"}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                            {/* Status Toggle */}
                                            <Button
                                                size="sm"
                                                variant={row.status === 'PRESENT' ? "default" : "outline"}
                                                className={row.status === 'PRESENT' ? "bg-green-600 hover:bg-green-700" : ""}
                                                onClick={() => updateRecord(row.user.id, { status: row.status === 'PRESENT' ? 'ABSENT' : 'PRESENT' })}
                                            >
                                                {row.status === 'PRESENT' ? "Пришел" : "Нет"}
                                            </Button>

                                            {/* Grade Input */}
                                            <div className="w-20">
                                                <Input
                                                    type="number"
                                                    placeholder="Оценка"
                                                    className="h-9 text-center"
                                                    value={row.grade || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value ? parseInt(e.target.value) : null
                                                        updateRecord(row.user.id, { grade: val })
                                                    }}
                                                />
                                            </div>

                                            {/* Summary Input */}
                                            <div className="flex-1 min-w-[200px]">
                                                <Input
                                                    placeholder="Комментарий / Что делал"
                                                    className="h-9"
                                                    value={row.summary || ""}
                                                    onChange={(e) => {
                                                        // Debouncing would be better here in real prod, but simple update works for now
                                                        // or onBlur
                                                    }}
                                                    onBlur={(e) => updateRecord(row.user.id, { workSummary: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {state?.rows.length === 0 && (
                                    <div className="text-center py-10 text-muted-foreground">
                                        Нет учеников в списке
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-end pt-4">
                <Button variant="ghost" className="text-red-500" onClick={onClose}>Завершить просмотр</Button>
            </div>
        </div>
    )
}
