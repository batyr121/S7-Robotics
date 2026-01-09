"use client"

export type Role = "user" | "student" | "parent" | "mentor" | "admin" | "guest"

export interface User {
  id: string
  email: string
  passwordHash?: string
  fullName?: string
  age?: number
  institution?: string
  primaryRole?: string
  role: Role
  level: number
  xp: number
  coinBalance: number // S7 100 Currency
  parentId?: string
  createdAt: number
  updatedAt: number
}

export interface Session {
  userId: string
  createdAt: number
  remember: boolean
}

export interface Lesson {
  id: number
  title: string
  time?: string
  videoName?: string
  slides?: string[]
  presentationFileName?: string
  videoMediaId?: string
  slideMediaIds?: string[]
  presentationMediaId?: string
  content?: string
}
export interface Module { id: number; title: string; lessons: Lesson[] }
export interface Course { id: string; title: string; author: string; difficulty: string; price: number; modules: Module[]; published: boolean }

export type EnrollmentStatus = "active" | "revoked"
export interface Enrollment { id: string; userId: string; courseId: string; status: EnrollmentStatus; createdAt: number }

export type PurchaseStatus = "pending" | "paid" | "canceled"
export interface Purchase { id: string; userId: string; courseId: string; amount: number; status: PurchaseStatus; createdAt: number; autoActivateAt: number; notes?: string }

export interface Achievement { id: string; userId: string; text: string; issuedBy: string; createdAt: number }

export interface Team { id: string; title: string; city: string; positions: string[]; contact?: string; createdAt: number }
export interface Masterclass { id: string; title: string; mode: string; location: string; date: string; author: string; price: number; createdAt: number }
export interface ByteSizeItem { id: string; title: string; tags: string[]; views: number; createdAt: number }

// --- New Entities for Class Management ---

export interface Class {
  id: string
  title: string
  mentorId: string
  studentIds: string[]
  programTitle?: string // e.g. "Robotics Level 1"
  schedule?: string // e.g. "Mon/Wed 15:00"
  createdAt: number
}

export interface LessonSession {
  id: string
  classId: string
  mentorId: string
  startTime: number
  endTime?: number
  topic?: string
  status: "active" | "finished"
  qrToken: string
}

export interface Attendance {
  id: string
  sessionId: string
  studentId: string
  status: "present" | "late" | "absent"
  scanTime?: number
  grade?: number
  comment?: string // Mentor comment
  createdAt: number
}

export interface Notification {
  id: string
  userId: string // Target user (e.g. parent)
  type: "info" | "alert" | "success" | "mentor_comment" | "MENTOR_GRADE" | "ATTENDANCE"
  title: string
  message: string
  read: boolean
  createdAt: number
}

// -----------------------------------------

const NS = "s7db.v1"

function getKey(name: string) { return `${NS}.${name}` }
function read<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(getKey(name))
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write<T>(name: string, value: T) {
  try { localStorage.setItem(getKey(name), JSON.stringify(value)) } catch { }
}

const C = {
  users: "users",
  session: "session",
  courses: "courses",
  enrollments: "enrollments",
  purchases: "purchases",
  achievements: "achievements",
  teams: "teams",
  masterclasses: "masterclasses",
  bytesize: "bytesize",
  // New
  classes: "classes",
  sessions: "sessions",
  attendance: "attendance",
  notifications: "notifications",
}

export function now() { return Date.now() }
export function uid(prefix = "id"): string { return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}` }

export async function sha256(text: string) {
  const enc = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest("SHA-256", enc)
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

export function listUsers(): User[] { return read<User[]>(C.users, []) }
export function saveUsers(users: User[]) { write(C.users, users) }
export function getUserByEmail(email: string): User | undefined { return listUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) }
export function getUserById(id: string): User | undefined { return listUsers().find(u => u.id === id) }
export function upsertUser(u: User) {
  const users = listUsers()
  const i = users.findIndex(x => x.id === u.id)
  if (i >= 0) users[i] = u; else users.push(u)
  saveUsers(users)
}

export function readSession(): Session | null { return read<Session | null>(C.session, null) }
export function writeSession(s: Session | null) { if (!s) localStorage.removeItem(getKey(C.session)); else write(C.session, s) }

export async function registerUser(email: string, password: string, role: Role = "user"): Promise<User> {
  const existing = getUserByEmail(email)
  if (existing) throw new Error("Email уже зарегистрирован")
  const passwordHash = await sha256(password)
  const u: User = { id: uid("usr"), email, passwordHash, role, level: 1, xp: 0, coinBalance: 0, createdAt: now(), updatedAt: now() }
  upsertUser(u)
  return u
}

export async function loginUser(email: string, password: string): Promise<User> {
  const u = getUserByEmail(email)
  if (!u) throw new Error("Неверная почта или пароль")
  const hash = await sha256(password)
  if (u.passwordHash && u.passwordHash !== hash) throw new Error("Неверная почта или пароль")
  return u
}

export function updateUserProfile(userId: string, patch: Partial<User>): User {
  const u = getUserById(userId)
  if (!u) throw new Error("Пользователь не найден")
  const next = { ...u, ...patch, updatedAt: now() }
  upsertUser(next)
  return next
}

export function listCourses(): Course[] { return read<Course[]>(C.courses, []) }
export function saveCourses(list: Course[]) { write(C.courses, list) }

export function listTeams(): Team[] { return read<Team[]>(C.teams, []) }
export function saveTeams(v: Team[]) { write(C.teams, v) }

export function listEnrollments(): Enrollment[] { return read<Enrollment[]>(C.enrollments, []) }
export function saveEnrollments(v: Enrollment[]) { write(C.enrollments, v) }
export function isEnrolled(userId: string, courseId: string): boolean { return listEnrollments().some(e => e.userId === userId && e.courseId === courseId && e.status === "active") }
export function enrollUser(userId: string, courseId: string): Enrollment {
  const e: Enrollment = { id: uid("enr"), userId, courseId, status: "active", createdAt: now() }
  const list = listEnrollments(); list.push(e); saveEnrollments(list)
  return e
}

export function listPurchases(): Purchase[] { return read<Purchase[]>(C.purchases, []) }
export function savePurchases(v: Purchase[]) { write(C.purchases, v) }
export function createPurchase(userId: string, courseId: string, amount: number): Purchase {
  const p: Purchase = { id: uid("pur"), userId, courseId, amount, status: "pending", createdAt: now(), autoActivateAt: now() + 2 * 60 * 60 * 1000 }
  const list = listPurchases(); list.push(p); savePurchases(list)
  return p
}
export function setPurchaseStatus(id: string, status: PurchaseStatus) {
  const list = listPurchases()
  const i = list.findIndex(p => p.id === id)
  if (i >= 0) { list[i].status = status; savePurchases(list) }
}
export function autoActivateEligiblePurchases(): Enrollment[] {
  const list = listPurchases()
  const activated: Enrollment[] = []
  for (const p of list) {
    if (p.status === "pending" && p.autoActivateAt <= now() && !isEnrolled(p.userId, p.courseId)) {
      activated.push(enrollUser(p.userId, p.courseId))
      p.status = "paid"
    }
  }
  savePurchases(list)
  return activated
}

export function hasCourseAccess(userId: string, courseId: string): boolean {
  autoActivateEligiblePurchases()
  return isEnrolled(userId, courseId)
}

export function listAchievements(): Achievement[] { return read<Achievement[]>(C.achievements, []) }
export function saveAchievements(v: Achievement[]) { write(C.achievements, v) }
export function awardAchievement(userId: string, text: string, issuedBy: string): Achievement {
  const a: Achievement = { id: uid("ach"), userId, text, issuedBy, createdAt: now() }
  const list = listAchievements(); list.push(a); saveAchievements(list)
  return a
}

// --- Class Management Methods ---

export function listClasses(): Class[] { return read<Class[]>(C.classes, []) }
export function saveClasses(v: Class[]) { write(C.classes, v) }

export function createClass(mentorId: string, title: string, programTitle = ""): Class {
  const c: Class = { id: uid("cls"), title, mentorId, studentIds: [], programTitle, createdAt: now() }
  const list = listClasses(); list.push(c); saveClasses(list)
  return c
}

export function addStudentToClass(classId: string, studentId: string) {
  const list = listClasses()
  const c = list.find(x => x.id === classId)
  if (c && !c.studentIds.includes(studentId)) {
    c.studentIds.push(studentId)
    saveClasses(list)
  }
}

export function listSessions(): LessonSession[] { return read<LessonSession[]>(C.sessions, []) }
export function saveSessions(v: LessonSession[]) { write(C.sessions, v) }

export function startSession(classId: string, mentorId: string, topic?: string): LessonSession {
  // Check if active session exists
  const list = listSessions()
  const active = list.find(s => s.classId === classId && s.status === "active")
  if (active) return active

  const s: LessonSession = {
    id: uid("sess"), classId, mentorId, startTime: now(), status: "active",
    qrToken: uid("qr"), topic
  }
  list.push(s)
  saveSessions(list)
  return s
}

export function endSession(sessionId: string) {
  const list = listSessions()
  const s = list.find(x => x.id === sessionId)
  if (s) {
    s.status = "finished"
    s.endTime = now()
    saveSessions(list)
  }
}

export function listAttendance(): Attendance[] { return read<Attendance[]>(C.attendance, []) }
export function saveAttendance(v: Attendance[]) { write(C.attendance, v) }

export function markAttendance(sessionId: string, studentId: string, status: "present" | "late", grade?: number, comment?: string) {
  const list = listAttendance()
  // upsert
  const existingIdx = list.findIndex(a => a.sessionId === sessionId && a.studentId === studentId)
  if (existingIdx >= 0) {
    if (grade !== undefined) list[existingIdx].grade = grade
    if (comment !== undefined) list[existingIdx].comment = comment
    if (status) list[existingIdx].status = status
  } else {
    list.push({ id: uid("att"), sessionId, studentId, status, grade, comment, scanTime: now(), createdAt: now() })
  }
  saveAttendance(list)
}

export function listNotifications(): Notification[] { return read<Notification[]>(C.notifications, []) }
export function saveNotifications(v: Notification[]) { write(C.notifications, v) }

export function createNotification(userId: string, title: string, message: string, type: "info" | "alert" | "success" | "mentor_comment" | "MENTOR_GRADE" | "ATTENDANCE" = "info") {
  const n: Notification = { id: uid("notif"), userId, title, message, type, read: false, createdAt: now() }
  const list = listNotifications(); list.push(n); saveNotifications(list)
  return n
}

export function markNotificationRead(notifId: string) {
  const list = listNotifications()
  const n = list.find(x => x.id === notifId)
  if (n) { n.read = true; saveNotifications(list) }
}

export function migrateAdminKeys() {
  try {
    const legacyCourses = localStorage.getItem("s7_admin_courses")
    if (legacyCourses && !localStorage.getItem(getKey(C.courses))) {
      write(C.courses, JSON.parse(legacyCourses))
    }
    const legacyTeams = localStorage.getItem("s7_admin_teams")
    if (legacyTeams && !localStorage.getItem(getKey(C.teams))) {
      write(C.teams, JSON.parse(legacyTeams))
    }
    const legacyMC = localStorage.getItem("s7_admin_masterclasses")
    if (legacyMC && !localStorage.getItem(getKey(C.masterclasses))) {
      write(C.masterclasses, JSON.parse(legacyMC))
    }
    const legacyBS = localStorage.getItem("s7_admin_bytesize")
    if (legacyBS && !localStorage.getItem(getKey(C.bytesize))) {
      write(C.bytesize, JSON.parse(legacyBS))
    }
  } catch { }
}
