"use client"
import { useState } from "react"
import UserLayout from "@/components/layout/user-layout"
import { UsersTab, ClassesTab } from "@/components/admin/admin-tabs"
import { useAuth } from "@/components/auth/auth-context"
import { useRouter } from "next/navigation"

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users")
  const { user, loading } = useAuth()
  const router = useRouter()

  if (!loading && user?.role !== 'ADMIN') {
    router.replace('/dashboard')
    return null
  }

  const renderContent = () => {
    switch (activeTab) {
      case "users": return <UsersTab />
      case "classes": return <ClassesTab />
      default: return <UsersTab />
    }
  }

  // Reuse Navbar style or just buttons
  return (
    <UserLayout title="Админ Панель" activeTab="admin" showFooter={false}>
      <div className="p-6">
        <div className="flex gap-4 mb-6 border-b border-[var(--color-border-1)] pb-2">
          <button
            onClick={() => setActiveTab("users")}
            className={`text-sm font-medium pb-2 transition-colors ${activeTab === 'users' ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]' : 'text-[var(--color-text-3)]'}`}
          >
            Пользователи
          </button>
          <button
            onClick={() => setActiveTab("classes")}
            className={`text-sm font-medium pb-2 transition-colors ${activeTab === 'classes' ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]' : 'text-[var(--color-text-3)]'}`}
          >
            Классы и Группы
          </button>
        </div>

        <div className="animate-fade-in">
          {renderContent()}
        </div>
      </div>
    </UserLayout>
  )
}
