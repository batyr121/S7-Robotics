"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QuizPlayer } from "@/components/kruzhok/quiz-player"
import { MatchingGame } from "@/components/kruzhok/matching-game"
import {
  ArrowLeft,
  FileText,
  Video,
  Presentation,
  GamepadIcon,
  CheckCircle,
  QrCode,
  MessageCircle,
  Image,
} from "lucide-react"
import ReactMarkdown from "react-markdown"

interface Lesson {
  id: string
  title: string
  content?: string // For ReactMarkdown
  duration?: string | null
  videoUrl?: string | null
  presentationUrl?: string | null
  slides?: Array<{ url: string }>
  contentType?: string
  lessonTemplate?: {
    mediaType: string
    contentUrl: string | null
    scenarioText: string | null
    quizId: string | null
  }
  isMentor: boolean // To show the 'End Lesson' button
  showAccessCode?: boolean // For access code
  kruzhok?: { accessCode?: string } // For access code
  quizzes?: any[] // For QuizPlayer
  matchingGames?: any[] // For MatchingGame
}

export default function LessonViewPage() {
  const params = useParams()
  const router = useRouter()
  const kruzhokId = params.id as string
  const lessonId = params.lessonId as string

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [isEndingLesson, setIsEndingLesson] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeQuizIndex, setActiveQuizIndex] = useState<number | null>(null)
  const [activeGameIndex, setActiveGameIndex] = useState<number | null>(null)
  const [quizResults, setQuizResults] = useState<Map<string, any>>(new Map())
  const [gameResults, setGameResults] = useState<Map<string, any>>(new Map())
  const [questions, setQuestions] = useState<any[]>([])

  const now = new Date()
  const ruDate = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(now)

  useEffect(() => {
    fetchLesson()
  }, [lessonId])

  const fetchLesson = async () => {
    try {
      setLoading(true)
      // Try to fetch as a course lesson first
      const courseId = kruzhokId // Assuming the kruzhokId might be a courseId
      const response = await apiFetch<any>(`/api/courses/${courseId}/lessons/${lessonId}`)

      if (response && response.lesson) {
        // It's a course lesson
        console.log('Course lesson data received:', response)
        const lessonData = {
          ...response.lesson,
          quizzes: response.questions && response.questions.length > 0 ? [{
            id: 'lesson-quiz',
            title: 'Квиз по уроку',
            questions: response.questions,
            showAnswersImmediately: true,
            randomizeQuestions: false,
            randomizeOptions: false,
            pointsPerQuestion: 20,
            timeBonus: false
          }] : [],
          lessonTemplate: {
            mediaType: response.lesson.videoUrl ? 'video' : response.lesson.presentationUrl ? 'presentation' : 'text',
            contentUrl: response.lesson.videoUrl || response.lesson.presentationUrl,
            scenarioText: null,
            quizId: response.questions && response.questions.length > 0 ? 'course-quiz' : null
          }
        }
        setLesson(lessonData)
        setQuestions(response.questions || [])
      } else {
        // Fallback to kruzhok lesson
        const data = await apiFetch<Lesson>(`/api/kruzhok/${kruzhokId}/lessons/${lessonId}`)
        console.log('Kruzhok lesson data received:', data)
        setLesson(data)
        setQuestions(data.quizzes || [])
      }
    } catch (error) {
      console.error('Error fetching lesson:', error)
      toast({
        title: "Қате",
        description: "Сабақты жүктеу мүмкін болмады",
        variant: "destructive" as any,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleQuizComplete = async (quizId: string, result: any) => {
    setQuizResults((prev) => new Map(prev).set(quizId, result))
    setActiveQuizIndex(null)

    toast({
      title: "Квиз аяқталды!",
      description: `Сіз ${result.correctAnswers}/${result.totalQuestions} дұрыс жауап бердіңіз. Ұпай: ${result.score}`,
    })

    // Прогрессті сақтау
    try {
      await apiFetch(`/api/kruzhok/${kruzhokId}/lessons/${lessonId}/complete`, {
        method: "POST",
      })
    } catch (error) {
      console.error("Failed to save progress:", error)
    }
  }

  const handleEndLesson = async () => {
    if (!lesson?.isMentor) return

    setIsEndingLesson(true)
    try {
      await apiFetch(`/api/kruzhok/${kruzhokId}/lessons/${lessonId}/end`, {
        method: "POST",
      })
      toast({
        title: "Сабақ аяқталды",
        description: "Оқушыларға квиз туралы хабарлама жіберілді.",
      })
      // Optionally refresh the lesson data to reflect the new state
      fetchLesson()
    } catch (error: any) {
      toast({
        title: "Қате",
        description: error.message || "Сабақты аяқтау мүмкін болмады",
        variant: "destructive" as any,
      })
    } finally {
      setIsEndingLesson(false)
    }
  }

  const handleGameComplete = async (gameId: string, result: any) => {
    setGameResults((prev) => new Map(prev).set(gameId, result))
    setActiveGameIndex(null)

    toast({
      title: "Ойын аяқталды!",
      description: `Дұрыс: ${result.correctMatches}, Қателер: ${result.mistakes}. Ұпай: ${result.score}`,
    })

    // Прогрессті сақтау
    try {
      await apiFetch(`/api/kruzhok/${kruzhokId}/lessons/${lessonId}/complete`, {
        method: "POST",
      })
    } catch (error) {
      console.error("Failed to save progress:", error)
    }
  }

  const getEmbedUrl = (url: string) => {
    // YouTube
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`
    }

    // Google Slides
    if (url.includes("docs.google.com/presentation")) {
      return url.replace("/edit", "/embed")
    }

    return url
  }

  if (loading || !lesson) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Жүктелуде...</p>
        </div>
      </div>
    )
  }

  // Квиз ойнау режимі
  if (activeQuizIndex !== null && lesson.quizzes) {
    return (
      <QuizPlayer
        quiz={lesson.quizzes[activeQuizIndex]}
        onComplete={(result) => handleQuizComplete(lesson.quizzes![activeQuizIndex].id, result)}
      />
    )
  }

  // Сәйкестендіру ойыны режимі
  if (activeGameIndex !== null && lesson.matchingGames) {
    return (
      <MatchingGame
        game={lesson.matchingGames[activeGameIndex]}
        onComplete={(result) => handleGameComplete(lesson.matchingGames![activeGameIndex].id, result)}
      />
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-3xl font-bold text-white mb-1">Панель управление</div>
          <div className="text-white/60">Класс 1 / {lesson.title}</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-white">{ruDate.split(" ")[0]} {ruDate.split(" ")[1]}</div>
          <div className="text-white/50">{ruDate.split(" ")[2]}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div className="space-y-3">
          <button className="w-full rounded-full h-12 bg-[#16161c] border border-[#2a2a35] text-white px-5 flex items-center gap-3">
            <Presentation className="w-5 h-5 text-white/70" />
            <span>Слайд. {lesson.title}</span>
          </button>
          <button className="w-full rounded-full h-12 bg-[#16161c] border border-[#2a2a35] text-white px-5 flex items-center gap-3">
            <FileText className="w-5 h-5 text-white/70" />
            <span>Журнал посещаемости</span>
          </button>
          <button className="w-full rounded-full h-12 bg-[#16161c] border border-[#2a2a35] text-white px-5 flex items-center gap-3">
            <MessageCircle className="w-5 h-5 text-white/70" />
            <span>Комментарий ментора</span>
          </button>
          <button
            onClick={async () => {
              try {
                await apiFetch(`/api/kruzhok/${kruzhokId}/lessons/${lessonId}/complete`, { method: "POST" })
                toast({ title: "Сабақ сақталды" })
              } catch (e: any) {
                toast({ title: "Қате", description: e?.message || "Сақтау мүмкін болмады", variant: "destructive" as any })
              }
            }}
            className="w-full rounded-full h-12 bg-[#00a3ff] hover:bg-[#0088cc] text-black font-semibold"
          >
            сабмит
          </button>
        </div>
        <div className="flex items-start justify-end gap-3">
          {lesson.isMentor && (
            <Button onClick={handleEndLesson} disabled={isEndingLesson} className="bg-[#22c55e] text-black hover:bg-[#16a34a]">
              {isEndingLesson ? "Аяқталуда..." : "Сабақты аяқтау (Квиз жіберу)"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>
          {lesson.showAccessCode && lesson.kruzhok?.accessCode && (
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-gray-400" />
              <Badge className="text-lg py-2 px-4 font-mono">{lesson.kruzhok.accessCode}</Badge>
            </div>
          )}
        </div>
      </div>

      {/* Тақырып */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2">{lesson.title}</h1>
        {lesson.lessonTemplate?.scenarioText && (
          <Card className="mt-4 bg-[#16161c] border-[#636370]/20 text-white">
            <CardHeader>
              <CardTitle className="text-white">Сценарий / Әдістеме</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-lg max-w-none text-white/80">
                <ReactMarkdown>{lesson.lessonTemplate.scenarioText}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="flex gap-2 mt-4">
          <Badge variant="outline">{lesson.lessonTemplate?.mediaType}</Badge>
          {lesson.lessonTemplate?.quizId && (
            <Badge className="bg-purple-500">Квиз</Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="content" className="w-full">
        <TabsList>
          <TabsTrigger value="content">
            <FileText className="w-4 h-4 mr-2" />
            Мазмұн
          </TabsTrigger>
          {lesson.lessonTemplate?.quizId && (
            <TabsTrigger value="quizzes">
              <GamepadIcon className="w-4 h-4 mr-2" />
              Квиз
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="content" className="space-y-6">
          {/* Видео */}
          {lesson.videoUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  Видео
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video">
                  <iframe
                    src={getEmbedUrl(lesson.videoUrl)}
                    className="w-full h-full rounded-lg"
                    allowFullScreen
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Презентация */}
          {lesson.presentationUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Presentation className="w-5 h-5" />
                  Презентация
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video">
                  <iframe
                    src={getEmbedUrl(lesson.presentationUrl)}
                    className="w-full h-full rounded-lg"
                    allowFullScreen
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Слайды */}
          {lesson.slides && lesson.slides.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="w-5 h-5" />
                  Слайды
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {lesson.slides.map((slide, index) => (
                    <div key={index} className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={slide.url}
                        alt={`Слайд ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Старый шаблон контента (если есть) */}
          {lesson.lessonTemplate?.contentUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {lesson.lessonTemplate.mediaType === "video" ? <Video className="w-5 h-5" /> : <Presentation className="w-5 h-5" />}
                  {lesson.lessonTemplate.mediaType === "video" ? "Видео (шаблон)" : "Презентация (шаблон)"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video">
                  <iframe
                    src={getEmbedUrl(lesson.lessonTemplate.contentUrl)}
                    className="w-full h-full rounded-lg"
                    allowFullScreen
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Контент урока */}
          {lesson.content && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Контент урока
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-lg max-w-none">
                  <ReactMarkdown>{lesson.content}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Старый шаблон текста (если есть) */}
          {lesson.lessonTemplate?.scenarioText && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Сценарий / Әдістеме
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-lg max-w-none text-white/80">
                  <ReactMarkdown>{lesson.lessonTemplate.scenarioText}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="quizzes" className="space-y-4">
          {questions.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Квиз</CardTitle>
                    <p className="text-gray-600 mt-2">Сабақ бойынша білімді тексеруге арналған квиз.</p>
                    <p className="text-sm text-gray-500 mt-1">{questions.length} сұрақ</p>
                  </div>
                  <Button onClick={() => setActiveQuizIndex(0)}>
                    Бастау
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ) : lesson.lessonTemplate?.quizId && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Квиз</CardTitle>
                    <p className="text-gray-600 mt-2">Сабақ бойынша білімді тексеруге арналған квиз.</p>
                  </div>
                  <Button onClick={() => router.push(`/quiz/${lesson.lessonTemplate?.quizId}`)}>
                    Бастау
                  </Button>
                </div>
              </CardHeader>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
