"use client"
import { useState } from "react"
import { QrCode, CheckCircle, XCircle } from "lucide-react"
import QrScanner from "@/components/scanner/qr-scanner"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"

export default function ScanTab() {
    const [scanned, setScanned] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [scanning, setScanning] = useState(false)

    const statusLabel = (status?: string) => {
        switch (String(status || "").toUpperCase()) {
            case "PRESENT":
                return { text: "Пришел вовремя", className: "text-green-500" }
            case "LATE":
                return { text: "Опоздал", className: "text-yellow-500" }
            default:
                return { text: String(status || "Отмечено"), className: "text-[var(--color-text-2)]" }
        }
    }

    const normalizeQrToken = (raw: string) => {
        const trimmed = String(raw || "").trim()
        if (!trimmed) return ""
        try {
            const parsed = JSON.parse(trimmed)
            if (typeof parsed === "string") return parsed.trim()
            if (parsed && typeof parsed === "object") {
                const token = typeof parsed.qrToken === "string"
                    ? parsed.qrToken
                    : typeof parsed.token === "string"
                        ? parsed.token
                        : typeof parsed.qr === "string"
                            ? parsed.qr
                            : ""
                if (token) return token.trim()
            }
        } catch {
        }
        try {
            const url = new URL(trimmed)
            const token = url.searchParams.get("qrToken") || url.searchParams.get("token") || url.searchParams.get("qr")
            if (token) return token.trim()
        } catch {
        }
        return trimmed
    }

    const handleScan = async (dataString: string) => {
        setScanning(false)
        try {
            const qrToken = normalizeQrToken(dataString)
            if (!qrToken) throw new Error("Invalid QR code.")
            const body = { qrToken }

            const res = await apiFetch<any>("/attendance/mark", {
                method: "POST",
                body: JSON.stringify(body)
            })

            if (res.error) throw new Error(res.error)

            setResult(res)
            setScanned(true)
        } catch (err: any) {
            console.error("Scan error:", err)
            setError(err.message || "Could not scan the QR code.")
        }
    }

    const reset = () => {
        setScanned(false)
        setResult(null)
        setError(null)
        setScanning(false)
    }

    return (
        <div className="max-w-md mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-[var(--color-text-1)] text-center">Отметка посещаемости</h2>

            {!scanned && !error && !scanning && (
                <div className="card p-8 text-center">
                    <QrCode className="w-16 h-16 mx-auto mb-4 text-[#00a3ff]" />
                    <p className="text-[var(--color-text-3)] mb-6">
                        Нажмите кнопку и отсканируйте QR‑код ментора, чтобы отметиться на уроке.
                    </p>
                    <Button onClick={() => setScanning(true)} className="w-full bg-[#00a3ff] text-white hover:bg-[#0088cc]">
                        Начать сканирование
                    </Button>
                </div>
            )}

            {scanning && (
                <div className="card p-4">
                    <div className="mb-4 text-center text-sm text-[var(--color-text-3)]">
                        Наведите камеру на QR‑код.
                    </div>
                    <QrScanner
                        onScan={handleScan}
                        onError={() => { }}
                        onClose={() => setScanning(false)}
                    />
                </div>
            )}

            {scanned && result && (
                <div className="card p-8 text-center animate-in zoom-in duration-300">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-[var(--color-text-1)] mb-2">Отметка успешна</h3>
                    <p className="text-[var(--color-text-3)] mb-3">Посещаемость успешно зафиксирована.</p>
                    {result?.status && (
                        <div className="text-sm text-[var(--color-text-2)] mb-4">
                            Статус: <span className={`font-semibold ${statusLabel(result.status).className}`}>{statusLabel(result.status).text}</span>
                        </div>
                    )}
                    <Button onClick={reset} variant="outline" className="w-full">Сканировать ещё</Button>
                </div>
            )}

            {error && (
                <div className="card p-8 text-center animate-in zoom-in duration-300">
                    <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4">
                        <XCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-[var(--color-text-1)] mb-2">Ошибка сканирования</h3>
                    <p className="text-[var(--color-text-3)] mb-6">{error}</p>
                    <Button onClick={reset} variant="outline" className="w-full">Попробовать снова</Button>
                </div>
            )}
        </div>
    )
}
