"use client"
import { useState, useEffect } from "react"
import { Edit, UserPlus, Users, Plus, Trash2, RefreshCw, ArrowRightLeft } from "lucide-react"
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
    kruzhokId: string
    kruzhok: { id: string, title: string }
    _count: { enrollments: number }
}

interface GroupDetail {
    id: string
    name: string
    description?: string
    maxStudents: number
    isActive: boolean
    kruzhokId: string
    kruzhok: { id: string, title: string }
    enrollments: Array<{ id: string, user: { id: string, fullName: string, email: string } }>
}

interface ClubOption {
    id: string
    name: string
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
            toast({ title: "Error", description: "Failed to load users", variant: "destructive" })
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
            toast({ title: "Saved", description: "User updated" })
            setEditingUser(null)
            fetchUsers()
        } catch (err) {
            toast({ title: "Error", description: "Failed to update user", variant: "destructive" })
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="max-w-md bg-[var(--color-surface-1)] border-[var(--color-border-1)]"
                />
                {loading && <div className="text-xs text-[var(--color-text-3)] self-center">Loading...</div>}
            </div>

            <div className="rounded-xl border border-[var(--color-border-1)] overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-[var(--color-surface-2)] text-[var(--color-text-2)]">
                        <tr>
                            <th className="p-3">User</th>
                            <th className="p-3">Role</th>
                            <th className="p-3">Parent</th>
                            <th className="p-3">Children</th>
                            <th className="p-3 text-right">Actions</th>
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
                        <DialogTitle>Edit user</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Role</label>
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

                        {/* Parent Linking */}
                        <div>
                            <label className="text-sm font-medium">Link parent (ID: {editParentId || "none"})</label>
                            <Input
                                placeholder="Search parent..."
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
                                    Clear parent link
                                </Button>
                            )}
                        </div>

                        <Button onClick={handleEditSave} className="w-full">Save changes</Button>
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
    const [clubs, setClubs] = useState<ClubOption[]>([])
    const { toast } = useToast()
    const confirm = useConfirm()

    const [createOpen, setCreateOpen] = useState(false)
    const [createData, setCreateData] = useState({
        kruzhokId: "",
        name: "",
        description: "",
        maxStudents: 30,
        isActive: true
    })

    const [managingGroup, setManagingGroup] = useState<Group | null>(null)
    const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [editData, setEditData] = useState({
        name: "",
        description: "",
        maxStudents: 30,
        isActive: true
    })

    const [studentSearch, setStudentSearch] = useState("")
    const [studentOptions, setStudentOptions] = useState<User[]>([])
    const [migrateStudentId, setMigrateStudentId] = useState("")
    const [targetGroupId, setTargetGroupId] = useState("")

    const fetchGroups = async () => {
        setLoading(true)
        try {
            const res = await apiFetch<any>("/admin/groups")
            setGroups(res.groups || [])
        } catch (err) {
            toast({ title: "Error", description: "Failed to load groups", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    const fetchClubs = async () => {
        try {
            // Admin should see ALL programs (clubs)
            const list = await apiFetch<any[]>("/programs")
            // Map program title to name
            const mapped = list.map(p => ({ id: p.id, name: p.title }))
            setClubs(mapped)
            if (!createData.kruzhokId && mapped.length) {
                setCreateData((prev) => ({ ...prev, kruzhokId: mapped[0].id }))
            }
        } catch (err) {
            setClubs([])
        }
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
                isActive: detail.isActive
            })
        } catch (err) {
            setGroupDetail(null)
        } finally {
            setDetailLoading(false)
        }
    }

    useEffect(() => {
        fetchGroups()
        fetchClubs()
    }, [])

    useEffect(() => {
        if (!managingGroup) {
            setGroupDetail(null)
            setStudentSearch("")
            setStudentOptions([])
            setMigrateStudentId("")
            setTargetGroupId("")
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
        if (!createData.kruzhokId || !createData.name.trim()) {
            toast({ title: "Missing data", description: "Club and group name are required", variant: "destructive" })
            return
        }
        try {
            await apiFetch("/admin/groups", {
                method: "POST",
                body: JSON.stringify({
                    kruzhokId: createData.kruzhokId,
                    name: createData.name.trim(),
                    description: createData.description.trim() || undefined,
                    maxStudents: Number(createData.maxStudents) || 30,
                    isActive: createData.isActive
                })
            })
            toast({ title: "Group created" })
            setCreateOpen(false)
            setCreateData({ kruzhokId: createData.kruzhokId, name: "", description: "", maxStudents: 30, isActive: true })
            fetchGroups()
        } catch (err: any) {
            toast({ title: "Error", description: err?.message || "Failed to create group", variant: "destructive" })
        }
    }

    const handleSaveGroup = async () => {
        if (!managingGroup) return
        if (!editData.name.trim()) {
            toast({ title: "Missing data", description: "Group name is required", variant: "destructive" })
            return
        }
        try {
            await apiFetch(`/admin/groups/${managingGroup.id}` as any, {
                method: "PUT",
                body: JSON.stringify({
                    name: editData.name.trim(),
                    description: editData.description.trim() || undefined,
                    maxStudents: Number(editData.maxStudents) || 30,
                    isActive: editData.isActive
                })
            })
            toast({ title: "Group updated" })
            fetchGroups()
            fetchGroupDetail(managingGroup.id)
        } catch (err: any) {
            toast({ title: "Error", description: err?.message || "Failed to update group", variant: "destructive" })
        }
    }

    const handleDeleteGroup = async () => {
        if (!managingGroup) return
        const ok = await confirm({
            title: "Delete this group?",
            description: "This action cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel",
            variant: "danger"
        })
        if (!ok) return
        try {
            await apiFetch(`/admin/groups/${managingGroup.id}`, { method: "DELETE" })
            toast({ title: "Group deleted" })
            setManagingGroup(null)
            fetchGroups()
        } catch (err: any) {
            toast({ title: "Error", description: err?.message || "Failed to delete group", variant: "destructive" })
        }
    }

    const handleAssignStudent = async (studentId: string) => {
        if (!managingGroup) return
        try {
            await apiFetch(`/admin/groups/${managingGroup.id}/assign`, {
                method: "POST",
                body: JSON.stringify({ studentId })
            })
            toast({ title: "Student added" })
            setStudentSearch("")
            setStudentOptions([])
            fetchGroupDetail(managingGroup.id)
            fetchGroups()
        } catch (err: any) {
            toast({ title: "Error", description: err?.message || "Failed to add student", variant: "destructive" })
        }
    }

    const handleRemoveStudent = async (studentId: string) => {
        if (!managingGroup) return
        try {
            await apiFetch(`/admin/groups/${managingGroup.id}/remove`, {
                method: "POST",
                body: JSON.stringify({ studentId })
            })
            toast({ title: "Student removed" })
            fetchGroupDetail(managingGroup.id)
            fetchGroups()
        } catch (err: any) {
            toast({ title: "Error", description: err?.message || "Failed to remove student", variant: "destructive" })
        }
    }

    const handleMigrateStudent = async () => {
        if (!managingGroup) return
        if (!migrateStudentId || !targetGroupId) {
            toast({ title: "Missing data", description: "Select a student and target group", variant: "destructive" })
            return
        }
        try {
            await apiFetch(`/admin/groups/${managingGroup.id}/migrate-student`, {
                method: "POST",
                body: JSON.stringify({ studentId: migrateStudentId, targetClassId: targetGroupId })
            })
            toast({ title: "Student moved" })
            setMigrateStudentId("")
            setTargetGroupId("")
            fetchGroupDetail(managingGroup.id)
            fetchGroups()
        } catch (err: any) {
            toast({ title: "Error", description: err?.message || "Failed to move student", variant: "destructive" })
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-sm text-[var(--color-text-2)]">Groups</div>
                    <div className="text-xs text-[var(--color-text-3)]">Manage classes, rosters, and migrations.</div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchGroups}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                    </Button>
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> New group
                    </Button>
                </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border-1)] overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-[var(--color-surface-2)]">
                        <tr>
                            <th className="p-3">Group</th>
                            <th className="p-3">Club</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Students</th>
                            <th className="p-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-1)]">
                        {loading ? (
                            <tr>
                                <td className="p-3 text-[var(--color-text-3)]" colSpan={5}>Loading...</td>
                            </tr>
                        ) : groups.length === 0 ? (
                            <tr>
                                <td className="p-3 text-[var(--color-text-3)]" colSpan={5}>No groups yet.</td>
                            </tr>
                        ) : (
                            groups.map(g => (
                                <tr key={g.id} className="hover:bg-[var(--color-surface-1)]">
                                    <td className="p-3">
                                        <div className="font-medium text-[var(--color-text-1)]">{g.name}</div>
                                        <div className="text-xs text-[var(--color-text-3)]">{g.description || "No description"}</div>
                                    </td>
                                    <td className="p-3 text-[var(--color-text-3)]">{g.kruzhok?.title || "-"}</td>
                                    <td className="p-3">
                                        <span className={cn(
                                            "px-2 py-0.5 rounded text-xs font-medium",
                                            g.isActive ? "bg-green-500/20 text-green-500" : "bg-yellow-500/20 text-yellow-500"
                                        )}>
                                            {g.isActive ? "Active" : "Paused"}
                                        </span>
                                    </td>
                                    <td className="p-3 text-[var(--color-text-3)]">{g._count?.enrollments ?? 0} / {g.maxStudents}</td>
                                    <td className="p-3 text-right">
                                        <Button size="sm" variant="outline" onClick={() => setManagingGroup(g)}>
                                            <Users className="w-4 h-4 mr-2" /> Manage
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
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New group</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Club</label>
                            <Select value={createData.kruzhokId} onValueChange={(value) => setCreateData((prev) => ({ ...prev, kruzhokId: value }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a club" />
                                </SelectTrigger>
                                <SelectContent>
                                    {clubs.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Group name</label>
                            <Input value={createData.name} onChange={(e) => setCreateData((prev) => ({ ...prev, name: e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Description</label>
                            <textarea
                                value={createData.description}
                                onChange={(e) => setCreateData((prev) => ({ ...prev, description: e.target.value }))}
                                className="w-full min-h-[84px] rounded-md border border-[var(--color-border-1)] bg-[var(--color-surface-1)] p-2 text-sm"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium">Max students</label>
                                <Input
                                    type="number"
                                    value={createData.maxStudents}
                                    onChange={(e) => setCreateData((prev) => ({ ...prev, maxStudents: Number(e.target.value) || 0 }))}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Status</label>
                                <Select value={createData.isActive ? "active" : "paused"} onValueChange={(value) => setCreateData((prev) => ({ ...prev, isActive: value === "active" }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="paused">Paused</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancel</Button>
                            <Button className="flex-1" onClick={handleCreateGroup}>Create</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Manage Group Dialog */}
            <Dialog open={!!managingGroup} onOpenChange={(open) => !open && setManagingGroup(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Manage group{managingGroup ? `: ${managingGroup.name}` : ""}</DialogTitle>
                    </DialogHeader>

                    {detailLoading ? (
                        <div className="text-[var(--color-text-3)]">Loading group details...</div>
                    ) : groupDetail ? (
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <div className="text-sm font-medium">Group details</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-[var(--color-text-3)]">Group name</label>
                                        <Input value={editData.name} onChange={(e) => setEditData((prev) => ({ ...prev, name: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-[var(--color-text-3)]">Max students</label>
                                        <Input type="number" value={editData.maxStudents} onChange={(e) => setEditData((prev) => ({ ...prev, maxStudents: Number(e.target.value) || 0 }))} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-[var(--color-text-3)]">Description</label>
                                    <textarea
                                        value={editData.description}
                                        onChange={(e) => setEditData((prev) => ({ ...prev, description: e.target.value }))}
                                        className="w-full min-h-[84px] rounded-md border border-[var(--color-border-1)] bg-[var(--color-surface-1)] p-2 text-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-[var(--color-text-3)]">Status</label>
                                        <Select value={editData.isActive ? "active" : "paused"} onValueChange={(value) => setEditData((prev) => ({ ...prev, isActive: value === "active" }))}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="paused">Paused</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-end">
                                        <Button className="w-full" onClick={handleSaveGroup}>Save changes</Button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="text-sm font-medium">Add student</div>
                                <Input
                                    placeholder="Search student by name or email..."
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
                                <div className="text-sm font-medium">Students</div>
                                {groupDetail.enrollments.length === 0 ? (
                                    <div className="text-sm text-[var(--color-text-3)]">No students yet.</div>
                                ) : (
                                    <div className="divide-y divide-[var(--color-border-1)] rounded-lg border border-[var(--color-border-1)]">
                                        {groupDetail.enrollments.map((e) => (
                                            <div key={e.id} className="flex items-center justify-between p-3 text-sm">
                                                <div>
                                                    <div className="text-[var(--color-text-1)]">{e.user.fullName}</div>
                                                    <div className="text-xs text-[var(--color-text-3)]">{e.user.email}</div>
                                                </div>
                                                <Button size="sm" variant="outline" onClick={() => handleRemoveStudent(e.user.id)}>
                                                    Remove
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div className="text-sm font-medium">Migrate student</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-[var(--color-text-3)]">Student</label>
                                        <Select value={migrateStudentId} onValueChange={setMigrateStudentId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select student" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {groupDetail.enrollments.map((e) => (
                                                    <SelectItem key={e.user.id} value={e.user.id}>{e.user.fullName}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-[var(--color-text-3)]">Target group</label>
                                        <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select target" />
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
                                    <ArrowRightLeft className="w-4 h-4 mr-2" /> Move student
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium text-red-400">Danger zone</div>
                                <Button variant="destructive" onClick={handleDeleteGroup}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete group
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-[var(--color-text-3)]">Group not found.</div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
