"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
    Users,
    Calendar,
    ArrowLeft,
    Clock,
    MoreVertical,
    CheckCircle,
    AlertCircle,
    BookOpen
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

interface Student {
    id: string
    fullName: string
    email: string
    level: string
    experiencePoints: number
    paymentStatus: "PAID" | "DEBTOR"
}

interface ScheduleItem {
    id: string
    studentId: string
    date: string
    status: string
    grade?: number
    activity?: string
    comment?: string
}

export default function GroupDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const id = params?.id as string

    const [group, setGroup] = useState<GroupDetails | null>(null)
    const [students, setStudents] = useState<Student[]>([])
    const [schedule, setSchedule] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!id) return;

        const loadData = async () => {
            setLoading(true)
            try {
                // Fetch group details
                const groupData = await apiFetch<GroupDetails>(`/mentor/groups/${id}`)
                setGroup(groupData)

                // Fetch students
                const studentsData = await apiFetch<Student[]>(`/mentor/class/${id}/students`)
                setStudents(studentsData)

                // Fetch schedule (recent)
                const now = new Date()
                const scheduleData = await apiFetch<any[]>(`/mentor/class/${id}/attendance?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
                // Group by date for display
                setSchedule(scheduleData) // This might need better typings/processing
            } catch (err) {
                console.error("Failed to load group details", err)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [id])

    if (loading) {
        return <div className="p-8 text-center text-[var(--color-text-3)]">Loading details...</div>
    }

    if (!group) {
        return (
            <div className="p-8 text-center">
                <h3 className="text-xl font-semibold mb-2">Group not found</h3>
                <Button onClick={() => router.back()}>Go Back</Button>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-slide-up pb-20">
            {/* Header */}
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
                <div className="ml-auto">
                    <Button
                        onClick={() => router.push(`/dashboard?tab=lesson&groupId=${group.id}`)}
                        className="bg-[#00a3ff] text-white hover:bg-[#0088cc]"
                    >
                        Start Lesson
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Info */}
                <Card className="lg:col-span-2 p-6 space-y-6 bg-[var(--color-surface-2)] border-[var(--color-border-1)]">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Users className="w-5 h-5 text-[#00a3ff]" />
                            Students
                        </h3>
                        <Badge variant="secondary">{students.length} students</Badge>
                    </div>

                    <div className="space-y-2">
                        {students.length === 0 ? (
                            <p className="text-[var(--color-text-3)] text-center py-4">No students enrolled yet.</p>
                        ) : (
                            students.map(student => (
                                <div key={student.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-1)]">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00a3ff] to-[#0055ff] flex items-center justify-center text-white font-medium">
                                            {student.fullName.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-medium text-[var(--color-text-1)]">{student.fullName}</div>
                                            <div className="text-xs text-[var(--color-text-3)]">{student.email}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right mr-2 hidden sm:block">
                                            <div className="text-xs text-[var(--color-text-3)]">Level {student.level}</div>
                                            <div className="text-xs font-mono">{student.experiencePoints} XP</div>
                                        </div>
                                        <Badge className={
                                            student.paymentStatus === "PAID"
                                                ? "bg-green-500/10 text-green-500 border-green-500/20"
                                                : "bg-red-500/10 text-red-500 border-red-500/20"
                                        }>
                                            {student.paymentStatus === "PAID" ? (
                                                <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Paid</span>
                                            ) : (
                                                <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Debtor</span>
                                            )}
                                        </Badge>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

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
                                    <div className="text-sm text-[var(--color-text-3)]">Completed</div>
                                    <div className="font-medium text-[#00a3ff]">-</div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-5 bg-[var(--color-surface-2)] border-[var(--color-border-1)] space-y-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-[#00a3ff]" />
                            Schedule
                        </h3>

                        <div className="space-y-3">
                            <div className="p-3 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border-1)]">
                                <div className="text-sm text-[var(--color-text-3)] mb-1">Regular Schedule</div>
                                <div className="font-medium flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-[var(--color-text-3)]" />
                                    {group.schedule || "Not set"}
                                </div>
                            </div>

                            {group.nextLesson && (
                                <div className="p-3 rounded-lg bg-[#00a3ff]/10 border border-[#00a3ff]/20">
                                    <div className="text-sm text-[#00a3ff] mb-1 font-medium">Next Lesson</div>
                                    <div className="font-medium">{new Date(group.nextLesson.date).toLocaleDateString()}</div>
                                    <div className="text-sm opacity-80">{group.nextLesson.time} • {group.nextLesson.title}</div>
                                </div>
                            )}

                            <Button className="w-full" variant="outline" onClick={() => router.push('/dashboard?tab=schedule')}>
                                View Full Schedule
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}
