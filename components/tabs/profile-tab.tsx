"use client"
import {
  User as UserIcon,
  Trophy,
  ExternalLink,
  Plus,
  Coins,
  BookOpen,
  GraduationCap,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth/auth-context"
import { toast } from "@/hooks/use-toast"
import { apiFetch } from "@/lib/api"
import { useRouter } from "next/navigation"
import MyCertificates from "@/components/profile/my-certificates"

type AchievementItem = {
  id: string
  text?: string
  createdAt?: number
  earnedAt?: string
  achievement?: {
    title?: string
    description?: string
    iconUrl?: string
  }
}

type SubmissionItem = {
  id: string
  title: string
  description?: string
  placement?: string
  venue?: string
  eventDate?: string
  status: "pending" | "approved" | "rejected"
  imageUrl?: string
}

type MentorContact = {
  id: string
  fullName: string
  email: string
  phone?: string | null
  groups: Array<{ className?: string; kruzhokTitle?: string }>
}

type CourseProgress = {
  id: string
  title: string
  difficulty?: string
  progress?: number
  completedLessons?: number
  totalLessons?: number
}

type ProfileTabKey = "overview" | "stats" | "certificates"

export default function ProfileTab() {
  const router = useRouter()
  const { user, updateProfile, loading } = useAuth()
  const [fullName, setFullName] = useState("")
  const [institution, setInstitution] = useState("")
  const [achievements, setAchievements] = useState<AchievementItem[]>([])
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [mentors, setMentors] = useState<MentorContact[]>([])
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([])
  const [openAdd, setOpenAdd] = useState(false)
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("overview")
  const [form, setForm] = useState({
    title: "",
    description: "",
    projectSummary: "",
    venue: "",
    placement: "",
    eventDate: "",
  })

  const role = (user as any)?.role
  const isStudent = ["student", "STUDENT"].includes(String(role))

  const xp = Number((user as any)?.xp ?? (user as any)?.experiencePoints ?? 0)
  const level = useMemo(() => {
    const fallbackLevel = Math.floor(xp / 100) + 1
    return typeof (user as any)?.level === "number" && (user as any).level > 0
      ? (user as any).level
      : fallbackLevel
  }, [user, xp])
  const xpInLevel = xp % 100
  const levelProgress = Math.min(100, Math.round((xpInLevel / 100) * 100))
  const xpToNext = 100 - xpInLevel
  const coins = Number((user as any)?.coinBalance ?? 0)

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "")
      setInstitution((user as any).educationalInstitution || (user as any).institution || "")
    }
  }, [user])

  useEffect(() => {
    if (!user?.id) return
    reloadAchievements().catch(() => {})
  }, [user?.id])

  const reloadAchievements = async () => {
    if (!user?.id) return
    try {
      const list = await apiFetch<AchievementItem[]>(`/achievements/mine`)
      setAchievements(list || [])
    } catch (e: any) {
      console.warn("Failed to load achievements:", e?.message)
      setAchievements([])
    }
  }

  useEffect(() => {
    if (!isStudent) return
    apiFetch<SubmissionItem[]>("/submissions/competitions/mine")
      .then((list) => setSubmissions(list || []))
      .catch(() => setSubmissions([]))
  }, [isStudent])

  useEffect(() => {
    if (!isStudent) return
    apiFetch<{ mentors: MentorContact[] }>("/student/mentors")
      .then((res) => setMentors(res?.mentors || []))
      .catch(() => setMentors([]))
  }, [isStudent])

  useEffect(() => {
    if (!isStudent) return
    apiFetch<CourseProgress[]>("/courses/continue")
      .then((list) => setCourseProgress(list || []))
      .catch(() => setCourseProgress([]))
  }, [isStudent])

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-8 animate-slide-up">
        <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
          <div className="text-[var(--color-text-1)] text-center">Loading profile...</div>
        </div>
      </div>
    )
  }

  const statsCards = [
    { label: "Level", value: level, icon: GraduationCap },
    { label: "XP", value: xp, icon: Trophy },
    { label: "Coins", value: coins, icon: Coins },
    { label: "Courses in progress", value: courseProgress.length, icon: BookOpen },
  ]

  return (
    <div className="flex-1 p-4 md:p-8 animate-slide-up">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
        <div
          className="bg-[var(--color-surface-2)] rounded-xl p-4 md:p-6 border border-[var(--color-border-1)] animate-slide-up"
          style={{ animationDelay: "100ms" }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-[#00a3ff] to-[#0080cc] rounded-full flex items-center justify-center">
              <UserIcon className="w-8 h-8 md:w-10 md:h-10 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                <h2 className="text-[var(--color-text-1)] text-xl md:text-2xl font-medium">
                  {user?.fullName || "Unnamed profile"}
                </h2>
                <span className="bg-[#00a3ff] text-white px-3 py-1 rounded-full text-sm font-medium w-fit">
                  Level {level}
                </span>
              </div>
              <div className="text-[var(--color-text-3)] text-sm space-y-1">
                <p>
                  <span className="text-[var(--color-text-1)]">Email:</span>{" "}
                  {user?.email || "Not set"}
                </p>
                <p>
                  <span className="text-[var(--color-text-1)]">Institution:</span>{" "}
                  {(user as any)?.educationalInstitution || (user as any)?.institution || "Not set"}
                </p>
                {user?.primaryRole && (
                  <p>
                    <span className="text-[var(--color-text-1)]">Role:</span> {user.primaryRole}
                  </p>
                )}
                {typeof (user as any)?.age === "number" && (
                  <p>
                    <span className="text-[var(--color-text-1)]">Age:</span> {(user as any)?.age}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {isStudent && (
          <div className="flex flex-wrap gap-2 border-b border-[var(--color-border-1)] pb-2">
            {(["overview", "stats", "certificates"] as ProfileTabKey[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "border-b-2 border-[var(--color-primary)] text-[var(--color-text-1)]"
                    : "text-[var(--color-text-3)] hover:text-[var(--color-text-1)]"
                }`}
              >
                {tab === "overview" ? "Overview" : tab === "stats" ? "Stats" : "Certificates"}
              </button>
            ))}
          </div>
        )}

        {(!isStudent || activeTab === "overview") && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statsCards.map((item) => (
                <div key={item.label} className="bg-[#16161c] rounded-xl p-4 border border-[#636370]/20 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#0e0e12] flex items-center justify-center">
                    <item.icon className="w-6 h-6 text-[#00a3ff]" />
                  </div>
                  <div className="text-2xl font-bold text-white">{item.value}</div>
                  <div className="text-xs text-white/60">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20">
              <div className="flex items-center justify-between mb-4">
                <span className="text-white text-lg font-medium">Level progress</span>
                <span className="text-white/70 text-sm">{xpToNext} XP to next level</span>
              </div>
              <div className="w-full bg-[#636370]/20 rounded-full h-2 mb-2">
                <div
                  className="bg-gradient-to-r from-[#00a3ff] to-[#0080cc] h-2 rounded-full"
                  style={{ width: `${levelProgress}%` }}
                />
              </div>
              <div className="text-xs text-[#a0a0b0]">Keep going to unlock new achievements.</div>
            </div>

            {mentors.length > 0 && (
              <div className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20">
                <h3 className="text-white text-lg font-medium mb-4">Mentor contacts</h3>
                <div className="space-y-3">
                  {mentors.map((mentor) => (
                    <div key={mentor.id} className="bg-[#0e0e12] rounded-lg p-4 border border-[#636370]/10">
                      <div className="text-white font-medium">{mentor.fullName}</div>
                      <div className="text-white/70 text-sm">{mentor.email}</div>
                      {mentor.phone && <div className="text-white/70 text-sm">{mentor.phone}</div>}
                      {mentor.groups?.length > 0 && (
                        <div className="text-white/50 text-xs mt-2">
                          {mentor.groups.map((g, idx) => (
                            <span key={`${mentor.id}-${idx}`}>
                              {g.className || "Group"}
                              {g.kruzhokTitle ? ` - ${g.kruzhokTitle}` : ""}
                              {idx < mentor.groups.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!user?.fullName || !(user as any)?.educationalInstitution) && (
              <div className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20">
                <h3 className="text-white text-lg font-medium mb-4">Complete your profile</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full name"
                    className="bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2 text-white outline-none"
                  />
                  <input
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="School or institution"
                    className="bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2 text-white outline-none"
                  />
                </div>
                <button
                  onClick={() => {
                    updateProfile({ fullName: fullName.trim(), institution: institution.trim() })
                    toast({ title: "Profile updated" })
                  }}
                  className="mt-4 w-full md:w-auto rounded-lg bg-[#00a3ff] hover:bg-[#0088cc] text-black font-medium px-4 py-2"
                >
                  Save changes
                </button>
              </div>
            )}

            <div className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20">
              <h3 className="text-white text-lg font-medium mb-4">Password reset</h3>
              <button
                onClick={() =>
                  router.push(`/forgot-password${user?.email ? `?email=${encodeURIComponent(user.email)}` : ""}`)
                }
                className="rounded-lg bg-[#2a2a35] hover:bg-[#333344] text-white px-4 py-2 transition-colors"
              >
                Reset password
              </button>
            </div>
          </div>
        )}

        {isStudent && activeTab === "stats" && (
          <div className="space-y-6">
            <div className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20">
              <h3 className="text-white text-lg font-medium mb-4">Learning progress</h3>
              {courseProgress.length === 0 ? (
                <div className="text-white/60 text-sm text-center py-6">
                  No active courses yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {courseProgress.map((course) => {
                    const progressValue =
                      typeof course.progress === "number"
                        ? course.progress
                        : course.totalLessons && course.completedLessons
                          ? (course.completedLessons / course.totalLessons) * 100
                          : 0
                    return (
                      <div key={course.id} className="bg-[#0e0e12] rounded-lg p-4 border border-[#636370]/10">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <div className="text-white font-medium">{course.title}</div>
                            {course.difficulty && (
                              <div className="text-xs text-white/60 mt-1">{course.difficulty}</div>
                            )}
                          </div>
                          <div className="text-[#00a3ff] font-semibold">
                            {Math.round(progressValue)}%
                          </div>
                        </div>
                        <div className="w-full bg-[#636370]/20 rounded-full h-2 mb-2">
                          <div
                            className="bg-[#00a3ff] h-2 rounded-full"
                            style={{ width: `${Math.min(100, progressValue)}%` }}
                          />
                        </div>
                        {course.totalLessons ? (
                          <div className="text-xs text-white/50">
                            {course.completedLessons || 0} of {course.totalLessons} lessons
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-lg font-medium">Achievements</h3>
                <button
                  onClick={reloadAchievements}
                  className="text-sm rounded-lg bg-[#2a2a35] hover:bg-[#333344] px-3 py-1 text-white/80"
                >
                  Refresh
                </button>
              </div>
              {achievements.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {achievements.map((a) => {
                    const title = a.achievement?.title || a.text || "Achievement"
                    const description = a.achievement?.description || ""
                    const date = a.earnedAt || (a as any).createdAt
                    return (
                      <div
                        key={a.id}
                        className="bg-[#0e0e12] rounded-lg p-4 border border-[#636370]/10 group hover:border-[#00a3ff]/30 transition-all duration-200"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-white font-medium">{title}</h4>
                          <ExternalLink className="w-4 h-4 text-[#a0a0b0] group-hover:text-[#00a3ff] transition-colors duration-200" />
                        </div>
                        {description && <p className="text-[#a0a0b0] text-xs mb-2">{description}</p>}
                        <div className="flex items-center gap-2">
                          <span className="bg-[#00ff88] text-black px-2 py-1 rounded text-xs">Unlocked</span>
                          {date && (
                            <span className="text-[#a0a0b0] text-xs">
                              {new Date(date).toLocaleDateString("en-US")}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="bg-[#0e0e12] rounded-lg p-4 border border-[#636370]/10 text-center">
                  <Trophy className="w-8 h-8 text-[#636370] mx-auto mb-2" />
                  <p className="text-[#a0a0b0] text-sm">No achievements yet.</p>
                </div>
              )}
            </div>

            <div className="bg-[#16161c] rounded-xl p-4 md:p-6 border border-[#636370]/20">
              <h3 className="text-white text-lg font-medium mb-4">Competition submissions</h3>
              {submissions.length > 0 ? (
                <div className="space-y-3">
                  {submissions.map((s) => (
                    <div key={s.id} className="bg-[#0e0e12] rounded-lg p-4 border border-[#636370]/10">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-medium">{s.title}</h4>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            s.status === "approved"
                              ? "bg-[#22c55e]/20 text-[#22c55e]"
                              : s.status === "rejected"
                                ? "bg-[#ef4444]/20 text-[#ef4444]"
                                : "bg-[#f59e0b]/20 text-[#f59e0b]"
                          }`}
                        >
                          {s.status === "pending" ? "Pending" : s.status === "approved" ? "Approved" : "Rejected"}
                        </span>
                      </div>
                      {s.imageUrl && (
                        <img src={s.imageUrl} alt="submission" className="w-full h-40 object-cover rounded-md mb-2" />
                      )}
                      <div className="text-[#a0a0b0] text-sm space-y-1">
                        {s.description && <p>{s.description}</p>}
                        {s.placement && (
                          <p>
                            <span className="text-white">Placement:</span> {s.placement}
                          </p>
                        )}
                        {s.venue && (
                          <p>
                            <span className="text-white">Venue:</span> {s.venue}
                          </p>
                        )}
                        {s.eventDate && (
                          <p>
                            <span className="text-white">Date:</span>{" "}
                            {new Date(s.eventDate).toLocaleDateString("en-US")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-white/70 text-sm">No submissions yet.</div>
              )}

              <div className="mt-6 pt-6 border-t border-[#636370]/20">
                <p className="text-[#a0a0b0] text-sm mb-4">
                  Add your latest competition result or project showcase.
                </p>
                <button
                  onClick={() => setOpenAdd(true)}
                  className="w-12 h-12 bg-[#00a3ff] hover:bg-[#0088cc] rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105"
                >
                  <Plus className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}

        {isStudent && activeTab === "certificates" && (
          <div className="space-y-6">
            <MyCertificates />
          </div>
        )}

        {openAdd && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
            <div className="w-full max-w-lg bg-[#16161c] border border-[#2a2a35] rounded-2xl p-6 text-white animate-slide-up">
              <div className="text-lg font-medium mb-4">New submission</div>
              <div className="grid grid-cols-1 gap-3">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Submission title"
                  className="bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2 outline-none"
                />
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Short description"
                  rows={4}
                  className="bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2 outline-none"
                />
                <input
                  value={form.placement}
                  onChange={(e) => setForm({ ...form, placement: e.target.value })}
                  placeholder="Placement (1st, finalist, etc.)"
                  className="bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2 outline-none"
                />
                <input
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  placeholder="Venue"
                  className="bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2 outline-none"
                />
                <input
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                  className="bg-[#0f0f14] border border-[#2a2a35] rounded-lg px-3 py-2 outline-none"
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOpenAdd(false)}
                  className="rounded-lg bg-[#2a2a35] hover:bg-[#333344] py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!form.title.trim()) return
                    try {
                      await apiFetch("/submissions/competitions", {
                        method: "POST",
                        body: JSON.stringify(form),
                      })
                      toast({ title: "Submission sent" })
                      setOpenAdd(false)
                      setForm({ title: "", description: "", projectSummary: "", venue: "", placement: "", eventDate: "" })
                      const list = await apiFetch<SubmissionItem[]>("/submissions/competitions/mine")
                      setSubmissions(list || [])
                    } catch (e: any) {
                      toast({
                        title: "Submission failed",
                        description: e?.message || "Please try again.",
                        variant: "destructive" as any,
                      })
                    }
                  }}
                  className="rounded-lg bg-[#00a3ff] hover:bg-[#0088cc] text-black font-medium py-2"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
