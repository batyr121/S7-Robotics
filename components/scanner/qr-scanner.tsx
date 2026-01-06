"use client"
import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { Camera, RefreshCw, Smartphone, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Toggle } from "@/components/ui/toggle"

interface QrScannerProps {
    onScan: (decodedText: string) => void
    onError?: (error: any) => void
    onClose?: () => void
}

export default function QrScanner({ onScan, onError, onClose }: QrScannerProps) {
    const divId = "qr-reader-custom"
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const [cameras, setCameras] = useState<any[]>([])
    const [selectedCameraId, setSelectedCameraId] = useState<string>("")
    const [isMirror, setIsMirror] = useState(false) // Default: No mirror (disableFlip: true)
    const [isScanning, setIsScanning] = useState(false)

    // 1. Fetch Cameras
    useEffect(() => {
        Html5Qrcode.getCameras().then((devices) => {
            if (devices && devices.length) {
                setCameras(devices)
                // Prefer back camera if available (usually the last one or labeled 'back')
                const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'))
                setSelectedCameraId(backCamera ? backCamera.id : devices[0].id)
            }
        }).catch(err => {
            console.error("Camera permission error", err)
            if (onError) onError("Ошибка доступа к камере")
        })

        return () => {
            stopScanner()
        }
    }, [])

    // 2. Start Scanner when selection changes
    useEffect(() => {
        if (!selectedCameraId) return

        startScanner(selectedCameraId, isMirror)

        return () => {
            // Cleanup is tricky with async stop. 
            // We rely on startScanner checking existing state or the global cleanup.
        }
    }, [selectedCameraId, isMirror])

    const startScanner = async (cameraId: string, mirror: boolean) => {
        if (scannerRef.current) {
            // If already running, stop first
            try {
                if (isScanning) {
                    await scannerRef.current.stop()
                }
                // Don't clear here, allows faster switch? NO, must clear to re-render potentially? 
                // Html5Qrcode instance is bound to element. 
            } catch (e) {
                console.warn("Stop failed", e)
            }
        } else {
            scannerRef.current = new Html5Qrcode(divId)
        }

        try {
            await scannerRef.current.start(
                cameraId,
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    disableFlip: !mirror // If mirror=false, disableFlip=true (No Mirror)
                },
                (decodedText) => {
                    stopScanner().then(() => onScan(decodedText))
                },
                (errorMessage) => {
                    // ignore frame errors
                }
            )
            setIsScanning(true)
        } catch (err) {
            console.error("Start failed", err)
            if (onError) onError("Не удалось запустить камеру")
        }
    }

    const stopScanner = async () => {
        if (scannerRef.current && isScanning) {
            try {
                await scannerRef.current.stop()
                scannerRef.current.clear()
                setIsScanning(false)
            } catch (err) {
                console.warn("Stop error", err)
            }
        }
    }

    const switchCamera = () => {
        if (cameras.length <= 1) return
        const currentIndex = cameras.findIndex(c => c.id === selectedCameraId)
        const nextIndex = (currentIndex + 1) % cameras.length
        setSelectedCameraId(cameras[nextIndex].id)
    }

    return (
        <div className="w-full max-w-sm mx-auto space-y-4">
            <div id={divId} className="w-full overflow-hidden rounded-lg bg-black/10 min-h-[300px] relative">
                {!selectedCameraId && (
                    <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-3)]">
                        Загрузка камер...
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-3">
                {cameras.length > 0 && (
                    <div className="flex items-center gap-2 justify-between">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={switchCamera}
                            disabled={cameras.length <= 1}
                            className="flex-1 gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            {cameras.length > 1 ? "Сменить камеру" : "Камера"}
                        </Button>

                        <Toggle
                            pressed={isMirror}
                            onPressedChange={setIsMirror}
                            variant="outline"
                            size="sm"
                        >
                            {isMirror ? "Зеркало ВКЛ" : "Зеркало ВЫКЛ"}
                        </Toggle>
                    </div>
                )}

                {/* Advanced selector if needed, currently Switch button handles it simpler */}
                {cameras.length > 2 && (
                    <Select value={selectedCameraId} onValueChange={setSelectedCameraId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Выберите камеру" />
                        </SelectTrigger>
                        <SelectContent>
                            {cameras.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.label || `Camera ${c.id.slice(0, 5)}`}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {onClose && (
                <button
                    onClick={() => {
                        stopScanner()
                        onClose()
                    }}
                    className="w-full py-2 text-sm text-[var(--color-text-2)] hover:text-[var(--color-text-1)]"
                >
                    Закрыть камеру
                </button>
            )}
        </div>
    )
}
