"use client"
import { useState, useRef } from "react"
import { apiFetch } from "@/lib/api"
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileUploadProps {
    value?: string
    onChange: (url: string) => void
    label?: string
    accept?: string
    className?: string
}

export function FileUpload({
    value,
    onChange,
    label = "Загрузить файл",
    accept = "image/*",
    className
}: FileUploadProps) {
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        const formData = new FormData()
        formData.append("file", file)

        try {
            // Using raw fetch because our apiFetch wrapper assumes JSON
            const token = localStorage.getItem("s7_token")
            const res = await fetch("/api/media", {
                method: "POST",
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: formData
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || "Upload failed")
            }

            const data = await res.json()
            onChange(data.url)
        } catch (error) {
            console.error("Upload error:", error)
            alert("Не удалось загрузить файл")
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const clearValue = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange("")
    }

    return (
        <div className={cn("w-full", className)}>
            {label && <label className="block text-sm text-[var(--color-text-3)] mb-2">{label}</label>}

            <div
                className={cn(
                    "border-2 border-dashed border-[var(--color-border-1)] rounded-lg p-4 transition-colors relative group cursor-pointer hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-2)]",
                    !value && "flex flex-col items-center justify-center h-40"
                )}
                onClick={() => !value && fileInputRef.current?.click()}
            >
                {value ? (
                    <div className="relative w-full aspect-video rounded-md overflow-hidden bg-black/20 group">
                        <img
                            src={value}
                            alt="Uploaded"
                            className="w-full h-full object-contain"
                        />
                        <button
                            onClick={clearValue}
                            className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <>
                        {uploading ? (
                            <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin mb-2" />
                        ) : (
                            <Upload className="w-8 h-8 text-[var(--color-text-3)] mb-2 group-hover:text-[var(--color-primary)]" />
                        )}
                        <p className="text-sm text-[var(--color-text-3)] text-center">
                            {uploading ? "Загрузка..." : "Нажмите для загрузки или перетащите файл"}
                        </p>
                    </>
                )}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={accept}
                    className="hidden"
                    onChange={handleUpload}
                    disabled={uploading}
                />
            </div>
            {value && (
                <div className="mt-2 flex justify-end">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-[var(--color-primary)] hover:underline"
                    >
                        Заменить файл
                    </button>
                </div>
            )}
        </div>
    )
}
