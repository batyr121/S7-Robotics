"use client"
import { useState } from "react"
import { ExternalLink, LogIn, Link2, ArrowLeft } from "lucide-react"

export interface EventDetails {
  id: string
  title: string
  difficulty: string
  organizer: string
  registrationUrl?: string
  about?: string
}

export default function EventsTab({
  event,
  onBack,
}: {
  event?: EventDetails | null
  onBack?: () => void
}) {
  const [activeSection, setActiveSection] = useState<"about" | "register">("register")

  const current =
    event ?? ({
      id: "mangystau-fll",
      title: "Mangystau FLL",
      difficulty: "Средний",
      organizer: "USTEM Foundation",
      registrationUrl: "#",
      about: "О соревнованиях",
    } satisfies EventDetails)

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
      {onBack && (
        <div className="mb-6 flex items-center gap-2 text-white">
          <button
            onClick={onBack}
            className="text-white/80 hover:text-white transition-colors flex items-center gap-2"
            aria-label="Назад к ивентам"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Ивенты</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        <section className="space-y-6">
          <div className="bg-[#16161c] border border-[#636370]/20 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-medium">{current.title}</h2>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-block bg-[#f59e0b] text-black text-xs font-medium px-3 py-1 rounded-full">
                    {current.difficulty}
                  </span>
                  <span className="text-white/70 text-sm">{current.organizer}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setActiveSection("about")}
              className={`w-full flex items-center justify-between rounded-2xl px-4 py-4 border transition-all duration-200 text-white ${
                activeSection === "about"
                  ? "bg-[#1b1b22] border-[#636370]/30"
                  : "bg-[#16161c] border-[#636370]/20 hover:bg-[#1b1b22]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#00a3ff] text-black flex items-center justify-center font-semibold">
                  1
                </div>
                <div className="text-left">
                  <div className="font-medium">О соревнованиях</div>
                </div>
              </div>
              <LogIn className="w-5 h-5 text-[#a0a0b0]" />
            </button>

            <button
              onClick={() => setActiveSection("register")}
              className={`w-full flex items-center justify-between rounded-2xl px-4 py-4 border transition-all duration-200 text-white ${
                activeSection === "register"
                  ? "bg-[#1b1b22] border-[#636370]/30"
                  : "bg-[#16161c] border-[#636370]/20 hover:bg-[#1b1b22]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#00a3ff] text-black flex items-center justify-center font-semibold">
                  2
                </div>
                <div className="text-left">
                  <div className="font-medium">Регистрация</div>
                </div>
              </div>
              <LogIn className="w-5 h-5 text-[#a0a0b0]" />
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          {activeSection === "register" ? (
            <div className="bg-[#16161c] border border-[#636370]/20 rounded-2xl p-4 md:p-6 text-white">
              <h3 className="text-lg font-semibold mb-4">Регистрация</h3>
              <a
                href={current.registrationUrl || "#"}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-[#1b1b22] border border-[#2a2a35] text-white/80 hover:text-white hover:bg-[#22222b] transition-colors"
              >
                <Link2 className="w-4 h-4" />
                <span>Ссылка на регистрацию</span>
                <ExternalLink className="w-4 h-4 text-[#a0a0b0]" />
              </a>
            </div>
          ) : (
            <div className="bg-[#16161c] border border-[#636370]/20 rounded-2xl p-4 md:p-6 text-white min-h-[300px]">
              <h3 className="text-lg font-semibold mb-1">О соревнованиях</h3>
              <p className="text-white/60 text-sm">{current.about || "О соревнованиях"}</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
