"use client"
import HomeTab from "@/components/tabs/home-tab"
import ProfileTab from "@/components/tabs/profile-tab"
import ScanTab from "@/components/tabs/scan-tab"
import ShopTab from "@/components/tabs/shop-tab"
import ScheduleTab from "@/components/tabs/schedule-tab"
import GroupsTab from "@/components/tabs/groups-tab"
import { useRouter, useSearchParams } from "next/navigation"
import UserLayout from "@/components/layout/user-layout"
import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Star } from "lucide-react"

interface StudentDashboardProps {
    user: any
}

export default function StudentDashboard({ user }: StudentDashboardProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [pendingReview, setPendingReview] = useState<any | null>(null)
    const [rating, setRating] = useState(5)
    const [comment, setComment] = useState("")
    const [reviewLoading, setReviewLoading] = useState(false)

    const activeTab = searchParams.get("tab") || "home"

    useEffect(() => {
        let mounted = true
        const role = (user as any)?.role
        if (role && !["student", "STUDENT", "user", "USER"].includes(role)) return
        const fetchPending = async () => {
            try {
                const res = await apiFetch<any>("/reviews/pending")
                if (!mounted) return
                const item = res?.items?.[0] || null
                setPendingReview(item)
                if (item) {
                    setRating(5)
                    setComment("")
                }
            } catch {
                // ignore
            }
        }
        fetchPending()
        const interval = setInterval(fetchPending, 60000)
        return () => {
            mounted = false
            clearInterval(interval)
        }
    }, [])

    const getTabTitle = (tab: string) => {
        switch (tab) {
            case "home": return "Home"
            case "schedule": return "Schedule"
            case "groups": return "Groups"
            case "scan": return "QR Scanner"
            case "shop": return "Shop"
            case "profile": return "Profile"
            default: return "Dashboard"
        }
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case "home": return <HomeTab />
            case "schedule": return <ScheduleTab />
            case "groups": return <GroupsTab user={user} />
            case "scan": return <ScanTab />
            case "shop": return <ShopTab />
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
            <Dialog open={!!pendingReview} onOpenChange={(open) => { if (!open) setPendingReview(null) }}>
                <DialogContent className="bg-[var(--color-bg)] border-[var(--color-border-1)]">
                    <DialogHeader>
                        <DialogTitle className="text-[var(--color-text-1)]">Rate your mentor</DialogTitle>
                    </DialogHeader>
                    {pendingReview && (
                        <div className="space-y-4">
                            <div className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] p-3 text-sm text-[var(--color-text-3)]">
                                <div>
                                    Lesson: <span className="text-[var(--color-text-1)]">{pendingReview.title}</span>
                                </div>
                                <div>
                                    Mentor:{" "}
                                    <span className="text-[var(--color-text-1)]">
                                        {pendingReview.createdBy?.fullName || "Mentor"}
                                    </span>
                                    {pendingReview.createdBy?.email && (
                                        <span className="ml-2 text-[var(--color-text-3)]">
                                            ({pendingReview.createdBy.email})
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-[var(--color-text-3)] mb-2">Your rating</div>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((value) => (
                                        <button
                                            key={value}
                                            onClick={() => setRating(value)}
                                            className={`w-10 h-10 rounded-full flex items-center justify-center border ${rating >= value ? "border-yellow-400 text-yellow-400" : "border-[var(--color-border-1)] text-[var(--color-text-3)]"}`}
                                        >
                                            <Star className="w-5 h-5" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Share a quick note (optional)"
                                rows={3}
                                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-3 py-2 text-[var(--color-text-1)]"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setPendingReview(null)}
                                    className="border-[var(--color-border-1)]"
                                >
                                    Not now
                                </Button>
                                <Button
                                    disabled={reviewLoading}
                                    onClick={async () => {
                                        if (!pendingReview?.id) return
                                        setReviewLoading(true)
                                        try {
                                            await apiFetch("/reviews/mentor", {
                                                method: "POST",
                                                body: JSON.stringify({ scheduleId: pendingReview.id, rating, comment })
                                            })
                                            setPendingReview(null)
                                        } finally {
                                            setReviewLoading(false)
                                        }
                                    }}
                                    className="bg-[#00a3ff] text-white hover:bg-[#0088cc]"
                                >
                                    {reviewLoading ? "Submitting..." : "Submit review"}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </UserLayout>
    )
}
