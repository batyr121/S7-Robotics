"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Users, UserPlus, MoreVertical, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { apiFetch } from "@/lib/api"

interface GroupsTabProps {
    user: any
}

interface Group {
    id: string
    name: string
    kruzhokTitle: string
    programTitle?: string | null
    programLessons?: number
    studentsCount: number
    schedule?: string
    nextLesson?: string
    mentorName?: string
    isActive?: boolean
}

export default function GroupsTab({ user }: GroupsTabProps) {
    const [groups, setGroups] = useState<Group[]>([])
    const [loading, setLoading] = useState(true)
    const role = String((user as any)?.role || "").toLowerCase()
    const isStudent = role === "student" || role === "user"

    const loadGroups = async () => {
        setLoading(true)
        try {
            if (isStudent) {
                const res = await apiFetch<any>("/student/groups")
                const list = (res?.groups || []).map((g: any) => ({
                    id: g.id,
                    name: g.name,
                    kruzhokTitle: g.kruzhokTitle || "",
                    programTitle: g.programTitle || null,
                    programLessons: Number(g.programLessons || 0),
                    studentsCount: g.studentsCount || 0,
                    schedule: g.scheduleDescription || null,
                    mentorName: g.mentor?.fullName || null,
                    isActive: g.isActive ?? true,
                }))
                setGroups(list)
            } else {
                const data = await apiFetch<Group[]>("/mentor/groups")
                setGroups((data || []).map((group) => ({ ...group, isActive: group.isActive ?? true })))
            }
        } catch (err) {
            console.error("Failed to load groups", err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadGroups()
    }, [])

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-[var(--color-text-1)]">Мои группы</h2>
                    <Badge className="bg-[#00a3ff]/20 text-[#00a3ff]">
                        {groups.length} {groups.length === 1 ? "группа" : "группы"}
                    </Badge>
                </div>

            </div>

            {loading ? (
                <div className="text-center py-10 text-[var(--color-text-3)]">Загрузка групп...</div>
            ) : groups.length === 0 ? (
                <div className="text-center py-12 bg-[var(--color-surface-2)] rounded-xl border border-[var(--color-border-1)]">
                    <div className="w-16 h-16 bg-black/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-[var(--color-text-3)]" />
                    </div>
                    <h3 className="text-lg font-medium text-[var(--color-text-1)] mb-2">Группы отсутствуют</h3>
                    <p className="text-[var(--color-text-3)] max-w-sm mx-auto">
                        Группы появятся здесь после назначения.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groups.map((group) => (
                        <div
                            key={group.id}
                            className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-xl p-5 hover:border-[#00a3ff]/50 transition-all group relative"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-medium text-[var(--color-text-1)] text-lg">{group.name}</h3>
                                    <p className="text-sm text-[var(--color-text-3)]">{group.kruzhokTitle}</p>
                                </div>
                                <div className="w-10 h-10 rounded-lg bg-[#00a3ff]/10 flex items-center justify-center text-[#00a3ff]">
                                    <Users className="w-5 h-5" />
                                </div>
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="flex items-center text-sm text-[var(--color-text-3)]">
                                    <Users className="w-4 h-4 mr-2" />
                                    {group.studentsCount} учеников
                                </div>
                                <div className="flex items-center text-sm text-[var(--color-text-3)]">
                                    <Users className="w-4 h-4 mr-2" />
                                    Программа: {group.programTitle || group.kruzhokTitle || "Программа"}
                                </div>
                                {group.programLessons && group.programLessons > 0 && (
                                    <div className="flex items-center text-sm text-[var(--color-text-3)]">
                                        <Users className="w-4 h-4 mr-2" />
                                        Занятий: {group.programLessons}
                                    </div>
                                )}
                                <div className="flex items-center text-sm text-[var(--color-text-3)]">
                                    <Calendar className="w-4 h-4 mr-2" />
                                    {group.schedule || "Расписание уточняется"}
                                </div>
                                {group.nextLesson && (
                                    <div className="flex items-center text-sm text-[var(--color-text-3)]">
                                        <Calendar className="w-4 h-4 mr-2" />
                                        Следующий: {group.nextLesson}
                                    </div>
                                )}
                                {group.mentorName && (
                                    <div className="flex items-center text-sm text-[var(--color-text-3)]">
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        {group.mentorName}
                                    </div>
                                )}
                                <div className="flex items-center text-sm text-[var(--color-text-3)]">
                                    <Badge className={`${group.isActive === false ? "bg-yellow-500/20 text-yellow-500" : "bg-green-500/20 text-green-500"}`}>
                                        {group.isActive === false ? "На паузе" : "Активна"}
                                    </Badge>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-4 border-t border-[var(--color-border-1)]">
                                <Link href={`/dashboard/groups/${group.id}`} passHref className="flex-1">
                                    <Button variant="outline" size="sm" className="w-full text-xs">
                                        Подробнее
                                    </Button>
                                </Link>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="w-4 h-4 text-[var(--color-text-3)]" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}


        </div>
    )
}
