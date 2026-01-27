"use client"
import { useState, useEffect } from "react"
import { Edit, UserPlus, Users, Plus, Trash2, RefreshCw, ArrowRightLeft, CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useConfirm } from "@/components/ui/confirm"
import { cn } from "@/lib/utils"

// --- TYPES ---
interface User {
    id: string
    fullName: string
    email: string
    role: string
    parentId: string | null
    parent?: { id: string, fullName: string }
    children?: { id: string, fullName: string }[]
}

interface Group {
    id: string
    name: string
    description?: string
    maxStudents: number
    isActive: boolean
    kruzhok: { id: string, title: string }
    mentorId?: string | null
    mentor?: { id: string, fullName: string }
    wagePerLesson: number
    scheduleDescription?: string | null
    _count: { enrollments: number }
}

interface GroupDetail {
    id: string
    name: string
    description?: string
    maxStudents: number
    isActive: boolean
    kruzhok: { id: string, title: string }
    mentorId?: string | null
    mentor?: { id: string, fullName: string }
    wagePerLesson: number
    scheduleDescription?: string | null
    enrollments: Array<{ id: string, user: { id: string, fullName: string, email: string } }>
}

interface ScheduleEvent {
    id: string
    classId: string
    className: string
    kruzhokTitle?: string
    scheduledDate: string
    scheduledTime: string
    status: string
}

// --- USERS TAB ---
export function UsersTab() {
    const [users, setUsers] = useState<User[]>([])
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()

    // Edit State
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [editRole, setEditRole] = useState("")
    const [editParentId, setEditParentId] = useState("")

    // Parent Search for linking
    const [parentSearch, setParentSearch] = useState("")
    const [parentOptions, setParentOptions] = useState<User[]>([])
    const roleLabel = (role: string) => {
        switch (role) {
            case "ADMIN": return "Админ"
            case "MENTOR": return "Ментор"
            case "PARENT": return "Родитель"
            case "STUDENT": return "Ученик"
            case "USER": return "Пользователь"
            default: return role
        }
    }


    const fetchUsers = async () => {
        setLoading(true)
        try {
            const query = new URLSearchParams({ page: page.toString(), limit: "20" })
            if (search) query.set("search", search)

            const res = await apiFetch<any>(`/admin/users?${query}`)
            setUsers(res.users)
            setTotalPages(res.totalPages)
        } catch (err) {
            console.error(err)
            toast({ title: "Ошибка", description: "Не удалось загрузить пользователей", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const timeout = setTimeout(fetchUsers, 500)
        return () => clearTimeout(timeout)
    }, [search, page])

    // Search parents when typing in edit dialog
    useEffect(() => {
        if (!parentSearch) {
            setParentOptions([])
            return
        }
        const timeout = setTimeout(async () => {
            const res = await apiFetch<any>(`/admin/users?search=${parentSearch}&role=PARENT&limit=5`)
            setParentOptions(res.users)
        }, 300)
        return () => clearTimeout(timeout)
    }, [parentSearch])

    const handleEditSave = async () => {
        if (!editingUser) return
        try {
            await apiFetch(`/admin/users/${editingUser.id}`, {
                method: "PUT",
                body: JSON.stringify({
                    role: editRole,
                    parentId: editParentId || null
                })
            })
            toast({ title: "Сохранено", description: "Данные пользователя обновлены" })
            setEditingUser(null)
            fetchUsers()
        } catch (err) {
            toast({ title: "Ошибка", description: "Не удалось обновить пользователя", variant: "destructive" })
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input
                    placeholder="Поиск по имени или эл. почте..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="max-w-md bg-[var(--color-surface-1)] border-[var(--color-border-1)]"
                />
                {loading && <div className="text-xs text-[var(--color-text-3)] self-center">Загрузка...</div>}
            </div>

            <div className="rounded-xl border border-[var(--color-border-1)] overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-[var(--color-surface-2)] text-[var(--color-text-2)]">
                        <tr>
                            <th className="p-3">Пользователь</th>
                            <th className="p-3">Роль</th>
                            <th className="p-3">Родитель</th>
                            <th className="p-3">Дети</th>
                            <th className="p-3 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-1)]">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-[var(--color-surface-1)]">
                                <td className="p-3">
                                    <div className="font-medium">{u.fullName || "-"}</div>
                                    <div className="text-xs text-[var(--color-text-3)]">{u.email}</div>
                                </td>
                                <td className="p-3">
                                    <span className={cn(
                                        "px-2 py-0.5 rounded text-xs font-medium",
                                        u.role === "ADMIN" ? "bg-red-500/20 text-red-500" :
                                            u.role === "MENTOR" ? "bg-purple-500/20 text-purple-500" :
                                                u.role === "STUDENT" ? "bg-blue-500/20 text-blue-500" :
                                                    u.role === "PARENT" ? "bg-amber-500/20 text-amber-500" :
                                                        "bg-gray-500/20 text-gray-500"
                                    )}>
                                        {roleLabel(u.role)}
                                    </span>
                                </td>
                                <td className="p-3 text-[var(--color-text-3)]">
                                    {u.parent?.fullName || "-"}
                                </td>
                                <td className="p-3 text-[var(--color-text-3)]">
                                    {u.children?.map(c => c.fullName).join(", ") || "-"}
                                </td>
                                <td className="p-3 text-right">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setEditingUser(u)
                                            setEditRole(u.role)
                                            setEditParentId(u.parentId || "")
                                            setParentSearch("")
                                        }}
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-center gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Назад</Button>
                <div className="flex items-center text-sm">{page} / {totalPages}</div>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Вперед</Button>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingUser} onOpenChange={open => !open && setEditingUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Редактировать пользователя</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Роль</label>
                            <Select value={editRole} onValueChange={setEditRole}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="USER">Пользователь</SelectItem>
                                    <SelectItem value="STUDENT">Ученик</SelectItem>
                                    <SelectItem value="PARENT">Родитель</SelectItem>
                                    <SelectItem value="MENTOR">Ментор</SelectItem>
                                    <SelectItem value="ADMIN">Админ</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Parent Linking */}
                        <div>
                            <label className="text-sm font-medium">Привязка родителя (ID: {editParentId || "—"})</label>
                            <Input
                                placeholder="Поиск родителя..."
                                value={parentSearch}
                                onChange={e => setParentSearch(e.target.value)}
                            />
                            {parentOptions.length > 0 && (
                                <div className="mt-2 border rounded p-2 max-h-32 overflow-y-auto bg-[var(--color-surface-2)]">
                                    {parentOptions.map(p => (
                                        <div
                                            key={p.id}
                                            className="cursor-pointer p-1 hover:bg-[var(--color-bg)] text-sm flex justify-between"
                                            onClick={() => {
                                                setEditParentId(p.id)
                                                setParentSearch("")
                                                setParentOptions([])
                                            }}
                                        >
                                            <span>{p.fullName}</span>
                                            <span className="text-xs opacity-50">{p.email}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {editParentId && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mt-1 text-red-500 h-auto p-0"
                                    onClick={() => setEditParentId("")}
                                >
                                    Отвязать от родителя
                                </Button>
                            )}
                        </div>

                        <Button onClick={handleEditSave} className="w-full">Сохранить изменения</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// --- CLASSES TAB ---
export function ClassesTab() {
    const [groups, setGroups] = useState<Group[]>([])
    const [loading, setLoading] = useState(false)
    const [mentors, setMentors] = useState<User[]>([])
    const { toast } = useToast()
    const confirm = useConfirm()

    const [createOpen, setCreateOpen] = useState(false)
    const [createData, setCreateData] = useState({
        kruzhokId: "",
        name: "",
        description: "",
        maxStudents: 30,
        isActive: true,
        mentorId: "none",
        wagePerLesson: 0,
        scheduleDescription: ""
    })
    const [createScheduleDates, setCreateScheduleDates] = useState<Date[]>([])
    const [createScheduleTimes, setCreateScheduleTimes] = useState<Record<string, string>>({})
    const [createDefaultTime, setCreateDefaultTime] = useState("15:00")
    const [createScheduleBuilderOpen, setCreateScheduleBuilderOpen] = useState(false)
    const [createWeekdays, setCreateWeekdays] = useState<number[]>([])
    const [createWeekdayTimes, setCreateWeekdayTimes] = useState<Record<number, string>>({})
    const [createWeekStart, setCreateWeekStart] = useState<Date>(() => startOfWeek(new Date()))
    const [createBusySchedules, setCreateBusySchedules] = useState<ScheduleEvent[]>([])
    const [createBusyLoading, setCreateBusyLoading] = useState(false)

    const [submitting, setSubmitting] = useState(false)

    const [managingGroup, setManagingGroup] = useState<Group | null>(null)
    const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [editData, setEditData] = useState({
        name: "",
        description: "",
        maxStudents: 30,
        isActive: true,
        mentorId: "none",
        wagePerLesson: 0,
        scheduleDescription: ""
    })
    const [editScheduleDates, setEditScheduleDates] = useState<Date[]>([])
    const [editScheduleTimes, setEditScheduleTimes] = useState<Record<string, string>>({})
    const [editDefaultTime, setEditDefaultTime] = useState("15:00")
    const [editScheduleBuilderOpen, setEditScheduleBuilderOpen] = useState(false)
    const [editWeekdays, setEditWeekdays] = useState<number[]>([])
    const [editWeekdayTimes, setEditWeekdayTimes] = useState<Record<number, string>>({})
    const [editWeekStart, setEditWeekStart] = useState<Date>(() => startOfWeek(new Date()))
    const [editBusySchedules, setEditBusySchedules] = useState<ScheduleEvent[]>([])
    const [editBusyLoading, setEditBusyLoading] = useState(false)

    const [studentSearch, setStudentSearch] = useState("")
    const [studentOptions, setStudentOptions] = useState<User[]>([])
    const [migrateStudentId, setMigrateStudentId] = useState("")
    const [targetGroupId, setTargetGroupId] = useState("")

    const schedulePresets = [
        { id: "mon-wed", label: "Пн/Ср 15:00", days: [1, 3], time: "15:00" },
        { id: "tue-thu", label: "Вт/Чт 15:00", days: [2, 4], time: "15:00" },
        { id: "sat", label: "Сб 12:00", days: [6], time: "12:00" },
        { id: "sun", label: "Вс 12:00", days: [0], time: "12:00" }
    ]

    const dateKey = (date: Date) => {
        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, "0")
        const d = String(date.getDate()).padStart(2, "0")
        return `${y}-${m}-${d}`
    }

    const timeToMinutes = (time: string) => {
        const [h, m] = time.split(":").map((v) => Number(v))
        return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
    }

    function startOfWeek(date: Date, weekStartsOn = 1) {
        const d = new Date(date)
        d.setHours(0, 0, 0, 0)
        const day = d.getDay()
        const diff = (day - weekStartsOn + 7) % 7
        d.setDate(d.getDate() - diff)
        return d
    }

    const addDays = (date: Date, days: number) => {
        const d = new Date(date)
        d.setDate(d.getDate() + days)
        return d
    }

    const weekDayOrder = [1, 2, 3, 4, 5, 6, 0]
    const weekDayMeta = [
        { id: 1, short: "Пн", label: "Понедельник" },
        { id: 2, short: "Вт", label: "Вторник" },
        { id: 3, short: "Ср", label: "Среда" },
        { id: 4, short: "Чт", label: "Четверг" },
        { id: 5, short: "Пт", label: "Пятница" },
        { id: 6, short: "Сб", label: "Суббота" },
        { id: 0, short: "Вс", label: "Воскресенье" },
    ]

    const buildWeekDates = (weekStart: Date) => weekDayOrder.map((_, idx) => addDays(weekStart, idx))

    const formatWeekRange = (weekStart: Date) => {
        const start = new Date(weekStart)
        const end = addDays(start, 6)
        const startLabel = start.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })
        const endLabel = end.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" })
        return `${startLabel} — ${endLabel}`
    }

    const formatSchedulePreview = (dates: Date[], times: Record<string, string>, fallbackTime: string) => {
        if (!dates || dates.length === 0) return ""
        const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
        return sorted
            .map((d) => {
                const key = dateKey(d)
                const t = times[key] || fallbackTime || "00:00"
                return `${d.toLocaleDateString("ru-RU")} ${t}`
            })
            .join(", ")
    }

    const buildTimeSlots = (startHour = 8, endHour = 22, stepMinutes = 30) => {
        const slots: string[] = []
        const totalMinutes = (endHour - startHour) * 60
        for (let minutes = 0; minutes < totalMinutes; minutes += stepMinutes) {
            const hour = startHour + Math.floor(minutes / 60)
            const minute = minutes % 60
            const hh = String(hour).padStart(2, "0")
            const mm = String(minute).padStart(2, "0")
            slots.push(`${hh}:${mm}`)
        }
        return slots
    }

    const timeSlots = buildTimeSlots()

    const nearestSlot = (time: string) => {
        if (!timeSlots.length) return time
        const target = timeToMinutes(time)
        let best = timeSlots[0]
        let bestDiff = Math.abs(timeToMinutes(best) - target)
        for (const slot of timeSlots) {
            const diff = Math.abs(timeToMinutes(slot) - target)
            if (diff < bestDiff) {
                best = slot
                bestDiff = diff
            }
        }
        return best
    }

    const buildWeekdayDateMap = (weekStart: Date) => {
        const map = new Map<number, Date>()
        buildWeekDates(weekStart).forEach((date) => {
            map.set(date.getDay(), date)
        })
        return map
    }

    const buildBusySlotMap = (events: ScheduleEvent[], weekStart: Date) => {
        const start = new Date(weekStart)
        const end = addDays(start, 7)
        const slotMap = new Map<string, ScheduleEvent[]>()
        events.forEach((event) => {
            const d = new Date(event.scheduledDate)
            if (Number.isNaN(d.getTime())) return
            if (d < start || d >= end) return
            const weekday = d.getDay()
            const slot = nearestSlot(event.scheduledTime || "00:00")
            const key = `${weekday}|${slot}`
            const list = slotMap.get(key) || []
            list.push(event)
            slotMap.set(key, list)
        })
        return slotMap
    }

    const buildPlannedSlotSet = (weekdays: number[], weekdayTimes: Record<number, string>, fallbackTime: string) => {
        const set = new Set<string>()
        weekdays.forEach((weekday) => {
            const time = weekdayTimes[weekday] || fallbackTime
            const slot = nearestSlot(time)
            set.add(`${weekday}|${slot}`)
        })
        return set
    }

    const applyWeekdaysToDates = (
        weekdays: number[],
        weekdayTimes: Record<number, string>,
        fallbackTime: string,
        weekStart: Date,
        weeks = 4
    ) => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const dates: Date[] = []
        const times: Record<string, string> = {}
        for (let w = 0; w < weeks; w += 1) {
            const base = addDays(weekStart, w * 7)
            for (let i = 0; i < 7; i += 1) {
                const d = addDays(base, i)
                if (d < today) continue
                const weekday = d.getDay()
                if (!weekdays.includes(weekday)) continue
                const key = dateKey(d)
                dates.push(d)
                times[key] = weekdayTimes[weekday] || fallbackTime || "00:00"
            }
        }
        return { dates, times }
    }

    const syncCreateScheduleFromWeekdays = () => {
        const baseWeekStart = startOfWeek(new Date())
        const { dates, times } = applyWeekdaysToDates(
            createWeekdays,
            createWeekdayTimes,
            createDefaultTime,
            baseWeekStart
        )
        setCreateScheduleDates(dates)
        setCreateScheduleTimes(times)
    }

    const syncEditScheduleFromWeekdays = () => {
        const baseWeekStart = startOfWeek(new Date())
        const { dates, times } = applyWeekdaysToDates(
            editWeekdays,
            editWeekdayTimes,
            editDefaultTime,
            baseWeekStart
        )
        setEditScheduleDates(dates)
        setEditScheduleTimes(times)
    }

    const applyCreateSchedulePreview = () => {
        setCreateData((prev) => ({
            ...prev,
            scheduleDescription: formatSchedulePreview(createScheduleDates, createScheduleTimes, createDefaultTime)
        }))
    }

    const applyEditSchedulePreview = () => {
        setEditData((prev) => ({
            ...prev,
            scheduleDescription: formatSchedulePreview(editScheduleDates, editScheduleTimes, editDefaultTime)
        }))
    }

    const applyCreatePreset = (preset: { days: number[]; time: string }) => {
        setCreateDefaultTime(preset.time)
        setCreateWeekdays(preset.days)
        setCreateWeekdayTimes(
            preset.days.reduce((acc, day) => {
                acc[day] = preset.time
                return acc
            }, {} as Record<number, string>)
        )
    }

    const applyEditPreset = (preset: { days: number[]; time: string }) => {
        setEditDefaultTime(preset.time)
        setEditWeekdays(preset.days)
        setEditWeekdayTimes(
            preset.days.reduce((acc, day) => {
                acc[day] = preset.time
                return acc
            }, {} as Record<number, string>)
        )
    }

    const toggleWeekday = (day: number, selected: number[], setSelected: (value: number[]) => void) => {
        if (selected.includes(day)) {
            setSelected(selected.filter((d) => d !== day))
            return
        }
        setSelected([...selected, day])
    }

    const setWeekdayTime = (
        day: number,
        time: string,
        selected: number[],
        setSelected: (value: number[]) => void,
        setTimes: (updater: (prev: Record<number, string>) => Record<number, string>) => void,
        setDefaultTime: (value: string) => void
    ) => {
        if (!selected.includes(day)) {
            setSelected([...selected, day])
        }
        setTimes((prev) => ({ ...prev, [day]: time }))
        setDefaultTime(time)
    }

    const fetchBusySchedulesForWeek = async (
        weekStart: Date,
        setBusy: (events: ScheduleEvent[]) => void,
        setBusyLoading: (value: boolean) => void
    ) => {
        const from = new Date(weekStart)
        const to = addDays(from, 6)
        to.setHours(23, 59, 59, 999)
        setBusyLoading(true)
        try {
            const query = new URLSearchParams({
                from: from.toISOString(),
                to: to.toISOString(),
            })
            const res = await apiFetch<{ schedules?: ScheduleEvent[] }>(`/admin/analytics/groups?${query}`)
            setBusy(res.schedules || [])
        } catch (err) {
            console.error(err)
            setBusy([])
        } finally {
            setBusyLoading(false)
        }
    }

    useEffect(() => {
        if (createOpen) return
        setCreateScheduleBuilderOpen(false)
    }, [createOpen])

    useEffect(() => {
        if (!createScheduleBuilderOpen) return
        fetchBusySchedulesForWeek(createWeekStart, setCreateBusySchedules, setCreateBusyLoading)
    }, [createScheduleBuilderOpen, createWeekStart])

    useEffect(() => {
        if (!editScheduleBuilderOpen) return
        fetchBusySchedulesForWeek(editWeekStart, setEditBusySchedules, setEditBusyLoading)
    }, [editScheduleBuilderOpen, editWeekStart])

    useEffect(() => {
        syncCreateScheduleFromWeekdays()
    }, [createWeekdays, createWeekdayTimes, createDefaultTime, createWeekStart])

    useEffect(() => {
        syncEditScheduleFromWeekdays()
    }, [editWeekdays, editWeekdayTimes, editDefaultTime, editWeekStart])

    useEffect(() => {
        if (!createScheduleBuilderOpen) return
        if (createWeekdays.length > 0) return
        const preset = schedulePresets[0]
        if (preset) applyCreatePreset(preset)
    }, [createScheduleBuilderOpen])

    useEffect(() => {
        if (!editScheduleBuilderOpen) return
        if (editWeekdays.length > 0) return
        const preset = schedulePresets[0]
        if (preset) applyEditPreset(preset)
    }, [editScheduleBuilderOpen])

    const createWeekDates = buildWeekDates(createWeekStart)
    const editWeekDates = buildWeekDates(editWeekStart)
    const createWeekdayDateMap = buildWeekdayDateMap(createWeekStart)
    const editWeekdayDateMap = buildWeekdayDateMap(editWeekStart)
    const createBusySlotMap = buildBusySlotMap(createBusySchedules, createWeekStart)
    const editBusySlotMap = buildBusySlotMap(editBusySchedules, editWeekStart)
    const createPlannedSlots = buildPlannedSlotSet(createWeekdays, createWeekdayTimes, createDefaultTime)
    const editPlannedSlots = buildPlannedSlotSet(editWeekdays, editWeekdayTimes, editDefaultTime)
    const createWeekdaysSorted = weekDayOrder.filter((d) => createWeekdays.includes(d))
    const editWeekdaysSorted = weekDayOrder.filter((d) => editWeekdays.includes(d))

    const shiftWeek = (weekStart: Date, deltaWeeks: number, setter: (value: Date) => void) => {
        setter(addDays(weekStart, deltaWeeks * 7))
    }

    const resetToCurrentWeek = (setter: (value: Date) => void) => {
        setter(startOfWeek(new Date()))
    }

    const fetchGroups = async () => {
        setLoading(true)
        try {
            const res = await apiFetch<any>("/admin/groups")
            setGroups(res.groups || [])
        } catch (err) {
            toast({ title: "Ошибка", description: "Не удалось загрузить группы", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    const fetchClubs = async () => {
        try {
            let list = await apiFetch<any[]>("/admin/kruzhoks")
            if (!list || list.length === 0) {
                const created = await apiFetch<any>("/admin/kruzhoks", {
                    method: "POST",
                    body: JSON.stringify({ title: "Основная программа", isActive: true })
                }).catch(() => null)
                list = created ? [created] : []
            }
            const primary = list[0]?.id
            if (!createData.kruzhokId && primary) {
                setCreateData((prev) => ({ ...prev, kruzhokId: primary }))
            }
        } catch (err) {
        }
    }

    const fetchMentors = async () => {
        try {
            const res = await apiFetch<any>("/admin/users?role=MENTOR&limit=100")
            setMentors(res.users || [])
        } catch (err) { }
    }

    const fetchGroupDetail = async (id: string) => {
        setDetailLoading(true)
        try {
            const detail = await apiFetch<GroupDetail>(`/admin/groups/${id}`)
            setGroupDetail(detail)
            setEditData({
                name: detail.name,
                description: detail.description || "",
                maxStudents: detail.maxStudents || 30,
                isActive: detail.isActive,
                mentorId: detail.mentorId || "none",
                wagePerLesson: detail.wagePerLesson || 0,
                scheduleDescription: detail.scheduleDescription || ""
            })

            try {
                const from = addDays(startOfWeek(new Date()), -7)
                const to = addDays(from, 98)
                const analytics = await apiFetch<{ lessons?: Array<{ scheduledDate: string; scheduledTime?: string | null }> }>(
                    `/admin/analytics/groups/${id}?from=${from.toISOString()}&to=${to.toISOString()}`
                )
                const lessons = analytics.lessons || []
                const byWeekday = new Map<number, Map<string, number>>()
                lessons.forEach((lesson) => {
                    if (!lesson.scheduledDate) return
                    const d = new Date(lesson.scheduledDate)
                    if (Number.isNaN(d.getTime())) return
                    const weekday = d.getDay()
                    const time = lesson.scheduledTime || "15:00"
                    if (!byWeekday.has(weekday)) byWeekday.set(weekday, new Map<string, number>())
                    const timeMap = byWeekday.get(weekday)!
                    timeMap.set(time, (timeMap.get(time) || 0) + 1)
                })
                const weekdays = Array.from(byWeekday.keys())
                const weekdayTimes: Record<number, string> = {}
                weekdays.forEach((weekday) => {
                    const timeMap = byWeekday.get(weekday)
                    if (!timeMap) return
                    let bestTime = "15:00"
                    let bestCount = -1
                    Array.from(timeMap.entries()).forEach(([time, count]) => {
                        if (count > bestCount) {
                            bestTime = time
                            bestCount = count
                        }
                    })
                    weekdayTimes[weekday] = bestTime
                })
                if (weekdays.length) {
                    setEditWeekdays(weekdays)
                    setEditWeekdayTimes(weekdayTimes)
                    const firstTime = weekdayTimes[weekdays[0]]
                    if (firstTime) setEditDefaultTime(firstTime)
                }
            } catch (err) {
                // Non-fatal: if analytics is unavailable we keep manual input
            }
        } catch (err) {
            setGroupDetail(null)
        } finally {
            setDetailLoading(false)
        }
    }

    useEffect(() => {
        fetchGroups()
        fetchClubs()
        fetchMentors()
    }, [])

    useEffect(() => {
        if (!managingGroup) {
            setGroupDetail(null)
            setStudentSearch("")
            setStudentOptions([])
            setMigrateStudentId("")
            setTargetGroupId("")
            setEditScheduleDates([])
            setEditScheduleTimes({})
            setEditDefaultTime("15:00")
            setEditWeekdays([])
            setEditWeekdayTimes({})
            setEditWeekStart(startOfWeek(new Date()))
            setEditBusySchedules([])
            setEditScheduleBuilderOpen(false)
            return
        }
        fetchGroupDetail(managingGroup.id)
    }, [managingGroup])

    // Student Search Effect
    useEffect(() => {
        if (!studentSearch) { setStudentOptions([]); return }
        const t = setTimeout(async () => {
            const res = await apiFetch<any>(`/admin/users?search=${studentSearch}&role=STUDENT&limit=5`)
            setStudentOptions(res.users)
        }, 300)
        return () => clearTimeout(t)
    }, [studentSearch])

    const handleCreateGroup = async () => {
        if (!createData.name.trim()) {
            toast({ title: "Заполните поля", description: "Нужно название группы", variant: "destructive" })
            return
        }
        if (!createData.kruzhokId) {
            toast({ title: "Ошибка", description: "Не удалось определить направление группы", variant: "destructive" })
            return
        }
        if (submitting) return
        setSubmitting(true)
        try {
            const scheduleDescription = createData.scheduleDescription.trim()
                || formatSchedulePreview(createScheduleDates, createScheduleTimes, createDefaultTime)
                || undefined
            await apiFetch("/admin/groups", {
                method: "POST",
                body: JSON.stringify({
                    kruzhokId: createData.kruzhokId,
                    name: createData.name.trim(),
                    description: createData.description.trim() || undefined,
                    maxStudents: Number(createData.maxStudents) || 30,
                    isActive: createData.isActive,
                    mentorId: createData.mentorId === "none" ? undefined : createData.mentorId,
                    wagePerLesson: Number(createData.wagePerLesson) || 0,
                    scheduleDescription
                })
            })
            toast({ title: "Группа создана" })
            setCreateOpen(false)
            setCreateData({ kruzhokId: createData.kruzhokId, name: "", description: "", maxStudents: 30, isActive: true, mentorId: "none", wagePerLesson: 0, scheduleDescription: "" })
            setCreateScheduleDates([])
            setCreateScheduleTimes({})
            setCreateDefaultTime("15:00")
            setCreateWeekdays([])
            setCreateWeekdayTimes({})
            setCreateWeekStart(startOfWeek(new Date()))
            setCreateBusySchedules([])
            setCreateScheduleBuilderOpen(false)
            fetchGroups()
        } catch (err: any) {
            toast({ title: "Ошибка", description: err?.message || "Не удалось создать группу", variant: "destructive" })
        } finally {
            setSubmitting(false)
        }
    }

    const handleSaveGroup = async () => {
        if (!managingGroup) return
        if (!editData.name.trim()) {
            toast({ title: "Заполните поле", description: "Название группы обязательно", variant: "destructive" })
            return
        }
        if (submitting) return
        setSubmitting(true)
        try {
            const scheduleDescription = editData.scheduleDescription.trim()
                || formatSchedulePreview(editScheduleDates, editScheduleTimes, editDefaultTime)
                || undefined
            await apiFetch(`/admin/groups/${managingGroup.id}` as any, {
                method: "PUT",
                body: JSON.stringify({
                    name: editData.name.trim(),
                    description: editData.description.trim() || undefined,
                    maxStudents: Number(editData.maxStudents) || 30,
                    isActive: editData.isActive,
                    mentorId: editData.mentorId === "none" ? undefined : editData.mentorId,
                    wagePerLesson: Number(editData.wagePerLesson) || 0,
                    scheduleDescription
                })
            })
            toast({ title: "Группа обновлена" })
            fetchGroups()
            fetchGroupDetail(managingGroup.id)
        } catch (err: any) {
            toast({ title: "Ошибка", description: err?.message || "Не удалось сохранить группу", variant: "destructive" })
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeleteGroup = async () => {
        if (!managingGroup) return
        const ok = await confirm({
            title: "Удалить группу",
            description: "Действие необратимо.",
            confirmText: "Удалить",
            cancelText: "Отмена",
            variant: "danger"
        })
        if (!ok) return
        try {
            await apiFetch(`/admin/groups/${managingGroup.id}`, { method: "DELETE" })
            toast({ title: "Группа удалена" })
            setManagingGroup(null)
            fetchGroups()
        } catch (err: any) {
            toast({ title: "Ошибка", description: err?.message || "Не удалось удалить группу", variant: "destructive" })
        }
    }

    const handleAssignStudent = async (studentId: string) => {
        if (!managingGroup) return
        try {
            await apiFetch(`/admin/groups/${managingGroup.id}/assign`, {
                method: "POST",
                body: JSON.stringify({ studentId })
            })
            toast({ title: "Ученик добавлен" })
            setStudentSearch("")
            setStudentOptions([])
            fetchGroupDetail(managingGroup.id)
            fetchGroups()
        } catch (err: any) {
            toast({ title: "Ошибка", description: err?.message || "Не удалось добавить ученика", variant: "destructive" })
        }
    }

    const handleRemoveStudent = async (studentId: string) => {
        if (!managingGroup) return
        try {
            await apiFetch(`/admin/groups/${managingGroup.id}/remove`, {
                method: "POST",
                body: JSON.stringify({ studentId })
            })
            toast({ title: "Ученик удален из группы" })
            fetchGroupDetail(managingGroup.id)
            fetchGroups()
        } catch (err: any) {
            toast({ title: "Ошибка", description: err?.message || "Не удалось удалить ученика", variant: "destructive" })
        }
    }

    const handleMigrateStudent = async () => {
        if (!managingGroup) return
        if (!migrateStudentId || !targetGroupId) {
            toast({ title: "Заполните поля", description: "Выберите ученика и целевую группу", variant: "destructive" })
            return
        }
        try {
            await apiFetch(`/admin/groups/${managingGroup.id}/migrate-student`, {
                method: "POST",
                body: JSON.stringify({ studentId: migrateStudentId, targetClassId: targetGroupId })
            })
            toast({ title: "Ученик переведен" })
            setMigrateStudentId("")
            setTargetGroupId("")
            fetchGroupDetail(managingGroup.id)
            fetchGroups()
        } catch (err: any) {
            toast({ title: "Ошибка", description: err?.message || "Не удалось перевести ученика", variant: "destructive" })
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-sm text-[var(--color-text-2)]">Группы</div>
                    <div className="text-xs text-[var(--color-text-3)]">Управляйте группами, расписанием и учениками.</div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchGroups}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Обновить
                    </Button>
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> Новая группа
                    </Button>
                </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border-1)] overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-[var(--color-surface-2)]">
                        <tr>
                            <th className="p-3">Группа</th>
                            <th className="p-3">Ментор</th>
                            <th className="p-3">Статус</th>
                            <th className="p-3">Ученики</th>
                            <th className="p-3 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-1)]">
                        {loading ? (
                        <tr>
                                <td className="p-3 text-[var(--color-text-3)]" colSpan={5}>Загрузка...</td>
                            </tr>
                        ) : groups.length === 0 ? (
                        <tr>
                                <td className="p-3 text-[var(--color-text-3)]" colSpan={5}>Нет групп.</td>
                            </tr>
                        ) : (
                            groups.map(g => (
                                <tr key={g.id} className="hover:bg-[var(--color-surface-1)]">
                                    <td className="p-3">
                                        <div className="font-medium text-[var(--color-text-1)]">{g.name}</div>
                                        <div className="text-xs text-[var(--color-text-3)]">{g.description || "Без описания"}</div>
                                    </td>
                                    <td className="p-3 text-[var(--color-text-3)]">{g.mentor?.fullName || "-"}</td>
                                    <td className="p-3">
                                        <span className={cn(
                                            "px-2 py-0.5 rounded text-xs font-medium",
                                            g.isActive ? "bg-green-500/20 text-green-500" : "bg-yellow-500/20 text-yellow-500"
                                        )}>
                                            {g.isActive ? "Активна" : "Пауза"}
                                        </span>
                                    </td>
                                    <td className="p-3 text-[var(--color-text-3)]">{g._count?.enrollments ?? 0} / {g.maxStudents}</td>
                                    <td className="p-3 text-right">
                                        <Button size="sm" variant="outline" onClick={() => setManagingGroup(g)}>
                                            <Users className="w-4 h-4 mr-2" /> Управлять
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Group Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="w-[min(1500px,98vw)] max-w-[98vw] max-h-[94vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Новая группа</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-1">
                        <div className="space-y-4 pb-1">
                        <div>
                            <label className="text-sm font-medium">Название группы</label>
                            <Input value={createData.name} onChange={(e) => setCreateData((prev) => ({ ...prev, name: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium">Ставка за урок ₸</label>
                                <Input
                                    type="number"
                                    value={createData.wagePerLesson}
                                    onChange={(e) => setCreateData((prev) => ({ ...prev, wagePerLesson: Number(e.target.value) || 0 }))}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Расписание (например, Пн/Ср 15:00)</label>
                                <Input
                                    value={createData.scheduleDescription}
                                    onChange={(e) => setCreateData((prev) => ({ ...prev, scheduleDescription: e.target.value }))}
                                />
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {schedulePresets.map((preset) => (
                                        <Button
                                            key={preset.id}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => applyCreatePreset(preset)}
                                        >
                                            {preset.label}
                                        </Button>
                                    ))}
                                </div>
                                <div className="mt-2 grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full justify-between"
                                        onClick={() => setCreateScheduleBuilderOpen(true)}
                                    >
                                        <span className="flex items-center gap-2">
                                            <CalendarDays className="w-4 h-4" />
                                            Календарь недели
                                        </span>
                                        <span className="text-xs text-[var(--color-text-3)]">
                                            {createWeekdaysSorted.length ? `${createWeekdaysSorted.length} дней` : "Открыть"}
                                        </span>
                                    </Button>
                                    <Input
                                        type="time"
                                        value={createDefaultTime}
                                        onChange={(e) => {
                                            const nextTime = e.target.value
                                            setCreateDefaultTime(nextTime)
                                            if (!createWeekdays.length) return
                                            setCreateWeekdayTimes((prev) => {
                                                const next = { ...prev }
                                                createWeekdays.forEach((day) => {
                                                    next[day] = nextTime
                                                })
                                                return next
                                            })
                                        }}
                                    />
                                    <Button
                                        variant="outline"
                                        disabled={createScheduleDates.length === 0}
                                        onClick={applyCreateSchedulePreview}
                                    >
                                        Сформировать
                                    </Button>
                                </div>
                                {createWeekdaysSorted.length > 0 && (
                                    <>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {createWeekdaysSorted.map((day) => {
                                                const meta = weekDayMeta.find((m) => m.id === day)
                                                const label = meta?.short || String(day)
                                                const time = createWeekdayTimes[day] || createDefaultTime
                                                return (
                                                    <div key={day} className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-1)] bg-[var(--color-surface-2)] px-3 py-1 text-xs">
                                                        <span className="text-[var(--color-text-2)]">{label}</span>
                                                        <span className="font-medium text-[var(--color-text-1)]">{time}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <div className="mt-2 text-xs text-[var(--color-text-3)]">
                                            Пример: {formatSchedulePreview(createScheduleDates, createScheduleTimes, createDefaultTime)}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Описание</label>
                            <textarea
                                value={createData.description}
                                onChange={(e) => setCreateData((prev) => ({ ...prev, description: e.target.value }))}
                                className="w-full min-h-[84px] rounded-md border border-[var(--color-border-1)] bg-[var(--color-surface-1)] p-2 text-sm"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium">Макс. учеников</label>
                                <Input
                                    type="number"
                                    value={createData.maxStudents}
                                    onChange={(e) => setCreateData((prev) => ({ ...prev, maxStudents: Number(e.target.value) || 0 }))}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Ментор</label>
                                <Select value={createData.mentorId} onValueChange={(value) => setCreateData((prev) => ({ ...prev, mentorId: value }))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Без ментора" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Без ментора</SelectItem>
                                        {mentors.map(m => (
                                            <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Статус</label>
                            <Select value={createData.isActive ? "active" : "paused"} onValueChange={(value) => setCreateData((prev) => ({ ...prev, isActive: value === "active" }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Активна</SelectItem>
                                    <SelectItem value="paused">Пауза</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Отмена</Button>
                            <Button className="flex-1" onClick={handleCreateGroup} disabled={submitting}>
                                {submitting ? "Создание..." : "Создать"}
                            </Button>
                        </div>
                    </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create Schedule Builder */}
            <Dialog open={createScheduleBuilderOpen} onOpenChange={setCreateScheduleBuilderOpen}>
                <DialogContent className="w-[min(1600px,98vw)] max-w-[98vw] h-[94vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader className="px-6 py-4 border-b border-[var(--color-border-1)]">
                        <DialogTitle className="text-base">Календарь недели</DialogTitle>
                        <div className="text-xs text-[var(--color-text-3)] mt-1">
                            Выберите дни недели, задайте время и сразу увидите занятые слоты.
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden">
                        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] h-full">
                            <aside className="border-b xl:border-b-0 xl:border-r border-[var(--color-border-1)] p-4 md:p-5 overflow-auto space-y-5">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-medium text-[var(--color-text-1)]">Неделя</div>
                                        {createBusyLoading && <div className="text-xs text-[var(--color-text-3)]">Загрузка…</div>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button type="button" variant="outline" size="sm" onClick={() => shiftWeek(createWeekStart, -1, setCreateWeekStart)}>
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => resetToCurrentWeek(setCreateWeekStart)}>
                                            Текущая
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => shiftWeek(createWeekStart, 1, setCreateWeekStart)}>
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <div className="text-xs text-[var(--color-text-3)]">{formatWeekRange(createWeekStart)}</div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-sm font-medium text-[var(--color-text-1)]">Дни недели (мультивыбор)</div>
                                    <div className="space-y-2">
                                        {weekDayMeta.map((day) => {
                                            const active = createWeekdays.includes(day.id)
                                            const timeValue = createWeekdayTimes[day.id] || createDefaultTime
                                            const date = createWeekdayDateMap.get(day.id)
                                            const dateLabel = date ? date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) : ""
                                            return (
                                                <div key={day.id} className={cn(
                                                    "rounded-lg border border-[var(--color-border-1)] p-2.5 space-y-2",
                                                    active ? "bg-[var(--color-surface-2)]" : "bg-transparent"
                                                )}>
                                                    <button
                                                        type="button"
                                                        className="w-full flex items-center justify-between text-sm"
                                                        onClick={() => toggleWeekday(day.id, createWeekdays, setCreateWeekdays)}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <span className={cn(
                                                                "inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-xs",
                                                                active ? "border-[var(--color-accent)] text-[var(--color-text-1)]" : "border-[var(--color-border-1)] text-[var(--color-text-3)]"
                                                            )}>
                                                                {day.short}
                                                            </span>
                                                            <span className={active ? "text-[var(--color-text-1)]" : "text-[var(--color-text-2)]"}>{day.label}</span>
                                                        </span>
                                                        <span className="text-xs text-[var(--color-text-3)]">{dateLabel}</span>
                                                    </button>
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-4 h-4 text-[var(--color-text-3)]" />
                                                        <Input
                                                            type="time"
                                                            value={timeValue}
                                                            disabled={!active}
                                                            onChange={(e) => setWeekdayTime(
                                                                day.id,
                                                                e.target.value,
                                                                createWeekdays,
                                                                setCreateWeekdays,
                                                                setCreateWeekdayTimes,
                                                                setCreateDefaultTime
                                                            )}
                                                            className="h-9"
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs text-[var(--color-text-3)]">Время по умолчанию</div>
                                    <Input
                                        type="time"
                                        value={createDefaultTime}
                                        onChange={(e) => {
                                            const nextTime = e.target.value
                                            setCreateDefaultTime(nextTime)
                                            if (!createWeekdays.length) return
                                            setCreateWeekdayTimes((prev) => {
                                                const next = { ...prev }
                                                createWeekdays.forEach((day) => { next[day] = nextTime })
                                                return next
                                            })
                                        }}
                                    />
                                </div>

                                <div className="space-y-2 text-xs">
                                    <div className="text-[var(--color-text-3)]">Легенда</div>
                                    <div className="flex items-center gap-2 text-[var(--color-text-2)]">
                                        <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-accent)]/70" />
                                        Ваше новое расписание
                                    </div>
                                    <div className="flex items-center gap-2 text-[var(--color-text-2)]">
                                        <span className="inline-block h-3 w-3 rounded-sm bg-red-500/70" />
                                        Время занято другими классами
                                    </div>
                                </div>
                            </aside>

                            <section className="p-4 md:p-6 overflow-hidden flex flex-col">
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div>
                                        <div className="text-sm font-medium text-[var(--color-text-1)]">Сетка недели</div>
                                        <div className="text-xs text-[var(--color-text-3)]">{formatWeekRange(createWeekStart)}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button type="button" variant="outline" size="sm" onClick={() => shiftWeek(createWeekStart, -1, setCreateWeekStart)}>
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => shiftWeek(createWeekStart, 1, setCreateWeekStart)}>
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-auto rounded-xl border border-[var(--color-border-1)] bg-[var(--color-surface-1)]">
                                    <div className="min-w-[1100px]">
                                        <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] sticky top-0 z-10 bg-[var(--color-surface-2)] border-b border-[var(--color-border-1)]">
                                            <div className="px-3 py-2 text-xs text-[var(--color-text-3)]">Время</div>
                                            {createWeekDates.map((date) => {
                                                const meta = weekDayMeta.find((m) => m.id === date.getDay())
                                                const dayLabel = meta?.short || date.toLocaleDateString("ru-RU", { weekday: "short" })
                                                const dateLabel = date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
                                                return (
                                                    <div key={dateKey(date)} className="px-2 py-2 text-xs border-l border-[var(--color-border-1)]">
                                                        <div className="text-[var(--color-text-1)] font-medium">{dayLabel}</div>
                                                        <div className="text-[var(--color-text-3)]">{dateLabel}</div>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {timeSlots.map((slot) => (
                                            <div key={slot} className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] border-b border-[var(--color-border-1)]/60">
                                                <div className="px-3 py-2 text-xs text-[var(--color-text-3)] bg-[var(--color-surface-2)]/50">{slot}</div>
                                                {createWeekDates.map((date) => {
                                                    const dayId = date.getDay()
                                                    const slotKey = `${dayId}|${slot}`
                                                    const busyEvents = createBusySlotMap.get(slotKey) || []
                                                    const isBusy = busyEvents.length > 0
                                                    const isPlanned = createPlannedSlots.has(slotKey)
                                                    const isConflict = isBusy && isPlanned
                                                    const primaryBusy = busyEvents[0]
                                                    return (
                                                        <button
                                                            key={`${dateKey(date)}-${slot}`}
                                                            type="button"
                                                            onClick={() => setWeekdayTime(
                                                                dayId,
                                                                slot,
                                                                createWeekdays,
                                                                setCreateWeekdays,
                                                                setCreateWeekdayTimes,
                                                                setCreateDefaultTime
                                                            )}
                                                            className={cn(
                                                                "relative h-11 px-2 text-left border-l border-[var(--color-border-1)] transition-colors",
                                                                isBusy ? "bg-red-500/10 hover:bg-red-500/15" : "hover:bg-[var(--color-surface-2)]/70",
                                                                isPlanned ? "ring-1 ring-[var(--color-accent)]" : "",
                                                                isConflict ? "ring-red-400 bg-red-500/20" : ""
                                                            )}
                                                        >
                                                            {isPlanned && (
                                                                <div className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                                                            )}
                                                            {isBusy && (
                                                                <div className="text-[10px] leading-tight text-red-300 pr-3 truncate">
                                                                    {primaryBusy?.className}
                                                                    {busyEvents.length > 1 ? ` +${busyEvents.length - 1}` : ""}
                                                                </div>
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-[var(--color-border-1)] flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setCreateScheduleBuilderOpen(false)}>Отмена</Button>
                        <Button
                            onClick={() => {
                                applyCreateSchedulePreview()
                                setCreateScheduleBuilderOpen(false)
                            }}
                            disabled={createScheduleDates.length === 0}
                        >
                            Применить расписание
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Manage Group Dialog */}
            <Dialog open={!!managingGroup} onOpenChange={(open) => !open && setManagingGroup(null)}>
                <DialogContent className="w-[min(1500px,98vw)] max-w-[98vw] max-h-[94vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Управление группой{managingGroup ? `: ${managingGroup.name}` : ""}</DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto pr-1">
                        {detailLoading ? (
                            <div className="text-[var(--color-text-3)]">Загрузка данных группы...</div>
                        ) : groupDetail ? (
                            <div className="space-y-6 pb-1">
                            <div className="space-y-3">
                                <div className="text-sm font-medium">Параметры группы</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-[var(--color-text-3)]">Название группы</label>
                                        <Input value={editData.name} onChange={(e) => setEditData((prev) => ({ ...prev, name: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-[var(--color-text-3)]">Макс. учеников</label>
                                        <Input type="number" value={editData.maxStudents} onChange={(e) => setEditData((prev) => ({ ...prev, maxStudents: Number(e.target.value) || 0 }))} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-[var(--color-text-3)]">Ставка за урок ₸</label>
                                        <Input type="number" value={editData.wagePerLesson} onChange={(e) => setEditData((prev) => ({ ...prev, wagePerLesson: Number(e.target.value) || 0 }))} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-[var(--color-text-3)]">Расписание</label>
                                        <Input value={editData.scheduleDescription} onChange={(e) => setEditData((prev) => ({ ...prev, scheduleDescription: e.target.value }))} />
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {schedulePresets.map((preset) => (
                                                <Button
                                                    key={preset.id}
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => applyEditPreset(preset)}
                                                >
                                                    {preset.label}
                                                </Button>
                                            ))}
                                        </div>
                                        <div className="mt-2 grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full justify-between"
                                                onClick={() => setEditScheduleBuilderOpen(true)}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <CalendarDays className="w-4 h-4" />
                                                    Календарь недели
                                                </span>
                                                <span className="text-xs text-[var(--color-text-3)]">
                                                    {editWeekdaysSorted.length ? `${editWeekdaysSorted.length} дней` : "Открыть"}
                                                </span>
                                            </Button>
                                            <Input
                                                type="time"
                                                value={editDefaultTime}
                                                onChange={(e) => {
                                                    const nextTime = e.target.value
                                                    setEditDefaultTime(nextTime)
                                                    if (!editWeekdays.length) return
                                                    setEditWeekdayTimes((prev) => {
                                                        const next = { ...prev }
                                                        editWeekdays.forEach((day) => {
                                                            next[day] = nextTime
                                                        })
                                                        return next
                                                    })
                                                }}
                                            />
                                            <Button
                                                variant="outline"
                                                disabled={editScheduleDates.length === 0}
                                                onClick={applyEditSchedulePreview}
                                            >
                                                Сформировать
                                            </Button>
                                        </div>
                                        {editWeekdaysSorted.length > 0 && (
                                            <>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {editWeekdaysSorted.map((day) => {
                                                        const meta = weekDayMeta.find((m) => m.id === day)
                                                        const label = meta?.short || String(day)
                                                        const time = editWeekdayTimes[day] || editDefaultTime
                                                        return (
                                                            <div key={day} className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-1)] bg-[var(--color-surface-2)] px-3 py-1 text-xs">
                                                                <span className="text-[var(--color-text-2)]">{label}</span>
                                                                <span className="font-medium text-[var(--color-text-1)]">{time}</span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                                <div className="mt-2 text-xs text-[var(--color-text-3)]">
                                                    Пример: {formatSchedulePreview(editScheduleDates, editScheduleTimes, editDefaultTime)}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-[var(--color-text-3)]">Описание</label>
                                    <textarea
                                        value={editData.description}
                                        onChange={(e) => setEditData((prev) => ({ ...prev, description: e.target.value }))}
                                        className="w-full min-h-[84px] rounded-md border border-[var(--color-border-1)] bg-[var(--color-surface-1)] p-2 text-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-[var(--color-text-3)]">Статус</label>
                                        <Select value={editData.isActive ? "active" : "paused"} onValueChange={(value) => setEditData((prev) => ({ ...prev, isActive: value === "active" }))}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="active">Активна</SelectItem>
                                                <SelectItem value="paused">Пауза</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-end">
                                        <Button className="w-full" onClick={handleSaveGroup} disabled={submitting}>
                                            {submitting ? "Сохранение..." : "Сохранить изменения"}
                                        </Button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-[var(--color-text-3)]">Ментор</label>
                                    <Select value={editData.mentorId} onValueChange={(value) => setEditData((prev) => ({ ...prev, mentorId: value }))}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Без ментора" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Без ментора</SelectItem>
                                            {mentors.map(m => (
                                                <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="text-sm font-medium">Добавить ученика</div>
                                <Input
                                    placeholder="Поиск ученика по имени или эл. почте..."
                                    value={studentSearch}
                                    onChange={e => setStudentSearch(e.target.value)}
                                />
                                {studentOptions.length > 0 && (
                                    <div className="border rounded bg-[var(--color-surface-2)]">
                                        {studentOptions.map(s => (
                                            <div key={s.id} className="p-2 hover:bg-[var(--color-bg)] cursor-pointer flex justify-between"
                                                onClick={() => handleAssignStudent(s.id)}
                                            >
                                                <div>
                                                    <div className="text-sm text-[var(--color-text-1)]">{s.fullName}</div>
                                                    <div className="text-xs text-[var(--color-text-3)]">{s.email}</div>
                                                </div>
                                                <UserPlus className="w-4 h-4" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div className="text-sm font-medium">Ученики</div>
                                {groupDetail.enrollments.length === 0 ? (
                                    <div className="text-sm text-[var(--color-text-3)]">Нет учеников.</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-lg border border-[var(--color-border-1)] p-2">
                                        {groupDetail.enrollments.map((e) => (
                                            <div key={e.id} className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border-1)] bg-[var(--color-surface-2)] px-3 py-2 text-sm">
                                                <div className="min-w-0">
                                                    <div className="truncate text-[var(--color-text-1)]">{e.user.fullName}</div>
                                                    <div className="truncate text-xs text-[var(--color-text-3)]">{e.user.email}</div>
                                                </div>
                                                <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleRemoveStudent(e.user.id)}>
                                                    Удалить
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div className="text-sm font-medium">Перевод ученика</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-[var(--color-text-3)]">Ученик</label>
                                        <Select value={migrateStudentId} onValueChange={setMigrateStudentId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Выберите ученика" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {groupDetail.enrollments.map((e) => (
                                                    <SelectItem key={e.user.id} value={e.user.id}>{e.user.fullName}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-[var(--color-text-3)]">Целевая группа</label>
                                        <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Выберите группу" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {groups.filter((g) => g.id !== groupDetail.id).map((g) => (
                                                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <Button variant="outline" onClick={handleMigrateStudent}>
                                    <ArrowRightLeft className="w-4 h-4 mr-2" /> Перевести ученика
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium text-red-400">Удаление группы</div>
                                <Button variant="destructive" onClick={handleDeleteGroup}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Удалить группу
                                </Button>
                            </div>
                            </div>
                        ) : (
                            <div className="text-[var(--color-text-3)]">Группа не найдена.</div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Schedule Builder */}
            <Dialog open={editScheduleBuilderOpen} onOpenChange={setEditScheduleBuilderOpen}>
                <DialogContent className="w-[min(1600px,98vw)] max-w-[98vw] h-[94vh] overflow-hidden flex flex-col p-0">
                    <DialogHeader className="px-6 py-4 border-b border-[var(--color-border-1)]">
                        <DialogTitle className="text-base">Календарь недели</DialogTitle>
                        <div className="text-xs text-[var(--color-text-3)] mt-1">
                            Редактируйте дни и время, сразу видя занятые слоты.
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden">
                        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] h-full">
                            <aside className="border-b xl:border-b-0 xl:border-r border-[var(--color-border-1)] p-4 md:p-5 overflow-auto space-y-5">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-medium text-[var(--color-text-1)]">Неделя</div>
                                        {editBusyLoading && <div className="text-xs text-[var(--color-text-3)]">Загрузка…</div>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button type="button" variant="outline" size="sm" onClick={() => shiftWeek(editWeekStart, -1, setEditWeekStart)}>
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => resetToCurrentWeek(setEditWeekStart)}>
                                            Текущая
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => shiftWeek(editWeekStart, 1, setEditWeekStart)}>
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <div className="text-xs text-[var(--color-text-3)]">{formatWeekRange(editWeekStart)}</div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-sm font-medium text-[var(--color-text-1)]">Дни недели (мультивыбор)</div>
                                    <div className="space-y-2">
                                        {weekDayMeta.map((day) => {
                                            const active = editWeekdays.includes(day.id)
                                            const timeValue = editWeekdayTimes[day.id] || editDefaultTime
                                            const date = editWeekdayDateMap.get(day.id)
                                            const dateLabel = date ? date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) : ""
                                            return (
                                                <div key={day.id} className={cn(
                                                    "rounded-lg border border-[var(--color-border-1)] p-2.5 space-y-2",
                                                    active ? "bg-[var(--color-surface-2)]" : "bg-transparent"
                                                )}>
                                                    <button
                                                        type="button"
                                                        className="w-full flex items-center justify-between text-sm"
                                                        onClick={() => toggleWeekday(day.id, editWeekdays, setEditWeekdays)}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <span className={cn(
                                                                "inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-xs",
                                                                active ? "border-[var(--color-accent)] text-[var(--color-text-1)]" : "border-[var(--color-border-1)] text-[var(--color-text-3)]"
                                                            )}>
                                                                {day.short}
                                                            </span>
                                                            <span className={active ? "text-[var(--color-text-1)]" : "text-[var(--color-text-2)]"}>{day.label}</span>
                                                        </span>
                                                        <span className="text-xs text-[var(--color-text-3)]">{dateLabel}</span>
                                                    </button>
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="w-4 h-4 text-[var(--color-text-3)]" />
                                                        <Input
                                                            type="time"
                                                            value={timeValue}
                                                            disabled={!active}
                                                            onChange={(e) => setWeekdayTime(
                                                                day.id,
                                                                e.target.value,
                                                                editWeekdays,
                                                                setEditWeekdays,
                                                                setEditWeekdayTimes,
                                                                setEditDefaultTime
                                                            )}
                                                            className="h-9"
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs text-[var(--color-text-3)]">Время по умолчанию</div>
                                    <Input
                                        type="time"
                                        value={editDefaultTime}
                                        onChange={(e) => {
                                            const nextTime = e.target.value
                                            setEditDefaultTime(nextTime)
                                            if (!editWeekdays.length) return
                                            setEditWeekdayTimes((prev) => {
                                                const next = { ...prev }
                                                editWeekdays.forEach((day) => { next[day] = nextTime })
                                                return next
                                            })
                                        }}
                                    />
                                </div>

                                <div className="space-y-2 text-xs">
                                    <div className="text-[var(--color-text-3)]">Легенда</div>
                                    <div className="flex items-center gap-2 text-[var(--color-text-2)]">
                                        <span className="inline-block h-3 w-3 rounded-sm bg-[var(--color-accent)]/70" />
                                        Ваше расписание
                                    </div>
                                    <div className="flex items-center gap-2 text-[var(--color-text-2)]">
                                        <span className="inline-block h-3 w-3 rounded-sm bg-red-500/70" />
                                        Занято другими классами
                                    </div>
                                </div>
                            </aside>

                            <section className="p-4 md:p-6 overflow-hidden flex flex-col">
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div>
                                        <div className="text-sm font-medium text-[var(--color-text-1)]">Сетка недели</div>
                                        <div className="text-xs text-[var(--color-text-3)]">{formatWeekRange(editWeekStart)}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button type="button" variant="outline" size="sm" onClick={() => shiftWeek(editWeekStart, -1, setEditWeekStart)}>
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => shiftWeek(editWeekStart, 1, setEditWeekStart)}>
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-auto rounded-xl border border-[var(--color-border-1)] bg-[var(--color-surface-1)]">
                                    <div className="min-w-[1100px]">
                                        <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] sticky top-0 z-10 bg-[var(--color-surface-2)] border-b border-[var(--color-border-1)]">
                                            <div className="px-3 py-2 text-xs text-[var(--color-text-3)]">Время</div>
                                            {editWeekDates.map((date) => {
                                                const meta = weekDayMeta.find((m) => m.id === date.getDay())
                                                const dayLabel = meta?.short || date.toLocaleDateString("ru-RU", { weekday: "short" })
                                                const dateLabel = date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
                                                return (
                                                    <div key={dateKey(date)} className="px-2 py-2 text-xs border-l border-[var(--color-border-1)]">
                                                        <div className="text-[var(--color-text-1)] font-medium">{dayLabel}</div>
                                                        <div className="text-[var(--color-text-3)]">{dateLabel}</div>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {timeSlots.map((slot) => (
                                            <div key={slot} className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] border-b border-[var(--color-border-1)]/60">
                                                <div className="px-3 py-2 text-xs text-[var(--color-text-3)] bg-[var(--color-surface-2)]/50">{slot}</div>
                                                {editWeekDates.map((date) => {
                                                    const dayId = date.getDay()
                                                    const slotKey = `${dayId}|${slot}`
                                                    const rawBusyEvents = editBusySlotMap.get(slotKey) || []
                                                    const busyEvents = managingGroup
                                                        ? rawBusyEvents.filter((e) => e.classId !== managingGroup.id)
                                                        : rawBusyEvents
                                                    const isBusy = busyEvents.length > 0
                                                    const isPlanned = editPlannedSlots.has(slotKey)
                                                    const isConflict = isBusy && isPlanned
                                                    const primaryBusy = busyEvents[0]
                                                    return (
                                                        <button
                                                            key={`${dateKey(date)}-${slot}`}
                                                            type="button"
                                                            onClick={() => setWeekdayTime(
                                                                dayId,
                                                                slot,
                                                                editWeekdays,
                                                                setEditWeekdays,
                                                                setEditWeekdayTimes,
                                                                setEditDefaultTime
                                                            )}
                                                            className={cn(
                                                                "relative h-11 px-2 text-left border-l border-[var(--color-border-1)] transition-colors",
                                                                isBusy ? "bg-red-500/10 hover:bg-red-500/15" : "hover:bg-[var(--color-surface-2)]/70",
                                                                isPlanned ? "ring-1 ring-[var(--color-accent)]" : "",
                                                                isConflict ? "ring-red-400 bg-red-500/20" : ""
                                                            )}
                                                        >
                                                            {isPlanned && (
                                                                <div className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                                                            )}
                                                            {isBusy && (
                                                                <div className="text-[10px] leading-tight text-red-300 pr-3 truncate">
                                                                    {primaryBusy?.className}
                                                                    {busyEvents.length > 1 ? ` +${busyEvents.length - 1}` : ""}
                                                                </div>
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-[var(--color-border-1)] flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setEditScheduleBuilderOpen(false)}>Отмена</Button>
                        <Button
                            onClick={() => {
                                applyEditSchedulePreview()
                                setEditScheduleBuilderOpen(false)
                            }}
                            disabled={editScheduleDates.length === 0}
                        >
                            Применить расписание
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
