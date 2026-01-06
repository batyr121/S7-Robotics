"use client"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import UserLayout from "@/components/layout/user-layout"
import HomeTab from "@/components/tabs/home-tab"
import ChildrenTab from "@/components/tabs/children-tab"
import ScheduleTab from "@/components/tabs/schedule-tab"
import MasterclassTab from "@/components/tabs/masterclass-tab"
import ByteSizeTab from "@/components/tabs/bytesize-tab"
import ShopTab from "@/components/tabs/shop-tab"
import AnalyticsTab from "@/components/tabs/analytics-tab"
import ProfileTab from "@/components/tabs/profile-tab"

interface ParentDashboardProps {
    user: any
}

type Tab = "home" | "children" | "schedule" | "masterclass" | "bytesize" | "shop" | "analytics" | "profile"

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
            case "schedule": return "Расписание"
            case "masterclass": return "Мастер-классы"
            case "bytesize": return "ByteSize"
            case "shop": return "Магазин"
            case "analytics": return "Аналитика"
            case "profile": return "Профиль"
            default: return "Кабинет родителя"
        }
    }

    const renderContent = () => {
        switch (activeTab) {
            case "home": return <HomeTab />
            case "children": return <ChildrenTab />
            case "schedule": return <ScheduleTab />
            case "masterclass": return <MasterclassTab />
            case "bytesize": return <ByteSizeTab />
            case "shop": return <ShopTab />
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

