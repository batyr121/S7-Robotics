"use client"
import { ArrowUpRight, Search, Plus, Filter, MoreVertical, Shield, User as UserIcon, GraduationCap, Users, Baby } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { useConfirm } from "@/components/ui/confirm"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

type UserRole = "USER" | "STUDENT" | "PARENT" | "MENTOR" | "ADMIN" | "GUEST"

interface User {
  id: string
  email: string
  fullName?: string
  role: UserRole
  xp?: number
  banned?: boolean
  bannedReason?: string
  createdAt?: string
}

export default function Page() {
  const confirm = useConfirm()
  const [users, setUsers] = useState<User[]>([])
  const [filter, setFilter] = useState<UserRole | "ALL">("ALL")
  const [search, setSearch] = useState("")

  // Create User State
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newUser, setNewUser] = useState({ email: "", password: "", fullName: "", role: "USER" })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = () => {
    apiFetch<any>("/api/admin/users")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res && Array.isArray(res.users) ? res.users : [])
        setUsers(Array.isArray(list) ? list : [])
      })
      .catch(() => setUsers([]))
  }

  const usersList = Array.isArray(users) ? users : []
  const filteredUsers = usersList.filter(u => {
    if (filter !== "ALL" && u.role !== filter) return false
    if (search) {
      const lower = search.toLowerCase()
      return u.email.toLowerCase().includes(lower) || u.fullName?.toLowerCase().includes(lower)
    }
    return true
  })

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.fullName) {
      toast({ title: "Ошибка", description: "Заполните все поля", variant: "destructive" })
      return
    }
    setCreating(true)
    try {
      await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(newUser)
      })
      toast({ title: "Успешно", description: "Пользователь создан" })
      setIsCreateOpen(false)
      setNewUser({ email: "", password: "", fullName: "", role: "USER" })
      loadUsers()
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message || "Не удалось создать пользователя", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await apiFetch(`/api/admin/users/${userId}/role`, {
        method: "POST",
        body: JSON.stringify({ role: newRole })
      })
      toast({ title: "Успешно", description: "Роль обновлена" })
      loadUsers()
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message || "Не удалось обновить роль", variant: "destructive" })
    }
  }

  const handleBan = async (u: User) => {
    const res = await confirm({ preset: 'ban' }) as any
    if (!res || res.ok !== true) return
    const reason = String(res.reason || '').trim()
    await apiFetch(`/api/admin/users/${u.id}/ban`, { method: 'POST', body: JSON.stringify({ reason: reason || undefined }) })
    setUsers(prev => (Array.isArray(prev) ? prev : []).map(x => x.id === u.id ? { ...x, banned: true, bannedReason: reason || undefined } : x))
  }

  const handleUnban = async (u: User) => {
    const ok = await confirm({ title: 'Снять бан с пользователя?', confirmText: 'Разбанить', cancelText: 'Отмена' })
    if (!ok) return
    await apiFetch(`/api/admin/users/${u.id}/unban`, { method: 'POST' })
    setUsers(prev => (Array.isArray(prev) ? prev : []).map(x => x.id === u.id ? { ...x, banned: false, bannedReason: undefined } : x))
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN": return <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/30">Admin</Badge>
      case "MENTOR": return <Badge className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30">Mentor</Badge>
      case "PARENT": return <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">Parent</Badge>
      case "STUDENT": return <Badge className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">Student</Badge>
      default: return <Badge variant="secondary">User</Badge>
    }
  }

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-white text-2xl font-semibold">Пользователи</h2>
          <p className="text-[#a0a0b0] text-sm">Управление учениками, родителями и менторами</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#00a3ff] hover:bg-[#0082cc] text-white">
              <Plus className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1b1b22] border-[#2a2a35] text-white">
            <DialogHeader>
              <DialogTitle>Создание пользователя</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm text-[#a0a0b0]">Email</label>
                <Input
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  className="bg-[#16161c] border-[#2a2a35]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-[#a0a0b0]">ФИО</label>
                <Input
                  value={newUser.fullName}
                  onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="bg-[#16161c] border-[#2a2a35]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-[#a0a0b0]">Пароль</label>
                <Input
                  type="password"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  className="bg-[#16161c] border-[#2a2a35]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-[#a0a0b0]">Роль</label>
                <Select value={newUser.role} onValueChange={v => setNewUser({ ...newUser, role: v })}>
                  <SelectTrigger className="bg-[#16161c] border-[#2a2a35]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1b1b22] border-[#2a2a35]">
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="STUDENT">Student</SelectItem>
                    <SelectItem value="PARENT">Parent</SelectItem>
                    <SelectItem value="MENTOR">Mentor</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="border-[#2a2a35] text-white hover:bg-[#2a2a35]">Отмена</Button>
              <Button onClick={handleCreateUser} disabled={creating} className="bg-[#00a3ff] hover:bg-[#0082cc] text-white">
                {creating ? "Создание..." : "Создать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a0a0b0]" />
          <Input
            placeholder="Поиск по имени или email"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-[#16161c] border-[#2a2a35] rounded-full"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {[
            { id: "ALL", label: "Все" },
            { id: "STUDENT", label: "Ученики" },
            { id: "PARENT", label: "Родители" },
            { id: "MENTOR", label: "Менторы" },
            { id: "ADMIN", label: "Админы" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id as any)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${filter === t.id
                ? "bg-[#00a3ff] text-white"
                : "bg-[#16161c] border border-[#2a2a35] text-[#a0a0b0] hover:text-white"
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-[#a0a0b0]">
            Пользователи не найдены
          </div>
        ) : (
          filteredUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-xl bg-[#16161c] border border-[#2a2a35] p-4 transition-all hover:border-[#333344] group">
              <Link href={`/admin/users/${u.id}`} className="flex items-center gap-4 flex-1 hover:opacity-90">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-[#1b1b22] border border-[#2a2a35] text-[#a0a0b0]`}>
                  {u.fullName ? u.fullName.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium">{u.fullName || "Без имени"}</span>
                    {getRoleBadge(u.role)}
                    {u.banned && (
                      <Badge variant="destructive" className="bg-[#ef4444]/20 text-[#ef4444] hover:bg-[#ef4444]/30">Забанен</Badge>
                    )}
                  </div>
                  <div className="text-sm text-[#a0a0b0]">{u.email}</div>
                </div>
              </Link>

              <div className="flex items-center gap-2 pl-4">
                <div className="text-right mr-4 hidden sm:block">
                  <div className="text-sm font-medium text-white">{u.xp || 0} XP</div>
                  <div className="text-xs text-[#a0a0b0]">Опыт</div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[#a0a0b0] hover:text-white hover:bg-[#2a2a35]">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[#1b1b22] border-[#2a2a35] text-white">
                    <Link href={`/admin/users/${u.id}`}>
                      <DropdownMenuItem className="cursor-pointer hover:bg-[#2a2a35] focus:bg-[#2a2a35]">
                        <ArrowUpRight className="w-4 h-4 mr-2" /> Профиль
                      </DropdownMenuItem>
                    </Link>

                    <DropdownMenuSeparator className="bg-[#2a2a35]" />
                    <div className="px-2 py-1.5 text-xs text-[#a0a0b0]">Сменить роль</div>
                    <DropdownMenuItem onClick={() => handleUpdateRole(u.id, "STUDENT")} className="cursor-pointer hover:bg-[#2a2a35] focus:bg-[#2a2a35]">
                      <GraduationCap className="w-4 h-4 mr-2 text-blue-400" /> Ученик
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUpdateRole(u.id, "PARENT")} className="cursor-pointer hover:bg-[#2a2a35] focus:bg-[#2a2a35]">
                      <Baby className="w-4 h-4 mr-2 text-green-400" /> Родитель
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUpdateRole(u.id, "MENTOR")} className="cursor-pointer hover:bg-[#2a2a35] focus:bg-[#2a2a35]">
                      <Users className="w-4 h-4 mr-2 text-purple-400" /> Ментор
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUpdateRole(u.id, "ADMIN")} className="cursor-pointer hover:bg-[#2a2a35] focus:bg-[#2a2a35]">
                      <Shield className="w-4 h-4 mr-2 text-red-400" /> Админ
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="bg-[#2a2a35]" />
                    {u.banned ? (
                      <DropdownMenuItem onClick={() => handleUnban(u)} className="cursor-pointer text-green-400 hover:bg-[#2a2a35] focus:bg-[#2a2a35]">
                        Разбанить
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => handleBan(u)} className="cursor-pointer text-red-400 hover:bg-[#2a2a35] focus:bg-[#2a2a35]">
                        Забанить
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  )
}
