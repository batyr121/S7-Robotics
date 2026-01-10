"use client"
import { useState, useEffect } from "react"
import { Plus, Users, QrCode, UserPlus, MoreVertical, Trash2, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { apiFetch } from "@/lib/api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface GroupsTabProps {
    user: any
}

interface Group {
    id: string
    name: string
    kruzhokTitle: string
    studentsCount: number
    schedule?: string
    nextLesson?: string
}

export default function GroupsTab({ user }: GroupsTabProps) {
    const [groups, setGroups] = useState<Group[]>([])
    const [loading, setLoading] = useState(true)

    // Create Group State
    const [createGroupOpen, setCreateGroupOpen] = useState(false)
    const [newGroupName, setNewGroupName] = useState("")
    const [selectedKruzhokId, setSelectedKruzhokId] = useState("")
    const [createGroupLoading, setCreateGroupLoading] = useState(false)
    const [kruzhokOptions, setKruzhokOptions] = useState<{ id: string, title: string }[]>([])

    const loadGroups = async () => {
        setLoading(true)
        try {
            const data = await apiFetch<Group[]>("/mentor/groups")
            setGroups(data || [])
        } catch (err) {
            console.error("Failed to load groups", err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadGroups()
    }, [])

    // Load kruzhoks for dropdown
    useEffect(() => {
        const fetchKruzhoks = async () => {
            try {
                const res = await apiFetch<any[]>("/mentor/my-kruzhoks")
                // Extract unique kruzhoks
                const unique = res.map(k => ({ id: k.id, title: k.title }))
                setKruzhokOptions(unique)
                if (unique.length > 0) setSelectedKruzhokId(unique[0].id)
            } catch (e) { console.error(e) }
        }
        if (createGroupOpen) fetchKruzhoks()
    }, [createGroupOpen])

    const handleCreateGroup = async () => {
        if (!newGroupName || !selectedKruzhokId) return
        setCreateGroupLoading(true)
        try {
            await apiFetch("/mentor/class", {
                method: "POST",
                body: JSON.stringify({ name: newGroupName, kruzhokId: selectedKruzhokId })
            })
            setCreateGroupOpen(false)
            setNewGroupName("")
            loadGroups()
        } catch (err: any) {
            console.error(err)
            // optional: show toast
        } finally {
            setCreateGroupLoading(false)
        }
    }

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-[var(--color-text-1)]">My groups</h2>
                    <Badge className="bg-[#00a3ff]/20 text-[#00a3ff]">
                        {groups.length} {groups.length === 1 ? "group" : "groups"}
                    </Badge>
                </div>
                <Button
                    onClick={() => setCreateGroupOpen(true)}
                    className="bg-[#00a3ff] text-white hover:bg-[#0088cc] gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Create Group
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-10 text-[var(--color-text-3)]">Loading groups...</div>
            ) : groups.length === 0 ? (
                <div className="text-center py-12 bg-[var(--color-surface-2)] rounded-xl border border-[var(--color-border-1)]">
                    <div className="w-16 h-16 bg-black/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-[var(--color-text-3)]" />
                    </div>
                    <h3 className="text-lg font-medium text-[var(--color-text-1)] mb-2">No groups yet</h3>
                    <p className="text-[var(--color-text-3)] max-w-sm mx-auto mb-6">
                        Create your first group to start managing students and lessons.
                    </p>
                    <Button onClick={() => setCreateGroupOpen(true)} variant="outline">
                        Create a Group
                    </Button>
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
                                    {group.studentsCount} students
                                </div>
                                {group.schedule && (
                                    <div className="flex items-center text-sm text-[var(--color-text-3)]">
                                        <Calendar className="w-4 h-4 mr-2" />
                                        {group.schedule}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 pt-4 border-t border-[var(--color-border-1)]">
                                <Button variant="outline" size="sm" className="flex-1 text-xs">
                                    View Details
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="w-4 h-4 text-[var(--color-text-3)]" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
                <DialogContent className="sm:max-w-md bg-[var(--color-bg)] border-[var(--color-border-1)] text-[var(--color-text-1)]">
                    <DialogHeader>
                        <DialogTitle>Create New Group</DialogTitle>
                        <DialogDescription className="text-[var(--color-text-3)]">
                            Add a new class to one of your programs.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <label className="text-sm text-[var(--color-text-3)] mb-1 block">Program / Kruzhok</label>
                            <select
                                value={selectedKruzhokId}
                                onChange={(e) => setSelectedKruzhokId(e.target.value)}
                                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-3 py-2 text-[var(--color-text-1)] outline-none focus:ring-1 focus:ring-[#00a3ff]"
                            >
                                <option value="" disabled>Select a program...</option>
                                {kruzhokOptions.map(k => (
                                    <option key={k.id} value={k.id}>{k.title}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm text-[var(--color-text-3)] mb-1 block">Group Name</label>
                            <Input
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder="e.g. Group A, Senior Class"
                                className="bg-[var(--color-surface-2)] border-[var(--color-border-1)]"
                            />
                        </div>
                        <Button
                            onClick={handleCreateGroup}
                            disabled={createGroupLoading || !newGroupName || !selectedKruzhokId}
                            className="w-full bg-[#00a3ff] text-white hover:bg-[#0088cc]"
                        >
                            {createGroupLoading ? "Creating..." : "Create Group"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
