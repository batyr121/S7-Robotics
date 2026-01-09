"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Home, BookOpen, Users, GraduationCap, FileText, Wrench, CreditCard, Award, LogOut, Newspaper, Gamepad2, CheckCircle, ChevronDown, ChevronRight, BarChart3, Coins, ShoppingBag, Calendar, UserCheck, FolderDot } from "lucide-react"
import { useAuth } from "@/components/auth/auth-context"
import ProfileDropdown from "@/components/kokonutui/profile-dropdown"
import { useConfirm } from "@/components/ui/confirm"
import { useState } from "react"

export default function AdminSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const confirm = useConfirm()
  const { user, logout } = useAuth()

  // State for collapsible groups
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "users": true,
    "education": true,
    "finance": true,
    "content": true,
  })

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const navGroups = [
    {
      key: "main",
      label: "Главное",
      items: [
        { href: "/admin", label: "Панель управления", icon: Home },
        { href: "/admin/analytics", label: "Аналитика", icon: BarChart3 },
      ]
    },
    {
      key: "users",
      label: "Пользователи",
      items: [
        { href: "/admin/users", label: "Все пользователи", icon: Users },
        { href: "/admin/users?role=student", label: "Ученики", icon: GraduationCap },
        { href: "/admin/users?role=parent", label: "Родители", icon: UserCheck },
        { href: "/admin/users?role=mentor", label: "Менторы", icon: Wrench },
        { href: "/admin/submissions", label: "Заявки", icon: FileText },
      ]
    },
    {
      key: "education",
      label: "Обучение",
      items: [
        { href: "/admin/courses", label: "Курсы", icon: BookOpen },
        { href: "/admin/schedule", label: "Расписание", icon: Calendar },
        { href: "/admin/programs", label: "Программы", icon: FileText },
        { href: "/admin/masterclass", label: "Мастер-классы", icon: GraduationCap },
        { href: "/admin/bytesize", label: "ByteSize", icon: FileText },
      ]
    },
    {
      key: "finance",
      label: "Финансы",
      items: [
        { href: "/admin/payments", label: "Платежи", icon: CreditCard },
        { href: "/admin/subscriptions", label: "Подписки", icon: CheckCircle },
        { href: "/admin/salaries", label: "Зарплаты", icon: Coins },
        { href: "/admin/orders", label: "Заказы", icon: ShoppingBag },
      ]
    },
    {
      key: "content",
      label: "Контент и Система",
      items: [
        { href: "/admin/news", label: "Новости", icon: Newspaper },
        { href: "/admin/shop", label: "Магазин S7", icon: ShoppingBag },
        { href: "/admin/achievements", label: "Достижения", icon: Award },
        { href: "/admin/games", label: "Игры", icon: Gamepad2 },
      ]
    }
  ]

  const handleLogout = async () => {
    const ok = await confirm({ preset: 'logout' })
    if (!ok) return
    await logout()
    router.replace('/')
  }

  const panelClasses = `${open ? "translate-x-0 md:translate-x-0" : "-translate-x-full md:-translate-x-full"}`

  return (
    <>
      {open && <div onClick={onClose} className="fixed inset-0 bg-black/50 md:hidden z-30" />}
      <aside className={`fixed left-0 top-0 z-40 h-screen w-64 bg-[var(--color-surface-1)] border-r border-[var(--color-border-1)] flex flex-col transform transition-transform ${panelClasses}`}>

        <div className="p-4 mb-2">
          <div className="text-[var(--color-text-1)] font-bold text-xl mb-2 flex items-center gap-2">
            <img src="/logo-s7.png" alt="S7" className="w-8 h-8 rounded-full" />
            S7 Admin
          </div>
          {user && (
            <div className="text-[var(--color-text-3)] text-sm px-1 truncate">
              {user.fullName || user.email}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
          {navGroups.map((group) => (
            <div key={group.key}>
              {group.label && (
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2 px-3 hover:text-[var(--color-text-1)] transition-colors"
                >
                  {group.label}
                  {expandedGroups[group.key] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              )}

              {(group.key === "main" || expandedGroups[group.key]) && (
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const active = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => {
                          try {
                            if (typeof window !== 'undefined' && window.innerWidth < 768) onClose()
                          } catch { }
                        }}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-[var(--dur-fast)] text-sm ${active
                          ? "bg-[var(--color-surface-2)] text-[var(--color-primary)] font-medium border-l-2 border-[var(--color-primary)]"
                          : "text-[var(--color-text-2)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface-2)]"
                          }`}
                      >
                        <Icon className={`w-4 h-4 ${active ? "text-[var(--color-primary)]" : "text-[var(--color-text-3)]"}`} />
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 mt-auto border-t border-[var(--color-border-1)] space-y-2 bg-[var(--color-surface-1)]">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--color-text-2)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface-2)] transition-colors duration-[var(--dur-fast)] w-full"
          >
            <Home className="w-4 h-4" />
            <span>На сайт</span>
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--color-text-2)] hover:text-red-400 hover:bg-[var(--color-surface-2)] transition-colors duration-[var(--dur-fast)] w-full"
          >
            <LogOut className="w-4 h-4" />
            <span>Выйти</span>
          </button>
        </div>
      </aside>
    </>
  )
}
