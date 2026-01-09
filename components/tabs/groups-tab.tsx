// ... (imports remain)
import { Plus } from "lucide-react"

// ... (interfaces remain)

export default function GroupsTab({ user }: GroupsTabProps) {
    // ... (existing state)
    const [createGroupOpen, setCreateGroupOpen] = useState(false)
    const [newGroupName, setNewGroupName] = useState("")
    const [selectedKruzhokId, setSelectedKruzhokId] = useState("")
    const [createGroupLoading, setCreateGroupLoading] = useState(false)
    const [kruzhokOptions, setKruzhokOptions] = useState<{ id: string, title: string }[]>([])

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

    // ... (rest of component)

    return (
        <div className="space-y-6">
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

            {/* ... (groups list view remains) ... */}

            {/* ... (existing dialogs) ... */}

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
                                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-3 py-2 text-[var(--color-text-1)]"
                            >
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

            {/* ... (other dialogs) ... */}
        </div>
    )
}
