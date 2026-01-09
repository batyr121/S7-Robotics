"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { apiFetch } from "@/lib/api"
import { BarChart3, Users, BookOpen, GraduationCap, Coins, TrendingUp, Star, CalendarCheck, UserCheck, Activity } from "lucide-react"
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts"
import { Badge } from "@/components/ui/badge"

interface MentorRating {
    id: string
    fullName: string
    email: string
    ratingAvg: number
    ratingCount: number
    lessonsCompleted: number
}

interface GroupSummary {
    id: string
    name: string
    kruzhokTitle: string
    isActive: boolean
    lessonsTotal: number
    lessonsCompleted: number
    attendanceTotal: number
    present: number
    late: number
    absent: number
    averageGrade: number
    lastLessonDate?: string
}

interface GroupDetail {
    group: {
        id: string
        name: string
        kruzhokTitle: string
        isActive: boolean
    }
    summary: {
        lessonsTotal: number
        lessonsCompleted: number
        attendanceTotal: number
        present: number
        late: number
        absent: number
        averageGrade: number
    }
    lessons: Array<{
        id: string
        title: string
        scheduledDate: string
        scheduledTime: string
        status: string
        attendance: {
            present: number
            late: number
            absent: number
            total: number
            averageGrade: number
        }
    }>
}

interface AnalyticsData {
    usersCount: number
    studentsCount: number
    parentsCount: number
    mentorsCount: number
    coursesCount: number
    groupsCount: number
    schedulesCount: number
    totalCoins: number
    registrationsByDay?: { date: string, count: number }[]
    attendance: {
        present: number
        late: number
        absent: number
        total: number
    }
    performance: {
        averageGrade: number
        averageRating: number
        ratingCount: number
    }
    content: {
        newsTotal: number
        newsPublished: number
        newsDrafts: number
        bytesizeTotal: number
        coursesTotal: number
        shopItemsTotal: number
        eventsTotal: number
        eventsPending: number
        eventsPublished: number
    }
    mentorRatings: MentorRating[]
}

export default function AdminAnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [groups, setGroups] = useState<GroupSummary[]>([])
    const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null)
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [groupLoading, setGroupLoading] = useState(true)
    const [detailLoading, setDetailLoading] = useState(false)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            setGroupLoading(true)
            try {
                const [analyticsData, groupData] = await Promise.all([
                    apiFetch<AnalyticsData>("/admin/analytics"),
                    apiFetch<{ groups: GroupSummary[] }>("/admin/analytics/groups").catch(() => ({ groups: [] }))
                ])
                setData(analyticsData)
                setGroups(groupData.groups || [])
                if (groupData.groups?.length) {
                    const first = groupData.groups[0]
                    setSelectedGroupId(first.id)
                }
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
                setGroupLoading(false)
            }
        }
        load()
    }, [])

    useEffect(() => {
        const loadDetail = async () => {
            if (!selectedGroupId) return
            setDetailLoading(true)
            try {
                const detail = await apiFetch<GroupDetail>(`/admin/analytics/groups/${selectedGroupId}`)
                setGroupDetail(detail)
            } catch (error) {
                console.error(error)
                setGroupDetail(null)
            } finally {
                setDetailLoading(false)
            }
        }
        loadDetail()
    }, [selectedGroupId])

    if (loading || !data) {
        return <div className="p-8 text-center text-[var(--color-text-3)]">Loading analytics...</div>
    }

    const stats = [
        { label: "Total users", value: data.usersCount, icon: Users, color: "text-blue-500" },
        { label: "Students", value: data.studentsCount, icon: GraduationCap, color: "text-green-500" },
        { label: "Parents", value: data.parentsCount, icon: UserCheck, color: "text-sky-500" },
        { label: "Mentors", value: data.mentorsCount, icon: BookOpen, color: "text-purple-500" },
        { label: "Groups", value: data.groupsCount, icon: Users, color: "text-amber-500" },
        { label: "Courses", value: data.coursesCount, icon: BookOpen, color: "text-yellow-500" }
    ]

    const attendanceTotal = data.attendance.total || 0
    const onTimeRate = attendanceTotal ? Math.round((data.attendance.present / attendanceTotal) * 100) : 0

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-[var(--color-text-1)] flex items-center gap-2">
                    <BarChart3 className="w-6 h-6" /> Admin analytics
                </h1>
                <p className="text-sm text-[var(--color-text-3)]">Global overview, mentor ratings, and content status.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="card p-6 flex items-center justify-between">
                        <div>
                            <p className="text-[var(--color-text-3)] text-sm">{stat.label}</p>
                            <p className="text-3xl font-bold text-[var(--color-text-1)] mt-1">{stat.value}</p>
                        </div>
                        <div className={`p-3 rounded-full bg-[var(--color-surface-2)] ${stat.color}`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-[var(--color-text-1)] mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-500" /> Registrations (last 7 days)
                    </h2>
                    <div className="h-64 border border-[var(--color-border-1)] rounded-lg bg-[var(--color-surface-2)] p-2">
                        {data.registrationsByDay ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.registrationsByDay}>
                                    <XAxis dataKey="date" stroke="#666" fontSize={12} tickFormatter={(v) => v.split("-").slice(1).join(".")} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "var(--color-surface-1)", borderColor: "var(--color-border-1)", color: "var(--color-text-1)" }}
                                    />
                                    <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-[var(--color-text-3)]">No data yet.</div>
                        )}
                    </div>
                </div>

                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-[var(--color-text-1)] mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500" /> Attendance & performance
                    </h2>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-4 rounded-lg bg-[var(--color-surface-2)]">
                            <div className="text-sm text-[var(--color-text-3)]">Present</div>
                            <div className="text-2xl font-bold text-[var(--color-text-1)]">{data.attendance.present}</div>
                        </div>
                        <div className="p-4 rounded-lg bg-[var(--color-surface-2)]">
                            <div className="text-sm text-[var(--color-text-3)]">Late</div>
                            <div className="text-2xl font-bold text-[var(--color-text-1)]">{data.attendance.late}</div>
                        </div>
                        <div className="p-4 rounded-lg bg-[var(--color-surface-2)]">
                            <div className="text-sm text-[var(--color-text-3)]">Absent</div>
                            <div className="text-2xl font-bold text-[var(--color-text-1)]">{data.attendance.absent}</div>
                        </div>
                        <div className="p-4 rounded-lg bg-[var(--color-surface-2)]">
                            <div className="text-sm text-[var(--color-text-3)]">On-time rate</div>
                            <div className="text-2xl font-bold text-[var(--color-text-1)]">{onTimeRate}%</div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-sm text-[var(--color-text-3)]">
                        <div className="flex items-center gap-2">
                            <Star className="w-4 h-4 text-yellow-500" />
                            Avg mentor rating: <span className="text-[var(--color-text-1)] font-medium ml-1">{data.performance.averageRating.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CalendarCheck className="w-4 h-4 text-green-500" />
                            Avg grade: <span className="text-[var(--color-text-1)] font-medium ml-1">{data.performance.averageGrade.toFixed(1)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-[var(--color-text-1)]">Mentor ratings</h2>
                        <p className="text-sm text-[var(--color-text-3)]">Sorted by rating, review volume, and completed lessons.</p>
                    </div>
                    <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">
                        {data.mentorRatings.length} mentors
                    </Badge>
                </div>

                {data.mentorRatings.length === 0 ? (
                    <div className="text-center py-8 text-[var(--color-text-3)]">No ratings yet.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="text-[var(--color-text-3)]">
                                <tr className="text-left border-b border-[var(--color-border-1)]">
                                    <th className="py-2 pr-4">Mentor</th>
                                    <th className="py-2 pr-4">Rating</th>
                                    <th className="py-2 pr-4">Reviews</th>
                                    <th className="py-2 pr-4">Lessons</th>
                                    <th className="py-2 text-right">Profile</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.mentorRatings.slice(0, 12).map((mentor) => (
                                    <tr key={mentor.id} className="border-b border-[var(--color-border-1)]">
                                        <td className="py-3 pr-4">
                                            <div className="font-medium text-[var(--color-text-1)]">{mentor.fullName}</div>
                                            <div className="text-xs text-[var(--color-text-3)]">{mentor.email}</div>
                                        </td>
                                        <td className="py-3 pr-4 text-[var(--color-text-1)]">
                                            {mentor.ratingAvg.toFixed(2)}
                                        </td>
                                        <td className="py-3 pr-4 text-[var(--color-text-1)]">
                                            {mentor.ratingCount}
                                        </td>
                                        <td className="py-3 pr-4 text-[var(--color-text-1)]">
                                            {mentor.lessonsCompleted}
                                        </td>
                                        <td className="py-3 text-right">
                                            <Link className="text-xs text-[var(--color-text-2)] hover:text-[var(--color-text-1)]" href={`/admin/users/${mentor.id}`}>
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-[var(--color-text-1)] mb-3">Content summary</h2>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-[var(--color-text-3)]">News</span>
                            <span className="text-[var(--color-text-1)]">{data.content.newsPublished}/{data.content.newsTotal} published</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[var(--color-text-3)]">Events</span>
                            <span className="text-[var(--color-text-1)]">{data.content.eventsPublished}/{data.content.eventsTotal} published</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[var(--color-text-3)]">ByteSize videos</span>
                            <span className="text-[var(--color-text-1)]">{data.content.bytesizeTotal}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[var(--color-text-3)]">Shop items</span>
                            <span className="text-[var(--color-text-1)]">{data.content.shopItemsTotal}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[var(--color-text-3)]">Total coins</span>
                            <span className="text-[var(--color-text-1)]">{data.totalCoins.toLocaleString("ru-RU")}</span>
                        </div>
                    </div>
                </div>

                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-[var(--color-text-1)] mb-3">Content actions</h2>
                    <div className="grid grid-cols-1 gap-3 text-sm">
                        <Link className="flex items-center justify-between rounded-lg border border-[var(--color-border-1)] px-4 py-3 hover:bg-[var(--color-surface-2)]" href="/admin/news">
                            <span>Manage news</span>
                            <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">{data.content.newsDrafts} drafts</Badge>
                        </Link>
                        <Link className="flex items-center justify-between rounded-lg border border-[var(--color-border-1)] px-4 py-3 hover:bg-[var(--color-surface-2)]" href="/admin/masterclass">
                            <span>Masterclasses</span>
                            <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">{data.content.eventsPending} pending</Badge>
                        </Link>
                        <Link className="flex items-center justify-between rounded-lg border border-[var(--color-border-1)] px-4 py-3 hover:bg-[var(--color-surface-2)]" href="/admin/bytesize">
                            <span>ByteSize feed</span>
                            <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">{data.content.bytesizeTotal} items</Badge>
                        </Link>
                        <Link className="flex items-center justify-between rounded-lg border border-[var(--color-border-1)] px-4 py-3 hover:bg-[var(--color-surface-2)]" href="/admin/shop">
                            <span>Bonus store</span>
                            <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">{data.content.shopItemsTotal} items</Badge>
                        </Link>
                    </div>
                </div>

                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-[var(--color-text-1)] mb-3">Learning operations</h2>
                    <div className="space-y-4 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-[var(--color-text-3)]">Schedules</span>
                            <span className="text-[var(--color-text-1)]">{data.schedulesCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[var(--color-text-3)]">Groups</span>
                            <span className="text-[var(--color-text-1)]">{data.groupsCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[var(--color-text-3)]">Courses</span>
                            <span className="text-[var(--color-text-1)]">{data.content.coursesTotal}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[var(--color-text-3)]">
                            <Coins className="w-4 h-4 text-yellow-500" />
                            Currency circulation overview
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card p-6 lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--color-text-1)]">Group drilldowns</h2>
                            <p className="text-sm text-[var(--color-text-3)]">Attendance and performance per group (last 30 days).</p>
                        </div>
                        <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">
                            {groups.length} groups
                        </Badge>
                    </div>

                    {groupLoading ? (
                        <div className="text-center py-8 text-[var(--color-text-3)]">Loading groups...</div>
                    ) : groups.length === 0 ? (
                        <div className="text-center py-8 text-[var(--color-text-3)]">No groups found.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="text-[var(--color-text-3)]">
                                    <tr className="text-left border-b border-[var(--color-border-1)]">
                                        <th className="py-2 pr-4">Group</th>
                                        <th className="py-2 pr-4">Attendance</th>
                                        <th className="py-2 pr-4">On time</th>
                                        <th className="py-2 pr-4">Avg grade</th>
                                        <th className="py-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groups.map((group) => {
                                        const onTime = group.attendanceTotal
                                            ? Math.round((group.present / group.attendanceTotal) * 100)
                                            : 0
                                        return (
                                            <tr
                                                key={group.id}
                                                className={`border-b border-[var(--color-border-1)] cursor-pointer ${selectedGroupId === group.id ? "bg-[var(--color-surface-2)]" : "hover:bg-[var(--color-surface-2)]"}`}
                                                onClick={() => setSelectedGroupId(group.id)}
                                            >
                                                <td className="py-3 pr-4">
                                                    <div className="font-medium text-[var(--color-text-1)]">{group.name}</div>
                                                    <div className="text-xs text-[var(--color-text-3)]">{group.kruzhokTitle}</div>
                                                </td>
                                                <td className="py-3 pr-4 text-[var(--color-text-1)]">
                                                    {group.present}/{group.attendanceTotal}
                                                </td>
                                                <td className="py-3 pr-4 text-[var(--color-text-1)]">{onTime}%</td>
                                                <td className="py-3 pr-4 text-[var(--color-text-1)]">{group.averageGrade.toFixed(1)}</td>
                                                <td className="py-3">
                                                    <Badge className={group.isActive ? "bg-green-500/20 text-green-500" : "bg-yellow-500/20 text-yellow-500"}>
                                                        {group.isActive ? "Active" : "Paused"}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-[var(--color-text-1)] mb-3">Selected group</h2>
                    {detailLoading ? (
                        <div className="text-[var(--color-text-3)]">Loading details...</div>
                    ) : groupDetail ? (
                        <div className="space-y-4">
                            <div>
                                <div className="text-[var(--color-text-1)] font-medium">{groupDetail.group.name}</div>
                                <div className="text-xs text-[var(--color-text-3)]">{groupDetail.group.kruzhokTitle}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                                    <div className="text-[var(--color-text-3)]">Lessons</div>
                                    <div className="text-lg font-semibold text-[var(--color-text-1)]">{groupDetail.summary.lessonsCompleted}/{groupDetail.summary.lessonsTotal}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                                    <div className="text-[var(--color-text-3)]">Avg grade</div>
                                    <div className="text-lg font-semibold text-[var(--color-text-1)]">{groupDetail.summary.averageGrade.toFixed(1)}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                                    <div className="text-[var(--color-text-3)]">Present</div>
                                    <div className="text-lg font-semibold text-[var(--color-text-1)]">{groupDetail.summary.present}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                                    <div className="text-[var(--color-text-3)]">Absent</div>
                                    <div className="text-lg font-semibold text-[var(--color-text-1)]">{groupDetail.summary.absent}</div>
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-[var(--color-text-3)] mb-2">Recent lessons</div>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {groupDetail.lessons.slice(0, 8).map((lesson) => (
                                        <div key={lesson.id} className="p-3 rounded-lg bg-[var(--color-surface-2)] text-sm">
                                            <div className="text-[var(--color-text-1)] font-medium">{lesson.title}</div>
                                            <div className="text-xs text-[var(--color-text-3)]">
                                                {new Date(lesson.scheduledDate).toLocaleDateString("en-US")} {lesson.scheduledTime}
                                            </div>
                                            <div className="text-xs text-[var(--color-text-3)]">
                                                Attendance: {lesson.attendance.present}/{lesson.attendance.total} | Avg grade {lesson.attendance.averageGrade.toFixed(1)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-[var(--color-text-3)]">Select a group to view details.</div>
                    )}
                </div>
            </div>
        </div>
    )
}

