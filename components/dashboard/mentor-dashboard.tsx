"use client"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import UserLayout from "@/components/layout/user-layout"
import HomeTab from "@/components/tabs/home-tab"
import ScheduleTab from "@/components/tabs/schedule-tab"
import GroupsTab from "@/components/tabs/groups-tab"
import QrGenerateTab from "@/components/tabs/qr-generate-tab"
import AttendanceTab from "@/components/tabs/attendance-tab"
import ByteSizeTab from "@/components/tabs/bytesize-tab"
import WalletTab from "@/components/tabs/wallet-tab"
import ProfileTab from "@/components/tabs/profile-tab"

interface MentorDashboardProps {
    user: any
}

type Tab = "home" | "schedule" | "groups" | "qr" | "attendance" | "bytesize" | "wallet" | "profile"

export default function MentorDashboard({ user }: MentorDashboardProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const activeTab = (searchParams.get("tab") as Tab) || "home"

    const setActiveTab = (tab: Tab) => {
        router.push(`/dashboard?tab=${tab}`)
    }

    const getTabTitle = () => {
        switch (activeTab) {
            case "home": return "Главная"
            case "schedule": return "Расписание"
            case "groups": return "Мои группы"
            case "qr": return "Начать урок"
            case "attendance": return "Табель"
            case "bytesize": return "ByteSize"
            case "wallet": return "Кошелек"
            case "profile": return "Профиль"
            default: return "Кабинет ментора"
        }
    }

    const renderContent = () => {
        switch (activeTab) {
            case "home": return <HomeTab />
            case "schedule": return <ScheduleTab />
            case "groups": return <GroupsTab user={user} />
            case "qr": return <QrGenerateTab />
            case "attendance": return <AttendanceTab />
            case "bytesize": return <ByteSizeTab />
            case "wallet": return <WalletTab />
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


