"use client"

import Link from "next/link"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#0e0e12] flex items-center justify-center p-6">
      <div className="w-full max-w-lg text-center text-white animate-slide-up">
        <div className="text-[56px] leading-none font-extrabold mb-2">Ошибка</div>
        <h1 className="text-2xl font-semibold mb-2">Что‑то пошло не так</h1>
        <p className="text-white/70 mb-1">{error?.message || "Произошла непредвиденная ошибка."}</p>
        {error?.digest && (
          <p className="text-white/40 text-xs mb-4">Код: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="rounded-full bg-[#00a3ff] hover:bg-[#0088cc] text-black font-medium px-5 py-2 transition-colors"
          >
            Повторить
          </button>
          <Link
            href="/"
            className="rounded-full bg-[#16161c] border border-[#2a2a35] hover:bg-[#1b1b22] text-white px-5 py-2 transition-colors"
          >
            На главную
          </Link>
        </div>
      </div>
    </main>
  )
}
