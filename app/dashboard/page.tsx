"use client"
import { useState, useEffect, Suspense } from "react"
import HomeTab from "@/components/tabs/home-tab"
import CoursesTab from "@/components/tabs/courses-tab"
import TeamsTab from "@/components/tabs/teams-tab"
import S7ToolsTab from "@/components/tabs/s7-tools-tab"
import MasterclassTab from "@/components/tabs/masterclass-tab"
import ProfileTab from "@/components/tabs/profile-tab"
import ByteSizeTab from "@/components/tabs/bytesize-tab"
import ClubsTab from "@/components/tabs/clubs-tab"
import CourseDetailsTab from "@/components/tabs/course-details-tab"
import type { CourseDetails } from "@/components/tabs/course-details-tab"
import CourseLessonTab from "@/components/tabs/course-lesson-tab"
import { useConfirm } from "@/components/ui/confirm"
import { useRouter, useSearchParams } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { useAuth } from "@/components/auth/auth-context"
import UserLayout from "@/components/layout/user-layout"

function DashboardInner() {
  const searchParams = useSearchParams()
  const initialTab = (() => {
    const t = searchParams.get("tab") || "home"
    const allowed = new Set(["home", "courses", "course-details", "lesson-details", "s7-tools", "teams", "profile", "masterclass", "bytesize", "clubs"])
    return allowed.has(t) ? t : "home"
  })()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [selectedCourse, setSelectedCourse] = useState<CourseDetails | null>(null)
  const [selectedModuleId, setSelectedModuleId] = useState<string | number | null>(null)
  const [selectedLessonId, setSelectedLessonId] = useState<string | number | null>(null)
  const { user, logout, loading } = useAuth() as any
  const confirm = useConfirm()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/")
    }
  }, [loading, user, router])

  useEffect(() => {
    const onOpenCourse = async (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { courseId?: string } | undefined
      const courseId = detail?.courseId
      if (!courseId) return
      try {
        const data = await apiFetch<any>(`/courses/${courseId}`)
        const mapped: CourseDetails = {
          id: data.id,
          title: data.title,
          difficulty: data.difficulty || "",
          author: (data.author?.fullName ?? data.author) as any,
          price: Number(data.price || 0),
          modules: (data.modules || []).map((m: any) => ({
            id: m.id,
            title: m.title,
            lessons: (m.lessons || []).map((l: any) => ({
              id: l.id,
              title: l.title,
              content: l.content,
              duration: l.duration,
              isFreePreview: l.isFreePreview,
              videoUrl: l.videoUrl,
              presentationUrl: l.presentationUrl,
              slides: l.slides,
              contentType: l.contentType,
            }))
          })),
        }
        setSelectedCourse(mapped)
        setActiveTab("course-details")
      } catch {
        setActiveTab("courses")
      }
    }
    window.addEventListener("s7-open-course", onOpenCourse as any)
    return () => window.removeEventListener("s7-open-course", onOpenCourse as any)
  }, [])

  const handleOpenCourse = (course: CourseDetails) => {
    setSelectedCourse(course)
    setActiveTab("course-details")
  }

  const handleOpenLesson = (course: CourseDetails, moduleId: string | number, lessonId: string | number) => {
    setSelectedCourse(course)
    setSelectedModuleId(moduleId)
    setSelectedLessonId(lessonId)
    setActiveTab("lesson-details")
  }

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case "home": return "Главная"
      case "courses": return "Курсы"
      case "course-details": return "Курсы"
      case "lesson-details": return "Курсы"
      case "s7-tools": return "S7 Tool"
      case "teams": return "Команды"
      case "profile": return "Профиль"
      case "masterclass": return "Мастер классы"
      case "bytesize": return "Byte Size"
      case "clubs": return "Кружки"
      default: return "Главная"
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "home": return <HomeTab onOpenCourse={handleOpenCourse} />
      case "courses": return <CoursesTab onOpenCourse={handleOpenCourse} />
      case "course-details":
        return (
          <CourseDetailsTab
            course={selectedCourse}
            onBack={() => setActiveTab("courses")}
            onOpenLesson={(moduleId, lessonId) => selectedCourse && handleOpenLesson(selectedCourse, moduleId, lessonId)}
          />
        )
      case "lesson-details":
        return (
          <CourseLessonTab
            course={selectedCourse}
            moduleId={selectedModuleId}
            lessonId={selectedLessonId}
            onBack={() => setActiveTab("course-details")}
          />
        )
      case "s7-tools": return <S7ToolsTab />
      case "clubs": return <ClubsTab />
      case "teams": return <TeamsTab />
      case "masterclass": return <MasterclassTab />
      case "profile": return <ProfileTab />
      case "bytesize": return <ByteSizeTab />
      default: return <HomeTab />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] bg-dots-pattern flex items-center justify-center">
        <div className="text-[var(--color-text-1)] text-sm opacity-80">Загрузка…</div>
      </div>
    )
  }

  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] bg-dots-pattern flex items-center justify-center">
        <div className="text-[var(--color-text-1)] text-sm opacity-80">Перенаправление…</div>
      </div>
    )
  }

  return (
    <UserLayout
      title={getTabTitle(activeTab)}
      activeTab={activeTab === "course-details" || activeTab === "lesson-details" ? "courses" : activeTab}
      onTabChange={(tab) => {
        setActiveTab(tab)
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search)
          params.set('tab', tab)
          window.history.replaceState({}, '', `/dashboard?${params.toString()}`)
        }
      }}
    >
      {renderTabContent()}
    </UserLayout>
  )
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--color-bg)] bg-dots-pattern flex items-center justify-center">
          <div className="text-[var(--color-text-1)] text-sm opacity-80">Загрузка дашборда…</div>
        </div>
      }
    >
      <DashboardInner />
    </Suspense>
  )
}
