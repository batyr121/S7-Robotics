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
                return { text: "On time", className: "text-green-500" }
            case "LATE":
                return { text: "Late", className: "text-yellow-500" }
            default:
                return { text: String(status || "Recorded"), className: "text-[var(--color-text-2)]" }
        }
    }

    const handleScan = async (dataString: string) => {
        setScanning(false)
        try {
            let body: any = {}
            try {
                const data = JSON.parse(dataString)
                if (data.qrToken) {
                    body = { qrToken: data.qrToken }
                } else {
                    body = data
                }
            } catch {
                body = { qrToken: dataString }
            }

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
            <h2 className="text-2xl font-bold text-[var(--color-text-1)] text-center">Attendance Check-In</h2>

            {!scanned && !error && !scanning && (
                <div className="card p-8 text-center">
                    <QrCode className="w-16 h-16 mx-auto mb-4 text-[#00a3ff]" />
                    <p className="text-[var(--color-text-3)] mb-6">
                        Tap the button and scan the QR code shown by your mentor to record attendance.
                    </p>
                    <Button onClick={() => setScanning(true)} className="w-full bg-[#00a3ff] text-white hover:bg-[#0088cc]">
                        Start scanning
                    </Button>
                </div>
            )}

            {scanning && (
                <div className="card p-4">
                    <div className="mb-4 text-center text-sm text-[var(--color-text-3)]">
                        Point the camera at the QR code.
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
                    <h3 className="text-xl font-bold text-[var(--color-text-1)] mb-2">Check-in complete</h3>
                    <p className="text-[var(--color-text-3)] mb-3">Your attendance was recorded successfully.</p>
                    {result?.status && (
                        <div className="text-sm text-[var(--color-text-2)] mb-4">
                            Status: <span className={`font-semibold ${statusLabel(result.status).className}`}>{statusLabel(result.status).text}</span>
                        </div>
                    )}
                    <Button onClick={reset} variant="outline" className="w-full">Scan again</Button>
                </div>
            )}

            {error && (
                <div className="card p-8 text-center animate-in zoom-in duration-300">
                    <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4">
                        <XCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-[var(--color-text-1)] mb-2">Scan failed</h3>
                    <p className="text-[var(--color-text-3)] mb-6">{error}</p>
                    <Button onClick={reset} variant="outline" className="w-full">Try again</Button>
                </div>
            )}
        </div>
    )
}
