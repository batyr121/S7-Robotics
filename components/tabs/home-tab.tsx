"use client"
import { ArrowUpRight, Search, Users, Wallet, Calendar, Tag, CreditCard, Bell } from "lucide-react"
import type { CourseDetails } from "@/components/tabs/course-details-tab"
import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { useAuth } from "@/components/auth/auth-context"

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
  courseName: string
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

export default function HomeTab({
  onOpenCourse,
}: {
  onOpenCourse?: (course: CourseDetails) => void
}) {
  const { user } = useAuth() as any
  const userRole = user?.role

  const [continueCourses, setContinueCourses] = useState<CourseDetails[]>([])
  const [loading, setLoading] = useState(true)

  // Mentor-specific state
  const [openGroups, setOpenGroups] = useState<OpenGroup[]>([])
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null)
  const [todayLessons, setTodayLessons] = useState<TodayLesson[]>([])

  // Parent-specific state
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [discounts, setDiscounts] = useState<Discount[]>([])

  useEffect(() => {
    // Load courses for students
    if (userRole === 'student' || !userRole) {
      apiFetch<any[]>("/courses/continue")
        .then((list) => {
          const mapped: CourseDetails[] = (list || []).map((c: any) => ({
            id: c.id,
            title: c.title,
            difficulty: c.difficulty || "",
            author: c.author?.fullName || "",
            price: Number(c.price || 0),
            modules: (c.modules || []).map((m: any) => ({ id: m.id, title: m.title, lessons: m.lessons || [] })),
          }))
          setContinueCourses(mapped)
        })
        .catch(() => setContinueCourses([]))
        .finally(() => setLoading(false))
    }

    // Mentor data
    if (userRole === 'mentor') {
      setLoading(true)
      Promise.all([
        apiFetch<OpenGroup[]>("/mentor/open-groups").catch(() => []),
        apiFetch<WalletSummary>("/mentor/wallet/summary").catch(() => ({ balance: 0, pendingBalance: 0, lessonsThisMonth: 0 })),
        apiFetch<TodayLesson[]>("/mentor/today-lessons").catch(() => []),
      ]).then(([groups, wallet, lessons]) => {
        setOpenGroups(groups || [])
        setWalletSummary(wallet)
        setTodayLessons(lessons || [])
      }).finally(() => setLoading(false))
    }

    // Parent data
    if (userRole === 'parent') {
      setLoading(true)
      Promise.all([
        apiFetch<Subscription[]>("/parent/subscriptions").catch(() => []),
        apiFetch<Discount[]>("/parent/discounts").catch(() => []),
      ]).then(([subs, discs]) => {
        setSubscriptions(subs || [])
        setDiscounts(discs || [])
      }).finally(() => setLoading(false))
    }
  }, [userRole])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0 }).format(amount) + ' ₸'
  }

  // MENTOR HOME
  if (userRole === 'mentor') {
    return (
      <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-slide-up">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Wallet Widget */}
          <div className="bg-gradient-to-br from-[#00a3ff]/20 to-[#0066cc]/10 border border-[#00a3ff]/30 rounded-2xl p-5 animate-slide-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#00a3ff] flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-[var(--color-text-3)]">Зарплата</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-1)] mb-1">
              {formatCurrency(walletSummary?.balance || 0)}
            </div>
            {(walletSummary?.pendingBalance || 0) > 0 && (
              <div className="text-xs text-yellow-500">
                +{formatCurrency(walletSummary?.pendingBalance || 0)} в обработке
              </div>
            )}
            <div className="text-xs text-[var(--color-text-3)] mt-2">
              Уроков в этом месяце: {walletSummary?.lessonsThisMonth || 0}
            </div>
          </div>

          {/* Today's Schedule */}
          <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl p-5 animate-slide-up" style={{ animationDelay: "100ms" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#22c55e] flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-[var(--color-text-3)]">Сегодня</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-1)] mb-1">
              {todayLessons.length} {todayLessons.length === 1 ? 'урок' : 'уроков'}
            </div>
            {todayLessons.length > 0 && (
              <div className="text-xs text-[var(--color-text-3)]">
                Ближайший: {todayLessons[0]?.time} — {todayLessons[0]?.groupName}
              </div>
            )}
          </div>

          {/* Open Groups */}
          <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl p-5 animate-slide-up" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#f59e0b] flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-[var(--color-text-3)]">Новые группы</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-1)] mb-1">
              {openGroups.length}
            </div>
            <div className="text-xs text-[var(--color-text-3)]">
              Доступно для набора
            </div>
          </div>
        </div>

        {/* Open Groups List */}
        {openGroups.length > 0 && (
          <section className="mb-8">
            <h2 className="text-[var(--color-text-1)] text-xl font-medium mb-4">Новые открытые группы</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {openGroups.map((group, idx) => (
                <div
                  key={group.id}
                  className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-xl p-4 hover:border-[var(--color-border-hover-1)] transition-all animate-slide-up"
                  style={{ animationDelay: `${300 + idx * 50}ms` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-[var(--color-text-1)]">{group.name}</h3>
                    <span className="text-xs bg-[#f59e0b]/20 text-[#f59e0b] px-2 py-1 rounded-full">Открыта</span>
                  </div>
                  <p className="text-sm text-[var(--color-text-3)] mb-2">{group.kruzhokTitle}</p>
                  <div className="flex items-center gap-4 text-xs text-[var(--color-text-3)]">
                    <span>{group.studentsCount} учеников</span>
                    {group.schedule && <span>{group.schedule}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* News Section */}
        <section>
          <h2 className="text-[var(--color-text-1)] text-xl font-medium mb-4">Новости</h2>
          <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 bg-black/20 border border-[var(--color-border-1)]">
              <Bell className="w-6 h-6 text-[var(--color-text-3)]" />
            </div>
            <p className="text-[var(--color-text-3)] text-sm">Пока нет новостей</p>
          </div>
        </section>
      </main>
    )
  }

  // PARENT HOME
  if (userRole === 'parent') {
    return (
      <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-slide-up">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Subscriptions */}
          <div className="bg-gradient-to-br from-[#22c55e]/20 to-[#16a34a]/10 border border-[#22c55e]/30 rounded-2xl p-5 animate-slide-up">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#22c55e] flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-[var(--color-text-3)]">Абонементы</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-1)] mb-1">
              {subscriptions.filter(s => s.isActive).length} активных
            </div>
            <div className="text-xs text-[var(--color-text-3)]">
              Всего: {subscriptions.length}
            </div>
          </div>

          {/* Discounts */}
          <div className="bg-gradient-to-br from-[#f59e0b]/20 to-[#d97706]/10 border border-[#f59e0b]/30 rounded-2xl p-5 animate-slide-up" style={{ animationDelay: "100ms" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#f59e0b] flex items-center justify-center">
                <Tag className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-[var(--color-text-3)]">Скидки</span>
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-1)] mb-1">
              {discounts.length} доступно
            </div>
            <div className="text-xs text-[var(--color-text-3)]">
              Акции и специальные предложения
            </div>
          </div>
        </div>

        {/* Subscriptions List */}
        <section className="mb-8">
          <h2 className="text-[var(--color-text-1)] text-xl font-medium mb-4">Абонементы детей</h2>
          {subscriptions.length === 0 ? (
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl p-6 text-center">
              <CreditCard className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-3)] opacity-50" />
              <p className="text-[var(--color-text-3)] text-sm">Нет активных абонементов</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subscriptions.map((sub, idx) => (
                <div
                  key={sub.id}
                  className={`bg-[var(--color-surface-2)] border rounded-xl p-4 animate-slide-up ${sub.isActive ? 'border-[#22c55e]/30' : 'border-[#ef4444]/30'}`}
                  style={{ animationDelay: `${200 + idx * 50}ms` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-[var(--color-text-1)]">{sub.childName}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${sub.isActive ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-[#ef4444]/20 text-[#ef4444]'}`}>
                      {sub.isActive ? 'Активен' : 'Истёк'}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-3)] mb-2">{sub.courseName}</p>
                  <div className="text-xs text-[var(--color-text-3)]">
                    До: {new Date(sub.expiresAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Discounts List */}
        <section className="mb-8">
          <h2 className="text-[var(--color-text-1)] text-xl font-medium mb-4">Актуальные скидки</h2>
          {discounts.length === 0 ? (
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl p-6 text-center">
              <Tag className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-3)] opacity-50" />
              <p className="text-[var(--color-text-3)] text-sm">Нет актуальных скидок</p>
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
                    До: {new Date(disc.validUntil).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* News */}
        <section>
          <h2 className="text-[var(--color-text-1)] text-xl font-medium mb-4">Новости</h2>
          <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl p-6 text-center">
            <Bell className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-3)] opacity-50" />
            <p className="text-[var(--color-text-3)] text-sm">Пока нет новостей</p>
          </div>
        </section>
      </main>
    )
  }

  // STUDENT HOME (default)
  return (
    <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-slide-up">

      <section className="mb-8 md:mb-12">
        <h2
          className="text-[var(--color-text-1)] text-xl font-medium mb-4 md:mb-6 animate-slide-up"
          style={{ animationDelay: "200ms" }}
        >
          Продолжить
        </h2>
        {loading ? (
          <div className="text-[var(--color-text-3)]">Загрузка...</div>
        ) : continueCourses.length === 0 ? (
          <div className="text-[var(--color-text-3)] text-sm">Нет курсов для продолжения</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {continueCourses.map((c, idx) => (
              <div
                key={c.id}
                onClick={() => onOpenCourse?.(c)}
                role="link"
                tabIndex={0}
                className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl p-4 md:p-6 hover:border-[var(--color-border-hover-1)] transition-all duration-[var(--dur-mid)] cursor-pointer group hover:scale-102 animate-slide-up"
                style={{ animationDelay: `${300 + idx * 100}ms` }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-[var(--color-text-1)] text-lg font-medium mb-2">{c.title}</h3>
                    <span className="inline-block bg-[#22c55e] text-black text-xs font-medium px-3 py-1 rounded-full">
                      {c.difficulty || "Курс"}
                    </span>
                  </div>
                  <ArrowUpRight className="w-6 h-6 text-[var(--color-text-3)] group-hover:text-[var(--color-text-1)] transition-colors duration-[var(--dur-mid)]" />
                </div>
                <div className="text-[var(--color-text-3)] text-sm space-y-1">
                  <div>Автор: {c.author || "—"}</div>
                  <div>Уроков: {(c.modules || []).reduce((acc, m) => acc + (m.lessons?.length || 0), 0)}</div>
                  <div>Стоимость: {c.price && c.price > 0 ? `${c.price.toLocaleString()}₸` : "0₸"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>


      <section>
        <h2
          className="text-[var(--color-text-1)] text-xl font-medium mb-4 md:mb-6 animate-slide-up"
          style={{ animationDelay: "800ms" }}
        >
          Новости
        </h2>
        <div
          className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl p-6 md:p-8 text-center animate-slide-up"
          style={{ animationDelay: "900ms" }}
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-black/20 border border-[var(--color-border-1)]">
            <Search className="w-7 h-7 text-[var(--color-text-3)]" />
          </div>
          <h3 className="text-[var(--color-text-1)] text-lg font-medium mb-2">Ничего не найдено</h3>
          <p className="text-[var(--color-text-3)] text-sm">Пока нет новостей</p>
        </div>
      </section>
    </main>
  )
}

