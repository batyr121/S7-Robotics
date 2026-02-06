"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { RefreshCw, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface QrScannerProps {
    onScan: (decodedText: string) => void
    onError?: (error: any) => void
    onClose?: () => void
}

type FacingMode = "environment" | "user"

type CameraDevice = {
    id: string
    label: string
}

const FRONT_CAMERA_HINTS = ["front", "user", "facetime", "selfie", "fronta", "pered"]
const BACK_CAMERA_HINTS = ["back", "rear", "environment", "osnov", "zad", "tyl"]

const normalize = (value: string) => String(value || "").toLowerCase()
const hasAnyHint = (label: string, hints: string[]) => hints.some((hint) => normalize(label).includes(hint))

const pickCameraIdByFacing = (devices: CameraDevice[], facingMode: FacingMode) => {
    if (!devices.length) return ""
    const hints = facingMode === "environment" ? BACK_CAMERA_HINTS : FRONT_CAMERA_HINTS
    const fallbackHints = facingMode === "environment" ? FRONT_CAMERA_HINTS : BACK_CAMERA_HINTS

    const exact = devices.find((device) => hasAnyHint(device.label, hints))
    if (exact) return exact.id

    const fallback = devices.find((device) => hasAnyHint(device.label, fallbackHints))
    if (fallback) return fallback.id

    return devices[0].id
}

const toCameraErrorMessage = (error: unknown) => {
    const raw = typeof error === "string" ? error : (error as any)?.message || ""
    const text = normalize(raw)

    if (text.includes("notallowed") || text.includes("permission") || text.includes("denied")) {
        return "No camera access. Allow camera in browser settings and try again."
    }

    if (text.includes("notfound") || text.includes("overconstrained") || text.includes("device") || text.includes("constraints")) {
        return "Camera not found. Switch camera and try again."
    }

    if (text.includes("secure") || text.includes("https")) {
        return "Camera works only on HTTPS or localhost."
    }

    return "Unable to start camera. Check permission and try again."
}

const normalizeCamera = (device: { id?: string; label?: string }): CameraDevice => ({
    id: String(device?.id || ""),
    label: String(device?.label || "")
})

const uniqTargets = (targets: Array<string | MediaTrackConstraints>) => {
    const seen = new Set<string>()
    const result: Array<string | MediaTrackConstraints> = []

    for (const target of targets) {
        const key = typeof target === "string" ? `id:${target}` : `obj:${JSON.stringify(target)}`
        if (seen.has(key)) continue
        seen.add(key)
        result.push(target)
    }

    return result
}

const detectFacingFromLabel = (label: string): FacingMode | null => {
    if (hasAnyHint(label, BACK_CAMERA_HINTS)) return "environment"
    if (hasAnyHint(label, FRONT_CAMERA_HINTS)) return "user"
    return null
}

const cameraLabel = (camera: CameraDevice | undefined, index: number) => {
    if (!camera) return ""
    const label = camera.label?.trim()
    if (label) return label
    return `Camera ${index + 1}`
}

const sortByFacing = (devices: CameraDevice[], facingMode: FacingMode) => {
    const preferred = facingMode === "environment" ? BACK_CAMERA_HINTS : FRONT_CAMERA_HINTS
    return [...devices].sort((a, b) => {
        const aScore = hasAnyHint(a.label, preferred) ? 1 : 0
        const bScore = hasAnyHint(b.label, preferred) ? 1 : 0
        return bScore - aScore
    })
}

export default function QrScanner({ onScan, onError, onClose }: QrScannerProps) {
    const divId = useMemo(() => `qr-reader-${Math.random().toString(36).slice(2, 9)}`, [])
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const onScanRef = useRef(onScan)
    const onErrorRef = useRef(onError)
    const startRequestRef = useRef(0)

    const [cameras, setCameras] = useState<CameraDevice[]>([])
    const [facingMode, setFacingMode] = useState<FacingMode>("environment")
    const [selectedCameraId, setSelectedCameraId] = useState("")
    const [isScanning, setIsScanning] = useState(false)
    const [isStarting, setIsStarting] = useState(false)
    const [cameraError, setCameraError] = useState<string | null>(null)

    useEffect(() => {
        onScanRef.current = onScan
    }, [onScan])

    useEffect(() => {
        onErrorRef.current = onError
    }, [onError])

    const sortedCameras = useMemo(() => sortByFacing(cameras, facingMode), [cameras, facingMode])

    const effectiveCameraId = useMemo(() => {
        if (selectedCameraId && cameras.some((camera) => camera.id === selectedCameraId)) {
            return selectedCameraId
        }
        return pickCameraIdByFacing(cameras, facingMode)
    }, [cameras, facingMode, selectedCameraId])

    const refreshCameraList = useCallback(async () => {
        try {
            const devices = await Html5Qrcode.getCameras()
            const mapped = (devices || [])
                .map(normalizeCamera)
                .filter((device) => device.id)

            setCameras(mapped)
            if (mapped.length && (!selectedCameraId || !mapped.some((camera) => camera.id === selectedCameraId))) {
                setSelectedCameraId(pickCameraIdByFacing(mapped, facingMode))
            }
        } catch {
            setCameras([])
        }
    }, [facingMode, selectedCameraId])

    useEffect(() => {
        refreshCameraList()
    }, [refreshCameraList])

    const stopScanner = useCallback(async () => {
        const scanner = scannerRef.current
        if (!scanner) return

        try {
            await scanner.stop()
        } catch {
        }

        try {
            await scanner.clear()
        } catch {
        }

        setIsScanning(false)
    }, [])

    const startScanner = useCallback(async () => {
        const requestId = ++startRequestRef.current
        setIsStarting(true)
        setCameraError(null)

        if (!scannerRef.current) {
            scannerRef.current = new Html5Qrcode(divId)
        } else {
            await stopScanner()
        }

        const scanner = scannerRef.current
        if (!scanner) return

        const startTargets = uniqTargets([
            ...(effectiveCameraId ? ([{ deviceId: { exact: effectiveCameraId } }, effectiveCameraId] as Array<string | MediaTrackConstraints>) : []),
            { facingMode: { exact: facingMode } },
            { facingMode },
            { facingMode: facingMode === "environment" ? "user" : "environment" }
        ])

        let lastError: unknown = null
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 }
        }

        for (const target of startTargets) {
            try {
                await scanner.start(
                    target as any,
                    config,
                    (decodedText) => {
                        stopScanner().finally(() => onScanRef.current(decodedText))
                    },
                    () => {
                    }
                )

                if (requestId !== startRequestRef.current) {
                    await stopScanner()
                    return
                }

                setIsScanning(true)
                setIsStarting(false)
                return
            } catch (error) {
                lastError = error
            }
        }

        if (requestId === startRequestRef.current) {
            await refreshCameraList()
            const message = toCameraErrorMessage(lastError)
            setCameraError(message)
            setIsScanning(false)
            setIsStarting(false)
            if (onErrorRef.current) onErrorRef.current(message)
        }
    }, [divId, effectiveCameraId, facingMode, refreshCameraList, stopScanner])

    const switchToNextCamera = useCallback(() => {
        if (cameras.length < 2) return
        const currentIndex = cameras.findIndex((camera) => camera.id === effectiveCameraId)
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % cameras.length : 0
        const next = cameras[nextIndex]
        if (!next) return

        setSelectedCameraId(next.id)
        const detectedFacing = detectFacingFromLabel(next.label)
        if (detectedFacing) {
            setFacingMode(detectedFacing)
        }
    }, [cameras, effectiveCameraId])

    useEffect(() => {
        startScanner()
        return () => {
            startRequestRef.current += 1
            stopScanner().catch(() => null)
        }
    }, [startScanner, stopScanner])

    const activeCameraIndex = useMemo(() => sortedCameras.findIndex((camera) => camera.id === effectiveCameraId), [sortedCameras, effectiveCameraId])

    return (
        <div className="w-full max-w-sm mx-auto space-y-4">
            <div className="relative overflow-hidden rounded-xl bg-black border border-[var(--color-border-1)] shadow-2xl">
                <div id={divId} className="w-full min-h-[300px] bg-black relative">
                    {!isScanning && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 space-y-2">
                            <RefreshCw className="w-8 h-8 animate-spin" />
                            <span className="text-sm">{isStarting ? "Starting camera..." : "Camera is stopped"}</span>
                        </div>
                    )}
                </div>

                <div className="absolute bottom-4 left-0 right-0 flex items-center justify-between px-4 z-10">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                setFacingMode("environment")
                                if (cameras.length > 0) {
                                    setSelectedCameraId(pickCameraIdByFacing(cameras, "environment"))
                                }
                            }}
                            disabled={isStarting || facingMode === "environment"}
                            className={`rounded-full backdrop-blur-md border-0 text-white ${facingMode === "environment" ? "bg-white/40" : "bg-white/20 hover:bg-white/30"}`}
                        >
                            Rear
                        </Button>

                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                setFacingMode("user")
                                if (cameras.length > 0) {
                                    setSelectedCameraId(pickCameraIdByFacing(cameras, "user"))
                                }
                            }}
                            disabled={isStarting || facingMode === "user"}
                            className={`rounded-full backdrop-blur-md border-0 text-white ${facingMode === "user" ? "bg-white/40" : "bg-white/20 hover:bg-white/30"}`}
                        >
                            Front
                        </Button>

                        <Button
                            variant="secondary"
                            size="icon"
                            onClick={switchToNextCamera}
                            disabled={isStarting || cameras.length < 2}
                            className="rounded-full backdrop-blur-md border-0 text-white bg-white/20 hover:bg-white/30"
                            title="Switch camera"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </Button>
                    </div>

                    {onClose && (
                        <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => {
                                stopScanner().catch(() => null)
                                onClose()
                            }}
                            className="rounded-full w-10 h-10 bg-red-500/80 hover:bg-red-600 backdrop-blur-md border-0 text-white"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    )}
                </div>
            </div>

            {cameraError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {cameraError}
                </div>
            )}

            {sortedCameras.length > 0 && (
                <div className="rounded-lg border border-[var(--color-border-1)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-text-3)]">
                    Camera: {cameraLabel(sortedCameras[activeCameraIndex >= 0 ? activeCameraIndex : 0], activeCameraIndex >= 0 ? activeCameraIndex : 0)}
                </div>
            )}

            <p className="text-center text-sm text-[var(--color-text-3)]">
                Point the camera at the mentor QR code.
                <br />
                <span className="text-xs opacity-50">If camera does not work, switch lens or ask mentor to mark attendance manually.</span>
            </p>
        </div>
    )
}
