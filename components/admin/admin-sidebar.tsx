"use client"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Home, Users, Award, LogOut, Newspaper, ChevronDown, ChevronRight, BarChart3, UserCheck, Coins, Tag } from "lucide-react"
import { useAuth } from "@/components/auth/auth-context"
import { useConfirm } from "@/components/ui/confirm"
import { useState } from "react"

export default function AdminSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const confirm = useConfirm()
  const { user, logout } = useAuth() as any

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    main: true,
    content: true,
  })

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const isActiveLink = (href: string) => {
    const parsed = new URL(href, "http://local")
    if (parsed.pathname !== pathname) return false
    if (!parsed.search) return true
    const tab = parsed.searchParams.get("tab")
    const view = parsed.searchParams.get("view")
    if (tab) return tab === searchParams?.get("tab")
    if (view) return view === searchParams?.get("view")
    return false
  }

  const navGroups = [
    {
      key: "main",
      label: "Overview",
      items: [
        { href: "/admin?tab=classes", label: "Class management", icon: Users },
        { href: "/admin?tab=users", label: "Users", icon: UserCheck },
        { href: "/admin/salaries", label: "Salaries", icon: Coins },
        { href: "/admin/analytics", label: "Global stats", icon: BarChart3 },
        { href: "/admin/analytics?view=mentors", label: "Mentor ranking", icon: Award },
      ]
    },
    {
      key: "content",
      label: "Content",
      items: [
        { href: "/admin/news", label: "News", icon: Newspaper },
        { href: "/admin/promotions", label: "Promotions", icon: Tag },
      ]
    },
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
                    const active = isActiveLink(item.href)
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
            <span>Dashboard</span>
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--color-text-2)] hover:text-red-400 hover:bg-[var(--color-surface-2)] transition-colors duration-[var(--dur-fast)] w-full"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
