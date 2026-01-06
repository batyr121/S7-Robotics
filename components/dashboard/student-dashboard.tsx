"use client"
import HomeTab from "@/components/tabs/home-tab"
import ProfileTab from "@/components/tabs/profile-tab"
import ScanTab from "@/components/tabs/scan-tab"
import ScheduleTab from "@/components/tabs/schedule-tab"
import { useRouter, useSearchParams } from "next/navigation"
import UserLayout from "@/components/layout/user-layout"

interface StudentDashboardProps {
    user: any
}

export default function StudentDashboard({ user }: StudentDashboardProps) {
    const searchParams = useSearchParams()
    const router = useRouter()

    const activeTab = searchParams.get("tab") || "home"

    const getTabTitle = (tab: string) => {
        switch (tab) {
            case "home": return "Главная"
            case "schedule": return "Расписание"
            case "scan": return "Сканер QR"
            case "profile": return "Профиль"
            default: return "Кабинет"
        }
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case "home": return <HomeTab />
            case "schedule": return <ScheduleTab />
            case "scan": return <ScanTab />
            case "profile": return <ProfileTab />
            default: return <HomeTab />
        }
    }

    return (
        <UserLayout
            title={getTabTitle(activeTab)}
            activeTab={activeTab}
            onTabChange={(tab) => router.push(`/dashboard?tab=${tab}`)}
        >
            <div className="animate-fade-in">
                {renderTabContent()}
            </div>
        </UserLayout>
    )
}
