"use client"
import { useState, useEffect } from "react"
import HomeTab from "@/components/tabs/home-tab"
import CoursesTab from "@/components/tabs/courses-tab"
import ProfileTab from "@/components/tabs/profile-tab"
import ScanTab from "@/components/tabs/scan-tab"
import ScheduleTab from "@/components/tabs/schedule-tab"
import CourseDetailsTab from "@/components/tabs/course-details-tab"
import type { CourseDetails } from "@/components/tabs/course-details-tab"
import CourseLessonTab from "@/components/tabs/course-lesson-tab"
import { useRouter, useSearchParams } from "next/navigation"
import { apiFetch } from "@/lib/api"
import UserLayout from "@/components/layout/user-layout"

interface StudentDashboardProps {
    user: any
}

export default function StudentDashboard({ user }: StudentDashboardProps) {
    const searchParams = useSearchParams()
    const router = useRouter()

    // Derive state from URL
    const activeTab = searchParams.get("tab") || "home"
    const courseIdParam = searchParams.get("courseId")
    const moduleIdParam = searchParams.get("moduleId")
    const lessonIdParam = searchParams.get("lessonId")

    const [selectedCourse, setSelectedCourse] = useState<CourseDetails | null>(null)
    const [loadingCourse, setLoadingCourse] = useState(false)

    // Load course data if needed (for deep linking or refresh)
    useEffect(() => {
        if ((activeTab === "course-details" || activeTab === "lesson-details") && courseIdParam) {
            // If we have local data and it matches, don't re-fetch usually, 
            // but here we check if `selectedCourse.id` matches `courseIdParam`
            if (!selectedCourse || String(selectedCourse.id) !== courseIdParam) {
                fetchCourseDetails(courseIdParam)
            }
        }
    }, [activeTab, courseIdParam])

    // Handle custom event for opening courses from other places
    useEffect(() => {
        const onOpenCourse = (ev: Event) => {
            const detail = (ev as CustomEvent).detail as { courseId?: string } | undefined
            const cId = detail?.courseId
            if (cId) {
                router.push(`/dashboard?tab=course-details&courseId=${cId}`)
            }
        }
        window.addEventListener("s7-open-course", onOpenCourse as any)
        return () => window.removeEventListener("s7-open-course", onOpenCourse as any)
    }, [router])

    const fetchCourseDetails = async (id: string) => {
        setLoadingCourse(true)
        try {
            const data = await apiFetch<any>(`/courses/${id}`)
            // Map data to CourseDetails
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
        } catch (err) {
            console.error("Failed to fetch course details:", err)
            // Fallback
            router.push("/dashboard?tab=courses")
        } finally {
            setLoadingCourse(false)
        }
    }

    const handleOpenCourse = (course: CourseDetails) => {
        // We can pass the object if we want instant transition, but URL is source of truth
        setSelectedCourse(course)
        router.push(`/dashboard?tab=course-details&courseId=${course.id}`)
    }

    const handleOpenLesson = (course: CourseDetails, moduleId: string | number, lessonId: string | number) => {
        setSelectedCourse(course)
        router.push(`/dashboard?tab=lesson-details&courseId=${course.id}&moduleId=${moduleId}&lessonId=${lessonId}`)
    }

    const handleBackToCourses = () => {
        router.push("/dashboard?tab=courses")
    }

    const handleBackToCourseDetails = () => {
        if (selectedCourse) {
            router.push(`/dashboard?tab=course-details&courseId=${selectedCourse.id}`)
        } else {
            router.push("/dashboard?tab=courses")
        }
    }

    const getTabTitle = (tab: string) => {
        switch (tab) {
            case "home": return "Главная"
            case "courses": return "Курсы"
            case "course-details": return selectedCourse?.title || "Курс"
            case "lesson-details": return "Просмотр урока"
            case "schedule": return "Расписание"
            case "profile": return "Профиль"
            default: return "Главная"
        }
    }

    const renderTabContent = () => {
        if (loadingCourse) {
            return <div className="p-8 text-center text-[var(--color-text-3)]">Загрузка курса...</div>
        }

        switch (activeTab) {
            case "home": return <HomeTab onOpenCourse={handleOpenCourse} />
            case "courses": return <CoursesTab onOpenCourse={handleOpenCourse} />
            case "course-details":
                return selectedCourse ? (
                    <CourseDetailsTab
                        course={selectedCourse}
                        onBack={handleBackToCourses}
                        onOpenLesson={(moduleId, lessonId) => handleOpenLesson(selectedCourse, moduleId, lessonId)}
                    />
                ) : null
            case "lesson-details":
                return selectedCourse ? (
                    <CourseLessonTab
                        course={selectedCourse}
                        moduleId={moduleIdParam || null}
                        lessonId={lessonIdParam || null}
                        onBack={handleBackToCourseDetails}
                    />
                ) : null
            case "schedule": return <ScheduleTab />
            case "scan": return <ScanTab />
            case "profile": return <ProfileTab />
            default: return <HomeTab onOpenCourse={handleOpenCourse} />
        }
    }

    // Determine active tab for sidebar highlighting. 
    // If we are in details/lesson, sidebar should highlight "courses".
    const sidebarActiveTab = (activeTab === "course-details" || activeTab === "lesson-details") ? "courses" : activeTab

    return (
        <UserLayout
            title={getTabTitle(activeTab)}
            activeTab={sidebarActiveTab}
            onTabChange={(tab) => router.push(`/dashboard?tab=${tab}`)}
        >
            <div className="animate-fade-in">
                {renderTabContent()}
            </div>
        </UserLayout>
    )
}
