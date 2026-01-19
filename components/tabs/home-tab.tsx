"use client"
import { Users, Wallet, Calendar, Tag, CreditCard, Bell, BookOpen, QrCode } from "lucide-react"
import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { useAuth } from "@/components/auth/auth-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface OpenGroup {
  id: string
  name: string
  kruzhokTitle: string
  studentsCount: number
  schedule?: string
}

interface WalletSummary {
  balance: number
  pendingBalance: number
  lessonsThisMonth: number
}

interface TodayLesson {
  id: string
  groupName: string
  time: string
  studentsCount: number
}

interface Subscription {
  id: string
  childName: string
  planLabel: string
  amount: number
  expiresAt: string
  isActive: boolean
}

interface Discount {
  id: string
  title: string
  description: string
  percent: number
  validUntil: string
}

interface NewsItem {
  id: string
  title: string
  content: string
  coverImageUrl?: string
  publishedAt?: string
}

interface StudentGroup {
  id: string
  name: string
  kruzhokTitle?: string
  scheduleDescription?: string | null
  mentor?: { fullName?: string; email?: string }
}

interface MentorScheduleItem {
  id: string
  title: string
  scheduledDate: string
  scheduledTime?: string | null
  class?: { id: string; name: string }
  kruzhok?: { id: string; title: string }
}

export default function HomeTab() {
  const router = useRouter()
  const { user } = useAuth() as any
  const userRole = user?.role

  const [loading, setLoading] = useState(true)
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([])
  const [mentorSchedule, setMentorSchedule] = useState<MentorScheduleItem[]>([])

  const [openGroups, setOpenGroups] = useState<OpenGroup[]>([])
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null)
  const [todayLessons, setTodayLessons] = useState<TodayLesson[]>([])

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [news, setNews] = useState<NewsItem[]>([])

  useEffect(() => {
    if (userRole === "student" || !userRole) {
      setLoading(true)
      apiFetch<{ groups: StudentGroup[] }>("/student/groups")
        .then((groupsRes) => {
          setStudentGroups(groupsRes?.groups || [])
        })
        .catch(() => {
          setStudentGroups([])
        })
        .finally(() => setLoading(false))
    }

    if (userRole === "mentor" || userRole === "admin") {
      setLoading(true)
      const from = new Date()
      const to = new Date()
      to.setDate(from.getDate() + 14)
      const query = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString()
      })
      Promise.all([
        apiFetch<OpenGroup[]>("/mentor/open-groups").catch(() => []),
        apiFetch<WalletSummary>("/mentor/wallet/summary").catch(() => ({ balance: 0, pendingBalance: 0, lessonsThisMonth: 0 })),
        apiFetch<TodayLesson[]>("/mentor/today-lessons").catch(() => []),
        apiFetch<MentorScheduleItem[]>(`/mentor/schedule?${query}`).catch(() => [])
      ]).then(([groups, wallet, lessons, schedule]) => {
        setOpenGroups(groups || [])
        setWalletSummary(wallet)
        setTodayLessons(lessons || [])
        setMentorSchedule(schedule || [])
      }).finally(() => setLoading(false))
    }

    if (userRole === "parent") {
      setLoading(true)
      Promise.all([
        apiFetch<Subscription[]>("/parent/subscriptions").catch(() => []),
        apiFetch<Discount[]>("/parent/discounts").catch(() => []),
        apiFetch<{ data: NewsItem[] }>("/news?limit=5").catch(() => ({ data: [] }))
      ]).then(([subs, discs, newsRes]) => {
        setSubscriptions(subs || [])
        setDiscounts(discs || [])
        setNews(newsRes?.data || [])
      }).finally(() => setLoading(false))
    }
  }, [userRole])

  const formatCurrency = (amount: number) => {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)} KZT`
  }

  const goToTab = (tab: string) => {
    router.push(`/dashboard?tab=${tab}`)
  }

  const upcomingMentorLessons = mentorSchedule
    .filter((item) => new Date(item.scheduledDate).getTime() >= Date.now())
    .slice(0, 4)

  const nextPayment = subscriptions
    .filter((s) => s.expiresAt)
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())[0]

  if (userRole === "mentor" || userRole === "admin") {
    return (
      <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-slide-up">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-[#00a3ff]/20 to-[#0066cc]/10 border border-[#00a3ff]/30 rounded-2xl p-5 animate-slide-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#00a3ff] flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-[var(--color-text-3)]">Payroll balance</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-1)] mb-1">
              {formatCurrency(walletSummary?.balance || 0)}
            </div>
            {(walletSummary?.pendingBalance || 0) > 0 && (
              <div className="text-xs text-yellow-500">
                +{formatCurrency(walletSummary?.pendingBalance || 0)} pending
              </div>
            )}
            <div className="text-xs text-[var(--color-text-3)] mt-2">
              Lessons this month: {walletSummary?.lessonsThisMonth || 0}
            </div>
          </div>

          <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl p-5 animate-slide-up" style={{ animationDelay: "100ms" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#22c55e] flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-[var(--color-text-3)]">Today</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-1)] mb-1">
              {todayLessons.length} {todayLessons.length === 1 ? "lesson" : "lessons"}
            </div>
            {todayLessons.length > 0 && (
              <div className="text-xs text-[var(--color-text-3)]">
                Next: {todayLessons[0]?.time} - {todayLessons[0]?.groupName}
              </div>
            )}
          </div>

          <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl p-5 animate-slide-up" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#f59e0b] flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-[var(--color-text-3)]">Open groups</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-1)] mb-1">
              {openGroups.length}
            </div>
            <div className="text-xs text-[var(--color-text-3)]">
              Recruiting new students
            </div>
          </div>
        </div>

        {openGroups.length > 0 && (
          <section className="mb-8">
            <h2 className="text-[var(--color-text-1)] text-xl font-medium mb-4">New open groups</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {openGroups.map((group, idx) => (
                <div
                  key={group.id}
                  className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-xl p-4 hover:border-[var(--color-border-hover-1)] transition-all animate-slide-up"
                  style={{ animationDelay: `${300 + idx * 50}ms` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-[var(--color-text-1)]">{group.name}</h3>
                    <span className="text-xs bg-[#f59e0b]/20 text-[#f59e0b] px-2 py-1 rounded-full">Recruiting</span>
                  </div>
                  <p className="text-sm text-[var(--color-text-3)] mb-2">{group.kruzhokTitle}</p>
                  <div className="flex items-center gap-4 text-xs text-[var(--color-text-3)]">
                    <span>{group.studentsCount} students</span>
                    {group.schedule && <span>{group.schedule}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-8">
          <h2 className="text-[var(--color-text-1)] text-xl font-medium mb-4">Upcoming lessons</h2>
          {upcomingMentorLessons.length === 0 ? (
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl p-6 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-3)] opacity-50" />
              <p className="text-[var(--color-text-3)] text-sm">No upcoming lessons scheduled.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingMentorLessons.map((lesson, idx) => (
                <div
                  key={lesson.id}
                  className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-xl p-4 animate-slide-up"
                  style={{ animationDelay: `${250 + idx * 50}ms` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-[var(--color-text-1)]">{lesson.title}</h3>
                    <span className="text-xs text-[var(--color-text-3)]">
                      {new Date(lesson.scheduledDate).toLocaleDateString("en-US")}
                    </span>
                  </div>
                  <div className="text-sm text-[var(--color-text-3)] mb-2">
                    {lesson.class?.name || "Group"} - {lesson.kruzhok?.title || "Program"}
                  </div>
                  {lesson.scheduledTime && (
                    <div className="text-xs text-[var(--color-text-3)]">
                      Starts at {lesson.scheduledTime}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        
      </main>
    )
  }

  if (userRole === "parent") {
    return (
      <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-slide-up">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-[#22c55e]/20 to-[#16a34a]/10 border border-[#22c55e]/30 rounded-2xl p-5 animate-slide-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#22c55e] flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-[var(--color-text-3)]">Subscriptions</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-1)] mb-1">
              {subscriptions.filter(s => s.isActive).length} active
            </div>
            <div className="text-xs text-[var(--color-text-3)]">
              Total: {subscriptions.length}
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#f59e0b]/20 to-[#d97706]/10 border border-[#f59e0b]/30 rounded-2xl p-5 animate-slide-up" style={{ animationDelay: "100ms" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#f59e0b] flex items-center justify-center">
                <Tag className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-[var(--color-text-3)]">Discounts</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-1)] mb-1">
              {discounts.length} offers
            </div>
            <div className="text-xs text-[var(--color-text-3)]">
              Active promotions and bundles
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#0ea5e9]/20 to-[#0284c7]/10 border border-[#0ea5e9]/30 rounded-2xl p-5 animate-slide-up" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#0ea5e9] flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-[var(--color-text-3)]">Next payment</span>
            </div>
            {nextPayment ? (
              <>
                <div className="text-2xl font-bold text-[var(--color-text-1)] mb-1">
                  {new Date(nextPayment.expiresAt).toLocaleDateString("en-US")}
                </div>
                <div className="text-xs text-[var(--color-text-3)]">
                  {nextPayment.childName} • {formatCurrency(nextPayment.amount)}
                </div>
              </>
            ) : (
              <div className="text-sm text-[var(--color-text-3)]">No upcoming payments.</div>
            )}
          </div>
        </div>

        <section className="mb-8">
          <h2 className="text-[var(--color-text-1)] text-xl font-medium mb-4">Children subscriptions</h2>
          {subscriptions.length === 0 ? (
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl p-6 text-center">
              <CreditCard className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-3)] opacity-50" />
              <p className="text-[var(--color-text-3)] text-sm">No active subscriptions.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subscriptions.map((sub, idx) => (
                <div
                  key={sub.id}
                  className={`bg-[var(--color-surface-2)] border rounded-xl p-4 animate-slide-up ${sub.isActive ? "border-[#22c55e]/30" : "border-[#ef4444]/30"}`}
                  style={{ animationDelay: `${200 + idx * 50}ms` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-[var(--color-text-1)]">{sub.childName}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${sub.isActive ? "bg-[#22c55e]/20 text-[#22c55e]" : "bg-[#ef4444]/20 text-[#ef4444]"}`}>
                      {sub.isActive ? "Active" : "Expired"}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-3)] mb-2">{sub.planLabel}</p>
                  <div className="text-xs text-[var(--color-text-3)] mb-1">
                    Amount: {formatCurrency(sub.amount)}
                  </div>
                  <div className="text-xs text-[var(--color-text-3)]">
                    Expires: {new Date(sub.expiresAt).toLocaleDateString("en-US")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mb-8">
          <h2 className="text-[var(--color-text-1)] text-xl font-medium mb-4">Available discounts</h2>
          {discounts.length === 0 ? (
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl p-6 text-center">
              <Tag className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-3)] opacity-50" />
              <p className="text-[var(--color-text-3)] text-sm">No discounts right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {discounts.map((disc, idx) => (
                <div
                  key={disc.id}
                  className="bg-gradient-to-r from-[#f59e0b]/10 to-transparent border border-[#f59e0b]/20 rounded-xl p-4 animate-slide-up"
                  style={{ animationDelay: `${300 + idx * 50}ms` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-[var(--color-text-1)]">{disc.title}</h3>
                    <span className="text-lg font-bold text-[#f59e0b]">-{disc.percent}%</span>
                  </div>
                  <p className="text-sm text-[var(--color-text-3)] mb-2">{disc.description}</p>
                  <div className="text-xs text-[var(--color-text-3)]">
                    Valid until: {new Date(disc.validUntil).toLocaleDateString("en-US")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-[var(--color-text-1)] text-xl font-medium mb-4">News</h2>
          {news.length === 0 ? (
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl p-6 text-center">
              <Bell className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-3)] opacity-50" />
              <p className="text-[var(--color-text-3)] text-sm">No news yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {news.map((item) => (
                <div key={item.id} className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-xl p-4">
                  <div className="text-[var(--color-text-1)] font-medium">{item.title}</div>
                  <div className="text-[var(--color-text-3)] text-sm mt-1 line-clamp-3">{item.content}</div>
                  {item.publishedAt && (
                    <div className="text-xs text-[var(--color-text-3)] mt-3">
                      {new Date(item.publishedAt).toLocaleDateString("en-US")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-slide-up">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#00a3ff] flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-[var(--color-text-3)]">Current schedule</span>
          </div>
          {loading ? (
            <div className="text-[var(--color-text-3)] text-sm">Loading schedule...</div>
          ) : studentGroups.length === 0 ? (
            <div className="text-[var(--color-text-3)] text-sm">No classes assigned yet.</div>
          ) : (
            <div className="space-y-2 text-sm">
              {studentGroups.slice(0, 3).map((group) => (
                <div key={group.id} className="flex items-center justify-between">
                  <div className="text-[var(--color-text-1)]">{group.name}</div>
                  <div className="text-[var(--color-text-3)]">
                    {group.scheduleDescription || "Schedule pending"}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" className="w-full mt-4" onClick={() => goToTab("schedule")}>
            Open schedule
          </Button>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#f59e0b] flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-[var(--color-text-3)]">Active group</span>
          </div>
          {loading ? (
            <div className="text-[var(--color-text-3)] text-sm">Loading groups...</div>
          ) : studentGroups.length === 0 ? (
            <div className="text-[var(--color-text-3)] text-sm">No active group yet.</div>
          ) : (
            <div className="space-y-1 text-sm">
              <div className="text-[var(--color-text-1)] font-medium">{studentGroups[0]?.name}</div>
              <div className="text-[var(--color-text-3)]">
                {studentGroups[0]?.kruzhokTitle || "Program"}
              </div>
              <div className="text-[var(--color-text-3)]">
                {studentGroups[0]?.scheduleDescription || "Schedule pending"}
              </div>
            </div>
          )}
          <Button variant="outline" className="w-full mt-4" onClick={() => goToTab("schedule")}>
            View classes
          </Button>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#f59e0b] flex items-center justify-center">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-[var(--color-text-3)]">Attendance</span>
          </div>
          <p className="text-sm text-[var(--color-text-3)]">
            Scan the QR code from your mentor to mark attendance.
          </p>
          <Button className="w-full mt-4" onClick={() => goToTab("scan")}>
            Mark attendance
          </Button>
        </div>
      </div>

      <section>
        <h2 className="text-[var(--color-text-1)] text-xl font-medium mb-4">Classes</h2>
        {loading ? (
          <div className="text-[var(--color-text-3)]">Loading classes...</div>
        ) : studentGroups.length === 0 ? (
          <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl p-6 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-3)] opacity-50" />
            <p className="text-[var(--color-text-3)] text-sm">You are not enrolled in any classes yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {studentGroups.map((group, idx) => (
              <div
                key={group.id}
                className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-xl p-4 animate-slide-up"
                style={{ animationDelay: `${200 + idx * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-[var(--color-text-1)]">{group.name}</h3>
                  <span className="text-xs text-[var(--color-text-3)]">
                    {group.kruzhokTitle || "Program"}
                  </span>
                </div>
                <div className="text-sm text-[var(--color-text-3)]">
                  {group.scheduleDescription || "Schedule pending"}
                </div>
                {group.mentor?.fullName && (
                  <div className="text-xs text-[var(--color-text-3)] mt-2">
                    Mentor: {group.mentor.fullName}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
