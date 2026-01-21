"use client"
import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2, RefreshCw, BookOpen } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { useConfirm } from "@/components/ui/confirm"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface Program {
    id: string
    title: string
    description?: string
    isActive: boolean
    _count?: { kruzhoks: number; lessons: number }
    createdAt: string
}

export function ProgramsTab() {
    const [programs, setPrograms] = useState<Program[]>([])
    const [loading, setLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [editingProgram, setEditingProgram] = useState<Program | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const { toast } = useToast()
    const confirm = useConfirm()

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        isActive: true
    })

    const fetchPrograms = async () => {
        setLoading(true)
        try {
            const res = await apiFetch<Program[]>("/admin/programs")
            setPrograms(res)
        } catch (err) {
            toast({ title: "Error", description: "Failed to load programs", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPrograms()
    }, [])

    const resetForm = () => {
        setFormData({
            title: "",
            description: "",
            isActive: true
        })
    }

    const handleCreate = async () => {
        if (!formData.title.trim()) {
            toast({ title: "Error", description: "Title is required", variant: "destructive" })
            return
        }
        if (submitting) return
        setSubmitting(true)
        try {
            await apiFetch("/admin/programs", {
                method: "POST",
                body: JSON.stringify({
                    title: formData.title.trim(),
                    description: formData.description.trim() || undefined,
                    isActive: formData.isActive
                })
            })
            toast({ title: "Success", description: "Program created" })
            setCreateOpen(false)
            resetForm()
            fetchPrograms()
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to create program", variant: "destructive" })
        } finally {
            setSubmitting(false)
        }
    }

    const handleUpdate = async () => {
        if (!editingProgram || !formData.title.trim()) return
        if (submitting) return
        setSubmitting(true)
        try {
            await apiFetch(`/admin/programs/${editingProgram.id}`, {
                method: "PUT",
                body: JSON.stringify({
                    title: formData.title.trim(),
                    description: formData.description.trim() || undefined,
                    isActive: formData.isActive
                })
            })
            toast({ title: "Success", description: "Program updated" })
            setEditingProgram(null)
            resetForm()
            fetchPrograms()
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to update program", variant: "destructive" })
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        const ok = await confirm({
            title: "Delete Program",
            description: "This will delete the program. It may fail if kruzhoks are using it. Are you sure?"
        })
        if (!ok) return
        try {
            await apiFetch(`/admin/programs/${id}`, { method: "DELETE" })
            toast({ title: "Deleted", description: "Program removed" })
            fetchPrograms()
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" })
        }
    }

    const openEdit = (p: Program) => {
        setEditingProgram(p)
        setFormData({
            title: p.title,
            description: p.description || "",
            isActive: p.isActive
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#00a3ff]" />
                    Programs (Curricula)
                </h2>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchPrograms} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="bg-[#00a3ff] hover:bg-[#0088cc]" onClick={resetForm}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Program
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Program</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div>
                                    <Label>Title *</Label>
                                    <Input
                                        placeholder="Beginner Robotics"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Description</Label>
                                    <Textarea
                                        placeholder="Program description..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch checked={formData.isActive} onCheckedChange={(v) => setFormData({ ...formData, isActive: v })} />
                                    <Label>Active</Label>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                                <Button onClick={handleCreate} disabled={submitting}>
                                    {submitting ? "Creating..." : "Create"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingProgram} onOpenChange={(open) => !open && setEditingProgram(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Program</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Title *</Label>
                            <Input
                                placeholder="Beginner Robotics"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label>Description</Label>
                            <Textarea
                                placeholder="Program description..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch checked={formData.isActive} onCheckedChange={(v) => setFormData({ ...formData, isActive: v })} />
                            <Label>Active</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingProgram(null)}>Cancel</Button>
                        <Button onClick={handleUpdate} disabled={submitting}>
                            {submitting ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* List */}
            {loading ? (
                <div className="text-center py-12 text-[var(--color-text-3)]">Loading...</div>
            ) : programs.length === 0 ? (
                <Card className="p-12 text-center text-[var(--color-text-3)]">
                    No programs yet. Create one to get started with curriculum management.
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {programs.map((p) => (
                        <Card key={p.id} className="p-4 bg-[var(--color-surface-2)] border-[var(--color-border-1)]">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-semibold text-lg">{p.title}</h3>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(p.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                            {p.description && (
                                <p className="text-sm text-[var(--color-text-3)] mb-3 line-clamp-2">{p.description}</p>
                            )}
                            <div className="flex flex-wrap gap-2 mb-3">
                                <Badge variant={p.isActive ? "default" : "secondary"}>
                                    {p.isActive ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                            <div className="text-xs text-[var(--color-text-3)] flex justify-between">
                                <span>{p._count?.kruzhoks || 0} kruzhoks</span>
                                <span>{p._count?.lessons || 0} lessons</span>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
