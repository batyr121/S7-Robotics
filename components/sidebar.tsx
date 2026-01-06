"use client"
import { useState, useEffect } from "react"
import Image from "next/image"
import { Home, BookOpen, User, Users, GraduationCap, FileText, Wrench, ChevronLeft, ChevronRight, LogOut, Shield, Calendar, CalendarDays, ShoppingBag, TrendingUp, CreditCard, Bell, BarChart3, Coins, Database, UserCheck, Play, QrCode } from "lucide-react"
import { useAuth } from "@/components/auth/auth-context"
import { useConfirm } from "@/components/ui/confirm"
import { useRouter } from "next/navigation"

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  isMobileMenuOpen: boolean
  setIsMobileMenuOpen: (open: boolean) => void
  onCollapseChange: (collapsed: boolean) => void
}

export default function Sidebar({
  activeTab,
  onTabChange,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  onCollapseChange,
}: SidebarProps) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const confirm = useConfirm()

  const handleLogout = async () => {
    const ok = await confirm({ preset: 'logout' })
    if (!ok) return
    await logout()
    router.replace('/')
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileMenuOpen && !(event.target as Element).closest(".sidebar-container")) {
        setIsMobileMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isMobileMenuOpen, setIsMobileMenuOpen])

  useEffect(() => {
    onCollapseChange(isCollapsed)
  }, [isCollapsed, onCollapseChange])

  // Student Navigation
  const studentNavItems = [
    { id: "home", label: "Главная", icon: Home, href: "/dashboard?tab=home" },
    { id: "courses", label: "Курсы", icon: BookOpen, href: "/dashboard?tab=courses" },
    { id: "schedule", label: "Расписание", icon: CalendarDays, href: "/dashboard?tab=schedule" },
    { id: "scan", label: "Сканер QR", icon: QrCode, href: "/dashboard?tab=scan" },
    { id: "profile", label: "Профиль", icon: User, href: "/dashboard?tab=profile" },
  ]

  // Parent Navigation
  const parentNavItems = [
    { id: "home", label: "Главная", icon: Home, href: "/dashboard?tab=home" },
    { id: "children", label: "Дети", icon: Users, href: "/dashboard?tab=children" },
    { id: "analytics", label: "Аналитика", icon: TrendingUp, href: "/dashboard?tab=analytics" },
    { id: "profile", label: "Профиль", icon: User, href: "/dashboard?tab=profile" },
  ]

  // Mentor Navigation
  const mentorNavItems = [
    { id: "home", label: "Главная", icon: Home, href: "/dashboard?tab=home" },
    { id: "schedule", label: "Расписание", icon: Calendar, href: "/dashboard?tab=schedule" },
    { id: "groups", label: "Группы", icon: Users, href: "/dashboard?tab=groups" },
    { id: "bytesize", label: "ByteSize", icon: Play, href: "/dashboard?tab=bytesize" },
    { id: "wallet", label: "Кошелек", icon: CreditCard, href: "/dashboard?tab=wallet" },
    { id: "profile", label: "Профиль", icon: User, href: "/dashboard?tab=profile" },
  ]

  // Select items based on role
  let navItems = studentNavItems
  const userRole = (user as any)?.role

  if (userRole === 'parent') {
    navItems = parentNavItems
  } else if (userRole === 'mentor') {
    navItems = mentorNavItems
  } else if (userRole === 'admin') {
    // Admin gets everything or a specific admin set + link to admin panel
    navItems = studentNavItems
  }

  return (
    <>
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40 animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div
        className={`sidebar-container bg-[var(--color-surface-1)] border-r border-[var(--color-border-1)] flex flex-col transition-all duration-[var(--dur-mid)] ease-[var(--easing)]
        ${isCollapsed ? "w-16" : "w-64"}
        ${isMobileMenuOpen ? "fixed inset-y-0 left-0 z-50 w-64 animate-slide-in-left" : "hidden md:flex md:fixed md:inset-y-0 md:left-0 md:z-30"}`}
      >
        <div
          className={`${isCollapsed ? "p-3" : "p-6"} border-b border-[var(--color-border-1)] flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}
        >
          <Image
            src="/logo-s7.png"
            alt="S7 Robotics Logo"
            width={isCollapsed ? 28 : 40}
            height={isCollapsed ? 28 : 40}
            className={isCollapsed ? "mx-auto" : ""}
          />
          {!isCollapsed && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--color-surface-2)] rounded-lg p-1 hidden md:block"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        {isCollapsed && (
          <div className="p-2 border-b border-[var(--color-border-1)] hidden md:block">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="w-full text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--color-surface-2)] rounded-lg p-2 flex justify-center"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <nav className="flex-1 p-2 overflow-y-auto">
          <div className="space-y-2">
            {navItems.map((item, index) => {
              const Icon = item.icon
              const isActive = activeTab === item.id

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    const tab = item.id
                    onTabChange(tab)
                    // If href exists and it's a dashboard tab link, update URL
                    if (item.href?.includes("?tab=")) {
                      router.push(item.href)
                    } else if (item.href) {
                      router.push(item.href)
                    }
                    setIsMobileMenuOpen(false)
                  }}
                  className={`group relative flex items-center ${isCollapsed ? "justify-center p-3" : "space-x-3 px-4 py-3.5"} rounded-xl transition-all duration-300 ease-[var(--easing)] cursor-pointer animate-slide-up active:scale-95 ${isActive
                    ? "bg-[var(--color-primary)] text-white shadow-[0_4px_12px_rgba(0,163,255,0.3)]"
                    : "text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface-2)]"
                    }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <Icon
                    className={`${isCollapsed ? "w-6 h-6" : "w-5 h-5"} transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-105"}`}
                  />
                  {isMobileMenuOpen && (
                    <span className={`text-base tracking-wide transition-all duration-200 ${isActive ? "font-medium" : ""}`}>
                      {item.label}
                    </span>
                  )}

                  {!isCollapsed && !isMobileMenuOpen && (
                    <span className={`text-[15px] tracking-wide transition-all duration-200 ${isActive ? "font-medium" : ""}`}>
                      {item.label}
                    </span>
                  )}

                  {isCollapsed && !isMobileMenuOpen && (
                    <div className="absolute left-full ml-3 px-3 py-1.5 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] text-[var(--color-text-1)] text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                      {item.label}
                    </div>
                  )}

                </div>
              )
            })}
          </div>
        </nav>
        <div className="p-2 border-t border-[var(--color-border-1)] space-y-1">
          {userRole === 'admin' && (
            <div
              onClick={() => router.push('/admin')}
              className="group relative flex items-center justify-center p-3 rounded-lg transition-all duration-[var(--dur-fast)] cursor-pointer text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface-2)]"
            >
              <Shield className="w-5 h-5 transition-transform duration-[var(--dur-fast)] group-hover:scale-105" />
              {!isCollapsed && (
                <span className="text-sm ml-3">Админ панель</span>
              )}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--color-surface-2)] text-[var(--color-text-1)] text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--dur-fast)] pointer-events-none whitespace-nowrap z-50">
                  Админ панель
                </div>
              )}
            </div>
          )}
          <div
            onClick={handleLogout}
            className="group relative flex items-center justify-center p-3 rounded-lg transition-all duration-[var(--dur-fast)] cursor-pointer text-[#ef4444] hover:text-white hover:bg-[var(--color-surface-2)]"
          >
            <LogOut className="w-5 h-5 transition-transform duration-[var(--dur-fast)] group-hover:scale-105" />
            {!isCollapsed && (
              <span className="text-sm ml-3">Выйти</span>
            )}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--color-surface-2)] text-[var(--color-text-1)] text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--dur-fast)] pointer-events-none whitespace-nowrap z-50">
                Выйти
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
