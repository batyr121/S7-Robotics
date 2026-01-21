"use client"
import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2, RefreshCw, Building2 } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useConfirm } from "@/components/ui/confirm"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface Program {
    id: string
    title: string
}

interface Kruzhok {
    id: string
    title: string
    description?: string
    programId?: string | null
    program?: { id: string; title: string } | null
    isActive: boolean
    isFree: boolean
    price: number
    owner?: { id: string; fullName: string; email: string }
    _count?: { classes: number; subscriptions: number }
    createdAt: string
}

export function KruzhoksTab() {
    const [kruzhoks, setKruzhoks] = useState<Kruzhok[]>([])
    const [programs, setPrograms] = useState<Program[]>([])
    const [loading, setLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [editingKruzhok, setEditingKruzhok] = useState<Kruzhok | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const { toast } = useToast()
    const confirm = useConfirm()

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        programId: "none",
        isActive: true,
        isFree: false,
        price: 0
    })

    const fetchKruzhoks = async () => {
        setLoading(true)
        try {
            const res = await apiFetch<Kruzhok[]>("/admin/kruzhoks")
            setKruzhoks(res)
        } catch (err) {
            toast({ title: "Error", description: "Failed to load kruzhoks", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    const fetchPrograms = async () => {
        try {
            const res = await apiFetch<Program[]>("/admin/programs")
            setPrograms(res)
        } catch (err) { }
    }

    useEffect(() => {
        fetchKruzhoks()
        fetchPrograms()
    }, [])

    const resetForm = () => {
        setFormData({
            title: "",
            description: "",
            programId: "none",
            isActive: true,
            isFree: false,
            price: 0
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
            await apiFetch("/admin/kruzhoks", {
                method: "POST",
                body: JSON.stringify({
                    title: formData.title.trim(),
                    description: formData.description.trim() || undefined,
                    programId: formData.programId === "none" ? undefined : formData.programId,
                    isActive: formData.isActive,
                    isFree: formData.isFree,
                    price: formData.isFree ? 0 : Number(formData.price)
                })
            })
            toast({ title: "Success", description: "Kruzhok created" })
            setCreateOpen(false)
            resetForm()
            fetchKruzhoks()
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to create kruzhok", variant: "destructive" })
        } finally {
            setSubmitting(false)
        }
    }

    const handleUpdate = async () => {
        if (!editingKruzhok || !formData.title.trim()) return
        if (submitting) return
        setSubmitting(true)
        try {
            await apiFetch(`/admin/kruzhoks/${editingKruzhok.id}`, {
                method: "PUT",
                body: JSON.stringify({
                    title: formData.title.trim(),
                    description: formData.description.trim() || undefined,
                    programId: formData.programId === "none" ? null : formData.programId,
                    isActive: formData.isActive,
                    isFree: formData.isFree,
                    price: formData.isFree ? 0 : Number(formData.price)
                })
            })
            toast({ title: "Success", description: "Kruzhok updated" })
            setEditingKruzhok(null)
            resetForm()
            fetchKruzhoks()
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to update kruzhok", variant: "destructive" })
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        const ok = await confirm({
            title: "Delete Kruzhok",
            description: "This will delete the kruzhok and may fail if it has classes. Are you sure?"
        })
        if (!ok) return
        try {
            await apiFetch(`/admin/kruzhoks/${id}`, { method: "DELETE" })
            toast({ title: "Deleted", description: "Kruzhok removed" })
            fetchKruzhoks()
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" })
        }
    }

    const openEdit = (k: Kruzhok) => {
        setEditingKruzhok(k)
        setFormData({
            title: k.title,
            description: k.description || "",
            programId: k.programId || "none",
            isActive: k.isActive,
            isFree: k.isFree,
            price: Number(k.price) || 0
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#00a3ff]" />
                    Kruzhoks (Clubs)
                </h2>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchKruzhoks} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="bg-[#00a3ff] hover:bg-[#0088cc]" onClick={resetForm}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Kruzhok
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Kruzhok</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div>
                                    <Label>Title *</Label>
                                    <Input
                                        placeholder="Robotics Club"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Description</Label>
                                    <Textarea
                                        placeholder="Description..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Program (optional)</Label>
                                    <Select value={formData.programId} onValueChange={(v) => setFormData({ ...formData, programId: v })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select program" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No program</SelectItem>
                                            {programs.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <Switch checked={formData.isActive} onCheckedChange={(v) => setFormData({ ...formData, isActive: v })} />
                                        <Label>Active</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch checked={formData.isFree} onCheckedChange={(v) => setFormData({ ...formData, isFree: v })} />
                                        <Label>Free</Label>
                                    </div>
                                </div>
                                {!formData.isFree && (
                                    <div>
                                        <Label>Price (KZT)</Label>
                                        <Input
                                            type="number"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                                        />
                                    </div>
                                )}
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
            <Dialog open={!!editingKruzhok} onOpenChange={(open) => !open && setEditingKruzhok(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Kruzhok</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Title *</Label>
                            <Input
                                placeholder="Robotics Club"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label>Description</Label>
                            <Textarea
                                placeholder="Description..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label>Program</Label>
                            <Select value={formData.programId} onValueChange={(v) => setFormData({ ...formData, programId: v })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select program" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No program</SelectItem>
                                    {programs.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Switch checked={formData.isActive} onCheckedChange={(v) => setFormData({ ...formData, isActive: v })} />
                                <Label>Active</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch checked={formData.isFree} onCheckedChange={(v) => setFormData({ ...formData, isFree: v })} />
                                <Label>Free</Label>
                            </div>
                        </div>
                        {!formData.isFree && (
                            <div>
                                <Label>Price (KZT)</Label>
                                <Input
                                    type="number"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingKruzhok(null)}>Cancel</Button>
                        <Button onClick={handleUpdate} disabled={submitting}>
                            {submitting ? "Saving..." : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* List */}
            {loading ? (
                <div className="text-center py-12 text-[var(--color-text-3)]">Loading...</div>
            ) : kruzhoks.length === 0 ? (
                <Card className="p-12 text-center text-[var(--color-text-3)]">
                    No kruzhoks yet. Create one to get started.
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {kruzhoks.map((k) => (
                        <Card key={k.id} className="p-4 bg-[var(--color-surface-2)] border-[var(--color-border-1)]">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-semibold text-lg">{k.title}</h3>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(k)}>
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(k.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                            {k.description && (
                                <p className="text-sm text-[var(--color-text-3)] mb-3 line-clamp-2">{k.description}</p>
                            )}
                            <div className="flex flex-wrap gap-2 mb-3">
                                <Badge variant={k.isActive ? "default" : "secondary"}>
                                    {k.isActive ? "Active" : "Inactive"}
                                </Badge>
                                {k.isFree ? (
                                    <Badge variant="outline" className="text-green-500 border-green-500/20">Free</Badge>
                                ) : (
                                    <Badge variant="outline">{Number(k.price).toLocaleString()} KZT</Badge>
                                )}
                                {k.program && (
                                    <Badge variant="outline" className="text-[#00a3ff] border-[#00a3ff]/20">
                                        {k.program.title}
                                    </Badge>
                                )}
                            </div>
                            <div className="text-xs text-[var(--color-text-3)] flex justify-between">
                                <span>{k._count?.classes || 0} classes</span>
                                <span>Owner: {k.owner?.fullName || "N/A"}</span>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
