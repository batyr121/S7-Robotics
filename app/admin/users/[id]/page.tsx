"use client"
import { ArrowUpRight, Star } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "@/hooks/use-toast"
import { apiFetch } from "@/lib/api"
import { Badge } from "@/components/ui/badge"

type Role = "USER" | "ADMIN" | "STUDENT" | "PARENT" | "MENTOR" | "GUEST"
interface Overview {
  user: {
    id: string
    email: string
    fullName?: string
    role: Role
    enrollments: { course: { id: string; title: string } }[]
    teamMemberships: { id: string; status: string; role: string; team: { id: string; name: string } }[]
  }
  purchases: { id: string; amount: number; currency: string; status: string; createdAt: string; payerFullName?: string; senderCode?: string }[]
  registrations: { id: string; status: string; event: { id: string; title: string; date?: string } }[]
  achievements: { id: string; achievement: { title: string } }[]
  competitionSubmissions: { id: string; title: string; placement?: string }[]
  mentorStats?: {
    ratingAvg: number
    ratingCount: number
    lessonsCompleted: number
    recentReviews: Array<{
      id: string
      rating: number
      comment?: string
      createdAt: string
      student: { id: string; fullName: string }
      schedule: { id: string; title: string; scheduledDate: string }
    }>
  }
}

export default function Page({ params }: { params: { id: string } }) {
  const [name, setName] = useState<string>("")
  const [role, setRole] = useState<Role | "">("")
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(true)

  useEffect(() => {
    apiFetch<Overview>(`/api/admin/users/${params.id}/overview`)
      .then((o) => {
        setOverview(o)
        setName(o.user.fullName || o.user.email || params.id)
        setRole(o.user.role)
      })
      .catch(() => {
        setOverview(null)
        setName(params.id)
      })
      .finally(() => setLoadingOverview(false))
  }, [params.id])

  const approveReg = async (eventId: string, regId: string) => {
    try {
      await apiFetch(`/api/admin/events/${eventId}/registrations/${regId}/approve`, { method: "POST" })
      setOverview((prev) => prev ? { ...prev, registrations: prev.registrations.map(r => r.id === regId ? { ...r, status: "approved" } : r) } : prev)
      toast({ title: "Registration approved" })
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to approve registration", variant: "destructive" as any })
    }
  }

  const rejectReg = async (eventId: string, regId: string) => {
    try {
      await apiFetch(`/api/admin/events/${eventId}/registrations/${regId}/reject`, { method: "POST" })
      setOverview((prev) => prev ? { ...prev, registrations: prev.registrations.map(r => r.id === regId ? { ...r, status: "rejected" } : r) } : prev)
      toast({ title: "Registration rejected" })
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to reject registration", variant: "destructive" as any })
    }
  }

  const promote = async () => {
    try {
      await apiFetch(`/api/admin/users/${params.id}`, {
        method: "PUT",
        body: JSON.stringify({ role: "ADMIN" })
      })
      setRole("ADMIN")
      toast({ title: "Role updated", description: "User is now an admin." })
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to promote user", variant: "destructive" as any })
    }
  }

  const demote = async () => {
    try {
      await apiFetch(`/api/admin/users/${params.id}`, {
        method: "PUT",
        body: JSON.stringify({ role: "USER" })
      })
      setRole("USER")
      toast({ title: "Role updated", description: "User is now a standard user." })
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to demote user", variant: "destructive" as any })
    }
  }

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
      <div className="max-w-4xl space-y-6">
        <div className="card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border-1)] w-10 h-10 text-sm text-[var(--color-text-2)]">
              {params.id.slice(-2).toUpperCase()}
            </span>
            <div>
              <div className="font-medium text-[var(--color-text-1)]">{name}</div>
              <div className="text-xs text-[var(--color-text-3)]">{overview?.user.email}</div>
            </div>
          </div>
          <ArrowUpRight className="w-5 h-5 text-[var(--color-text-3)]" />
        </div>

        <section className="card p-4 space-y-3">
          <div className="text-[var(--color-text-1)] font-medium">Role management</div>
          <div className="text-[var(--color-text-3)] text-sm">Current role: <span className="text-[var(--color-text-1)] font-semibold">{role || "-"}</span></div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={promote} className="rounded-lg bg-[#00a3ff] hover:bg-[#0088cc] text-black font-medium py-2">Promote to admin</button>
            <button onClick={demote} className="rounded-lg bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] py-2 text-[var(--color-text-1)]">Demote to user</button>
          </div>
        </section>

        {overview?.mentorStats && (
          <section className="card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[var(--color-text-1)] font-medium">Mentor performance</div>
                <div className="text-sm text-[var(--color-text-3)]">Rating details and recent reviews</div>
              </div>
              <Badge className="bg-[var(--color-surface-2)] text-[var(--color-text-3)]">
                {overview.mentorStats.ratingCount} reviews
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                <div className="text-xs text-[var(--color-text-3)]">Average rating</div>
                <div className="text-lg font-semibold text-[var(--color-text-1)] flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" /> {overview.mentorStats.ratingAvg.toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                <div className="text-xs text-[var(--color-text-3)]">Lessons completed</div>
                <div className="text-lg font-semibold text-[var(--color-text-1)]">{overview.mentorStats.lessonsCompleted}</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-surface-2)]">
                <div className="text-xs text-[var(--color-text-3)]">Review count</div>
                <div className="text-lg font-semibold text-[var(--color-text-1)]">{overview.mentorStats.ratingCount}</div>
              </div>
            </div>
            {overview.mentorStats.recentReviews.length === 0 ? (
              <div className="text-sm text-[var(--color-text-3)]">No reviews yet.</div>
            ) : (
              <div className="space-y-2">
                {overview.mentorStats.recentReviews.map((review) => (
                  <div key={review.id} className="p-3 rounded-lg bg-[var(--color-surface-2)] text-sm">
                    <div className="flex items-center justify-between">
                      <div className="text-[var(--color-text-1)] font-medium">{review.student.fullName}</div>
                      <div className="text-[var(--color-text-3)]">{new Date(review.createdAt).toLocaleDateString("en-US")}</div>
                    </div>
                    <div className="text-[var(--color-text-3)]">Lesson: {review.schedule.title}</div>
                    <div className="text-[var(--color-text-1)]">Rating: {review.rating}</div>
                    {review.comment && <div className="text-[var(--color-text-2)] mt-1">{review.comment}</div>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="card p-4 space-y-4">
          <div className="text-[var(--color-text-1)] font-medium">Event registrations</div>
          {loadingOverview ? (
            <div className="text-[var(--color-text-3)]">Loading...</div>
          ) : overview && overview.registrations.length > 0 ? (
            <div className="space-y-2 text-sm">
              {overview.registrations.map((r) => (
                <div key={r.id} className="flex items-center justify-between bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg px-3 py-2">
                  <div>
                    <div className="text-[var(--color-text-1)]">{r.event.title}</div>
                    <div className="text-[var(--color-text-3)] text-xs">{r.event.date ? new Date(r.event.date).toLocaleString("en-US") : ""}</div>
                    <div className="text-[var(--color-text-3)] text-xs">Status: {r.status}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => approveReg(r.event.id, r.id)} className="px-3 py-1 text-xs rounded bg-green-500 text-black">Approve</button>
                    <button onClick={() => rejectReg(r.event.id, r.id)} className="px-3 py-1 text-xs rounded bg-red-500 text-white">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[var(--color-text-3)]">No registrations yet.</div>
          )}
        </section>

        <section className="card p-4 space-y-4">
          <div className="text-[var(--color-text-1)] font-medium">Purchases</div>
          {loadingOverview ? (
            <div className="text-[var(--color-text-3)]">Loading...</div>
          ) : overview && overview.purchases.length > 0 ? (
            <div className="divide-y divide-[var(--color-border-1)] text-sm">
              {overview.purchases.map((p) => (
                <div key={p.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="text-[var(--color-text-1)]">{Number(p.amount).toLocaleString()} {p.currency}</div>
                    <div className="text-[var(--color-text-3)] text-xs">{new Date(p.createdAt).toLocaleString("en-US")} | {p.status}</div>
                    <div className="text-[var(--color-text-3)] text-xs">{p.payerFullName || "-"} | {p.senderCode || "-"}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[var(--color-text-3)]">No purchases yet.</div>
          )}
        </section>
      </div>
    </main>
  )
}


