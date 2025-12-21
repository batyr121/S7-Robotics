"use client"
import { useState, useEffect } from "react"
import Image from "next/image"
import { Home, BookOpen, User, Users, GraduationCap, FileText, Wrench, ChevronLeft, ChevronRight, LogOut, Shield, Calendar, CalendarDays, ShoppingBag, TrendingUp, CreditCard, Bell, BarChart3, Coins, Database } from "lucide-react"
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
    { id: "clubs", label: "Кружки", icon: Calendar, href: "/dashboard?tab=clubs" },
    { id: "schedule", label: "Расписание", icon: CalendarDays, href: "/dashboard?tab=schedule" },
    { id: "s7-tools", label: "S7 Tools", icon: Wrench, href: "/dashboard?tab=s7-tools" },
    { id: "teams", label: "Команда", icon: Users, href: "/dashboard?tab=teams" },
    { id: "profile", label: "Профиль", icon: User, href: "/dashboard?tab=profile" },
    { id: "masterclass", label: "Мастер классы", icon: GraduationCap, href: "/dashboard?tab=masterclass" },
    { id: "bytesize", label: "ByteSize", icon: FileText, href: "/dashboard?tab=bytesize" },
    { id: "shop", label: "Магазин", icon: ShoppingBag, href: "/dashboard?tab=shop" },
  ]

  // Parent Navigation
  const parentNavItems = [
    { id: "children", label: "Мои дети", icon: Users, href: "/dashboard?tab=children" },
    { id: "progress", label: "Прогресс", icon: TrendingUp, href: "/dashboard?tab=progress" },
    { id: "attendance", label: "Посещаемость", icon: Calendar, href: "/dashboard?tab=attendance" },
    { id: "payments", label: "Оплаты", icon: CreditCard, href: "/dashboard?tab=payments" },
    { id: "notifications", label: "Уведомления", icon: Bell, href: "/dashboard?tab=notifications" },
  ]

  // Mentor Navigation
  const mentorNavItems = [
    { id: "schedule", label: "Расписание", icon: Calendar, href: "/dashboard?tab=schedule" },
    { id: "students", label: "Ученики", icon: Users, href: "/dashboard?tab=students" },
    { id: "stats", label: "Статистика", icon: BarChart3, href: "/dashboard?tab=stats" },
    { id: "coins", label: "Награды S7", icon: Coins, href: "/dashboard?tab=coins" },
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
          <div className="space-y-1">
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
                  className={`group relative flex items-center ${isCollapsed ? "justify-center p-3" : "space-x-3 px-4 py-3"} rounded-lg transition-all duration-[var(--dur-fast)] cursor-pointer animate-slide-up ${isActive
                    ? "bg-[var(--color-surface-2)] border border-[var(--color-border-hover-1)] text-[var(--color-text-1)]"
                    : "text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface-2)]"
                    }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <Icon
                    className={`${isCollapsed ? "w-5 h-5" : "w-5 h-5"} transition-transform duration-200 ${isActive ? "scale-110 text-[var(--color-primary)]" : "group-hover:scale-105"}`}
                  />
                  {isMobileMenuOpen && (
                    <span className={`text-sm transition-all duration-200 ${isActive ? "font-medium text-[var(--color-primary)]" : ""}`}>
                      {item.label}
                    </span>
                  )}

                  {!isCollapsed && !isMobileMenuOpen && (
                    <span className={`text-sm transition-all duration-200 ${isActive ? "font-medium text-[var(--color-primary)]" : ""}`}>
                      {item.label}
                    </span>
                  )}

                  {isCollapsed && !isMobileMenuOpen && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--color-surface-2)] text-[var(--color-text-1)] text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--dur-fast)] pointer-events-none whitespace-nowrap z-50">
                      {item.label}
                    </div>
                  )}

                  {/* Active Indicator Line for collapsed mode or even expanded */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--color-primary)] rounded-r-lg" />
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
