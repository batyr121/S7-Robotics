"use client"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import UserLayout from "@/components/layout/user-layout"
import HomeTab from "@/components/tabs/home-tab"
import ChildrenTab from "@/components/tabs/children-tab"
import AnalyticsTab from "@/components/tabs/analytics-tab"
import ProfileTab from "@/components/tabs/profile-tab"

interface ParentDashboardProps {
    user: any
}

type Tab = "home" | "children" | "analytics" | "profile"

export default function ParentDashboard({ user }: ParentDashboardProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const activeTab = (searchParams.get("tab") as Tab) || "home"

    const setActiveTab = (tab: Tab) => {
        router.push(`/dashboard?tab=${tab}`)
    }

    const getTabTitle = () => {
        switch (activeTab) {
            case "home": return "Главная"
            case "children": return "Мои дети"
            case "analytics": return "Аналитика"
            case "profile": return "Профиль"
            default: return "Кабинет родителя"
        }
    }

    const renderContent = () => {
        switch (activeTab) {
            case "home": return <HomeTab />
            case "children": return <ChildrenTab />
            case "analytics": return <AnalyticsTab />
            case "profile": return <ProfileTab />
            default: return <HomeTab />
        }
    }

    return (
        <UserLayout title={getTabTitle()} activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as Tab)}>
            <div className="p-4 md:p-6 animate-fade-in">
                {renderContent()}
            </div>
        </UserLayout>
    )
}

