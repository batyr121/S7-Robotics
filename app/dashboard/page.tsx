"use client"
import { Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-context"
import StudentDashboard from "@/components/dashboard/student-dashboard"
import ParentDashboard from "@/components/dashboard/parent-dashboard"
import MentorDashboard from "@/components/dashboard/mentor-dashboard"

function DashboardInner() {
  const { user, loading } = useAuth() as any
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/")
    }
    if (!loading && (user?.role === "admin" || user?.role === "ADMIN")) {
      router.replace("/admin")
    }
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] bg-dots-pattern flex items-center justify-center">
        <div className="text-[var(--color-text-1)] text-sm opacity-80">Загрузка…</div>
      </div>
    )
  }

  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] bg-dots-pattern flex items-center justify-center">
        <div className="text-[var(--color-text-1)] text-sm opacity-80">Перенаправление…</div>
      </div>
    )
  }

  if (!loading && (user?.role === "admin" || user?.role === "ADMIN")) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] bg-dots-pattern flex items-center justify-center">
        <div className="text-[var(--color-text-1)] text-sm opacity-80">Открываем админ‑панель...</div>
      </div>
    )
  }


  // Role-based routing
  switch (user.role) {
    case "parent":
      return <ParentDashboard user={user} />
    case "mentor":
      return <MentorDashboard user={user} />
    case "student":
    case "user":
    default:
      return <StudentDashboard user={user} />
  }
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--color-bg)] bg-dots-pattern flex items-center justify-center">
          <div className="text-[var(--color-text-1)] text-sm opacity-80">Загрузка дашборда…</div>
        </div>
      }
    >
      <DashboardInner />
    </Suspense>
  )
}
