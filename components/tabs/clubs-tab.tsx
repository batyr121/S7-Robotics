"use client"
import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { Plus, Calendar, MapPin, Users, Check, X, Clock, Building2, ArrowUpRight, Trash2, Download, FileText } from "lucide-react"
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
  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [desc, setDesc] = useState("")
  const [creating, setCreating] = useState(false)
  const [mentorEmail, setMentorEmail] = useState<Record<string, string>>({})
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null)
  const [newClass, setNewClass] = useState<Record<string, { title: string; description?: string; location?: string }>>({})
  const [enrollEmail, setEnrollEmail] = useState<Record<string, string>>({})
  const [schedForm, setSchedForm] = useState<Record<string, { dayOfWeek: number; startTime: string; endTime: string; location?: string }>>({})
  const [genRange, setGenRange] = useState<Record<string, { from: string; to: string }>>({})
  const [sessions, setSessions] = useState<Record<string, Array<{ id: string; date: string; attendances?: Array<{ studentId: string; status: string; feedback?: string }> }>>>({})
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, Record<string, { status: string; feedback?: string }>>>({})
  const [loadingSessions, setLoadingSessions] = useState<Record<string, boolean>>({})
  const [resources, setResources] = useState<Record<string, Array<{ id: string; title: string; description?: string; url: string }>>>({})
  const [resForm, setResForm] = useState<Record<string, { title: string; url: string; description?: string }>>({})
  const [assignments, setAssignments] = useState<Record<string, Array<{ id: string; title: string; description?: string; dueAt?: string }>>>({})
  const [assignForm, setAssignForm] = useState<Record<string, { title: string; description?: string; dueAt?: string }>>({})
  const [subs, setSubs] = useState<Record<string, Array<{ id: string; student: { id: string; fullName?: string; email: string }; grade?: number; feedback?: string; submittedAt: string }>>>({})
  const [mySub, setMySub] = useState<Record<string, { answerText?: string; attachmentUrl?: string }>>({})
  const [gradeForm, setGradeForm] = useState<Record<string, { grade?: number; feedback?: string }>>({})
  const [extraFio, setExtraFio] = useState<Record<string, string>>({})
  const [extraEmail, setExtraEmail] = useState<Record<string, string>>({})
  const [addDate, setAddDate] = useState<Record<string, string>>({})
  const [openClubId, setOpenClubId] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState("")
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [joining, setJoining] = useState(false)
  const [subOpen, setSubOpen] = useState(false)
  const [paymentComment, setPaymentComment] = useState("")
  const [submittingOpenRequest, setSubmittingOpenRequest] = useState(false)
  const [openRequestSent, setOpenRequestSent] = useState(false)
  const [inviteCodes, setInviteCodes] = useState<Record<string, string | null>>({})
  // Registration wizard
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [wName, setWName] = useState("")
  const [wLocation, setWLocation] = useState("")
  const [wProgramId, setWProgramId] = useState("")
  const [wPrograms, setWPrograms] = useState<Array<{ id: string; title: string }>>([])
  const [wClass1, setWClass1] = useState<{ title: string; location?: string }>({ title: "" })
  const [wClass2, setWClass2] = useState<{ title: string; location?: string }>({ title: "" })
  const [wSubmitting, setWSubmitting] = useState(false)
  // Quiz state per session
  const [quizOpen, setQuizOpen] = useState<string | null>(null)
  const [quizBySession, setQuizBySession] = useState<Record<string, any>>({})
  const [quizAnswers, setQuizAnswers] = useState<Record<string, Record<number, number[]>>>({})
  const [startingQuiz, setStartingQuiz] = useState<Record<string, boolean>>({})
  const [submittingQuiz, setSubmittingQuiz] = useState(false)
  const [submissionsOpen, setSubmissionsOpen] = useState<string | null>(null)
  const [submissionsBySession, setSubmissionsBySession] = useState<Record<string, Array<{ id: string; score: number; student: { id: string; fullName?: string; email: string } }>>>({})
  const [programTemplates, setProgramTemplates] = useState<Record<string, Array<{ id: string; title: string; presentationUrl?: string; scriptUrl?: string }>>>({})
  const [lessonModal, setLessonModal] = useState<{ open: boolean; classId?: string; sessionId?: string; clubId?: string }>({ open: false })
  const [upgradeModal, setUpgradeModal] = useState(false)
  const [limitError, setLimitError] = useState<{ type: 'class' | 'student'; clubId?: string } | null>(null)

  // Close modals on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (quizOpen) setQuizOpen(null)
      if (submissionsOpen) setSubmissionsOpen(null)
      if (joinOpen) setJoinOpen(false)
      if (subOpen) setSubOpen(false)
      if (wizardOpen) setWizardOpen(false)
      if (upgradeModal) setUpgradeModal(false)
    }
    if (quizOpen || submissionsOpen || joinOpen || subOpen || wizardOpen || upgradeModal) {
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }
  }, [quizOpen, submissionsOpen, joinOpen, subOpen, wizardOpen, upgradeModal])

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
  const refreshClubsSilently = async () => {
    try {
      const isAdmin = String(user?.role || '').toUpperCase() === 'ADMIN'
      const list = await apiFetch<Club[]>(`/api/clubs/mine?limit=${isAdmin ? 30 : 100}`)
      setClubs(list)
      setLoadError(null)
    } catch (e: any) {
      setLoadError(e?.message || "Не удалось обновить кружки")
    }
  }
  const loadSubmissions = async (sessionId: string) => {
    try {
      const list = await apiFetch<Array<{ id: string; score: number; student: { id: string; fullName?: string; email: string } }>>(`/api/clubs/sessions/${sessionId}/quiz/submissions`)
      setSubmissionsBySession(prev => ({ ...prev, [sessionId]: list }))
    } catch {}
  }
  const loadQuiz = async (sessionId: string) => {
    try {
      const q = await apiFetch<any>(`/api/clubs/sessions/${sessionId}/quiz`)
      setQuizBySession(prev => ({ ...prev, [sessionId]: q }))
      if (!quizAnswers[sessionId]) setQuizAnswers(prev => ({ ...prev, [sessionId]: {} }))
    } catch {
      // no quiz yet
    }
  }
  const openQuizModal = async (sessionId: string) => {
    if (!quizBySession[sessionId]) await loadQuiz(sessionId)
    setQuizOpen(sessionId)
  }
  const startQuiz = async (sessionId: string) => {
    try {
      setStartingQuiz(prev => ({ ...prev, [sessionId]: true }))
      const q = await apiFetch<any>(`/api/clubs/sessions/${sessionId}/quiz/start`, { method: 'POST', body: JSON.stringify({}) })
      setQuizBySession(prev => ({ ...prev, [sessionId]: q }))
      setQuizOpen(sessionId)
    } catch (e: any) {
      toast({ title: 'Ошибка', description: e?.message || 'Не удалось начать квиз', variant: 'destructive' as any })
    } finally {
      setStartingQuiz(prev => ({ ...prev, [sessionId]: false }))
    }
  }
  const toggleAnswer = (sessionId: string, qIdx: number, optIdx: number) => {
    setQuizAnswers(prev => {
      const cur = prev[sessionId] || {}
      const selected = new Set(cur[qIdx] || [])
      if (selected.has(optIdx)) selected.delete(optIdx); else selected.add(optIdx)
      return { ...prev, [sessionId]: { ...cur, [qIdx]: Array.from(selected).sort() } }
    })
  }
  const submitQuiz = async (sessionId: string) => {
    const qa = quizAnswers[sessionId] || {}
    const answers = Object.keys(qa).map(k => ({ questionIndex: Number(k), selected: qa[Number(k)] || [] }))
    try {
      setSubmittingQuiz(true)
      const r = await apiFetch<any>(`/api/clubs/sessions/${sessionId}/quiz/submit`, { method: 'POST', body: JSON.stringify({ answers }) })
      toast({ title: 'Результат', description: `Ваш счёт: ${r.score}` } as any)
      setQuizOpen(null)
    } catch (e: any) {
      toast({ title: 'Ошибка', description: e?.message || 'Не удалось отправить ответы', variant: 'destructive' as any })
    } finally {
      setSubmittingQuiz(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const now = new Date()
    const months = ["Января","Февраля","Марта","Апреля","Мая","Июня","Июля","Августа","Сентября","Октября","Ноября","Декабря"]
    const d = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`
    setCurrentDate(d)
  }, [])

  const createClub = async () => {
    if (!name.trim()) {
      toast({ title: "Ошибка", description: "Введите название кружка", variant: "destructive" as any })
      return
    }
    try {
      setCreating(true)
      console.log('[ClubsTab] Creating club:', { name: name.trim(), description: desc.trim() || undefined, location: location.trim() || undefined })
      const created = await apiFetch<Club>("/api/clubs", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: desc.trim() || undefined, location: location.trim() || undefined })
      })
      console.log('[ClubsTab] Club created successfully:', created)
      setName("")
      setLocation("")
      setDesc("")
      setClubs((prev) => [created, ...prev])
      refreshClubsSilently().catch(()=>{})
      toast({ title: "Кружок создан", description: `Создан: ${created.name}` })
    } catch (e: any) {
      console.error('[ClubsTab] Error creating club:', e)
      toast({ title: "Ошибка создания кружка", description: e?.message || "Не удалось создать кружок", variant: "destructive" as any })
    } finally {
      setCreating(false)
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
      refreshClubsSilently().catch(()=>{})
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось вступить", variant: "destructive" as any })
    } finally {
      setJoining(false)
    }
  }

  useEffect(() => {
    if (!subOpen) return
    const base = String(user?.id || 'USER').slice(-4).toUpperCase()
    const rnd = Math.random().toString(36).slice(2, 7).toUpperCase()
    setPaymentComment(`S7-CLUB-${base}-${rnd}`)
    setOpenRequestSent(false)
  }, [subOpen, user?.id])

  const submitSubscriptionRequest = async () => {
    try {
      setSubmittingOpenRequest(true)
      await apiFetch(`/api/subscriptions/request`, { 
        method: 'POST', 
        body: JSON.stringify({ 
          type: 'ONETIME_PURCHASE',
          paymentComment 
        }) 
      })
      setOpenRequestSent(true)
      toast({ title: 'Заявка отправлена', description: 'Админы уведомлены. После проверки платежа доступ будет активирован.' } as any)
      // After successful request, proceed to registration wizard
      setSubOpen(false)
      setWizardOpen(true)
      setWizardStep(1)
    } catch (e: any) {
      toast({ title: 'Ошибка', description: e?.message || 'Не удалось отправить заявку', variant: 'destructive' as any })
    } finally {
      setSubmittingOpenRequest(false)
    }
  }

  useEffect(() => {
    if (!wizardOpen) return
    let alive = true
    apiFetch<any[]>(`/api/programs?active=true`).then(list => {
      if (!alive) return
      setWPrograms((list || []).map(p => ({ id: p.id, title: p.title })))
    }).catch(()=>setWPrograms([]))
    return () => { alive = false }
  }, [wizardOpen])

  const submitWizard = async () => {
    const name = wName.trim()
    if (!name) return
    try {
      setWSubmitting(true)
      const club = await apiFetch<{ id: string }>(`/api/clubs`, { method: 'POST', body: JSON.stringify({ name, location: wLocation.trim() || undefined, description: undefined, programId: wProgramId || undefined }) })
      const classPayloads: Array<{ title: string; location?: string }> = []
      if (wClass1.title.trim()) classPayloads.push({ title: wClass1.title.trim(), location: wClass1.location?.trim() || undefined })
      if (wClass2.title.trim()) classPayloads.push({ title: wClass2.title.trim(), location: wClass2.location?.trim() || undefined })
      for (const cp of classPayloads) {
        await apiFetch(`/api/clubs/${club.id}/classes`, { method: 'POST', body: JSON.stringify(cp) })
      }
      setWizardOpen(false); setWizardStep(1)
      setWName(""); setWLocation(""); setWProgramId("")
      setWClass1({ title: "" }); setWClass2({ title: "" })
      await load()
      toast({ title: 'Кружок создан' })
    } catch (e: any) {
      toast({ title: 'Ошибка', description: e?.message || 'Не удалось создать', variant: 'destructive' as any })
    } finally { setWSubmitting(false) }
  }

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-white text-2xl md:text-3xl font-bold">Кружок</h1>
        </div>
        <div className="text-right">
          <div className="text-white text-xl font-semibold">{currentDate.split(" ").slice(0,2).join(" ")}</div>
          <div className="text-white/60 text-xs">{currentDate.split(" ").slice(2).join(" ")}</div>
        </div>
      </div>

      {String(user?.role || "").toUpperCase() === 'ADMIN' && (
        <section className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-4 text-white">
          <div className="flex items-center gap-3 mb-3">
            <Plus className="w-5 h-5" />
            <div className="font-semibold">Создать кружок</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Название" className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl px-3 py-2" />
            <input value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="Локация" className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl px-3 py-2" />
            <input value={desc} onChange={(e)=>setDesc(e.target.value)} placeholder="Описание (необязательно)" className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl px-3 py-2" />
          </div>
          <div className="mt-3">
            <button onClick={createClub} disabled={creating || !name.trim()} className="rounded-full bg-[#00a3ff] hover:bg-[#0088cc] disabled:opacity-60 text-black font-medium px-5 py-2">Создать</button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        {loading && <div className="text-white/60">Загрузка...</div>}
        {loadError && <div className="text-red-400 text-sm">Ошибка: {loadError}</div>}
        {clubs.length === 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[#2a2a35] bg-[#16161c] p-5 text-white">
                <div className="text-xl font-semibold mb-1">Открыть кружок</div>
                <div className="text-white/60 text-sm mb-4">Подписка: Xtg/месяц. Включает до 2 классов и 30 учеников в классе.</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <button onClick={() => setSubOpen(true)} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#00a3ff] hover:bg-[#0088cc] text-black font-medium px-4 py-3">
                    Подключить <ArrowUpRight className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setWizardOpen(true); setWizardStep(1) }} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f0f14] border border-[#2a2a35] hover:bg-[#1b1b22] text-white font-medium px-4 py-3">
                    Регистрация
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border border-[#2a2a35] bg-[#16161c] p-5 text-white">
                <div className="text-xl font-semibold mb-1">Вступить в кружок</div>
                <div className="text-white/60 text-sm mb-4">Вступление по коду кружка, который вы получили от руководителя.</div>
                <button onClick={() => setJoinOpen(true)} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#00a3ff] hover:bg-[#0088cc] text-black font-medium px-4 py-3">
                  Вступить <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {joinOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={()=>setJoinOpen(false)}>
                <div className="w-full max-w-md rounded-2xl bg-[#16161c] border border-[#2a2a35] p-5 text-white" onClick={(e)=>e.stopPropagation()}>
                  <div className="text-lg font-semibold mb-4">Вступить по коду</div>
                  <div className="space-y-3">
                    <input value={joinCode} onChange={(e)=>setJoinCode(e.target.value)} placeholder="Код кружка" className="w-full bg-[#0f0f14] border border-[#2a2a35] rounded-xl px-3 py-2" />
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button onClick={()=>setJoinOpen(false)} className="px-4 py-2 rounded-full bg-[#1b1b22] border border-[#2a2a35] text-white/80">Отмена</button>
                      <button onClick={handleJoinByCode} disabled={joining || !joinCode.trim()} className="px-4 py-2 rounded-full bg-[#00a3ff] hover:bg-[#0088cc] text-black disabled:opacity-60">{joining?"Проверяю...":"Вступить"}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {lessonModal.open && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={()=>setLessonModal({ open: false })}>
                <div className="w-full max-w-3xl rounded-2xl bg-[#16161c] border border-[#2a2a35] p-5 text-white" onClick={(e)=>e.stopPropagation()}>
                  {(() => {
                    const club = clubs.find(cc => cc.id === lessonModal.clubId)
                    const cl = club?.classes?.find(kk => kk.id === lessonModal.classId)
                    const classId = cl?.id || lessonModal.classId!
                    const sessionId = lessonModal.sessionId!
                    const key = `${classId}:${sessionId}`
                    const enrolled = (cl?.enrollments || []).map(e => e.user)
                    const tpls = programTemplates[club?.id || ""] || []
                    const sDate = (()=>{ try{ const d = (sessions[classId]||[]).find(s=>s.id===sessionId)?.date; return d ? new Date(d).toLocaleString('ru-RU', { timeZone: 'Asia/Aqtobe' }) : '' } catch { return '' } })()
                    return (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-lg font-semibold">Урок — {sDate}</div>
                          <button onClick={()=>setLessonModal({ open: false })} className="px-3 py-1 rounded-full bg-[#2a2a35] hover:bg-[#333344] text-sm">Закрыть</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-3">
                            <div className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl p-3">
                              <div className="text-sm font-medium mb-2">Материалы</div>
                              {tpls.length === 0 && <div className="text-white/60 text-sm">Нет материалов</div>}
                              {tpls.map(t => (
                                <div key={t.id} className="flex items-center justify-between text-sm border border-[#2a2a35] rounded-lg px-3 py-2 mb-2">
                                  <div>{t.title}</div>
                                  <div className="flex items-center gap-2">
                                    {t.presentationUrl && <a href={t.presentationUrl} target="_blank" rel="noreferrer" className="text-xs rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-1">Презентация</a>}
                                    {t.scriptUrl && <a href={t.scriptUrl} target="_blank" rel="noreferrer" className="text-xs rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-1">Сценарий</a>}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl p-3 flex items-center gap-2">
                              <button onClick={()=>startQuiz(sessionId)} disabled={startingQuiz[sessionId]} className="rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-2 text-xs">{startingQuiz[sessionId]?"Запуск...":"Начать квиз"}</button>
                              <button onClick={()=>openQuizModal(sessionId)} className="rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-2 text-xs">Открыть квиз</button>
                              <button onClick={async()=>{ await loadSubmissions(sessionId); setSubmissionsOpen(sessionId) }} className="rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-2 text-xs">Результаты</button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Посещаемость</div>
                            {enrolled.length === 0 && <div className="text-white/60 text-sm">Нет учеников</div>}
                            {enrolled.map(u => {
                              const draft = attendanceDraft[key] || {}
                              const st = draft[u.id]?.status || 'present'
                              const fb = draft[u.id]?.feedback || ''
                              return (
                                <div key={u.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center text-sm border border-[#2a2a35] rounded-lg p-2">
                                  <div className="col-span-2">{u.fullName || u.email}</div>
                                  <select value={st} onChange={async (e)=>{ const val = e.target.value; setAttendanceDraft(prev=>({ ...prev, [key]: { ...draft, [u.id]: { status: val, feedback: fb } } })); try { await apiFetch(`/api/clubs/sessions/${sessionId}/attendance`, { method: 'POST', body: JSON.stringify({ marks: [{ studentId: u.id, status: val, feedback: fb || undefined }] }) }); toast({ title: 'Сохранено' }) } catch(e:any){ toast({ title: 'Ошибка', description: e?.message||'Не удалось сохранить', variant: 'destructive' as any }) } }} className="bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-2 py-2">
                                    <option value="present">Пришёл</option>
                                    <option value="absent">Не пришёл</option>
                                    <option value="late">Опоздал</option>
                                    <option value="excused">Уважительная</option>
                                  </select>
                                  <input placeholder="Фидбек (опц.)" value={fb} onChange={(e)=>setAttendanceDraft(prev=>({ ...prev, [key]: { ...draft, [u.id]: { status: st, feedback: e.target.value } } }))} className="bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-2 py-2" />
                                  <div className="flex gap-2">
                                    <button onClick={async()=>{ const prev = attendanceDraft[key] || {}; const next = { ...prev, [u.id]: { status: 'present', feedback: fb } }; setAttendanceDraft(p=>({ ...p, [key]: next })); try { await apiFetch(`/api/clubs/sessions/${sessionId}/attendance`, { method: 'POST', body: JSON.stringify({ marks: [{ studentId: u.id, status: 'present', feedback: fb || undefined }] }) }); toast({ title: 'Сохранено' }) } catch(e:any){ toast({ title: 'Ошибка', description: e?.message||'Не удалось сохранить', variant: 'destructive' as any }) } }} className="rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-2 flex items-center gap-1"><Check className="w-3 h-3"/>Пришёл</button>
                                    <button onClick={async()=>{ const prev = attendanceDraft[key] || {}; const next = { ...prev, [u.id]: { status: 'absent', feedback: fb } }; setAttendanceDraft(p=>({ ...p, [key]: next })); try { await apiFetch(`/api/clubs/sessions/${sessionId}/attendance`, { method: 'POST', body: JSON.stringify({ marks: [{ studentId: u.id, status: 'absent', feedback: fb || undefined }] }) }); toast({ title: 'Сохранено' }) } catch(e:any){ toast({ title: 'Ошибка', description: e?.message||'Не удалось сохранить', variant: 'destructive' as any }) } }} className="rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-2 flex items-center gap-1"><X className="w-3 h-3"/>Нет</button>
                                  </div>
                                </div>
                              )
                            })}
                            {enrolled.length>0 && (
                              <div className="flex justify-end pt-1">
                                <button onClick={async()=>{ const draft = attendanceDraft[key] || {}; const marks = Object.entries(draft).map(([studentId, v])=>({ studentId, status: (v as any).status, feedback: (v as any).feedback || undefined })); if (marks.length === 0) return; try { await apiFetch(`/api/clubs/sessions/${sessionId}/attendance`, { method: 'POST', body: JSON.stringify({ marks }) }); toast({ title: 'Отметки отправлены' }) } catch(e:any){ toast({ title: 'Ошибка', description: e?.message||'Не удалось отправить', variant: 'destructive' as any }) } }} className="rounded-full bg-[#00a3ff] hover:bg-[#0088cc] px-4 py-2 text-black font-medium">Сохранить</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}

            {submissionsOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={()=>setSubmissionsOpen(null)}>
                <div className="w-full max-w-2xl rounded-2xl bg-[#16161c] border border-[#2a2a35] p-5 text-white" onClick={(e)=>e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-lg font-semibold">Результаты квиза</div>
                    <button onClick={()=>setSubmissionsOpen(null)} className="px-3 py-1 rounded-full bg-[#2a2a35] hover:bg-[#333344] text-sm">Закрыть</button>
                  </div>
                  {(() => {
                    const list = submissionsBySession[submissionsOpen] || []
                    return (
                      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {list.length === 0 && <div className="text-white/60">Нет отправок</div>}
                        {list.map((s, idx) => (
                          <div key={s.id} className="flex items-center justify-between border border-[#2a2a35] rounded-xl px-3 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-[#0f0f14] border border-[#2a2a35] inline-flex items-center justify-center">{idx+1}</div>
                              <div>{s.student.fullName || s.student.email}</div>
                            </div>
                            <div className="text-white/80">{s.score} баллов</div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {quizOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={()=>setQuizOpen(null)}>
                <div className="w-full max-w-3xl rounded-2xl bg-[#16161c] border border-[#2a2a35] p-5 text-white" onClick={(e)=>e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-lg font-semibold">Квиз</div>
                    <button onClick={()=>setQuizOpen(null)} className="px-3 py-1 rounded-full bg-[#2a2a35] hover:bg-[#333344] text-sm">Закрыть</button>
                  </div>
                  {(() => {
                    const q = quizBySession[quizOpen] || {}
                    const questions: any[] = Array.isArray(q?.quizJson?.questions) ? q.quizJson.questions : []
                    return (
                      <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                        {questions.length === 0 && <div className="text-white/60">Квиз не найден</div>}
                        {questions.map((qq, qi) => (
                          <div key={qi} className="border border-[#2a2a35] rounded-xl p-3">
                            <div className="font-medium mb-2">{qq.title || `Вопрос ${qi+1}`}</div>
                            <div className="space-y-2">
                              {(qq.options||[]).map((op: any, oi: number) => {
                                const selected = (quizAnswers[quizOpen!]?.[qi] || []).includes(oi)
                                return (
                                  <label key={oi} className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={selected} onChange={()=>toggleAnswer(quizOpen!, qi, oi)} />
                                    <span>{op.text || String(op)}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                  <div className="mt-4 flex items-center justify-end">
                    <button onClick={()=>submitQuiz(quizOpen!)} disabled={submittingQuiz} className="rounded-full bg-[#00a3ff] hover:bg-[#0088cc] text-black px-4 py-2 disabled:opacity-60">Отправить</button>
                  </div>
                </div>
              </div>
            )}

            {wizardOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={()=>setWizardOpen(false)}>
                <div className="w-full max-w-2xl rounded-2xl bg-[#16161c] border border-[#2a2a35] p-5 text-white" onClick={(e)=>e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-lg font-semibold">Регистрация кружка</div>
                    <button onClick={()=>setWizardOpen(false)} className="px-3 py-1 rounded-full bg-[#2a2a35] hover:bg-[#333344] text-sm">Закрыть</button>
                  </div>
                  <div className="mb-4 flex items-center gap-2 text-xs text-white/60">
                    <div className={`px-2 py-1 rounded-full ${wizardStep===1?'bg-[#00a3ff] text-black':'bg-[#0f0f14] border border-[#2a2a35]'}`}>Шаг 1</div>
                    <div className={`px-2 py-1 rounded-full ${wizardStep===2?'bg-[#00a3ff] text-black':'bg-[#0f0f14] border border-[#2a2a35]'}`}>Шаг 2</div>
                  </div>
                  {wizardStep === 1 && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input value={wName} onChange={(e)=>setWName(e.target.value)} placeholder="Название кружка" className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl px-3 py-2" />
                        <input value={wLocation} onChange={(e)=>setWLocation(e.target.value)} placeholder="Локация (опц.)" className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl px-3 py-2" />
                      </div>
                      <div>
                        <div className="text-sm mb-1">Программа</div>
                        <select value={wProgramId} onChange={(e)=>setWProgramId(e.target.value)} className="w-full bg-[#0f0f14] border border-[#2a2a35] rounded-xl px-3 py-2">
                          <option value="">— Выберите программу (опц.) —</option>
                          {wPrograms.map(p => (
                            <option key={p.id} value={p.id}>{p.title}</option>
                          ))}
                        </select>
                        <div className="text-xs text-white/50 mt-1">Программы управляются в админке.</div>
                      </div>
                      <div className="flex justify-end">
                        <button onClick={()=>setWizardStep(2)} disabled={!wName.trim()} className="rounded-full bg-[#00a3ff] hover:bg-[#0088cc] text-black px-4 py-2 disabled:opacity-60">Далее</button>
                      </div>
                    </div>
                  )}
                  {wizardStep === 2 && (
                    <div className="space-y-3">
                      <div className="text-sm font-medium">Классы (до 2 шт.)</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <input value={wClass1.title} onChange={(e)=>setWClass1(prev=>({ ...prev, title: e.target.value }))} placeholder="Класс 1 — название" className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl px-3 py-2" />
                          <input value={wClass1.location||""} onChange={(e)=>setWClass1(prev=>({ ...prev, location: e.target.value }))} placeholder="Локация (опц.)" className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl px-3 py-2" />
                        </div>
                        <div className="space-y-2">
                          <input value={wClass2.title} onChange={(e)=>setWClass2(prev=>({ ...prev, title: e.target.value }))} placeholder="Класс 2 — название (опц.)" className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl px-3 py-2" />
                          <input value={wClass2.location||""} onChange={(e)=>setWClass2(prev=>({ ...prev, location: e.target.value }))} placeholder="Локация (опц.)" className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl px-3 py-2" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <button onClick={()=>setWizardStep(1)} className="rounded-full bg-[#0f0f14] border border-[#2a2a35] px-4 py-2">Назад</button>
                        <button onClick={submitWizard} disabled={wSubmitting || !wName.trim()} className="rounded-full bg-[#00a3ff] hover:bg-[#0088cc] text-black px-4 py-2 disabled:opacity-60">Создать</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {subOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={()=>setSubOpen(false)}>
                <div className="w-full max-w-md rounded-2xl bg-[#16161c] border border-[#2a2a35] p-5 text-white" onClick={(e)=>e.stopPropagation()}>
                  <div className="text-lg font-semibold mb-3">Открыть кружок</div>
                  <div className="text-white/90 text-sm mb-3">
                    Переведите <b>2000 ₸</b> на Kaspi: <b>+7 776 045 7776</b>. 
                    В комментарии к переводу укажите код ниже. После проверки платежа мы активируем ваш кружок.
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-white/60">Комментарий к переводу</div>
                    <div className="flex items-center gap-2">
                      <input readOnly value={paymentComment} className="flex-1 bg-[#0f0f14] border border-[#2a2a35] rounded-xl px-3 py-2 text-sm" />
                      <button 
                        onClick={()=>{ 
                          navigator.clipboard?.writeText(paymentComment)
                          toast({ title: 'Скопировано', description: 'Комментарий скопирован в буфер обмена' } as any)
                        }} 
                        className="px-3 py-2 rounded-xl bg-[#2a2a35] hover:bg-[#333344] text-sm whitespace-nowrap"
                      >
                        Скопировать
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-4">
                    <button onClick={()=>setSubOpen(false)} className="px-4 py-2 rounded-full bg-[#1b1b22] border border-[#2a2a35] text-white/90">Закрыть</button>
                    <button onClick={submitSubscriptionRequest} disabled={submittingOpenRequest || openRequestSent} className="px-4 py-2 rounded-full bg-[#00a3ff] hover:bg-[#0088cc] text-black font-medium disabled:opacity-60">{openRequestSent? 'Отправлено' : (submittingOpenRequest ? 'Отправка...' : 'Отправить заявку')}</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {!loading && clubs.map((c) => (
          <div key={c.id} className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-5 text-white space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#0f0f14] border border-[#2a2a35] inline-flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white/80" />
              </div>
              <div className="flex-1">
                <div className="text-xl font-semibold">{c.name}</div>
                {c.location && <div className="text-white/70 text-sm inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</div>}
              </div>
              <div className="hidden md:block text-xs text-white/70">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#0f0f14] border border-[#2a2a35]">Подписка: до 2 классов, 30 учеников/класс</div>
              </div>
              <button onClick={() => setOpenClubId(openClubId === c.id ? null : c.id)} className="w-9 h-9 rounded-lg bg-[#0f0f14] border border-[#2a2a35] inline-flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#00a3ff] text-black text-sm font-medium">Кол-во классов: {(c.classes||[]).length}</div>
              {String(user?.role || "").toUpperCase() === 'ADMIN' && (
                <button onClick={async()=>{ const ok = await confirm({ title: 'Удалить кружок?', description: 'Действие нельзя отменить. Все классы и данные будут удалены.', confirmText: 'Удалить', cancelText: 'Отмена', variant: 'danger' }); if(!ok) return; try{ await apiFetch(`/api/clubs/${c.id}`, { method: 'DELETE' }); toast({ title: "Кружок удалён" }) } catch(e:any){ toast({ title: "Ошибка", description: e?.message||"Не удалось удалить", variant: "destructive" as any }) } await load() }} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2a2a35] hover:bg-[#333344] text-sm">
                  <Trash2 className="w-4 h-4" /> Удалить
                </button>
              )}
            </div>

            {openClubId === c.id && (
            <div className="space-y-3">
              <div className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl p-3">
                <div className="text-sm font-medium mb-2">Менторы</div>
              <div className="flex gap-2">
                <input value={mentorEmail[c.id]||""} onChange={(e)=>setMentorEmail(prev=>({...prev,[c.id]:e.target.value}))} placeholder="email@example.com" className="flex-1 bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-3 py-2 text-sm" />
                <button onClick={async()=>{
                  const email=(mentorEmail[c.id]||"").trim(); if(!email) return
                  await apiFetch(`/api/clubs/${c.id}/mentors-by-email`,{ method:"POST", body: JSON.stringify({ email })})
                  setMentorEmail(prev=>({...prev,[c.id]:""}))
                  await load()
                }} className="text-xs rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-2">Добавить</button>
              </div>
              <div className="text-white/70 text-xs mt-2 space-y-1">
                {(!(c.mentors||[]).length) && <div>Нет менторов</div>}
                {(c.mentors||[]).map(m => (
                  <div key={m.user.id}>{m.user.fullName || m.user.email}</div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              {(c.classes || []).map((cl) => {
                const isOpen = expandedClassId === cl.id
                const sched = schedForm[cl.id] || { dayOfWeek: 1, startTime: "15:00", endTime: "16:00", location: cl.location || "" }
                const range = genRange[cl.id] || { from: new Date().toISOString().slice(0,10), to: new Date(Date.now()+7*86400000).toISOString().slice(0,10) }
                const classSessions = sessions[cl.id] || []
                const enrolled = (cl.enrollments || []).map(e => e.user)
                return (
                  <div key={cl.id} className="border border-[#2a2a35] rounded-xl p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{cl.title}</div>
                        {cl.location && <div className="text-white/60 text-xs inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{cl.location}</div>}
                        <div className="text-white/60 text-xs inline-flex items-center gap-1 mt-1"><Users className="w-3 h-3" />Участников: {(cl.enrollments||[]).length}</div>
                        <div className="text-white/60 text-xs inline-flex items-center gap-1 mt-1"><Calendar className="w-3 h-3" />Расписание: {(cl.scheduleItems||[]).length}</div>
                      </div>
                      <div className="flex items-center gap-2">
                      {String(user?.role || "").toUpperCase() === 'ADMIN' && (
                        <button onClick={async()=>{ const ok = await confirm({ title: 'Удалить класс?', description: 'Действие нельзя отменить. Все занятия, расписание и отметки будут удалены.', confirmText: 'Удалить', cancelText: 'Отмена', variant: 'danger' }); if(!ok) return; try{ await apiFetch(`/api/clubs/classes/${cl.id}`, { method: 'DELETE' }); toast({ title: "Класс удалён" }) } catch(e:any){ toast({ title: "Ошибка", description: e?.message||"Не удалось удалить", variant: "destructive" as any }) } await load() }} className="text-xs rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-1">Удалить</button>
                      )}
                      <button onClick={()=>{
                        setExpandedClassId(isOpen ? null : cl.id)
                        if (!isOpen) {
                          void (async ()=>{
                            setLoadingSessions((p)=>({...p, [cl.id]: true}))
                            try {
                              const from = new Date().toISOString().slice(0,10)
                              const to = new Date(Date.now()+14*86400000).toISOString().slice(0,10)
                              const list = await apiFetch<any[]>(`/api/clubs/classes/${cl.id}/sessions?from=${from}&to=${to}`)
                              setSessions((prev)=>({...prev, [cl.id]: list}))
                              const draftEntries: Record<string, Record<string, { status: string; feedback?: string }>> = {}
                              for (const s of list) {
                                const key = `${cl.id}:${s.id}`
                                if (Array.isArray(s.attendances)) {
                                  const m: Record<string, { status: string; feedback?: string }> = {}
                                  for (const a of s.attendances) {
                                    if (a?.studentId && a?.status) m[a.studentId] = { status: String(a.status), feedback: a.feedback || "" }
                                  }
                                  draftEntries[key] = m
                                }
                              }
                              if (Object.keys(draftEntries).length) setAttendanceDraft(prev=>({ ...draftEntries, ...prev }))
                            } catch { setSessions((prev)=>({...prev, [cl.id]: []})) }
                            finally { setLoadingSessions((p)=>({...p, [cl.id]: false})) }
                          })()
                          void (async ()=>{
                            try {
                              const [resList, asgList] = await Promise.all([
                                apiFetch<any[]>(`/api/clubs/classes/${cl.id}/resources`),
                                apiFetch<any[]>(`/api/clubs/classes/${cl.id}/assignments`),
                              ])
                              setResources((prev)=>({ ...prev, [cl.id]: resList }))
                              setAssignments((prev)=>({ ...prev, [cl.id]: asgList }))
                            } catch {}
                          })()
                          void (async ()=>{
                            try {
                              const pid = (c as any)?.programId
                              if (pid) {
                                const tpls = await apiFetch<any[]>(`/api/programs/${pid}/templates`)
                                setProgramTemplates(prev => ({ ...prev, [c.id]: (tpls||[]).map(t=>({ id: t.id, title: t.title, presentationUrl: t.presentationUrl, scriptUrl: t.scriptUrl })) }))
                              }
                            } catch {}
                          })()
                          void (async ()=>{
                            try {
                              const data = await apiFetch<{ code: string | null }>(`/api/clubs/classes/${cl.id}/invite-code`)
                              setInviteCodes((prev)=>({ ...prev, [cl.id]: data?.code ?? null }))
                            } catch { setInviteCodes((prev)=>({ ...prev, [cl.id]: null })) }
                          })()
                        }
                      }} className="text-xs rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-1">{isOpen?"Скрыть":"Управление"}</button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="space-y-4">
                        <div className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl p-3">
                          <div className="text-sm font-medium mb-2">Код вступления</div>
                          <div className="flex items-center gap-2 text-sm">
                            <div className="px-2 py-1 rounded bg-[#1b1b22] border border-[#2a2a35]">{inviteCodes[cl.id] || 'не сгенерирован'}</div>
                            <button onClick={async()=>{ try{ const r = await apiFetch<{code:string}>(`/api/clubs/classes/${cl.id}/invite-code`, { method: 'POST' }); setInviteCodes(p=>({ ...p, [cl.id]: r.code })); toast({ title: 'Код обновлён' }) } catch(e:any){ toast({ title:'Ошибка', description: e?.message||'Не удалось сгенерировать', variant:'destructive' as any }) } }} className="text-xs rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-1">Сгенерировать</button>
                          </div>
                        </div>
                        
                        <div className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl p-3">
                          <div className="text-sm font-medium mb-2">Добавить ученика по email</div>
                          <div className="flex gap-2">
                            <input value={enrollEmail[cl.id]||""} onChange={(e)=>setEnrollEmail(prev=>({...prev,[cl.id]:e.target.value}))} placeholder="email@example.com" className="flex-1 bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-3 py-2 text-sm" />
                            <button onClick={async()=>{
                              const email=(enrollEmail[cl.id]||"").trim(); if(!email) return
                              try {
                                await apiFetch(`/api/clubs/classes/${cl.id}/enroll-by-email`,{ method:"POST", body: JSON.stringify({ email })})
                                toast({ title: "Ученик добавлен" })
                              } catch (e:any) {
                                toast({ title: "Ошибка", description: e?.message||"Не удалось добавить", variant: "destructive" as any })
                              }
                              setEnrollEmail(prev=>({...prev,[cl.id]:""}))
                              await load()
                            }} className="text-xs rounded-full bg-[#00a3ff] hover:bg-[#0088cc] px-3 py-2 text-black font-medium">Добавить</button>
                          </div>

                          <div className="mt-4">
                            <div className="text-sm font-medium mb-2">Добавить ученика (ФИО)</div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <input value={extraFio[cl.id]||""} onChange={(e)=>setExtraFio(prev=>({...prev,[cl.id]:e.target.value}))} placeholder="ФИО" className="bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-3 py-2 text-sm" />
                              <input value={extraEmail[cl.id]||""} onChange={(e)=>setExtraEmail(prev=>({...prev,[cl.id]:e.target.value}))} placeholder="Email (необязательно)" className="bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-3 py-2 text-sm" />
                              <button onClick={async()=>{
                                const fullName=(extraFio[cl.id]||"").trim(); if(!fullName) return
                                try {
                                  await apiFetch(`/api/clubs/classes/${cl.id}/extra-students`,{ method:"POST", body: JSON.stringify({ fullName, email: (extraEmail[cl.id]||"").trim()||undefined })})
                                  toast({ title: "Ученик добавлен" })
                                } catch (e:any) {
                                  toast({ title: "Ошибка", description: e?.message||"Не удалось добавить", variant: "destructive" as any })
                                }
                                setExtraFio(prev=>({...prev,[cl.id]:""})); setExtraEmail(prev=>({...prev,[cl.id]:""}))
                                await load()
                              }} className="text-xs rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-2">Добавить</button>
                            </div>
                          </div>

                        <div className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl p-3">
                          <div className="text-sm font-medium mb-2">Добавить дату занятия</div>
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-sm items-center">
                            <input type="date" value={addDate[cl.id]||new Date().toISOString().slice(0,10)} onChange={(e)=>setAddDate(prev=>({...prev,[cl.id]: e.target.value}))} className="bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-2 py-2" />
                            <button onClick={async()=>{
                              const d=(addDate[cl.id]||new Date().toISOString().slice(0,10))
                              try { await apiFetch(`/api/clubs/classes/${cl.id}/sessions`,{ method:'POST', body: JSON.stringify({ date: d }) }); toast({ title: 'Дата добавлена' }) } catch(e:any){ toast({ title: 'Ошибка', description: e?.message||'Не удалось добавить дату', variant: 'destructive' as any }) }
                              const list = await apiFetch<any[]>(`/api/clubs/classes/${cl.id}/sessions?from=${d}&to=${d}`)
                              setSessions(prev=>({ ...prev, [cl.id]: Array.from(new Set([...(prev[cl.id]||[]), ...list])).sort((a:any,b:any)=> new Date(a.date).getTime()-new Date(b.date).getTime()) }))
                            }} className="rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-2">Добавить дату</button>
                          </div>
                        </div>

                        <div className="mt-3">
                            <div className="text-sm font-medium mb-2">Участники</div>
                            {(enrolled.length===0) && <div className="text-white/60 text-sm">Пока нет</div>}
                            {enrolled.map(u=> (
                              <div key={u.id} className="flex items-center justify-between text-sm py-1">
                                <div>{u.fullName || u.email}</div>
                                <button onClick={async()=>{
                                  try { await apiFetch(`/api/clubs/classes/${cl.id}/enroll/${u.id}`, { method: 'DELETE' }); toast({ title: "Удалён из класса" }) } catch(e:any){ toast({ title: "Ошибка", description: e?.message||"Не удалось удалить", variant: "destructive" as any }) }
                                  await load()
                                }} className="text-xs rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-1">Убрать</button>
                              </div>
                            ))}
                          </div>
                        </div>

                        
                        <div className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl p-3">
                          <div className="text-sm font-medium mb-2">Добавить слот расписания</div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                            <select value={sched.dayOfWeek} onChange={(e)=>setSchedForm(prev=>({...prev,[cl.id]:{...sched, dayOfWeek:Number(e.target.value)}}))} className="bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-2 py-2">
                              <option value={1}>Пн</option>
                              <option value={2}>Вт</option>
                              <option value={3}>Ср</option>
                              <option value={4}>Чт</option>
                              <option value={5}>Пт</option>
                              <option value={6}>Сб</option>
                              <option value={0}>Вс</option>
                            </select>
                            <input type="time" value={sched.startTime} onChange={(e)=>setSchedForm(prev=>({...prev,[cl.id]:{...sched, startTime:e.target.value}}))} className="bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-2 py-2" />
                            <input type="time" value={sched.endTime} onChange={(e)=>setSchedForm(prev=>({...prev,[cl.id]:{...sched, endTime:e.target.value}}))} className="bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-2 py-2" />
                            <input placeholder="Локация (опц.)" value={sched.location||""} onChange={(e)=>setSchedForm(prev=>({...prev,[cl.id]:{...sched, location:e.target.value}}))} className="bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-2 py-2" />
                            <button onClick={async()=>{
                              try { await apiFetch(`/api/clubs/classes/${cl.id}/schedule`,{ method:"POST", body: JSON.stringify({ ...sched }) }); toast({ title: "Слот добавлен" }) } catch(e:any){ toast({ title: "Ошибка", description: e?.message||"Не удалось добавить", variant: "destructive" as any }) }
                              await load()
                            }} className="rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-2">Добавить</button>
                          </div>
                          <div className="text-white/60 text-xs mt-2 space-y-1">
                            <div className="text-white/80">Имеющиеся слоты:</div>
                            {(!cl.scheduleItems || cl.scheduleItems.length===0) && <div>нет</div>}
                            {(cl.scheduleItems||[]).map(si=> (
                              <div key={si.id} className="flex items-center justify-between">
                                <div>{["Вс","Пн","Вт","Ср","Чт","Пт","Сб"][si.dayOfWeek]} {si.startTime}-{si.endTime} {si.location?`/ ${si.location}`:""}</div>
                                <button onClick={async()=>{ try{ await apiFetch(`/api/clubs/schedule/${si.id}`, { method: 'DELETE' }); toast({ title: "Слот удалён" }) } catch(e:any){ toast({ title: "Ошибка", description: e?.message||"Не удалось удалить", variant: "destructive" as any }) } await load() }} className="text-xs rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-1">Удалить</button>
                              </div>
                            ))}
                          </div>
                        </div>

                        
                        <div className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl p-3">
                          <div className="text-sm font-medium mb-2">Сгенерировать занятия</div>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm items-center">
                            <div className="inline-flex items-center gap-2"><span>С</span><input type="date" value={range.from} onChange={(e)=>setGenRange(prev=>({...prev,[cl.id]:{...range, from:e.target.value}}))} className="bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-2 py-2" /></div>
                            <div className="inline-flex items-center gap-2"><span>По</span><input type="date" value={range.to} onChange={(e)=>setGenRange(prev=>({...prev,[cl.id]:{...range, to:e.target.value}}))} className="bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-2 py-2" /></div>
                            <button onClick={async()=>{
                              try { await apiFetch(`/api/clubs/classes/${cl.id}/sessions/generate`,{ method:"POST", body: JSON.stringify({ from: range.from, to: range.to }) }); toast({ title: "Занятия сгенерированы" }) } catch(e:any){ toast({ title: "Ошибка", description: e?.message||"Не удалось сгенерировать", variant: "destructive" as any }) }
                              const list = await apiFetch<any[]>(`/api/clubs/classes/${cl.id}/sessions?from=${range.from}&to=${range.to}`)
                              setSessions((prev)=>({...prev, [cl.id]: list}))
                              const draftEntries: Record<string, Record<string, { status: string; feedback?: string }>> = {}
                              for (const s of list) {
                                const key = `${cl.id}:${s.id}`
                                if (Array.isArray(s.attendances)) {
                                  const m: Record<string, { status: string; feedback?: string }> = {}
                                  for (const a of s.attendances) {
                                    if (a?.studentId && a?.status) m[a.studentId] = { status: String(a.status), feedback: a.feedback || "" }
                                  }
                                  draftEntries[key] = m
                                }
                              }
                              if (Object.keys(draftEntries).length) setAttendanceDraft(prev=>({ ...draftEntries, ...prev }))
                            }} className="rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-2">Сгенерировать</button>
                            <div className="text-white/60 text-xs inline-flex items-center gap-1"><Clock className="w-3 h-3" />Занятий: {classSessions.length}</div>
                          </div>
                        </div>

                        
                        {/* Сегодняшний урок */}
                        {(() => {
                          const todayStr = new Date().toLocaleDateString('ru-RU', { timeZone: 'Asia/Aqtobe' })
                          const today = classSessions.find(ss => new Date(ss.date).toLocaleDateString('ru-RU', { timeZone: 'Asia/Aqtobe' }) === todayStr)
                          if (!today) return null
                          const isStaff = String(user?.role||'').toUpperCase()==='ADMIN' || (c.mentors||[]).some(m=>m.user?.id===user?.id)
                          const att = (sessions[cl.id]||[]).find(s=>s.id===today.id)?.attendances || []
                          const mePresent = Boolean(att.find((a:any)=>a?.studentId===user?.id && String(a?.status)==='present'))
                          return (
                            <div className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl p-3 mb-2">
                              <div className="text-sm font-medium mb-1">Сегодняшний урок</div>
                              <div className="text-white/80 text-sm mb-2">{new Date(today.date).toLocaleString('ru-RU', { timeZone: 'Asia/Aqtobe' })}</div>
                              <div className="flex items-center gap-2">
                                {isStaff && <button onClick={()=>startQuiz(today.id)} disabled={startingQuiz[today.id]} className="rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-2 text-xs">{startingQuiz[today.id]?"Запуск...":"Начать квиз"}</button>}
                                <button onClick={()=>openQuizModal(today.id)} className="rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-2 text-xs">Открыть квиз</button>
                                {isStaff && <button onClick={async()=>{ await loadSubmissions(today.id); setSubmissionsOpen(today.id) }} className="rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-2 text-xs">Результаты</button>}
                                {isStaff && <button onClick={()=>setLessonModal({ open: true, classId: cl.id, sessionId: today.id, clubId: c.id })} className="rounded-full bg-[#00a3ff] hover:bg-[#0088cc] px-3 py-2 text-xs text-black">Открыть урок</button>}
                                {!isStaff && mePresent && <button onClick={()=>openQuizModal(today.id)} className="rounded-full bg-[#00a3ff] hover:bg-[#0088cc] px-3 py-2 text-xs text-black">Пройти квиз</button>}
                              </div>
                            </div>
                          )
                        })()}

                        <div className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl p-3 space-y-2">
                          <div className="text-sm font-medium">Материалы программы</div>
                          {((programTemplates[c.id]||[]).length===0) && <div className="text-white/60 text-sm">Нет материалов</div>}
                          {(programTemplates[c.id]||[]).map(t => (
                            <div key={t.id} className="flex items-center justify-between text-sm border border-[#2a2a35] rounded-lg px-3 py-2">
                              <div>{t.title}</div>
                              <div className="flex items-center gap-2">
                                {t.presentationUrl && <a href={t.presentationUrl} target="_blank" rel="noreferrer" className="text-xs rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-1">Презентация</a>}
                                {t.scriptUrl && <a href={t.scriptUrl} target="_blank" rel="noreferrer" className="text-xs rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-1">Сценарий</a>}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl p-3 space-y-2">
                          <div className="text-sm font-medium">Ближайшие занятия</div>
                          {loadingSessions[cl.id] && <div className="text-white/60 text-sm">Загрузка...</div>}
                          {!loadingSessions[cl.id] && classSessions.length === 0 && <div className="text-white/60 text-sm">Нет занятий</div>}
                          {!loadingSessions[cl.id] && classSessions.map((s) => {
                            const d = new Date(s.date)
                            const key = `${cl.id}:${s.id}`
                            const draft = attendanceDraft[key] || {}
                            return (
                              <div key={s.id} className="border border-[#2a2a35] rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-white/80 text-sm">{d.toLocaleString('ru-RU', { timeZone: 'Asia/Aqtobe' })}</div>
                                  <div className="flex items-center gap-2">
                                    {(() => { const isStaff = String(user?.role||'').toUpperCase()==='ADMIN' || (c.mentors||[]).some(m=>m.user?.id===user?.id); return isStaff ? (<>
                                      <button onClick={()=>startQuiz(s.id)} disabled={startingQuiz[s.id]} className="text-xs rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-1">{startingQuiz[s.id]?"Запуск...":"Начать квиз"}</button>
                                      <button onClick={async()=>{ await loadSubmissions(s.id); setSubmissionsOpen(s.id) }} className="text-xs rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-1">Результаты</button>
                                      <button onClick={()=>setLessonModal({ open: true, classId: cl.id, sessionId: s.id, clubId: c.id })} className="text-xs rounded-full bg-[#00a3ff] hover:bg-[#0088cc] px-3 py-1 text-black">Открыть урок</button>
                                    </> ) : null })()}
                                    <button onClick={()=>openQuizModal(s.id)} className="text-xs rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-1">Открыть квиз</button>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {enrolled.length === 0 && <div className="text-white/60 text-sm">Нет учеников</div>}
                                  {enrolled.map((u) => {
                                    const st = draft[u.id]?.status || "present"
                                    const fb = draft[u.id]?.feedback || ""
                                    return (
                                      <div key={u.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center text-sm">
                                        <div className="col-span-2">{u.fullName || u.email}</div>
                                        <select value={st} onChange={async (e)=>{ const val = e.target.value; setAttendanceDraft(prev=>({ ...prev, [key]: { ...draft, [u.id]: { status: val, feedback: fb } } })); try { await apiFetch(`/api/clubs/sessions/${s.id}/attendance`, { method: 'POST', body: JSON.stringify({ marks: [{ studentId: u.id, status: val, feedback: fb || undefined }] }) }); toast({ title: 'Сохранено' }) } catch(e:any){ toast({ title: 'Ошибка', description: e?.message||'Не удалось сохранить', variant: 'destructive' as any }) } }} className="bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-2 py-2">
                                          <option value="present">Пришёл</option>
                                          <option value="absent">Не пришёл</option>
                                          <option value="late">Опоздал</option>
                                          <option value="excused">Уважительная</option>
                                        </select>
                                        <input placeholder="Фидбек (опц.)" value={fb} onChange={(e)=>setAttendanceDraft(prev=>({ ...prev, [key]: { ...draft, [u.id]: { status: st, feedback: e.target.value } } }))} className="bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-2 py-2" />
                                        <div className="flex gap-2">
                                          <button onClick={async()=>{
                                            const d = attendanceDraft[key] || {}
                                            const next = { ...d, [u.id]: { status: "present", feedback: fb } }
                                            setAttendanceDraft(prev=>({ ...prev, [key]: next }))
                                            try { await apiFetch(`/api/clubs/sessions/${s.id}/attendance`, { method: 'POST', body: JSON.stringify({ marks: [{ studentId: u.id, status: 'present', feedback: fb || undefined }] }) }); toast({ title: 'Сохранено' }) } catch(e:any){ toast({ title: 'Ошибка', description: e?.message||'Не удалось сохранить', variant: 'destructive' as any }) }
                                          }} className="rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-2 flex items-center gap-1"><Check className="w-3 h-3"/>Пришёл</button>
                                          <button onClick={async()=>{
                                            const d = attendanceDraft[key] || {}
                                            const next = { ...d, [u.id]: { status: "absent", feedback: fb } }
                                            setAttendanceDraft(prev=>({ ...prev, [key]: next }))
                                            try { await apiFetch(`/api/clubs/sessions/${s.id}/attendance`, { method: 'POST', body: JSON.stringify({ marks: [{ studentId: u.id, status: 'absent', feedback: fb || undefined }] }) }); toast({ title: 'Сохранено' }) } catch(e:any){ toast({ title: 'Ошибка', description: e?.message||'Не удалось сохранить', variant: 'destructive' as any }) }
                                          }} className="rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-2 flex items-center gap-1"><X className="w-3 h-3"/>Нет</button>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                                {enrolled.length>0 && (
                                  <div className="mt-2">
                                    <button onClick={async()=>{
                                      const d = attendanceDraft[key] || {}
                                      const marks = Object.entries(d).map(([studentId, v])=>({ studentId, status: (v as any).status, feedback: (v as any).feedback || undefined }))
                                      if (marks.length === 0) return
                                      try { await apiFetch(`/api/clubs/sessions/${s.id}/attendance`, { method: "POST", body: JSON.stringify({ marks }) }); toast({ title: "Отметки отправлены" }) } catch(e:any){ toast({ title: "Ошибка", description: e?.message||"Не удалось отправить", variant: "destructive" as any }) }
                                      setAttendanceDraft(prev=>{ const n = { ...prev }; delete n[key]; return n })
                                    }} className="rounded-full bg-[#00a3ff] hover:bg-[#0088cc] px-4 py-2 text-black font-medium">Отправить отметки</button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        <div className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium">Таблица посещаемости</div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  try {
                                    const colDates = Array.from(new Set(classSessions.map(s => new Date(s.date).toISOString().slice(0,10))))
                                    const dateToSession: Record<string, string> = {}
                                    for (const s of classSessions) {
                                      const iso = new Date(s.date).toISOString().slice(0,10)
                                      dateToSession[iso] = s.id
                                    }
                                    const students = enrolled.map(u => ({ id: u.id, name: u.fullName || u.email }))
                                    const attendanceData: Record<string, Record<string, { status: string }>> = {}
                                    colDates.forEach(d => {
                                      const sid = dateToSession[d]
                                      const key = `${cl.id}:${sid}`
                                      attendanceData[d] = attendanceDraft[key] || {}
                                    })
                                    exportAttendanceToCSV(students, colDates, attendanceData, cl.title)
                                    toast({ title: 'Экспортировано', description: 'Таблица сохранена в CSV' })
                                  } catch (e: any) {
                                    toast({ title: 'Ошибка', description: e?.message || 'Не удалось экспортировать', variant: 'destructive' as any })
                                  }
                                }}
                                className="inline-flex items-center gap-1 text-xs rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-1"
                              >
                                <Download className="w-3 h-3" />
                                CSV
                              </button>
                              <button 
                                onClick={() => {
                                  try {
                                    const colDates = Array.from(new Set(classSessions.map(s => new Date(s.date).toISOString().slice(0,10))))
                                    const dateToSession: Record<string, string> = {}
                                    for (const s of classSessions) {
                                      const iso = new Date(s.date).toISOString().slice(0,10)
                                      dateToSession[iso] = s.id
                                    }
                                    const students = enrolled.map(u => ({ id: u.id, name: u.fullName || u.email }))
                                    const attendanceData: Record<string, Record<string, { status: string }>> = {}
                                    colDates.forEach(d => {
                                      const sid = dateToSession[d]
                                      const key = `${cl.id}:${sid}`
                                      attendanceData[d] = attendanceDraft[key] || {}
                                    })
                                    exportAttendanceToPDF(students, colDates, attendanceData, cl.title)
                                  } catch (e: any) {
                                    toast({ title: 'Ошибка', description: e?.message || 'Не удалось экспортировать', variant: 'destructive' as any })
                                  }
                                }}
                                className="inline-flex items-center gap-1 text-xs rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-1"
                              >
                                <FileText className="w-3 h-3" />
                                PDF
                              </button>
                            </div>
                          </div>
                          {(() => {
                            const colDates = Array.from(new Set(classSessions.map(s => new Date(s.date).toISOString().slice(0,10))))
                            const dateToSession: Record<string, string> = {}
                            for (const s of classSessions) {
                              const iso = new Date(s.date).toISOString().slice(0,10)
                              dateToSession[iso] = s.id
                            }
                            return (
                              <div className="overflow-auto">
                                <table className="min-w-full text-white text-sm">
                                  <thead>
                                    <tr>
                                      <th className="sticky left-0 bg-[#0f0f14] px-3 py-2 text-left border-b border-[#2a2a35]">ФИО</th>
                                      {colDates.map(d => (
                                        <th key={d} className="px-3 py-2 text-center border-b border-[#2a2a35] whitespace-nowrap">{new Date(d).toLocaleDateString("ru-RU", { timeZone: 'Asia/Aqtobe' })}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {enrolled.map(u => (
                                      <tr key={u.id} className="border-t border-[#2a2a35]">
                                        <td className="sticky left-0 bg-[#0f0f14] px-3 py-2 border-r border-[#2a2a35] whitespace-nowrap">{u.fullName || u.email}</td>
                                        {colDates.map(d => {
                                          const sid = dateToSession[d]
                                          const key = `${cl.id}:${sid}`
                                          const draft = attendanceDraft[key] || {}
                                          const checked = (draft[u.id]?.status || "absent") === "present"
                                          return (
                                            <td key={d} className="px-3 py-2 text-center">
                                              <input type="checkbox" className="w-5 h-5 accent-[#00a3ff]" checked={checked} onChange={async () => {
                                                const prev = attendanceDraft[key] || {}
                                                const cur = (prev[u.id]?.status || 'absent') === 'present'
                                                const nextStatus = cur ? 'absent' : 'present'
                                                const fb = prev[u.id]?.feedback || ''
                                                setAttendanceDraft(old => ({ ...old, [key]: { ...prev, [u.id]: { status: nextStatus, feedback: fb } } }))
                                                try {
                                                  await apiFetch(`/api/clubs/sessions/${sid}/attendance`, { method: 'POST', body: JSON.stringify({ marks: [{ studentId: u.id, status: nextStatus, feedback: fb || undefined }] }) })
                                                  toast({ title: 'Сохранено' })
                                                } catch(e:any) {
                                                  toast({ title: 'Ошибка', description: e?.message||'Не удалось сохранить', variant: 'destructive' as any })
                                                }
                                              }} />
                                            </td>
                                          )
                                        })}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )
                          })()}
                          {enrolled.length>0 && (sessions[cl.id]?.length||0) > 0 && (
                            <div className="flex justify-end">
                              <button onClick={async()=>{
                                try {
                                  const colDates = Array.from(new Set((sessions[cl.id]||[]).map(s => new Date(s.date).toISOString().slice(0,10))))
                                  const dateToSession: Record<string, string> = {}
                                  for (const s of (sessions[cl.id]||[])) {
                                    const iso = new Date(s.date).toISOString().slice(0,10)
                                    dateToSession[iso] = s.id
                                  }
                                  await Promise.all(colDates.map(async (d) => {
                                    const sid = dateToSession[d]
                                    const key = `${cl.id}:${sid}`
                                    const draft = attendanceDraft[key] || {}
                                    const marks = Object.entries(draft).map(([studentId, v]) => ({ studentId, status: (v as any).status || "absent", feedback: (v as any).feedback || undefined }))
                                    if (marks.length > 0) {
                                      await apiFetch(`/api/clubs/sessions/${sid}/attendance`, { method: "POST", body: JSON.stringify({ marks }) })
                                    }
                                  }))
                                  toast({ title: "Таблица сохранена" })
                                } catch (e:any) {
                                  toast({ title: "Ошибка", description: e?.message || "Не удалось сохранить", variant: "destructive" as any })
                                }
                              }} className="rounded-full bg-[#00a3ff] hover:bg-[#0088cc] px-4 py-2 text-black font-medium">Сохранить таблицу</button>
                            </div>
                          )}
                        </div>

                        
                        {String(user?.role || "").toUpperCase() === 'ADMIN' && (
                          <div className="bg-[#140f0f] border border-[#432424] rounded-xl p-3">
                            <div className="text-sm font-medium mb-2">Опасная зона</div>
                            <button onClick={async()=>{ try{ await apiFetch(`/api/clubs/classes/${cl.id}`, { method: 'DELETE' }); toast({ title: "Класс удалён" }) } catch(e:any){ toast({ title: "Ошибка", description: e?.message||"Не удалось удалить", variant: "destructive" as any }) } await load() }} className="text-xs rounded-full bg-[#a33] hover:bg-[#c44] px-3 py-2 text-white">Удалить класс</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            
            <div className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl p-3">
              <div className="text-sm font-medium mb-2">Создать класс</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm items-center">
                <input placeholder="Название" value={(newClass[c.id]?.title)||""}  onChange={(e)=>setNewClass(prev=>({ ...prev, [c.id]: { ...(prev[c.id]||{ title:"" }), title: e.target.value } }))} className="bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-2 py-2" />
                <input placeholder="Локация (опц.)" value={(newClass[c.id]?.location)||""}  onChange={(e)=>setNewClass(prev=>({ ...prev, [c.id]: { ...(prev[c.id]||{ title:"" }), location: e.target.value } }))} className="bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-2 py-2" />
                <input placeholder="Описание (опц.)" value={(newClass[c.id]?.description)||""}  onChange={(e)=>setNewClass(prev=>({ ...prev, [c.id]: { ...(prev[c.id]||{ title:"" }), description: e.target.value } }))} className="bg-[#0c0c10] border border-[#2a2a35] rounded-lg px-2 py-2" />
                <button onClick={async()=>{
                  const payload = newClass[c.id]
                  if (!payload?.title?.trim()) return
                  try {
                    await apiFetch(`/api/clubs/${c.id}/classes`, { method: "POST", body: JSON.stringify({ title: payload.title.trim(), description: payload.description?.trim() || undefined, location: payload.location?.trim() || undefined }) })
                    setNewClass(prev=>{ const n={...prev}; delete n[c.id]; return n })
                    await load()
                    toast({ title: 'Класс создан' } as any)
                  } catch(e:any) {
                    // Check if it's a limit error
                    if (e?.message?.includes('лимит') || e?.message?.includes('максимум')) {
                      setLimitError({ type: 'class', clubId: c.id })
                      setUpgradeModal(true)
                    } else {
                      toast({ title: 'Ошибка', description: e?.message || 'Не удалось создать класс', variant: 'destructive' as any })
                    }
                  }
                }} className="rounded-full bg-[#2a2a35] hover:bg-[#333344] px-3 py-2">Создать</button>
              </div>
            </div>
            </div>
            )}
          </div>
        ))}
      </section>

      {/* Upgrade subscription modal */}
      {upgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={()=>{ setUpgradeModal(false); setLimitError(null) }}>
          <div className="w-full max-w-md rounded-2xl bg-[#16161c] border border-[#2a2a35] p-5 text-white" onClick={(e)=>e.stopPropagation()}>
            <div className="text-lg font-semibold mb-3">
              {limitError?.type === 'class' ? 'Достигнут лимит классов' : 'Достигнут лимит учеников'}
            </div>
            <div className="space-y-3 text-white/80 text-sm mb-4">
              {limitError?.type === 'class' ? (
                <>
                  <div>Ваша текущая подписка позволяет создать максимум <strong>2 класса</strong> на кружок.</div>
                  <div>Для создания дополнительных классов необходимо обновить подписку.</div>
                </>
              ) : (
                <>
                  <div>Ваша текущая подписка позволяет добавить максимум <strong>30 учеников</strong> в класс.</div>
                  <div>Для добавления большего количества учеников необходимо обновить подписку.</div>
                </>
              )}
            </div>
            <div className="bg-[#0f0f14] border border-[#2a2a35] rounded-xl p-3 mb-4">
              <div className="text-sm font-medium mb-2">Улучшенная подписка</div>
              <div className="text-white/70 text-xs space-y-1">
                <div>• До 5 классов на кружок</div>
                <div>• До 100 учеников в классе</div>
                <div>• Приоритетная поддержка</div>
                <div className="text-[#00a3ff] font-medium mt-2">5000₸/месяц</div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={()=>{ setUpgradeModal(false); setLimitError(null) }} className="px-4 py-2 rounded-full bg-[#1b1b22] border border-[#2a2a35] text-white/90">Закрыть</button>
              <button onClick={()=>{ setUpgradeModal(false); setLimitError(null); setSubOpen(true) }} className="px-4 py-2 rounded-full bg-[#00a3ff] hover:bg-[#0088cc] text-black font-medium">Обновить</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
