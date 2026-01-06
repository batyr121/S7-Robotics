"use client"
import { useState, useEffect } from "react"
import { Search, Edit, UserPlus, Users, Save, X, Plus } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
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
    kruzhok: { title: string }
    mentor: { id: string, fullName: string } | null
    _count: { students: number }
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
            toast({ title: "Успешно", description: "Пользователь обновлен" })
            setEditingUser(null)
            fetchUsers()
        } catch (err) {
            toast({ title: "Ошибка", description: "Не удалось сохранить", variant: "destructive" })
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input
                    placeholder="Поиск по имени или email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="max-w-md bg-[var(--color-surface-1)] border-[var(--color-border-1)]"
                />
            </div>

            <div className="rounded-xl border border-[var(--color-border-1)] overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-[var(--color-surface-2)] text-[var(--color-text-2)]">
                        <tr>
                            <th className="p-3">Имя</th>
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
                                    <div className="font-medium">{u.fullName}</div>
                                    <div className="text-xs text-[var(--color-text-3)]">{u.email}</div>
                                </td>
                                <td className="p-3">
                                    <span className={cn(
                                        "px-2 py-0.5 rounded text-xs font-medium",
                                        u.role === 'ADMIN' ? "bg-red-500/20 text-red-500" :
                                            u.role === 'MENTOR' ? "bg-purple-500/20 text-purple-500" :
                                                u.role === 'STUDENT' ? "bg-blue-500/20 text-blue-500" :
                                                    "bg-gray-500/20 text-gray-500"
                                    )}>
                                        {u.role}
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
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                <div className="flex items-center text-sm">{page} / {totalPages}</div>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
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
                                    <SelectItem value="USER">User</SelectItem>
                                    <SelectItem value="STUDENT">Student</SelectItem>
                                    <SelectItem value="PARENT">Parent</SelectItem>
                                    <SelectItem value="MENTOR">Mentor</SelectItem>
                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Parent Linking (Only for Students usually, but generic here) */}
                        <div>
                            <label className="text-sm font-medium">Привязать Родителя (ID: {editParentId || 'нет'})</label>
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
                                    Отвязать родителя
                                </Button>
                            )}
                        </div>

                        <Button onClick={handleEditSave} className="w-full">Сохранить</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// --- CLASSES TAB ---
export function ClassesTab() {
    const [groups, setGroups] = useState<Group[]>([])
    const { toast } = useToast()

    // Assign State
    const [assigningGroup, setAssigningGroup] = useState<Group | null>(null)
    const [studentSearch, setStudentSearch] = useState("")
    const [studentOptions, setStudentOptions] = useState<User[]>([])

    // Mentor Assign
    const [mentorSearch, setMentorSearch] = useState("")
    const [mentorOptions, setMentorOptions] = useState<User[]>([])

    const fetchGroups = async () => {
        try {
            const res = await apiFetch<any>("/admin/groups")
            setGroups(res.groups || [])
        } catch (err) { }
    }

    useEffect(() => { fetchGroups() }, [])

    // Student Search Effect
    useEffect(() => {
        if (!studentSearch) { setStudentOptions([]); return }
        const t = setTimeout(async () => {
            const res = await apiFetch<any>(`/admin/users?search=${studentSearch}&role=STUDENT&limit=5`)
            setStudentOptions(res.users)
        }, 300)
        return () => clearTimeout(t)
    }, [studentSearch])

    // Mentor Search Effect
    useEffect(() => {
        if (!mentorSearch) { setMentorOptions([]); return }
        const t = setTimeout(async () => {
            const res = await apiFetch<any>(`/admin/users?search=${mentorSearch}&role=MENTOR&limit=5`)
            setMentorOptions(res.users)
        }, 300)
        return () => clearTimeout(t)
    }, [mentorSearch])

    const handleAssignStudent = async (studentId: string) => {
        if (!assigningGroup) return
        try {
            await apiFetch(`/admin/groups/${assigningGroup.id}/assign`, {
                method: "POST",
                body: JSON.stringify({ studentId })
            })
            toast({ title: "Успешно", description: "Ученик добавлен" })
            setStudentSearch("")
            fetchGroups()
        } catch (err) {
            toast({ title: "Ошибка", variant: "destructive" })
        }
    }

    const handleSetMentor = async (mentorId: string) => {
        if (!assigningGroup) return
        try {
            await apiFetch(`/admin/groups/${assigningGroup.id}/set-mentor`, {
                method: "POST",
                body: JSON.stringify({ mentorId })
            })
            toast({ title: "Успешно", description: "Ментор назначен" })
            setMentorSearch("")
            fetchGroups()
        } catch (err) {
            toast({ title: "Ошибка", variant: "destructive" })
        }
    }

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-[var(--color-border-1)] overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-[var(--color-surface-2)]">
                        <tr>
                            <th className="p-3">Группа</th>
                            <th className="p-3">Ментор</th>
                            <th className="p-3">Учеников</th>
                            <th className="p-3 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-1)]">
                        {groups.map(g => (
                            <tr key={g.id} className="hover:bg-[var(--color-surface-1)]">
                                <td className="p-3 font-medium">{g.kruzhok.title}</td>
                                <td className="p-3 text-[var(--color-text-3)]">{g.mentor?.fullName || "-"}</td>
                                <td className="p-3 text-[var(--color-text-3)]">{g._count.students}</td>
                                <td className="p-3 text-right">
                                    <Button size="sm" variant="outline" onClick={() => setAssigningGroup(g)}>
                                        <Users className="w-4 h-4 mr-2" />
                                        Управление
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Dialog open={!!assigningGroup} onOpenChange={open => !open && setAssigningGroup(null)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Управление группой: {assigningGroup?.kruzhok.title}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                        {/* Mentor Assignment */}
                        <div>
                            <h4 className="text-sm font-medium mb-2">Ментор</h4>
                            <div className="flex gap-2 mb-2">
                                <div className="p-2 bg-[var(--color-surface-2)] rounded flex-1">
                                    {assigningGroup?.mentor?.fullName || "Не назначен"}
                                </div>
                            </div>
                            <Input placeholder="Найти и назначить ментора..." value={mentorSearch} onChange={e => setMentorSearch(e.target.value)} />
                            {mentorOptions.length > 0 && (
                                <div className="mt-2 border rounded bg-[var(--color-surface-2)]">
                                    {mentorOptions.map(m => (
                                        <div key={m.id} className="p-2 hover:bg-[var(--color-bg)] cursor-pointer flex justify-between"
                                            onClick={() => handleSetMentor(m.id)}
                                        >
                                            <span>{m.fullName}</span>
                                            <Plus className="w-4 h-4" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Add Student */}
                        <div>
                            <h4 className="text-sm font-medium mb-2">Добавить ученика</h4>
                            <Input placeholder="Найти ученика..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                            {studentOptions.length > 0 && (
                                <div className="mt-2 border rounded bg-[var(--color-surface-2)]">
                                    {studentOptions.map(s => (
                                        <div key={s.id} className="p-2 hover:bg-[var(--color-bg)] cursor-pointer flex justify-between"
                                            onClick={() => handleAssignStudent(s.id)}
                                        >
                                            <span>{s.fullName}</span>
                                            <UserPlus className="w-4 h-4" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
