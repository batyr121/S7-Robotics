"use client"
import { useState, useEffect } from "react"
import Sidebar from "@/components/sidebar"
import ProfileDropdown from "@/components/kokonutui/profile-dropdown"
import FooterSocial from "@/components/footer-social"
import { useAuth } from "@/components/auth/auth-context"
import { useConfirm } from "@/components/ui/confirm"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"

interface UserLayoutProps {
    children: React.ReactNode
    title: string
    activeTab: string
    onTabChange?: (tab: string) => void
    showFooter?: boolean
}

export default function UserLayout({
    children,
    title,
    activeTab,
    onTabChange,
    showFooter = true
}: UserLayoutProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [currentDate, setCurrentDate] = useState("")
    const { user, logout, loading } = useAuth() as any
    const confirm = useConfirm()
    const router = useRouter()

    useEffect(() => {
        const updateDate = () => {
            const now = new Date()
            const months = [
                "Января", "Февраля", "Марта", "Апреля", "Мая", "Июня",
                "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря",
            ]
            const day = now.getDate()
            const month = months[now.getMonth()]
            setCurrentDate(`${day} ${month}`)
        }

        updateDate()
        const interval = setInterval(updateDate, 24 * 60 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    // Mobile menu body class
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.classList.add("mobile-menu-open")
        } else {
            document.body.classList.remove("mobile-menu-open")
        }
        return () => {
            document.body.classList.remove("mobile-menu-open")
        }
    }, [isMobileMenuOpen])

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--color-bg)] bg-dots-pattern flex items-center justify-center">
                <div className="text-[var(--color-text-1)] text-sm opacity-80">Загрузка…</div>
            </div>
        )
    }

    if (!loading && !user) {
        router.replace("/")
        return (
            <div className="min-h-screen bg-[var(--color-bg)] bg-dots-pattern flex items-center justify-center">
                <div className="text-[var(--color-text-1)] text-sm opacity-80">Перенаправление…</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[var(--color-bg)] bg-dots-pattern flex flex-col md:flex-row relative">
            <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden fixed top-4 left-4 z-50 text-[var(--color-text-1)] p-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-border-hover-1)] rounded-lg transition-all duration-[var(--dur-mid)] border border-[var(--color-border-1)] hover:border-[var(--color-border-hover-1)] shadow-lg"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>

            <Sidebar
                activeTab={activeTab}
                onTabChange={onTabChange || (() => { })}
                isMobileMenuOpen={isMobileMenuOpen}
                setIsMobileMenuOpen={setIsMobileMenuOpen}
                onCollapseChange={setIsSidebarCollapsed}
            />

            <div
                className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${isSidebarCollapsed ? "md:ml-16" : "md:ml-64"
                    }`}
            >
                <header className="bg-[var(--color-surface-2)] border-b border-[var(--color-border-1)] px-4 md:px-8 py-4 md:py-6 flex items-center gap-4 animate-slide-up relative z-10">
                    <div className="flex items-center">
                        <h1 className="text-[var(--color-text-1)] text-xl md:text-2xl font-medium ml-12 md:ml-0">{title}</h1>
                    </div>

                    <div className="ml-auto flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-[var(--color-text-1)] text-lg md:text-xl font-medium">{currentDate}</div>
                            <div className="text-[var(--color-text-3)] text-sm">2025</div>
                        </div>
                        <ProfileDropdown
                            data={{ name: user?.fullName || user?.email || "Профиль", email: user?.email || "", avatar: "/logo-s7.png", xp: user?.xp || 0, coins: user?.coinBalance || 0 }}
                            onLogout={async () => {
                                const ok = await confirm({ preset: 'logout' })
                                if (!ok) return
                                await logout()
                                toast({ title: "Вы вышли из аккаунта", description: "До встречи!" })
                                router.replace('/')
                            }}
                        />
                    </div>
                </header>

                <div className="flex-1 pb-20 md:pb-0">
                    {children}
                </div>
            </div>

            {showFooter && <FooterSocial />}
        </div>
    )
}
