import { useState, useEffect } from "react"
import { Users, ChevronDown, ChevronUp, UserPlus, Clock, BookOpen, QrCode, ArrowRightLeft, Mail } from "lucide-react"
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
import { Input } from "@/components/ui/input"

interface Student {
    id: string
    fullName: string
    email: string
    level: number
    experiencePoints: number
}

interface ScheduleItem {
    id: string
    dayOfWeek: number
    startTime: string
    endTime: string
    location?: string | null
}

interface Group {
    id: string
    name: string
    kruzhokTitle: string
    programTitle: string
    status: "active" | "paused"
    scheduleItems: ScheduleItem[]
    students: Student[]
}

interface GroupsTabProps {
    user?: any
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const formatSchedule = (items?: ScheduleItem[]) => {
    if (!items || items.length === 0) return "Schedule not set"
    const sorted = [...items].sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
        return a.startTime.localeCompare(b.startTime)
    })

    return sorted.map((item) => {
        const day = dayNames[item.dayOfWeek] || "Day"
        const time = item.endTime ? `${item.startTime}-${item.endTime}` : item.startTime
        const location = item.location ? ` ${item.location}` : ""
        return `${day} ${time}${location}`
    }).join(", ")
}

export default function GroupsTab({ user }: GroupsTabProps) {
    const [groups, setGroups] = useState<Group[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

    const [qrOpen, setQrOpen] = useState(false)
    const [qrData, setQrData] = useState("")
    const [selectedGroupForQr, setSelectedGroupForQr] = useState<Group | null>(null)
    const [qrScheduleId, setQrScheduleId] = useState("")
    const [qrLoading, setQrLoading] = useState(false)

    const [addStudentOpen, setAddStudentOpen] = useState(false)
    const [addStudentGroup, setAddStudentGroup] = useState<Group | null>(null)
    const [addStudentEmail, setAddStudentEmail] = useState("")
    const [addStudentLoading, setAddStudentLoading] = useState(false)
    const [addStudentError, setAddStudentError] = useState("")

    const [migrateOpen, setMigrateOpen] = useState(false)
    const [migrateStudent, setMigrateStudent] = useState<Student | null>(null)
    const [migrateFromGroup, setMigrateFromGroup] = useState<Group | null>(null)
    const [migrateToGroupId, setMigrateToGroupId] = useState("")
    const [migrateLoading, setMigrateLoading] = useState(false)

    useEffect(() => {
        loadGroups()
    }, [])

    const loadGroups = async () => {
        setLoading(true)
        try {
            const kruzhoks = await apiFetch<any[]>("/mentor/my-kruzhoks")

            const allGroups: Group[] = []
            for (const k of kruzhoks || []) {
                const programTitle = k.program?.title || "Program not set"
                const kruzhokActive = k.isActive !== false

                for (const cls of k.classes || []) {
                    const students = await apiFetch<Student[]>(`/mentor/class/${cls.id}/students`).catch(() => [])
                    allGroups.push({
                        id: cls.id,
                        name: cls.name,
                        kruzhokTitle: k.title,
                        programTitle,
                        status: kruzhokActive && cls.isActive !== false ? "active" : "paused",
                        scheduleItems: cls.scheduleItems || [],
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

    const handleOpenQr = async (e: React.MouseEvent, group: Group) => {
        e.stopPropagation()
        setQrLoading(true)
        try {
            const res = await apiFetch<any>("/attendance-live/start", {
                method: "POST",
                body: JSON.stringify({ classId: group.id, title: group.name })
            })
            setQrData(res.token || "")
            setQrScheduleId(res.schedule?.id || "")
            setSelectedGroupForQr(group)
            setQrOpen(true)
        } catch (err) {
            console.error("Failed to start lesson:", err)
        } finally {
            setQrLoading(false)
        }
    }

    useEffect(() => {
        if (!qrOpen || !qrScheduleId) return
        const refresh = async () => {
            try {
                const res = await apiFetch<{ token: string }>(`/attendance-live/${qrScheduleId}/qr`)
                if (res?.token) setQrData(res.token)
            } catch {
                // ignore
            }
        }
        refresh()
        const interval = setInterval(refresh, 45000)
        return () => clearInterval(interval)
    }, [qrOpen, qrScheduleId])

    const openAddStudent = (e: React.MouseEvent, group: Group) => {
        e.stopPropagation()
        setAddStudentGroup(group)
        setAddStudentEmail("")
        setAddStudentError("")
        setAddStudentOpen(true)
    }

    const handleAddStudent = async () => {
        if (!addStudentGroup || !addStudentEmail) return
        setAddStudentLoading(true)
        setAddStudentError("")
        try {
            await apiFetch(`/mentor/class/${addStudentGroup.id}/add-student`, {
                method: "POST",
                body: JSON.stringify({ email: addStudentEmail })
            })
            setAddStudentOpen(false)
            loadGroups()
        } catch (err: any) {
            setAddStudentError(err.message || "Failed to add student")
        } finally {
            setAddStudentLoading(false)
        }
    }

    const openMigrate = (e: React.MouseEvent, student: Student, group: Group) => {
        e.stopPropagation()
        setMigrateStudent(student)
        setMigrateFromGroup(group)
        setMigrateToGroupId("")
        setMigrateOpen(true)
    }

    const handleMigrate = async () => {
        if (!migrateFromGroup || !migrateStudent || !migrateToGroupId) return
        setMigrateLoading(true)
        try {
            await apiFetch(`/mentor/class/${migrateFromGroup.id}/migrate-student`, {
                method: "POST",
                body: JSON.stringify({ studentId: migrateStudent.id, targetClassId: migrateToGroupId })
            })
            setMigrateOpen(false)
            loadGroups()
        } catch (err) {
            console.error(err)
        } finally {
            setMigrateLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-[var(--color-text-3)]">Loading groups...</div>
            </div>
        )
    }

    const groupLabel = groups.length === 1 ? "group" : "groups"

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-[var(--color-text-1)]">My groups</h2>
                <Badge className="bg-[#00a3ff]/20 text-[#00a3ff]">
                    {groups.length} {groupLabel}
                </Badge>
            </div>

            {groups.length === 0 ? (
                <div className="card text-center py-12">
                    <Users className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-3)] opacity-50" />
                    <h3 className="text-lg font-medium text-[var(--color-text-1)] mb-2">No groups yet</h3>
                    <p className="text-[var(--color-text-3)]">
                        Groups will appear here once you are assigned to a class.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {groups.map((group) => {
                        const scheduleSummary = formatSchedule(group.scheduleItems)
                        const statusLabel = group.status === "active" ? "Active" : "Paused"
                        const statusClass = group.status === "active"
                            ? "bg-green-500/20 text-green-500"
                            : "bg-yellow-500/20 text-yellow-500"

                        return (
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
                                            <div className="text-xs text-[var(--color-text-3)] flex items-center gap-1 mt-1">
                                                <BookOpen className="w-3 h-3" />
                                                <span>{group.programTitle}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="hidden md:flex gap-2 border-[#00a3ff] text-[#00a3ff] hover:bg-[#00a3ff]/10"
                                            onClick={(e) => handleOpenQr(e, group)}
                                            disabled={qrLoading}
                                        >
                                            <QrCode className="w-4 h-4" />
                                            {qrLoading ? "Starting..." : "Start lesson"}
                                        </Button>

                                        <div className="text-right">
                                            <div className="text-sm font-medium text-[var(--color-text-1)]">
                                                {group.students.length} students
                                            </div>
                                            <div
                                                className="text-xs text-[var(--color-text-3)] flex items-center gap-1 justify-end max-w-[220px] truncate"
                                                title={scheduleSummary}
                                            >
                                                <Clock className="w-3 h-3" />
                                                {scheduleSummary}
                                            </div>
                                            <Badge className={`mt-2 ${statusClass}`}>{statusLabel}</Badge>
                                        </div>
                                        {expandedGroup === group.id ? (
                                            <ChevronUp className="w-5 h-5 text-[var(--color-text-3)]" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-[var(--color-text-3)]" />
                                        )}
                                    </div>
                                </div>

                                {expandedGroup === group.id && (
                                    <div className="border-t border-[var(--color-border-1)] p-4 bg-[var(--color-surface-2)]">
                                        <div className="mb-4 md:hidden">
                                            <Button
                                                size="sm"
                                                className="w-full gap-2 bg-[#00a3ff] text-white"
                                                onClick={(e) => handleOpenQr(e, group)}
                                                disabled={qrLoading}
                                            >
                                                <QrCode className="w-4 h-4" />
                                                {qrLoading ? "Starting..." : "Start lesson"}
                                            </Button>
                                        </div>

                                        <div className="grid gap-2 text-sm text-[var(--color-text-2)] mb-4">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-[var(--color-text-3)]" />
                                                <span>{scheduleSummary}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <BookOpen className="w-4 h-4 text-[var(--color-text-3)]" />
                                                <span>Program: {group.programTitle}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge className={statusClass}>{statusLabel}</Badge>
                                                <span>Current status</span>
                                            </div>
                                        </div>

                                        <div className="mb-4">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-2 border-green-500 text-green-500 hover:bg-green-500/10"
                                                onClick={(e) => openAddStudent(e, group)}
                                            >
                                                <UserPlus className="w-4 h-4" />
                                                Add student
                                            </Button>
                                        </div>

                                        {group.students.length === 0 ? (
                                            <div className="text-center py-6 text-[var(--color-text-3)]">
                                                <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                <p>No students in this group</p>
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
                                                                <span>Level {student.level}</span>
                                                                <span>-</span>
                                                                <span>{student.experiencePoints} XP</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={(e) => openMigrate(e, student, group)}
                                                            className="p-2 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors"
                                                            title="Move student to another group"
                                                        >
                                                            <ArrowRightLeft className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            <div className="card">
                <h3 className="text-lg font-medium text-[var(--color-text-1)] mb-4">Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-[var(--color-surface-2)] rounded-lg">
                        <div className="text-2xl font-bold text-[var(--color-text-1)]">{groups.length}</div>
                        <div className="text-sm text-[var(--color-text-3)]">Groups</div>
                    </div>
                    <div className="text-center p-4 bg-[var(--color-surface-2)] rounded-lg">
                        <div className="text-2xl font-bold text-[var(--color-text-1)]">
                            {groups.reduce((sum, g) => sum + g.students.length, 0)}
                        </div>
                        <div className="text-sm text-[var(--color-text-3)]">Students</div>
                    </div>
                    <div className="text-center p-4 bg-[var(--color-surface-2)] rounded-lg">
                        <div className="text-2xl font-bold text-[var(--color-text-1)]">
                            {new Set(groups.map(g => g.programTitle)).size}
                        </div>
                        <div className="text-sm text-[var(--color-text-3)]">Programs</div>
                    </div>
                    <div className="text-center p-4 bg-[var(--color-surface-2)] rounded-lg">
                        <div className="text-2xl font-bold text-[var(--color-text-1)]">
                            {groups.length > 0
                                ? Math.round(groups.reduce((sum, g) => sum + g.students.length, 0) / groups.length)
                                : 0}
                        </div>
                        <div className="text-sm text-[var(--color-text-3)]">Avg. students</div>
                    </div>
                </div>
            </div>

            <Dialog open={qrOpen} onOpenChange={setQrOpen}>
                <DialogContent className="sm:max-w-md bg-[var(--color-bg)] border-[var(--color-border-1)] text-[var(--color-text-1)]">
                    <DialogHeader>
                    <DialogTitle>Attendance QR</DialogTitle>
                    <DialogDescription className="text-[var(--color-text-3)]">
                            Students scan this code to mark attendance for {selectedGroupForQr?.name}.
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
                        QR refreshes automatically every minute during the lesson.
                </div>
            </DialogContent>
        </Dialog>

            <Dialog open={addStudentOpen} onOpenChange={setAddStudentOpen}>
                <DialogContent className="sm:max-w-md bg-[var(--color-bg)] border-[var(--color-border-1)] text-[var(--color-text-1)]">
                    <DialogHeader>
                        <DialogTitle>Add student</DialogTitle>
                        <DialogDescription className="text-[var(--color-text-3)]">
                            Enter student email to add to "{addStudentGroup?.name}".
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="flex items-center gap-2">
                            <Mail className="w-5 h-5 text-[var(--color-text-3)]" />
                            <Input
                                type="email"
                                placeholder="email@example.com"
                                value={addStudentEmail}
                                onChange={(e) => setAddStudentEmail(e.target.value)}
                                className="flex-1 bg-[var(--color-surface-2)] border-[var(--color-border-1)]"
                            />
                        </div>
                        {addStudentError && (
                            <div className="text-red-500 text-sm">{addStudentError}</div>
                        )}
                        <Button
                            onClick={handleAddStudent}
                            disabled={addStudentLoading || !addStudentEmail}
                            className="w-full bg-[#00a3ff] text-white hover:bg-[#0088cc]"
                        >
                            {addStudentLoading ? "Adding..." : "Add student"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={migrateOpen} onOpenChange={setMigrateOpen}>
                <DialogContent className="sm:max-w-md bg-[var(--color-bg)] border-[var(--color-border-1)] text-[var(--color-text-1)]">
                    <DialogHeader>
                        <DialogTitle>Move student</DialogTitle>
                        <DialogDescription className="text-[var(--color-text-3)]">
                            Move {migrateStudent?.fullName} from "{migrateFromGroup?.name}" to another group.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <select
                            value={migrateToGroupId}
                            onChange={(e) => setMigrateToGroupId(e.target.value)}
                            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-3 py-2 text-[var(--color-text-1)]"
                        >
                            <option value="">Select a group...</option>
                            {groups.filter(g => g.id !== migrateFromGroup?.id).map(g => (
                                <option key={g.id} value={g.id}>{g.name} - {g.kruzhokTitle}</option>
                            ))}
                        </select>
                        <Button
                            onClick={handleMigrate}
                            disabled={migrateLoading || !migrateToGroupId}
                            className="w-full bg-[#00a3ff] text-white hover:bg-[#0088cc]"
                        >
                            {migrateLoading ? "Moving..." : "Move student"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
