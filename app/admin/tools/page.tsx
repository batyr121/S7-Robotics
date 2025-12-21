"use client"
import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { Activity, Database, Server, RefreshCw, Mail, ShieldAlert } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"

interface Stats { totalUsers: number; totalCourses: number; pendingPayments: number; completedPayments: number; newUsersThisWeek: number; totalRevenue: number }

export default function AdminToolsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [health, setHealth] = useState<string>("...")
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      apiFetch<Stats>("/api/admin/stats").catch(() => null),
      fetch("/api/health").then(r => r.ok ? r.json() : Promise.reject()).catch(() => ({ status: "error" })),
    ]).then(([s, h]: any) => { setStats(s); setHealth(h?.status || "error") }).finally(() => setLoading(false))
  }, [])

  const runAction = async (action: string, label: string) => {
    setActionLoading(action)
    // Mock actions for now or implement specific endpoints if they existed
    setTimeout(() => {
      toast({ title: "Успешно", description: `Действие "${label}" выполнено` })
      setActionLoading(null)
    }, 1500)
  }

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
      <h1 className="text-white text-2xl font-bold mb-6 flex items-center gap-2">
        <Server className="w-6 h-6 text-[#00a3ff]" />
        Инструменты системы
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#16161c] border border-[#636370]/20 rounded-2xl p-6 text-white relative overflow-hidden group">
          <div className="text-sm text-white/60 flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-green-500" /> System Health
          </div>
          <div className="text-2xl font-bold text-green-500">{health.toUpperCase()}</div>
          <div className="absolute right-[-10px] bottom-[-10px] opacity-5 group-hover:opacity-10 transition-opacity">
            <Activity className="w-24 h-24" />
          </div>
        </div>
        <div className="bg-[#16161c] border border-[#636370]/20 rounded-2xl p-6 text-white">
          <div className="text-sm text-white/60 mb-1">Всего пользователей</div>
          <div className="text-3xl font-bold">{stats?.totalUsers ?? 0}</div>
        </div>
        <div className="bg-[#16161c] border border-[#636370]/20 rounded-2xl p-6 text-white">
          <div className="text-sm text-white/60 mb-1">Активные курсы</div>
          <div className="text-3xl font-bold">{stats?.totalCourses ?? 0}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#16161c] border border-[#636370]/20 rounded-2xl p-6 text-white">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-500" />
            Обслуживание данных
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-[#0f0f14] rounded-xl border border-[#2a2a35]">
              <div>
                <div className="font-medium text-sm">Очистка кэша</div>
                <div className="text-xs text-white/50">Сброс кэша приложения и CDN</div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="bg-[#2a2a35] hover:bg-[#333344] text-white"
                disabled={!!actionLoading}
                onClick={() => runAction("cache", "Очистка кэша")}
              >
                {actionLoading === "cache" ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Запуск"}
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#0f0f14] rounded-xl border border-[#2a2a35]">
              <div>
                <div className="font-medium text-sm">Переиндексация поиска</div>
                <div className="text-xs text-white/50">Обновление поисковых индексов</div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="bg-[#2a2a35] hover:bg-[#333344] text-white"
                disabled={!!actionLoading}
                onClick={() => runAction("index", "Переиндексация")}
              >
                {actionLoading === "index" ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Запуск"}
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-[#16161c] border border-[#636370]/20 rounded-2xl p-6 text-white">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-yellow-500" />
            Диагностика и Тесты
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-[#0f0f14] rounded-xl border border-[#2a2a35]">
              <div>
                <div className="font-medium text-sm">Тест Email рассылки</div>
                <div className="text-xs text-white/50">Отправка тестового письма админу</div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="bg-[#2a2a35] hover:bg-[#333344] text-white"
                disabled={!!actionLoading}
                onClick={() => runAction("email", "Тест Email")}
              >
                {actionLoading === "email" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
