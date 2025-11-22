import { NextResponse } from "next/server"

export async function GET(
    req: Request,
    { params }: { params: { courseId: string; lessonId: string } }
) {
    try {
        const { courseId, lessonId } = params
        const backendUrl = process.env.BACKEND_URL || "http://localhost:3001"

        // Get the authorization header from the incoming request
        const authHeader = req.headers.get("authorization")
        const headers: HeadersInit = {
            "Content-Type": "application/json",
        }
        if (authHeader) {
            headers["Authorization"] = authHeader
        }

        // Fetch lesson details
        const lessonRes = await fetch(`${backendUrl}/courses/${courseId}/lessons/${lessonId}`, {
            headers,
            cache: 'no-store'
        })

        if (!lessonRes.ok) {
            if (lessonRes.status === 404) return new NextResponse("Lesson not found", { status: 404 })
            return new NextResponse("Error fetching lesson", { status: lessonRes.status })
        }

        const rawLesson = await lessonRes.json()
        const lessonData = {
            ...rawLesson,
            videoUrl: rawLesson.video_url || rawLesson.videoUrl,
            presentationUrl: rawLesson.presentation_url || rawLesson.presentationUrl,
        }

        // Fetch questions
        const questionsRes = await fetch(`${backendUrl}/courses/${courseId}/lessons/${lessonId}/questions`, {
            headers,
            cache: 'no-store'
        })

        let questionsData = []
        if (questionsRes.ok) {
            questionsData = await questionsRes.json()
        }

        const mappedQuestions = questionsData.map((q: any, index: number) => {
            const correctIdx = Number(q.correctIndex)
            const options = (q.options as string[]).map((opt: string, i: number) => ({
                id: `${q.id}-opt-${i}`,
                text: opt,
                isCorrect: i === correctIdx
            }))

            return {
                id: q.id,
                questionText: q.text,
                type: "SINGLE_CHOICE",
                options: options,
                points: q.xpReward || 20,
                orderIndex: index
            }
        })

        return NextResponse.json({
            lesson: lessonData,
            questions: mappedQuestions
        })

    } catch (error) {
        console.error("[LESSON_GET_BFF]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
