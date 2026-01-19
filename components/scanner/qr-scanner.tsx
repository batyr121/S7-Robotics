"use client"
import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"

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
    const [isScanning, setIsScanning] = useState(false)

    // 1. Fetch Cameras
    useEffect(() => {
        Html5Qrcode.getCameras().then((devices) => {
            if (devices && devices.length) {
                setCameras(devices)
                // Prefer back camera if available (usually the last one or labeled 'back')
                const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'))

                if (backCamera) {
                    setSelectedCameraId(backCamera.id)
                } else {
                    setSelectedCameraId(devices[0].id)
                }
            }
        }).catch(err => {
            console.error("Camera permission error", err)
            if (onError) onError("Camera error")
        })

        return () => {
            stopScanner()
        }
    }, [])

    // 2. Start Scanner when selection changes
    useEffect(() => {
        if (!selectedCameraId) return
        startScanner(selectedCameraId)
        return () => { }
    }, [selectedCameraId])

    const startScanner = async (cameraId: string) => {
        if (scannerRef.current) {
            try {
                if (isScanning) await scannerRef.current.stop()
            } catch (e) { console.warn("Stop failed", e) }
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
                    disableFlip: true
                },
                (decodedText) => {
                    stopScanner().then(() => onScan(decodedText))
                },
                () => { } // ignore frame errors
            )
            setIsScanning(true)
        } catch (err) {
            console.error("Start failed", err)
            if (onError) onError("Camera error")
        }
    }

    const stopScanner = async () => {
        if (scannerRef.current && isScanning) {
            try {
                await scannerRef.current.stop()
                scannerRef.current.clear()
                setIsScanning(false)
            } catch (err) { console.warn("Stop error", err) }
        }
    }

    const switchCamera = () => {
        if (cameras.length <= 1) return
        const currentIndex = cameras.findIndex(c => c.id === selectedCameraId)
        const nextIndex = (currentIndex + 1) % cameras.length

        const nextCamera = cameras[nextIndex]
        setSelectedCameraId(nextCamera.id)

    }

    return (
        <div className="w-full max-w-sm mx-auto space-y-4">
            <div className="relative overflow-hidden rounded-xl bg-black border border-[var(--color-border-1)] shadow-2xl">
                <div id={divId} className="w-full min-h-[300px] bg-black">
                    {!isScanning && (
                        <div className="absolute inset-0 flex items-center justify-center text-white/50 animate-pulse">
                            Initializing...
                        </div>
                    )}
                </div>

                {/* Overlay Controls */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 px-4 z-10">
                    {cameras.length > 1 && (
                        <Button
                            variant="secondary"
                            size="icon"
                            onClick={switchCamera}
                            className="rounded-full w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-md border-0 text-white"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </Button>
                    )}

                    {onClose && (
                        <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => {
                                stopScanner()
                                onClose()
                            }}
                            className="rounded-full w-10 h-10 bg-red-500/80 hover:bg-red-600 backdrop-blur-md border-0 text-white ml-auto"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    )}
                </div>
            </div>

            <p className="text-center text-sm text-[var(--color-text-3)]">
                Point at the QR code on the teacher&apos;s screen
            </p>
        </div>
    )
}
