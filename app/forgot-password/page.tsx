"use client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/otp-input"
import SocialPanel from "@/components/social-panel"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<"request" | "code" | "reset">("request")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [countdown, setCountdown] = useState(0)
  const [resetToken, setResetToken] = useState("")

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleRequestReset = async () => {
    if (!email) {
      toast({ 
        title: "Ошибка", 
        description: "Пожалуйста, введите email", 
        variant: "destructive" as any 
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || "Ошибка запроса сброса пароля")
      }
      
      toast({ 
        title: "Код отправлен", 
        description: "Проверьте вашу почту для получения кода сброса пароля" 
      })
      
      setStep("code")
      setCountdown(60) // 1 minute cooldown
    } catch (e: any) {
      toast({ 
        title: "Ошибка", 
        description: e?.message || "Не удалось отправить код сброса пароля", 
        variant: "destructive" as any 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      toast({ 
        title: "Неверный код", 
        description: "Код должен содержать 6 символов", 
        variant: "destructive" as any 
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code })
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Неверный или просроченный код")
      }
      if (!data.resetToken) throw new Error("Токен сброса не получен")
      setResetToken(String(data.resetToken))
      toast({ title: "Код подтвержден" })
      setStep("reset")
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось подтвердить код", variant: "destructive" as any })
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({ 
        title: "Ошибка", 
        description: "Пожалуйста, заполните все поля", 
        variant: "destructive" as any 
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({ 
        title: "Ошибка", 
        description: "Пароли не совпадают", 
        variant: "destructive" as any 
      })
      return
    }

    if (newPassword.length < 8) {
      toast({ 
        title: "Ошибка", 
        description: "Пароль должен содержать минимум 8 символов", 
        variant: "destructive" as any 
      })
      return
    }

    if (!resetToken) {
      toast({ title: "Ошибка", description: "Сначала подтвердите код", variant: "destructive" as any })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, resetToken, newPassword })
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Ошибка сброса пароля")
      }
      toast({ title: "Успешно", description: "Пароль успешно изменен" })
      router.push("/")
    } catch (e: any) {
      toast({ title: "Ошибка", description: e?.message || "Не удалось сбросить пароль", variant: "destructive" as any })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative bg-dots-pattern">
      <div className="mb-12 animate-slide-up" style={{ animationDelay: "200ms" }}>
        <Image src="/logo-s7.png" alt="S7 Robotics Logo" width={80} height={80} className="mx-auto" />
      </div>

      <div
        className="w-full max-w-sm bg-[var(--color-surface-1)] border border-dashed border-[var(--color-border-1)] rounded-2xl p-7 backdrop-blur-[1px] transition-all duration-[var(--dur-mid)] ease-in-out hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-hover-1)] animate-slide-up"
        style={{ animationDelay: "200ms" }}
      >
        <h1 className="text-[var(--color-text-1)] text-3xl font-medium text-center mb-7 transition-all duration-[var(--dur-fast)] tracking-tight">
          Сброс пароля
        </h1>

        {step === "request" && (
          <div className="space-y-6">
            <div>
              <label className="block text-[var(--color-text-3)] text-sm mb-2">Email</label>
              <div className="relative">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="bg-transparent h-auto py-2.5 border-0 border-b border-[var(--color-border-1)] rounded-none px-0 pb-3 pr-6 text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] focus:border-[var(--color-border-hover-1)] focus:ring-0 focus-visible:ring-0 transition-all duration-[var(--dur-fast)] hover:border-[var(--color-border-hover-1)]"
                />
                <i className="bi bi-envelope absolute right-0 top-1/2 -translate-y-1/2 text-lg text-[var(--color-text-3)]" />
              </div>
            </div>

            <Button
              onClick={handleRequestReset}
              disabled={loading}
              variant="outline"
              className="w-full py-3"
            >
              {loading ? "Отправка..." : "Отправить код"}
            </Button>

            <div className="text-center">
              <button
                onClick={() => router.push("/")}
                className="text-[var(--color-text-3)] text-sm hover:text-[var(--color-text-1)] transition-all duration-[var(--dur-fast)]"
              >
                Назад к входу
              </button>
            </div>
          </div>
        )}

        {step === "code" && (
          <div className="space-y-6">
            <div>
              <label className="block text-[var(--color-text-3)] text-sm mb-2">Код подтверждения</label>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={(value) => setCode(value)}
                  containerClassName="flex gap-2"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="h-12 w-12" />
                    <InputOTPSlot index={1} className="h-12 w-12" />
                    <InputOTPSlot index={2} className="h-12 w-12" />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} className="h-12 w-12" />
                    <InputOTPSlot index={4} className="h-12 w-12" />
                    <InputOTPSlot index={5} className="h-12 w-12" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            <Button
              onClick={handleVerifyCode}
              disabled={code.length !== 6}
              variant="outline"
              className="w-full py-3"
            >
              Подтвердить код
            </Button>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={handleRequestReset}
                disabled={countdown > 0 || loading}
                variant="outline"
                className="flex-1"
              >
                {countdown > 0 ? `Отправить заново (${countdown})` : "Отправить заново"}
              </Button>
              <Button
                onClick={() => setStep("request")}
                variant="outline"
                className="flex-1"
              >
                Назад
              </Button>
            </div>
          </div>
        )}

        {step === "reset" && (
          <div className="space-y-6">
            <div>
              <label className="block text-[var(--color-text-3)] text-sm mb-2">Новый пароль</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Новый пароль"
                className="bg-transparent h-auto py-2.5 border-0 border-b border-[var(--color-border-1)] rounded-none px-0 pb-3 text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] focus:border-[var(--color-border-hover-1)] focus:ring-0 focus-visible:ring-0 transition-all duration-[var(--dur-fast)] hover:border-[var(--color-border-hover-1)]"
              />
            </div>

            <div>
              <label className="block text-[var(--color-text-3)] text-sm mb-2">Подтвердите пароль</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Подтвердите пароль"
                className="bg-transparent h-auto py-2.5 border-0 border-b border-[var(--color-border-1)] rounded-none px-0 pb-3 text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] focus:border-[var(--color-border-hover-1)] focus:ring-0 focus-visible:ring-0 transition-all duration-[var(--dur-fast)] hover:border-[var(--color-border-hover-1)]"
              />
            </div>

            <Button
              onClick={handleResetPassword}
              disabled={loading}
              variant="outline"
              className="w-full py-3"
            >
              {loading ? "Сброс..." : "Сбросить пароль"}
            </Button>

            <div className="text-center">
              <button
                onClick={() => setStep("code")}
                className="text-[var(--color-text-3)] text-sm hover:text-[var(--color-text-1)] transition-all duration-[var(--dur-fast)]"
              >
                Назад
              </button>
            </div>
          </div>
        )}
      </div>

      <SocialPanel />
      <div className="flex items-center space-x-2 mt-8 animate-slide-up" style={{ animationDelay: "1400ms" }}>
        <i className="bi bi-exclamation-circle w-5 h-5 text-white"></i>
        <span className="text-[#a7a7a7] text-sm">If the email does not arrive, check your spam folder.</span>
      </div>
      <div
        className="absolute bottom-4 left-1/2 transform -translate-x-1/2 animate-slide-up"
        style={{ animationDelay: "1800ms" }}
      >
        <div className="text-[#636370] text-xs text-center">
          <div>Version 0.1</div>
          <div>All rights reserved S7 Robotics.</div>
        </div>
      </div>
    </div>
  )
}
