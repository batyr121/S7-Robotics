"use client"
import { useState, useEffect } from "react"
import { QrCode, Users, Play, CheckCircle } from "lucide-react"
import QRCode from "react-qr-code"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth/auth-context"

interface Group {
    id: string
    name: string
    kruzhokTitle: string
    studentsCount: number
}

export default function QrGenerateTab() {
    const { user } = useAuth() as any
    const [groups, setGroups] = useState<Group[]>([])
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
    const [qrData, setQrData] = useState("")
    const [loading, setLoading] = useState(true)
    const [lessonStarted, setLessonStarted] = useState(false)

    useEffect(() => {
        loadGroups()
    }, [])

    const loadGroups = async () => {
        setLoading(true)
        try {
            const kruzhoks = await apiFetch<any[]>("/mentor/my-kruzhoks")
            const allGroups: Group[] = []
            for (const k of kruzhoks || []) {
                for (const cls of k.classes || []) {
                    allGroups.push({
                        id: cls.id,
                        name: cls.name,
                        kruzhokTitle: k.title,
                        studentsCount: cls._count?.enrollments || 0
                    })
                }
            }
            setGroups(allGroups)
        } catch (err) {
            console.error("Failed to load groups:", err)
            setGroups([])
        } finally {
            setLoading(false)
        }
    }

    const startLesson = (group: Group) => {
        setSelectedGroup(group)
        const data = JSON.stringify({
            type: 'attendance_session',
            mentorId: user?.id,
            groupId: group.id,
            groupName: group.name,
            timestamp: Date.now()
        })
        setQrData(data)
        setLessonStarted(true)
    }

    const endLesson = () => {
        setSelectedGroup(null)
        setQrData("")
        setLessonStarted(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-[var(--color-text-3)]">Загрузка групп...</div>
            </div>
        )
    }

    // QR Code Display
    if (lessonStarted && selectedGroup) {
        return (
            <div className="max-w-lg mx-auto space-y-6">
                <div className="text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-500 rounded-full mb-4">
                        <Play className="w-4 h-4" />
                        <span>Урок начат</span>
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--color-text-1)]">{selectedGroup.name}</h2>
                    <p className="text-[var(--color-text-3)]">{selectedGroup.kruzhokTitle}</p>
                </div>

                <div className="card p-8">
                    <div className="bg-white rounded-2xl p-6 mx-auto max-w-[280px]">
                        <QRCode
                            value={qrData}
                            size={240}
                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            viewBox="0 0 256 256"
                        />
                    </div>
                    <p className="text-center text-[var(--color-text-3)] mt-4 text-sm">
                        Покажите этот QR код ученикам для отметки присутствия
                    </p>
                </div>

                <div className="card p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-[var(--color-text-1)] font-medium">Ожидание учеников</div>
                            <div className="text-sm text-[var(--color-text-3)]">Ученики сканируют код для отметки</div>
                        </div>
                        <div className="flex items-center gap-2 text-[#00a3ff]">
                            <Users className="w-5 h-5" />
                            <span className="font-bold">{selectedGroup.studentsCount}</span>
                        </div>
                    </div>
                </div>

                <Button
                    onClick={endLesson}
                    variant="outline"
                    className="w-full border-red-500/50 text-red-500 hover:bg-red-500/10"
                >
                    Завершить урок
                </Button>
            </div>
        )
    }

    // Group Selection
    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
                <QrCode className="w-16 h-16 mx-auto mb-4 text-[#00a3ff]" />
                <h2 className="text-2xl font-bold text-[var(--color-text-1)]">Начать урок</h2>
                <p className="text-[var(--color-text-3)]">Выберите группу для генерации QR кода</p>
            </div>

            {groups.length === 0 ? (
                <div className="card p-8 text-center">
                    <Users className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-3)] opacity-50" />
                    <p className="text-[var(--color-text-3)]">У вас нет групп</p>
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
                                        <div className="text-sm text-[var(--color-text-3)]">Учеников</div>
                                        <div className="font-bold text-[var(--color-text-1)]">{group.studentsCount}</div>
                                    </div>
                                    <Button size="sm" className="bg-[#00a3ff] text-white hover:bg-[#0088cc]">
                                        <Play className="w-4 h-4 mr-2" />
                                        Начать
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
