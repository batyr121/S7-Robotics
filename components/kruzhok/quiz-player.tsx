"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, XCircle, Clock, Trophy, Zap } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface QuizPlayerProps {
  quiz: {
    id: string
    title: string
    description?: string
    timeLimit?: number
    showAnswersImmediately: boolean
    randomizeQuestions: boolean
    randomizeOptions: boolean
    pointsPerQuestion: number
    timeBonus: boolean
    questions: Array<{
      id: string
      questionText: string
      type: string
      options: Array<{
        id: string
        text: string
        isCorrect: boolean
      }>
      imageUrl?: string
      explanation?: string
      points: number
      timeLimit?: number
      orderIndex: number
    }>
  }
  onComplete: (result: {
    score: number
    correctAnswers: number
    totalQuestions: number
    timeSpent: number
    answers: any[]
  }) => void
}

export function QuizPlayer({ quiz, onComplete }: QuizPlayerProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [answers, setAnswers] = useState<any[]>([])
  const [score, setScore] = useState(0)
  const [timeSpent, setTimeSpent] = useState(0)
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [isAnswered, setIsAnswered] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)

  const currentQuestion = quiz.questions[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1

  // Таймер
  useEffect(() => {
    if (currentQuestion.timeLimit && currentQuestion.timeLimit > 0) {
      setTimeLeft(currentQuestion.timeLimit)
    } else {
      setTimeLeft(null)
    }
    setQuestionStartTime(Date.now())
  }, [currentQuestionIndex])

  useEffect(() => {
    if (timeLeft === null || isAnswered) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          handleSubmitAnswer() // Уақыт біткенде автоматты жіберу
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, isAnswered])

  const handleOptionSelect = (optionId: string) => {
    if (isAnswered) return

    if (currentQuestion.type === "MULTIPLE_CHOICE") {
      setSelectedOptions((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
      )
    } else {
      setSelectedOptions([optionId])
    }
  }

  const handleSubmitAnswer = () => {
    if (isAnswered) return

    const questionTime = (Date.now() - questionStartTime) / 1000
    const correctOptionIds = currentQuestion.options.filter((o) => o.isCorrect).map((o) => o.id)
    const isCorrectAnswer =
      selectedOptions.length === correctOptionIds.length &&
      selectedOptions.every((id) => correctOptionIds.includes(id))

    let questionScore = 0
    if (isCorrectAnswer) {
      questionScore = currentQuestion.points

      // Уақыт бонусы
      if (quiz.timeBonus && currentQuestion.timeLimit && timeLeft !== null) {
        const timeBonus = Math.round((timeLeft / currentQuestion.timeLimit) * (currentQuestion.points * 0.2))
        questionScore += timeBonus
      }
    }

    const answer = {
      questionId: currentQuestion.id,
      selectedOptions,
      correctOptions: correctOptionIds,
      isCorrect: isCorrectAnswer,
      score: questionScore,
      timeSpent: questionTime,
    }

    setAnswers((prev) => [...prev, answer])
    setScore((prev) => prev + questionScore)
    setTimeSpent((prev) => prev + questionTime)
    setIsAnswered(true)
    setIsCorrect(isCorrectAnswer)

    if (isCorrectAnswer) {
      toast({
        title: "Дұрыс!",
        description: `Сіз ${questionScore} ұпай жинадыңыз!`,
        variant: "default",
      })
    } else {
      toast({
        title: "Қате",
        description: "Келесі жолы сәтті боласыз!",
        variant: "destructive",
      })
    }

    if (quiz.showAnswersImmediately) {
      setShowResult(true)
    } else {
      setTimeout(() => handleNextQuestion(), 1500)
    }
  }

  const handleNextQuestion = () => {
    if (isLastQuestion) {
      onComplete({
        score,
        correctAnswers: answers.filter((a) => a.isCorrect).length + (isCorrect ? 1 : 0),
        totalQuestions: quiz.questions.length,
        timeSpent,
        answers: [...answers, answers[answers.length - 1]],
      })
    } else {
      setCurrentQuestionIndex((prev) => prev + 1)
      setSelectedOptions([])
      setIsAnswered(false)
      setShowResult(false)
      setIsCorrect(false)
    }
  }

  const getOptionClass = (optionId: string, isCorrectOption: boolean) => {
    if (!isAnswered) {
      return selectedOptions.includes(optionId)
        ? "border-blue-500 bg-blue-50 border-2"
        : "border-gray-300 hover:border-blue-300"
    }

    if (isCorrectOption) {
      return "border-green-500 bg-green-50 border-2"
    }

    if (selectedOptions.includes(optionId) && !isCorrectOption) {
      return "border-red-500 bg-red-50 border-2"
    }

    return "border-gray-300 opacity-50"
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Прогресс */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Сұрақ {currentQuestionIndex + 1} / {quiz.questions.length}
          </span>
          <div className="flex items-center gap-4">
            {timeLeft !== null && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className={`font-mono font-bold ${timeLeft <= 5 ? "text-red-500" : ""}`}>
                  {timeLeft}s
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="font-bold">{score}</span>
            </div>
          </div>
        </div>
        <Progress value={((currentQuestionIndex + 1) / quiz.questions.length) * 100} className="h-2" />
      </div>

      {/* Сұрақ */}
      <Card className="mb-6">
        <CardContent className="pt-8 pb-8">
          {currentQuestion.imageUrl && (
            <div className="mb-6">
              <img
                src={currentQuestion.imageUrl}
                alt="Question"
                className="w-full max-h-64 object-contain rounded-lg"
              />
            </div>
          )}

          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">{currentQuestion.questionText}</h2>

          {currentQuestion.type === "MULTIPLE_CHOICE" && (
            <p className="text-center text-sm text-gray-600">Бірнеше жауап таңдауға болады</p>
          )}
        </CardContent>
      </Card>

      {/* Опциялар */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {currentQuestion.options.map((option, index) => {
          const colors = ["bg-red-500", "bg-blue-500", "bg-yellow-500", "bg-green-500"]
          const isCorrectOption = option.isCorrect

          return (
            <button
              key={option.id}
              onClick={() => handleOptionSelect(option.id)}
              disabled={isAnswered}
              className={`p-6 rounded-xl border-2 transition-all text-left ${getOptionClass(
                option.id,
                isCorrectOption
              )} ${!isAnswered ? "hover:scale-105 active:scale-95" : ""}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg ${colors[index % 4]} text-white flex items-center justify-center font-bold text-xl flex-shrink-0`}>
                  {String.fromCharCode(65 + index)}
                </div>
                <span className="text-lg font-medium flex-1">{option.text}</span>
                {isAnswered && isCorrectOption && <CheckCircle className="w-6 h-6 text-green-500" />}
                {isAnswered && selectedOptions.includes(option.id) && !isCorrectOption && (
                  <XCircle className="w-6 h-6 text-red-500" />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Түсініктеме */}
      {showResult && currentQuestion.explanation && (
        <Card className="mb-6 border-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-blue-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-2">Түсініктеме:</h3>
                <p className="text-gray-700">{currentQuestion.explanation}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Нәтиже */}
      {showResult && (
        <Card className={`mb-6 ${isCorrect ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}`}>
          <CardContent className="pt-6 text-center">
            {isCorrect ? (
              <>
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-green-700 mb-2">Дұрыс!</h3>
                <p className="text-green-600">+{answers[answers.length - 1]?.score || 0} ұпай</p>
              </>
            ) : (
              <>
                <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-red-700 mb-2">Қате</h3>
                <p className="text-red-600">Келесі жолы сәтті боласыз!</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Батырмалар */}
      <div className="flex justify-center">
        {!isAnswered ? (
          <Button
            onClick={handleSubmitAnswer}
            disabled={selectedOptions.length === 0}
            size="lg"
            className="px-12"
          >
            Жіберу
          </Button>
        ) : showResult ? (
          <Button onClick={handleNextQuestion} size="lg" className="px-12">
            {isLastQuestion ? "Аяқтау" : "Келесі сұрақ"}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
