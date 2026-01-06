import { useState, useEffect } from "react"
import { Users, ChevronDown, ChevronUp, UserPlus, Clock, BookOpen, QrCode } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import QRCode from "react-qr-code"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface Student {
    id: string
    fullName: string
    email: string
    level: number
    experiencePoints: number
}

interface Group {
    id: string
    name: string
    kruzhokTitle: string
    schedule?: string
    students: Student[]
}

interface GroupsTabProps {
    user?: any
}

export default function GroupsTab({ user }: GroupsTabProps) {
    const [groups, setGroups] = useState<Group[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

    // QR State
    const [qrOpen, setQrOpen] = useState(false)
    const [qrData, setQrData] = useState("")
    const [selectedGroupForQr, setSelectedGroupForQr] = useState<Group | null>(null)

    useEffect(() => {
        loadGroups()
    }, [])

    const loadGroups = async () => {
        setLoading(true)
        try {
            // Fetch mentor's kruzhoks with their classes (groups)
            const kruzhoks = await apiFetch<any[]>("/mentor/my-kruzhoks")

            // Transform kruzhoks to groups format
            const allGroups: Group[] = []
            for (const k of kruzhoks || []) {
                for (const cls of k.classes || []) {
                    // Fetch students for this class
                    const students = await apiFetch<Student[]>(`/mentor/class/${cls.id}/students`).catch(() => [])
                    allGroups.push({
                        id: cls.id,
                        name: cls.name,
                        kruzhokTitle: k.title,
                        schedule: cls.schedule,
                        students: students || []
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

    const toggleGroup = (groupId: string) => {
        setExpandedGroup(expandedGroup === groupId ? null : groupId)
    }

    const handleOpenQr = (e: React.MouseEvent, group: Group) => {
        e.stopPropagation() // prevent accordion toggle
        const data = JSON.stringify({
            type: 'attendance_session',
            mentorId: user?.id,
            groupId: group.id,
            timestamp: Date.now()
        })
        setQrData(data)
        setSelectedGroupForQr(group)
        setQrOpen(true)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-[var(--color-text-3)]">Загрузка групп...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[var(--color-text-1)]">Мои группы</h2>
                <Badge className="bg-[#00a3ff]/20 text-[#00a3ff]">
                    {groups.length} {groups.length === 1 ? 'группа' : 'групп'}
                </Badge>
            </div>

            {groups.length === 0 ? (
                <div className="card text-center py-12">
                    <Users className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-3)] opacity-50" />
                    <h3 className="text-lg font-medium text-[var(--color-text-1)] mb-2">Нет групп</h3>
                    <p className="text-[var(--color-text-3)]">
                        Для начала работы обратитесь к администратору для назначения групп
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {groups.map((group) => (
                        <div
                            key={group.id}
                            className="card overflow-hidden"
                        >
                            <div
                                onClick={() => toggleGroup(group.id)}
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00a3ff] to-[#0066cc] flex items-center justify-center">
                                        <Users className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-[var(--color-text-1)]">{group.name}</h3>
                                        <p className="text-sm text-[var(--color-text-3)]">{group.kruzhokTitle}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="hidden md:flex gap-2 border-[#00a3ff] text-[#00a3ff] hover:bg-[#00a3ff]/10"
                                        onClick={(e) => handleOpenQr(e, group)}
                                    >
                                        <QrCode className="w-4 h-4" />
                                        QR Урока
                                    </Button>

                                    <div className="text-right">
                                        <div className="text-sm font-medium text-[var(--color-text-1)]">
                                            {group.students.length} учеников
                                        </div>
                                        {group.schedule && (
                                            <div className="text-xs text-[var(--color-text-3)] flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {group.schedule}
                                            </div>
                                        )}
                                    </div>
                                    {expandedGroup === group.id ? (
                                        <ChevronUp className="w-5 h-5 text-[var(--color-text-3)]" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-[var(--color-text-3)]" />
                                    )}
                                </div>
                            </div>

                            {/* Mobile button if needed, but flex above handles layout */}

                            {expandedGroup === group.id && (
                                <div className="border-t border-[var(--color-border-1)] p-4 bg-[var(--color-surface-2)]">
                                    <div className="mb-4 md:hidden">
                                        <Button
                                            size="sm"
                                            className="w-full gap-2 bg-[#00a3ff] text-white"
                                            onClick={(e) => handleOpenQr(e, group)}
                                        >
                                            <QrCode className="w-4 h-4" />
                                            Показать QR для отметки
                                        </Button>
                                    </div>

                                    {group.students.length === 0 ? (
                                        <div className="text-center py-6 text-[var(--color-text-3)]">
                                            <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <p>Нет учеников в группе</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {group.students.map((student) => (
                                                <div
                                                    key={student.id}
                                                    className="flex items-center gap-3 p-3 bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border-1)]"
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-bold">
                                                        {student.fullName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-[var(--color-text-1)] truncate">
                                                            {student.fullName}
                                                        </div>
                                                        <div className="text-xs text-[var(--color-text-3)] flex items-center gap-2">
                                                            <span>Уровень {student.level}</span>
                                                            <span>•</span>
                                                            <span>{student.experiencePoints} XP</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Summary Card */}
            <div className="card">
                <h3 className="text-lg font-medium text-[var(--color-text-1)] mb-4">Статистика по группам</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-[var(--color-surface-2)] rounded-lg">
                        <div className="text-2xl font-bold text-[var(--color-text-1)]">{groups.length}</div>
                        <div className="text-sm text-[var(--color-text-3)]">Групп</div>
                    </div>
                    <div className="text-center p-4 bg-[var(--color-surface-2)] rounded-lg">
                        <div className="text-2xl font-bold text-[var(--color-text-1)]">
                            {groups.reduce((sum, g) => sum + g.students.length, 0)}
                        </div>
                        <div className="text-sm text-[var(--color-text-3)]">Учеников</div>
                    </div>
                    <div className="text-center p-4 bg-[var(--color-surface-2)] rounded-lg">
                        <div className="text-2xl font-bold text-[var(--color-text-1)]">
                            {new Set(groups.map(g => g.kruzhokTitle)).size}
                        </div>
                        <div className="text-sm text-[var(--color-text-3)]">Кружков</div>
                    </div>
                    <div className="text-center p-4 bg-[var(--color-surface-2)] rounded-lg">
                        <div className="text-2xl font-bold text-[var(--color-text-1)]">
                            {groups.length > 0
                                ? Math.round(groups.reduce((sum, g) => sum + g.students.length, 0) / groups.length)
                                : 0}
                        </div>
                        <div className="text-sm text-[var(--color-text-3)]">Сред. размер</div>
                    </div>
                </div>
            </div>

            <Dialog open={qrOpen} onOpenChange={setQrOpen}>
                <DialogContent className="sm:max-w-md bg-[var(--color-bg)] border-[var(--color-border-1)] text-[var(--color-text-1)]">
                    <DialogHeader>
                        <DialogTitle>QR код для отметки</DialogTitle>
                        <DialogDescription className="text-[var(--color-text-3)]">
                            Покажите этот код ученикам группы {selectedGroupForQr?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl mx-auto my-4">
                        <QRCode
                            value={qrData}
                            size={200}
                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            viewBox={`0 0 256 256`}
                        />
                    </div>
                    <div className="text-center text-sm text-[var(--color-text-3)]">
                        Код действителен для текущего занятия
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
