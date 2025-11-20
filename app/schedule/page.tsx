"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { Calendar, Clock, MapPin, Users, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import UserLayout from "@/components/layout/user-layout"

type ScheduleEvent = {
  id: string
  date: string
  classTitle: string
  clubName: string
  location?: string
  dayOfWeek: number
  startTime: string
  endTime: string
  sessionId?: string
  clubId: string
  classId: string
}

export default function SchedulePage() {
  const router = useRouter()
  const [pageLoading, setPageLoading] = useState(true)
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()))
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [currentDateLabel, setCurrentDateLabel] = useState("")

  function getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day // Monday is first day
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  function getWeekDays(weekStart: Date): Date[] {
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      days.push(d)
    }
    return days
  }

  function getMonthDays(date: Date): Date[] {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const days: Date[] = []
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1

    // Add previous month days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(firstDay)
      d.setDate(firstDay.getDate() - i - 1)
      days.push(d)
    }

    // Add current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }

    // Add next month days to fill grid
    const remainingDays = 42 - days.length
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(lastDay)
      d.setDate(lastDay.getDate() + i)
      days.push(d)
    }

    return days
  }

  const loadSchedule = async () => {
    setPageLoading(true)
    try {
      const clubs = await apiFetch<any[]>(`/api/clubs/mine?limit=100`)
      const allEvents: ScheduleEvent[] = []

      for (const club of clubs) {
        for (const cls of club.classes || []) {
          // Load sessions
          const from = new Date(currentWeekStart)
          from.setDate(from.getDate() - 30) // 30 days before
          const to = new Date(currentWeekStart)
          to.setDate(to.getDate() + 60) // 60 days after

          const sessions = await apiFetch<any[]>(`/api/clubs/classes/${cls.id}/sessions?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`)

          for (const session of sessions) {
            allEvents.push({
              id: session.id,
              date: session.date,
              classTitle: cls.title,
              clubName: club.name,
              location: cls.location || club.location,
              dayOfWeek: new Date(session.date).getDay(),
              startTime: "00:00",
              endTime: "00:00",
              sessionId: session.id,
              clubId: club.id,
              classId: cls.id,
            })
          }

          // Add schedule items as recurring events
          for (const item of cls.scheduleItems || []) {
            const weekDays = viewMode === 'week' ? getWeekDays(currentWeekStart) : getMonthDays(currentWeekStart)
            for (const day of weekDays) {
              if (day.getDay() === item.dayOfWeek) {
                allEvents.push({
                  id: `sched-${item.id}-${day.toISOString()}`,
                  date: day.toISOString(),
                  classTitle: cls.title,
                  clubName: club.name,
                  location: item.location || cls.location || club.location,
                  dayOfWeek: item.dayOfWeek,
                  startTime: item.startTime,
                  endTime: item.endTime,
                  clubId: club.id,
                  classId: cls.id,
                })
              }
            }
          }
        }
      }

      setEvents(allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось загрузить расписание", variant: "destructive" })
    } finally {
      setPageLoading(false)
    }
  }

  useEffect(() => {
    loadSchedule()
  }, [currentWeekStart, viewMode])

  // Header date label
  useEffect(() => {
    const updateDate = () => {
      const now = new Date()
      const months = [
        "Января", "Февраля", "Марта", "Апреля", "Мая", "Июня",
        "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря",
      ]
      const day = now.getDate()
      const month = months[now.getMonth()]
      setCurrentDateLabel(`${day} ${month}`)
    }

    updateDate()
    const interval = setInterval(updateDate, 24 * 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const goToPrevious = () => {
    const d = new Date(currentWeekStart)
    if (viewMode === 'week') {
      d.setDate(d.getDate() - 7)
    } else {
      d.setMonth(d.getMonth() - 1)
    }
    setCurrentWeekStart(d)
  }

  const goToNext = () => {
    const d = new Date(currentWeekStart)
    if (viewMode === 'week') {
      d.setDate(d.getDate() + 7)
    } else {
      d.setMonth(d.getMonth() + 1)
    }
    setCurrentWeekStart(d)
  }

  const goToToday = () => {
    setCurrentWeekStart(getWeekStart(new Date()))
  }

  const renderWeekView = () => {
    const days = getWeekDays(currentWeekStart)
    const dayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

    return (
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, idx) => {
          const dayEvents = events.filter(e => {
            const eDate = new Date(e.date)
            return eDate.toDateString() === day.toDateString()
          })

          const isToday = day.toDateString() === new Date().toDateString()

          return (
            <div key={day.toISOString()} className={`bg-[#16161c] border ${isToday ? 'border-[#00a3ff]' : 'border-[#2a2a35]'} rounded-xl p-3 min-h-[200px]`}>
              <div className="text-sm font-medium mb-2">{dayNames[idx]}</div>
              <div className="text-white/60 text-xs mb-3">{day.getDate()} {day.toLocaleDateString('ru-RU', { month: 'short' })}</div>
              <div className="space-y-2">
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    className="bg-[#0f0f14] border border-[#2a2a35] rounded-lg p-2 cursor-pointer hover:bg-[#1b1b22] transition-colors"
                    onClick={() => router.push(`/clubs?highlight=${event.classId}`)}
                  >
                    <div className="text-xs font-medium text-white/90 mb-1">{event.classTitle}</div>
                    <div className="text-xs text-white/60 mb-1">{event.clubName}</div>
                    {event.startTime !== "00:00" && (
                      <div className="text-xs text-white/50 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {event.startTime} - {event.endTime}
                      </div>
                    )}
                    {event.location && (
                      <div className="text-xs text-white/50 inline-flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderMonthView = () => {
    const days = getMonthDays(currentWeekStart)
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    const currentMonth = currentWeekStart.getMonth()

    return (
      <div>
        <div className="grid grid-cols-7 gap-2 mb-2">
          {dayNames.map(name => (
            <div key={name} className="text-center text-sm font-medium text-white/80 py-2">
              {name}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map(day => {
            const dayEvents = events.filter(e => {
              const eDate = new Date(e.date)
              return eDate.toDateString() === day.toDateString()
            })

            const isToday = day.toDateString() === new Date().toDateString()
            const isCurrentMonth = day.getMonth() === currentMonth

            return (
              <div
                key={day.toISOString()}
                className={`bg-[#16161c] border ${isToday ? 'border-[#00a3ff]' : 'border-[#2a2a35]'} rounded-lg p-2 min-h-[100px] ${!isCurrentMonth ? 'opacity-50' : ''}`}
              >
                <div className="text-sm font-medium mb-1">{day.getDate()}</div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map(event => (
                    <div
                      key={event.id}
                      className="bg-[#0f0f14] border border-[#2a2a35] rounded px-2 py-1 cursor-pointer hover:bg-[#1b1b22] transition-colors"
                      onClick={() => router.push(`/clubs?highlight=${event.classId}`)}
                    >
                      <div className="text-xs text-white/80 truncate">{event.classTitle}</div>
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-white/50 px-2">+{dayEvents.length - 2} ещё</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const periodLabel = viewMode === 'week'
    ? `${currentWeekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} - ${new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : currentWeekStart.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  return (
    <UserLayout title="Расписание" activeTab="schedule">
      <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white text-2xl md:text-3xl font-bold mb-1">Расписание</h1>
              <div className="text-white/60 text-sm">Все занятия и события</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('week')}
                className={`px-4 py-2 rounded-lg text-sm ${viewMode === 'week' ? 'bg-[#00a3ff] text-black' : 'bg-[#16161c] border border-[#2a2a35] text-white'}`}
              >
                Неделя
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-4 py-2 rounded-lg text-sm ${viewMode === 'month' ? 'bg-[#00a3ff] text-black' : 'bg-[#16161c] border border-[#2a2a35] text-white'}`}
              >
                Месяц
              </button>
            </div>
          </div>

          <div className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={goToPrevious}
                className="p-2 rounded-lg bg-[#0f0f14] border border-[#2a2a35] hover:bg-[#1b1b22] transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={goToToday}
                  className="px-4 py-2 rounded-lg bg-[#0f0f14] border border-[#2a2a35] text-white text-sm hover:bg-[#1b1b22] transition-colors"
                >
                  Сегодня
                </button>
                <div className="text-white font-medium">{periodLabel}</div>
              </div>

              <button
                onClick={goToNext}
                className="p-2 rounded-lg bg-[#0f0f14] border border-[#2a2a35] hover:bg-[#1b1b22] transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </div>

            {pageLoading ? (
              <div className="text-white/60 text-center py-12">Загрузка расписания...</div>
            ) : (
              viewMode === 'week' ? renderWeekView() : renderMonthView()
            )}
          </div>

          <div className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-4">
            <div className="text-sm font-medium text-white mb-3">Статистика</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl p-3">
                <div className="text-white/60 text-xs mb-1">Всего событий</div>
                <div className="text-white text-2xl font-bold">{events.length}</div>
              </div>
              <div className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl p-3">
                <div className="text-white/60 text-xs mb-1">На этой неделе</div>
                <div className="text-white text-2xl font-bold">
                  {events.filter(e => {
                    const eDate = new Date(e.date)
                    const weekStart = getWeekStart(new Date())
                    const weekEnd = new Date(weekStart)
                    weekEnd.setDate(weekEnd.getDate() + 7)
                    return eDate >= weekStart && eDate < weekEnd
                  }).length}
                </div>
              </div>
              <div className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl p-3">
                <div className="text-white/60 text-xs mb-1">Сегодня</div>
                <div className="text-white text-2xl font-bold">
                  {events.filter(e => new Date(e.date).toDateString() === new Date().toDateString()).length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </UserLayout>
  )
}
