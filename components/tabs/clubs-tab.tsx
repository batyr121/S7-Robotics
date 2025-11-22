"use client"
import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { Plus, Calendar, MapPin, Users, Check, X, Clock, Building2, ArrowUpRight, Trash2, Download, FileText, ArrowLeft, ChevronRight, MoreHorizontal, Settings, BookOpen, Play } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm"
import { useAuth } from "@/components/auth/auth-context"
import { exportAttendanceToCSV, exportAttendanceToPDF } from "@/lib/export-utils"

type Club = {
  id: string
  name: string
  description?: string
  location?: string
  mentors?: Array<{ user: { id: string; fullName?: string; email: string } }>
  classes?: Array<{
    id: string
    title: string
    description?: string
    location?: string
    enrollments?: Array<{ user: { id: string; fullName: string; email: string } }>
    scheduleItems?: Array<{ id: string; dayOfWeek: number; startTime: string; endTime: string; location?: string }>
    sessions?: Array<{ id: string; date: string }>
  }>
}

export default function ClubsTab() {
  const { user } = useAuth() as any
  const confirm = useConfirm()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [clubs, setClubs] = useState<Club[]>([])
  
  // View State
  const [view, setView] = useState<'list' | 'create' | 'club' | 'class' | 'lesson' | 'journal'>('list')
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  // Data State
  const [sessions, setSessions] = useState<Record<string, Array<{ id: string; date: string; attendances?: Array<{ studentId: string; status: string; feedback?: string }> }>>>({})
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, Record<string, { status: string; feedback?: string }>>>({})
  const [loadingSessions, setLoadingSessions] = useState<Record<string, boolean>>({})
  const [programTemplates, setProgramTemplates] = useState<Record<string, Array<{ id: string; title: string; presentationUrl?: string; scriptUrl?: string }>>>({})
  const [inviteCodes, setInviteCodes] = useState<Record<string, string | null>>({})
  
  // Creation/Forms
  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [desc, setDesc] = useState("")
  const [creating, setCreating] = useState(false)
  const [newClass, setNewClass] = useState<{ title: string; location?: string }>({ title: "" })
  
  // Modals & Extras
  const [subOpen, setSubOpen] = useState(false)
  const [paymentComment, setPaymentComment] = useState("")
  const [submittingOpenRequest, setSubmittingOpenRequest] = useState(false)
  const [openRequestSent, setOpenRequestSent] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [joining, setJoining] = useState(false)
  const [upgradeModal, setUpgradeModal] = useState(false)
  const [limitError, setLimitError] = useState<{ type: 'class' | 'student' } | null>(null)
  const [currentDate, setCurrentDate] = useState("")

  // Quiz State
  const [quizOpen, setQuizOpen] = useState<string | null>(null)
  const [startingQuiz, setStartingQuiz] = useState<Record<string, boolean>>({})
  const [submittingQuiz, setSubmittingQuiz] = useState(false)
  const [quizBySession, setQuizBySession] = useState<Record<string, any>>({})
  const [quizAnswers, setQuizAnswers] = useState<Record<string, Record<number, number[]>>>({})
  const [submissionsOpen, setSubmissionsOpen] = useState<string | null>(null)
  const [submissionsBySession, setSubmissionsBySession] = useState<Record<string, Array<{ id: string; score: number; student: { id: string; fullName?: string; email: string } }>>>({})

  // Helper to get current objects
  const currentClub = clubs.find(c => c.id === selectedClubId)
  const currentClass = currentClub?.classes?.find(c => c.id === selectedClassId)
  const currentSession = selectedSessionId ? (sessions[selectedClassId || ''] || []).find(s => s.id === selectedSessionId) : null

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const isAdmin = String(user?.role || '').toUpperCase() === 'ADMIN'
      const list = await apiFetch<Club[]>(`/api/clubs/mine?limit=${isAdmin ? 30 : 100}`)
      setClubs(list)
    } catch (e: any) {
      setClubs([])
      setLoadError(e?.message || "Не удалось загрузить кружки")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  
  useEffect(() => {
    const now = new Date()
    const months = ["Января","Февраля","Марта","Апреля","Мая","Июня","Июля","Августа","Сентября","Октября","Ноября","Декабря"]
    const d = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`
    setCurrentDate(d)
  }, [])

  // Navigation
  const openClub = (id: string) => {
    setSelectedClubId(id)
    setNewClass({ title: "" }) // Reset new class form when opening a club
    setView('club')
  }
  const openClass = (id: string) => {
    setSelectedClassId(id)
    setView('class')
    loadClassSessions(id)
  }
  const openLesson = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setView('lesson')
  }
  const openJournal = () => {
    setView('journal')
  }
  const goBack = () => {
    if (view === 'journal') setView('class')
    else if (view === 'lesson') setView('class')
    else if (view === 'class') setView('club')
    else if (view === 'club') setView('list')
    else if (view === 'create') setView('list')
  }

  // Data Loading
  const loadClassSessions = async (classId: string) => {
    setLoadingSessions(prev => ({ ...prev, [classId]: true }))
    try {
      // Load range: roughly +/- 3 months to cover active semester
      const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
      const to = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
      const list = await apiFetch<any[]>(`/api/clubs/classes/${classId}/sessions?from=${from}&to=${to}`)
      setSessions(prev => ({ ...prev, [classId]: list }))
      
      // Populate attendance draft
      const draftEntries: Record<string, Record<string, { status: string; feedback?: string }>> = {}
      for (const s of list) {
        const key = `${classId}:${s.id}`
        if (Array.isArray(s.attendances)) {
          const m: Record<string, { status: string; feedback?: string }> = {}
          for (const a of s.attendances) {
            if (a?.studentId && a?.status) m[a.studentId] = { status: String(a.status), feedback: a.feedback || "" }
          }
          draftEntries[key] = m
        }
      }
      if (Object.keys(draftEntries).length) setAttendanceDraft(prev => ({ ...prev, ...draftEntries }))
      
      // Load templates
      const pid = (clubs.find(c => c.classes?.some(cl => cl.id === classId)) as any)?.programId
      if (pid) {
        const tpls = await apiFetch<any[]>(`/api/programs/${pid}/templates`)
        setProgramTemplates(prev => ({ ...prev, [classId]: (tpls||[]).map(t=>({ id: t.id, title: t.title, presentationUrl: t.presentationUrl, scriptUrl: t.scriptUrl })) }))
      }
    } catch {
      setSessions(prev => ({ ...prev, [classId]: [] }))
    } finally {
      setLoadingSessions(prev => ({ ...prev, [classId]: false }))
    }
  }

  const createClub = async () => {
    if (!name.trim()) {
      toast({ title: "Ошибка", description: "Введите название кружка", variant: "destructive" as any })
      return
    }
    try {
      setCreating(true)
      const created = await apiFetch<Club>("/api/clubs", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: desc.trim() || undefined, location: location.trim() || undefined })
      })
      setName(""); setLocation(""); setDesc("")
      setClubs(prev => [created, ...prev])
      setView('list')
      toast({ title: "Кружок создан" })
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось создать", variant: "destructive" as any })
    } finally {
      setCreating(false)
    }
  }

  const addClass = async () => {
    if (!selectedClubId || !newClass.title.trim()) return
    try {
      await apiFetch(`/api/clubs/${selectedClubId}/classes`, {
        method: 'POST',
        body: JSON.stringify({ title: newClass.title, location: newClass.location })
      })
      setNewClass({ title: "" })
      load() // Reload to get new class
      toast({ title: 'Класс создан' })
    } catch (e: any) {
       if (e?.message?.includes('лимит') || e?.message?.includes('максимум')) {
         setLimitError({ type: 'class' })
         setUpgradeModal(true)
       } else {
         toast({ title: 'Ошибка', description: e?.message || 'Не удалось создать', variant: 'destructive' as any })
       }
    }
  }

  const handleJoinByCode = async () => {
    const code = (joinCode || "").trim()
    if (!code) return
    try {
      setJoining(true)
      await apiFetch(`/api/clubs/join-by-code`, { method: "POST", body: JSON.stringify({ code }) })
      toast({ title: "Готово", description: "Вы присоединились к кружку" } as any)
      setJoinOpen(false); setJoinCode("")
      await load()
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось вступить", variant: "destructive" as any })
    } finally {
      setJoining(false)
    }
  }
  
  // Quiz Logic
  const startQuiz = async (sessionId: string) => {
    try {
      setStartingQuiz(prev => ({ ...prev, [sessionId]: true }))
      await apiFetch(`/api/clubs/sessions/${sessionId}/quiz/start`, { method: 'POST', body: JSON.stringify({}) })
      toast({ title: 'Квиз запущен', description: 'Ученики теперь могут видеть квиз' })
    } catch (e: any) {
      toast({ title: 'Ошибка', description: e?.message || 'Не удалось начать квиз', variant: 'destructive' as any })
    } finally {
      setStartingQuiz(prev => ({ ...prev, [sessionId]: false }))
    }
  }

  // Payment/Sub Request
  const submitSubscriptionRequest = async () => {
    try {
      setSubmittingOpenRequest(true)
      await apiFetch(`/api/subscriptions/request`, { 
        method: 'POST', 
        body: JSON.stringify({ type: 'ONETIME_PURCHASE', paymentComment }) 
      })
      setOpenRequestSent(true)
      toast({ title: 'Заявка отправлена' } as any)
      setTimeout(() => {
         setSubOpen(false)
         setView('create') // Go to creation page after request
      }, 1500)
    } catch (e: any) {
      toast({ title: 'Ошибка', description: e?.message, variant: 'destructive' as any })
    } finally {
      setSubmittingOpenRequest(false)
    }
  }

  useEffect(() => {
    if (!subOpen) return
    const base = String(user?.id || 'USER').slice(-4).toUpperCase()
    const rnd = Math.random().toString(36).slice(2, 7).toUpperCase()
    setPaymentComment(`S7-CLUB-${base}-${rnd}`)
    setOpenRequestSent(false)
  }, [subOpen, user?.id])

  // --- RENDER ---

  // 1. CREATE CLUB PAGE
  if (view === 'create') {
    return (
      <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up bg-black text-white">
        <div className="max-w-2xl mx-auto">
          <button onClick={goBack} className="mb-6 flex items-center gap-2 text-white/60 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Назад
          </button>
          <h1 className="text-3xl font-bold mb-2">Создание кружка</h1>
          <p className="text-white/60 mb-8">Заполните информацию о вашем новом кружке.</p>
          
          <div className="space-y-6 bg-[#16161c] border border-[#2a2a35] rounded-2xl p-8">
            <div className="space-y-2">
              <label className="text-sm font-medium">Название</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#0f0f14] border border-[#2a2a35] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00a3ff]" placeholder="Например: Робототехника" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Локация</label>
              <input value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-[#0f0f14] border border-[#2a2a35] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00a3ff]" placeholder="Например: Кабинет 204" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Описание (необязательно)</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-[#0f0f14] border border-[#2a2a35] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00a3ff] min-h-[100px]" placeholder="О чем этот кружок..." />
            </div>
            <button onClick={createClub} disabled={creating || !name.trim()} className="w-full rounded-xl bg-[#00a3ff] hover:bg-[#0088cc] text-black font-bold py-4 transition-colors disabled:opacity-50">
              {creating ? "Создание..." : "Создать кружок"}
            </button>
          </div>
        </div>
      </main>
    )
  }

  // 2. LIST VIEW
  if (view === 'list') {
    return (
      <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up space-y-8 bg-black text-white">
        <div className="flex items-start justify-between">
          <h1 className="text-3xl font-bold">Кружок</h1>
          <div className="text-right">
            <div className="text-xl font-semibold">{currentDate.split(" ").slice(0,2).join(" ")}</div>
            <div className="text-white/60 text-xs">{currentDate.split(" ").slice(2).join(" ")}</div>
          </div>
        </div>

        {/* Action Cards if empty or relevant */}
        {clubs.length === 0 && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div onClick={() => setSubOpen(true)} className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-6 hover:bg-[#1a1a22] transition-colors cursor-pointer group">
               <div className="flex items-center justify-between mb-4">
                 <div className="w-12 h-12 rounded-full bg-[#00a3ff]/10 flex items-center justify-center group-hover:bg-[#00a3ff]/20 transition-colors">
                   <Plus className="w-6 h-6 text-[#00a3ff]" />
                 </div>
                 <ArrowUpRight className="w-5 h-5 text-white/40 group-hover:text-white" />
               </div>
               <h3 className="text-xl font-semibold mb-1">Открыть кружок</h3>
               <p className="text-white/60 text-sm">Создайте свой кружок и начните обучение</p>
             </div>
             <div onClick={() => setJoinOpen(true)} className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-6 hover:bg-[#1a1a22] transition-colors cursor-pointer group">
               <div className="flex items-center justify-between mb-4">
                 <div className="w-12 h-12 rounded-full bg-[#00a3ff]/10 flex items-center justify-center group-hover:bg-[#00a3ff]/20 transition-colors">
                   <Users className="w-6 h-6 text-[#00a3ff]" />
                 </div>
                 <ArrowUpRight className="w-5 h-5 text-white/40 group-hover:text-white" />
               </div>
               <h3 className="text-xl font-semibold mb-1">Вступить в кружок</h3>
               <p className="text-white/60 text-sm">Присоединитесь по коду</p>
             </div>
          </div>
        )}

        {/* Clubs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clubs.map(club => (
            <div key={club.id} onClick={() => openClub(club.id)} className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-6 hover:border-[#00a3ff]/50 transition-all cursor-pointer group relative overflow-hidden">
              <div className="flex items-start justify-between mb-8">
                <div className="w-14 h-14 rounded-2xl bg-[#0f0f14] border border-[#2a2a35] flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-white" />
                </div>
                <ArrowUpRight className="w-6 h-6 text-white/40 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">{club.name}</h3>
              {club.location && <div className="flex items-center gap-1 text-white/60 text-sm mb-6"><MapPin className="w-3 h-3" /> {club.location}</div>}
              
              <div className="absolute bottom-6 right-6">
                <div className="bg-[#00a3ff] text-black text-xs font-bold px-4 py-2 rounded-full">
                  Кол-во классов: {(club.classes || []).length}
                </div>
              </div>
            </div>
          ))}
          {/* Create Button if user has clubs */}
          {clubs.length > 0 && (
            <div onClick={() => setSubOpen(true)} className="bg-[#16161c] border border-dashed border-[#2a2a35] rounded-2xl p-6 hover:bg-[#1a1a22] transition-colors cursor-pointer flex flex-col items-center justify-center text-white/40 hover:text-white gap-4 min-h-[200px]">
              <Plus className="w-8 h-8" />
              <span className="font-medium">Создать еще</span>
            </div>
          )}
        </div>
        
        {/* Modals */}
        {subOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={()=>setSubOpen(false)}>
            <div className="w-full max-w-md rounded-2xl bg-[#16161c] border border-[#2a2a35] p-6 text-white" onClick={(e)=>e.stopPropagation()}>
              <div className="text-xl font-bold mb-4">Активация кружка</div>
              <div className="text-white/80 text-sm mb-6 leading-relaxed">
                Для создания кружка необходимо оплатить подписку <b>2000 ₸</b>.<br/>
                Перевод Kaspi: <b>+7 776 045 7776</b><br/>
                Укажите код ниже в комментарии к переводу.
              </div>
              <div className="bg-[#0f0f14] rounded-xl p-4 mb-6 flex items-center gap-3 border border-[#2a2a35]">
                <code className="flex-1 font-mono text-lg text-[#00a3ff]">{paymentComment}</code>
                <button onClick={()=>{ navigator.clipboard.writeText(paymentComment); toast({ title: 'Скопировано' }) }} className="text-xs bg-[#2a2a35] hover:bg-[#333344] px-3 py-2 rounded-lg">Копировать</button>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={()=>setSubOpen(false)} className="px-5 py-3 rounded-xl bg-[#1b1b22] border border-[#2a2a35] hover:bg-[#22222a]">Отмена</button>
                <button onClick={submitSubscriptionRequest} disabled={submittingOpenRequest} className="px-5 py-3 rounded-xl bg-[#00a3ff] hover:bg-[#0088cc] text-black font-bold disabled:opacity-50">
                  {submittingOpenRequest ? 'Отправка...' : 'Я оплатил'}
                </button>
              </div>
            </div>
          </div>
        )}
        {joinOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={()=>setJoinOpen(false)}>
             <div className="w-full max-w-md rounded-2xl bg-[#16161c] border border-[#2a2a35] p-6 text-white" onClick={(e)=>e.stopPropagation()}>
               <div className="text-xl font-bold mb-4">Вступить по коду</div>
               <input value={joinCode} onChange={(e)=>setJoinCode(e.target.value)} placeholder="Код кружка" className="w-full bg-[#0f0f14] border border-[#2a2a35] rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-[#00a3ff]" />
               <div className="flex justify-end gap-3">
                 <button onClick={()=>setJoinOpen(false)} className="px-5 py-3 rounded-xl bg-[#1b1b22] border border-[#2a2a35]">Отмена</button>
                 <button onClick={handleJoinByCode} disabled={joining || !joinCode.trim()} className="px-5 py-3 rounded-xl bg-[#00a3ff] hover:bg-[#0088cc] text-black font-bold disabled:opacity-50">{joining?"Вход...":"Вступить"}</button>
               </div>
             </div>
           </div>
         )}
      </main>
    )
  }

  // 3. CLUB VIEW (Panel Control)
  if (view === 'club' && currentClub) {
    return (
      <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up space-y-8 bg-black text-white">
        {/* Header */}
        <div className="flex items-center gap-4">
           <button onClick={goBack} className="w-12 h-12 rounded-full bg-[#16161c] border border-[#2a2a35] flex items-center justify-center hover:bg-[#1a1a22] transition-colors group">
             <ArrowLeft className="w-5 h-5 text-white/60 group-hover:text-white" />
           </button>
           <div>
             <h1 className="text-3xl font-bold">Панель управления</h1>
             <div className="text-white/60 text-sm mt-1">{currentClub.name}</div>
           </div>
           <div className="ml-auto text-right hidden md:block">
             <div className="text-xl font-semibold">{currentDate.split(" ").slice(0,2).join(" ")}</div>
             <div className="text-white/60 text-xs">{currentDate.split(" ").slice(2).join(" ")}</div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Left: Classes List */}
           <div className="lg:col-span-1 space-y-4">
             {(currentClub.classes || []).map(cls => (
               <div key={cls.id} onClick={() => openClass(cls.id)} className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-6 hover:border-[#00a3ff]/50 transition-all cursor-pointer group">
                 <div className="flex items-start justify-between mb-4">
                   <h3 className="text-2xl font-bold">{cls.title}</h3>
                   <ArrowUpRight className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
                 </div>
                 <div className="text-white/60 text-sm">
                   Ментор: {(currentClub.mentors && currentClub.mentors[0]?.user.fullName) || "Не назначен"}
                 </div>
               </div>
             ))}
             
             {/* Add Class UI */}
             <div className="bg-[#16161c] border border-dashed border-[#2a2a35] rounded-2xl p-4 space-y-3">
               <div className="text-sm font-medium text-white/60">Добавить класс</div>
               <div className="flex gap-2">
                 <input value={newClass.title} onChange={e=>setNewClass({...newClass, title: e.target.value})} placeholder="Название (напр. Класс А)" className="flex-1 bg-[#0f0f14] border border-[#2a2a35] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00a3ff]" />
                 <button onClick={addClass} className="bg-[#2a2a35] hover:bg-[#333344] text-white px-4 rounded-xl transition-colors">
                   <Plus className="w-5 h-5" />
                 </button>
               </div>
             </div>
           </div>

           {/* Right: Calendar Placeholder */}
           <div className="lg:col-span-2 bg-[#16161c] border border-[#2a2a35] rounded-2xl p-8 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50 pointer-events-none" />
             <div className="text-center z-10">
               <Calendar className="w-16 h-16 text-[#00a3ff]/20 mx-auto mb-4" />
               <div className="text-xl font-medium mb-2">Календарь уроков</div>
               <div className="text-white/40 text-sm">Выберите класс слева для просмотра расписания и уроков</div>
             </div>
           </div>
        </div>
      </main>
    )
  }

  // 4. CLASS DASHBOARD
  if (view === 'class' && currentClass) {
    // Find today's session
    const todayStr = new Date().toLocaleDateString('ru-RU', { timeZone: 'Asia/Aqtobe' })
    const todaysSession = sessions[currentClass.id]?.find(s => new Date(s.date).toLocaleDateString('ru-RU', { timeZone: 'Asia/Aqtobe' }) === todayStr)

    return (
      <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up space-y-8 bg-black text-white">
         {/* Header */}
         <div className="flex items-center gap-4">
           <button onClick={goBack} className="w-12 h-12 rounded-full bg-[#16161c] border border-[#2a2a35] flex items-center justify-center hover:bg-[#1a1a22] transition-colors group">
             <ArrowLeft className="w-5 h-5 text-white/60 group-hover:text-white" />
           </button>
           <div>
             <h1 className="text-3xl font-bold">Панель управления</h1>
             <div className="text-white/60 text-sm mt-1">{currentClass.title}</div>
           </div>
           <div className="ml-auto text-right hidden md:block">
             <div className="text-xl font-semibold">{currentDate.split(" ").slice(0,2).join(" ")}</div>
             <div className="text-white/60 text-xs">{currentDate.split(" ").slice(2).join(" ")}</div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-8">
            {/* Today Section */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Сегодня</h2>
              {todaysSession ? (
                <div onClick={() => openLesson(todaysSession.id)} className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-6 hover:bg-[#1a1a22] hover:border-[#00a3ff]/50 transition-all cursor-pointer group">
                  <div className="text-white/40 text-xs mb-2 uppercase tracking-wider">Текущий урок</div>
                  <h3 className="text-xl font-bold text-white mb-2">
                     {/* Try to find topic from templates if mapped, else generic */}
                     Урок {new Date(todaysSession.date).toLocaleDateString('ru-RU')}
                  </h3>
                  <div className="flex items-center text-[#00a3ff] text-sm font-medium group-hover:gap-2 transition-all">
                    Открыть урок <ArrowUpRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              ) : (
                <div className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-6 opacity-50">
                  <h3 className="text-lg font-medium text-white">Нет урока сегодня</h3>
                  <div className="text-white/40 text-sm">В расписании пусто</div>
                </div>
              )}
            </div>

            {/* Settings Section */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Настройки</h2>
              <div className="space-y-4">
                <div onClick={openJournal} className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-6 hover:bg-[#1a1a22] transition-all cursor-pointer flex items-center justify-between group">
                  <div>
                    <h3 className="text-lg font-bold">Отчет прошлых уроков</h3>
                    <div className="text-white/40 text-xs mt-1">Табель посещаемости</div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-white/40 group-hover:text-white" />
                </div>
                {/* Schedule Placeholder Button */}
                <div className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-6 hover:bg-[#1a1a22] transition-all cursor-pointer flex items-center justify-between group">
                   <div>
                    <h3 className="text-lg font-bold">Расписание</h3>
                    <div className="text-white/40 text-xs mt-1">Управление слотами</div>
                  </div>
                  <Settings className="w-5 h-5 text-white/40 group-hover:text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Empty Void or Widgets as per design */}
          <div className="lg:col-span-2 min-h-[400px]">
            {/* Content placeholder */}
          </div>
        </div>
      </main>
    )
  }

  // 5. LESSON VIEW
  if (view === 'lesson' && currentSession && currentClass) {
    const key = `${currentClass.id}:${currentSession.id}`
    const enrolled = (currentClass.enrollments || []).map(e => e.user)
    // Find template if available - simpler logic: assume templates are ordered or match somehow. 
    // For now, just show list of all templates to pick, or first one.
    const tpls = programTemplates[currentClass.id] || []
    // A better way would be to link session index to template index, but sessions are dates.
    // We'll just show all materials for the class for now or allow attaching.
    
    return (
      <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up space-y-8 bg-black text-white">
        <div className="flex items-center gap-4">
           <button onClick={goBack} className="w-12 h-12 rounded-full bg-[#16161c] border border-[#2a2a35] flex items-center justify-center hover:bg-[#1a1a22] transition-colors group">
             <ArrowLeft className="w-5 h-5 text-white/60 group-hover:text-white" />
           </button>
           <div>
             <h1 className="text-3xl font-bold">Урок</h1>
             <div className="text-white/60 text-sm mt-1">{new Date(currentSession.date).toLocaleDateString('ru-RU')}</div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Materials */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-[#00a3ff]"/> Материалы урока</h3>
              {tpls.length === 0 && <div className="text-white/40 italic">Нет прикрепленных материалов</div>}
              <div className="space-y-3">
                {tpls.map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-[#0f0f14] border border-[#2a2a35] p-4 rounded-xl">
                    <div className="font-medium">{t.title}</div>
                    <div className="flex gap-2">
                      {t.presentationUrl && <a href={t.presentationUrl} target="_blank" className="px-3 py-2 bg-[#2a2a35] hover:bg-[#333344] rounded-lg text-xs">Презентация</a>}
                      {t.scriptUrl && <a href={t.scriptUrl} target="_blank" className="px-3 py-2 bg-[#2a2a35] hover:bg-[#333344] rounded-lg text-xs">Сценарий</a>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-6">
               <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Play className="w-5 h-5 text-[#00a3ff]"/> Действия</h3>
               <div className="flex flex-wrap gap-3">
                 <button onClick={() => startQuiz(currentSession.id)} disabled={startingQuiz[currentSession.id]} className="bg-[#00a3ff] hover:bg-[#0088cc] text-black px-6 py-3 rounded-xl font-bold disabled:opacity-50 transition-colors">
                   {startingQuiz[currentSession.id] ? "Запуск..." : "Начать квиз"}
                 </button>
                 <button onClick={async() => { 
                   try {
                     const list = await apiFetch<Array<{ id: string; score: number; student: { id: string; fullName?: string; email: string } }>>(`/api/clubs/sessions/${currentSession.id}/quiz/submissions`)
                     setSubmissionsBySession(prev => ({ ...prev, [currentSession.id]: list }))
                     setSubmissionsOpen(currentSession.id)
                   } catch (e: any) {
                     toast({ title: 'Ошибка', description: e?.message || 'Не удалось загрузить результаты', variant: 'destructive' as any })
                   }
                 }} className="bg-[#2a2a35] hover:bg-[#333344] text-white px-6 py-3 rounded-xl font-bold transition-colors">
                   Результаты квиза
                 </button>
               </div>
            </div>
          </div>

          {/* Right: Attendance (SUSH style) */}
          <div className="lg:col-span-1">
             <div className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-6 h-full">
               <h3 className="text-xl font-bold mb-4">Ученики</h3>
               <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                 {enrolled.length === 0 && <div className="text-white/40">Нет учеников</div>}
                 {enrolled.map(u => {
                   const draft = attendanceDraft[key] || {}
                   const st = draft[u.id]?.status
                   const isPresent = st === 'present'
                   return (
                     <div key={u.id} className="flex items-center justify-between bg-[#0f0f14] border border-[#2a2a35] p-3 rounded-xl">
                       <div className="text-sm font-medium">{u.fullName || u.email}</div>
                       <div className="flex items-center bg-[#1b1b22] rounded-lg p-1">
                         <button 
                           onClick={async()=>{
                             const next = isPresent ? 'absent' : 'present'
                             setAttendanceDraft(p => ({ ...p, [key]: { ...draft, [u.id]: { status: next, feedback: draft[u.id]?.feedback || "" } } }))
                             // Auto-save
                             try {
                               await apiFetch(`/api/clubs/sessions/${currentSession.id}/attendance`, { method: 'POST', body: JSON.stringify({ marks: [{ studentId: u.id, status: next }] }) })
                             } catch {}
                           }}
                           className={`p-2 rounded-md transition-colors ${isPresent ? 'bg-[#22c55e] text-black' : 'text-white/40 hover:text-white'}`}
                         >
                           <Check className="w-4 h-4" />
                         </button>
                       </div>
                     </div>
                   )
                 })}
               </div>
             </div>
          </div>
        </div>

        {submissionsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={()=>setSubmissionsOpen(null)}>
            <div className="w-full max-w-2xl rounded-2xl bg-[#16161c] border border-[#2a2a35] p-6 text-white" onClick={(e)=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="text-xl font-bold">Результаты квиза</div>
                <button onClick={()=>setSubmissionsOpen(null)} className="px-3 py-1 rounded-full bg-[#2a2a35] hover:bg-[#333344] text-sm">Закрыть</button>
              </div>
              {(() => {
                const list = submissionsBySession[submissionsOpen] || []
                return (
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {list.length === 0 && <div className="text-white/60 text-center py-8">Нет ответов</div>}
                    {list.map((s, idx) => (
                      <div key={s.id} className="flex items-center justify-between border border-[#2a2a35] rounded-xl px-4 py-3 text-sm hover:bg-[#1a1a22] transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#0f0f14] border border-[#2a2a35] inline-flex items-center justify-center font-medium text-white/60">{idx+1}</div>
                          <div className="font-medium">{s.student.fullName || s.student.email}</div>
                        </div>
                        <div className="text-[#00a3ff] font-bold">{s.score} баллов</div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </main>
    )
  }

  // 6. JOURNAL VIEW (Tabel)
  if (view === 'journal' && currentClass) {
    const students = (currentClass.enrollments || []).map(e => e.user)
    const sortedSessions = (sessions[currentClass.id] || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return (
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-black text-white animate-slide-up">
        <div className="p-6 md:p-8 pb-4 shrink-0 border-b border-[#2a2a35]">
           <div className="flex items-center gap-4">
             <button onClick={goBack} className="w-10 h-10 rounded-full bg-[#16161c] border border-[#2a2a35] flex items-center justify-center hover:bg-[#1a1a22] transition-colors">
               <ArrowLeft className="w-5 h-5" />
             </button>
             <div>
               <h1 className="text-2xl font-bold">Журнал посещаемости</h1>
               <div className="text-white/60 text-sm">{currentClass.title}</div>
             </div>
             <div className="ml-auto flex gap-2">
               <button onClick={() => {
                  // Export logic
                  const colDates = sortedSessions.map(s => new Date(s.date).toISOString().slice(0,10))
                  const data: any = {}
                  colDates.forEach((d, i) => {
                    const s = sortedSessions[i]
                    data[d] = attendanceDraft[`${currentClass.id}:${s.id}`] || {}
                  })
                  exportAttendanceToCSV(students.map(s=>({id:s.id, name:s.fullName||s.email})), colDates, data, currentClass.title)
               }} className="px-4 py-2 rounded-full bg-[#16161c] border border-[#2a2a35] text-white hover:bg-[#1a1a22] text-sm flex items-center gap-2">
                 <Download className="w-4 h-4" /> CSV
               </button>
             </div>
           </div>
        </div>

        <div className="flex-1 overflow-hidden flex relative">
           {/* Sticky Names Column */}
           <div className="w-64 shrink-0 bg-[#0f0f14] border-r border-[#2a2a35] overflow-y-auto z-10 no-scrollbar">
             <div className="h-12 border-b border-[#2a2a35] flex items-center px-4 text-white/60 text-xs font-medium sticky top-0 bg-[#0f0f14]">
               ФИО Учеников
             </div>
             {students.map((s, i) => (
               <div key={s.id} className="h-12 flex items-center px-4 border-b border-[#2a2a35] text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                 {i + 1}. {s.fullName || s.email}
               </div>
             ))}
           </div>

           {/* Scrollable Dates */}
           <div className="flex-1 overflow-auto bg-[#16161c]">
             <div className="flex min-w-full">
               {sortedSessions.map(s => (
                 <div key={s.id} className="w-24 shrink-0 border-r border-[#2a2a35]">
                   <div className="h-12 border-b border-[#2a2a35] flex items-center justify-center bg-[#0f0f14] sticky top-0 text-xs text-white/80">
                     {new Date(s.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                   </div>
                   {students.map(st => {
                     const key = `${currentClass.id}:${s.id}`
                     const stat = attendanceDraft[key]?.[st.id]?.status
                     return (
                       <div key={`${s.id}-${st.id}`} className="h-12 border-b border-[#2a2a35] flex items-center justify-center hover:bg-white/5 transition-colors">
                         <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold
                           ${stat === 'present' ? 'text-[#22c55e]' : ''}
                           ${stat === 'absent' ? 'text-[#ef4444]' : ''}
                           ${!stat ? 'text-white/10' : ''}
                         `}>
                           {stat === 'present' ? 'П' : (stat === 'absent' ? 'Н' : '·')}
                         </div>
                       </div>
                     )
                   })}
                 </div>
               ))}
               {/* Infinite add placeholder */}
               <div className="w-24 shrink-0 flex flex-col border-r border-[#2a2a35] bg-[#0f0f14]/30 hover:bg-[#0f0f14]/60 cursor-pointer transition-colors"
                  onClick={async () => {
                    // Create new session for today
                    const d = new Date().toISOString().slice(0,10)
                    try {
                      await apiFetch(`/api/clubs/classes/${currentClass.id}/sessions`, { method: 'POST', body: JSON.stringify({ date: d }) })
                      loadClassSessions(currentClass.id) // Reload to show new column
                      toast({ title: 'Колонка добавлена' })
                    } catch {}
                  }}
               >
                 <div className="h-12 border-b border-[#2a2a35] flex items-center justify-center text-[#00a3ff]">
                   <Plus className="w-5 h-5" />
                 </div>
                 {students.map(s => (
                   <div key={`add-${s.id}`} className="h-12 border-b border-[#2a2a35]"></div>
                 ))}
               </div>
             </div>
           </div>
        </div>
      </main>
    )
  }
  
  return null
}
