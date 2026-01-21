"use client"
import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { UsersTab, ClassesTab } from "@/components/admin/admin-tabs"
import { KruzhoksTab } from "@/components/admin/kruzhoks-tab"
import { ProgramsTab } from "@/components/admin/programs-tab"
import { useAuth } from "@/components/auth/auth-context"

type AdminTab = "classes" | "users" | "kruzhoks" | "programs"

export default function AdminPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, loading } = useAuth() as any

  useEffect(() => {
    if (!loading && user?.role !== "admin") {
      router.replace("/dashboard")
    }
  }, [loading, user, router])

  const activeTab = (searchParams.get("tab") as AdminTab) || "classes"

  const tabs: { key: AdminTab; label: string }[] = [
    { key: "kruzhoks", label: "Kruzhoks" },
    { key: "programs", label: "Programs" },
    { key: "classes", label: "Classes" },
    { key: "users", label: "Users" },
  ]

  const renderTab = () => {
    switch (activeTab) {
      case "kruzhoks":
        return <KruzhoksTab />
      case "programs":
        return <ProgramsTab />
      case "users":
        return <UsersTab />
      case "classes":
      default:
        return <ClassesTab />
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex gap-4 border-b border-[var(--color-border-1)] pb-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => router.push(`/admin?tab=${tab.key}`)}
            className={`text-sm font-medium pb-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? "text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]" : "text-[var(--color-text-3)]"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-fade-in">
        {renderTab()}
      </div>
    </div>
  )
}

