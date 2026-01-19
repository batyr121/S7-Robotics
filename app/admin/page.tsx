"use client"
import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { UsersTab, ClassesTab } from "@/components/admin/admin-tabs"
import { useAuth } from "@/components/auth/auth-context"

export default function AdminPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, loading } = useAuth() as any

  useEffect(() => {
    if (!loading && user?.role !== "admin") {
      router.replace("/dashboard")
    }
  }, [loading, user, router])

  const activeTab = (searchParams.get("tab") as "users" | "classes") || "classes"

  return (
    <div className="p-6 space-y-6">
      <div className="flex gap-4 border-b border-[var(--color-border-1)] pb-2">
        <button
          onClick={() => router.push("/admin?tab=classes")}
          className={`text-sm font-medium pb-2 transition-colors ${activeTab === "classes" ? "text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]" : "text-[var(--color-text-3)]"}`}
        >
          Class management
        </button>
        <button
          onClick={() => router.push("/admin?tab=users")}
          className={`text-sm font-medium pb-2 transition-colors ${activeTab === "users" ? "text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]" : "text-[var(--color-text-3)]"}`}
        >
          Users
        </button>
      </div>

      <div className="animate-fade-in">
        {activeTab === "users" ? <UsersTab /> : <ClassesTab />}
      </div>
    </div>
  )
}
