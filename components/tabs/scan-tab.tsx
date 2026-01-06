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

    const handleScan = async (dataString: string) => {
        setScanning(false)
        try {
            let body: any = {}
            try {
                // Try JSON first (legacy or robust format)
                const data = JSON.parse(dataString)
                if (data.type === 'attendance_session') {
                    body = data
                } else if (data.qrToken) {
                    body = { qrToken: data.qrToken }
                } else {
                    // Assume it might be just data attributes if not typed?
                    // Fallback to sending as custom if needed, or error
                    body = data
                }
            } catch (e) {
                // Not JSON, assume it is the raw JWT token
                body = { qrToken: dataString }
            }

            // Call API
            const res = await apiFetch<any>("/attendance/mark", {
                method: "POST",
                body: JSON.stringify(body)
            })

            if (res.error) throw new Error(res.error)

            setResult(res)
            setScanned(true)
        } catch (err: any) {
            console.error("Scan error:", err)
            setError(err.message || "Ошибка сканирования")
        }
    }

    const reset = () => {
        setScanned(false)
        setResult(null)
        setError(null)
        setScanning(false) // Reset to initial state (button visible), not auto-scan
    }

    return (
        <div className="max-w-md mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-[var(--color-text-1)] text-center">Отметка посещаемости</h2>

            {!scanned && !error && !scanning && (
                <div className="card p-8 text-center">
                    <QrCode className="w-16 h-16 mx-auto mb-4 text-[#00a3ff]" />
                    <p className="text-[var(--color-text-3)] mb-6">
                        Наведите камеру на QR код ментора, чтобы отметить присутствие на уроке
                    </p>
                    <Button onClick={() => setScanning(true)} className="w-full bg-[#00a3ff] text-white hover:bg-[#0088cc]">
                        Сканировать QR
                    </Button>
                </div>
            )}

            {scanning && (
                <div className="card p-4">
                    <div className="mb-4 text-center text-sm text-[var(--color-text-3)]">
                        Наведите камеру на код
                    </div>
                    <QrScanner
                        onScan={handleScan}
                        onError={(err) => { }}
                        onClose={() => setScanning(false)}
                    />
                </div>
            )}

            {scanned && result && (
                <div className="card p-8 text-center animate-in zoom-in duration-300">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-[var(--color-text-1)] mb-2">Успешно!</h3>
                    <p className="text-[var(--color-text-3)] mb-6">
                        Вы отмечены на занятии.
                    </p>
                    <Button onClick={reset} variant="outline" className="w-full">ОК</Button>
                </div>
            )}

            {error && (
                <div className="card p-8 text-center animate-in zoom-in duration-300">
                    <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4">
                        <XCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-[var(--color-text-1)] mb-2">Ошибка</h3>
                    <p className="text-[var(--color-text-3)] mb-6">{error}</p>
                    <Button onClick={reset} variant="outline" className="w-full">Попробовать снова</Button>
                </div>
            )}
        </div>
    )
}
