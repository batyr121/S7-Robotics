"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Plus, Trash2, Image, Video, FileText, Link as LinkIcon, Save, Image as ImageIcon, Loader2 } from "lucide-react"
import Link from "next/link"
import { apiFetch, getTokens } from "@/lib/api"
import { toast } from "@/hooks/use-toast"

type AttachmentType = "photo" | "video" | "presentation" | "document" | "link"

interface Attachment {
  type: AttachmentType
  url: string
  title?: string
  description?: string
  orderIndex: number
}

interface NewsItem {
  id: string
  title: string
  content: string
  coverImageUrl?: string
  published: boolean
  publishedAt?: string
  createdAt: string
  updatedAt: string
  author?: {
    id: string
    fullName: string
    email: string
  }
  attachments?: Array<{
    id: string
    type: string
    url: string
    title?: string
    description?: string
    orderIndex: number
  }>
}

interface NewsResponse {
  data: NewsItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const attachmentTypes: Array<{ value: AttachmentType; label: string; icon: any }> = [
  { value: "photo", label: "Фото", icon: Image },
  { value: "video", label: "Видео", icon: Video },
  { value: "presentation", label: "Презентация", icon: FileText },
  { value: "document", label: "Документ", icon: FileText },
  { value: "link", label: "Ссылка", icon: LinkIcon }
]

export default function EditNewsPage() {
  const router = useRouter()
  const params = useParams()
  const newsId = params.id as string

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [coverImageUrl, setCoverImageUrl] = useState("")
  const [coverUploading, setCoverUploading] = useState(false)
  const [published, setPublished] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  const ALLOWED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"]

  const uploadMedia = async (file: File): Promise<string> => {
    const tokens = getTokens()
    const fd = new FormData()
    fd.append("file", file)
    const tryEndpoints = ["/uploads/media", "/api/uploads/media"]
    let lastErr: any = null
    for (const ep of tryEndpoints) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)
      try {
        const res = await fetch(ep, {
          method: "POST",
          headers: tokens?.accessToken ? { authorization: `Bearer ${tokens.accessToken}` } : undefined,
          body: fd,
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        if (!res.ok) {
          const ct = res.headers.get("content-type") || ""
          if (ct.includes("application/json")) {
            const j = await res.json().catch(() => null)
            throw new Error(j?.error || `Не удалось загрузить (${res.status})`)
          }
          const t = await res.text().catch(() => "Не удалось загрузить")
          throw new Error(t || `Не удалось загрузить (${res.status})`)
        }
        const data = await res.json()
        const rawUrl = String(data.url || "")
        const normalizedPath = rawUrl.startsWith("/media/") ? rawUrl.replace("/media/", "/api/media/") : rawUrl
        const absolute = normalizedPath.startsWith("http://") || normalizedPath.startsWith("https://")
          ? normalizedPath
          : new URL(normalizedPath, window.location.origin).href
        return absolute
      } catch (e) {
        clearTimeout(timeoutId)
        lastErr = e
      }
    }
    throw lastErr || new Error("Не удалось загрузить файл")
  }

  const [showAttachmentForm, setShowAttachmentForm] = useState(false)
  const [newAttachment, setNewAttachment] = useState<Attachment>({
    type: "photo",
    url: "",
    title: "",
    description: "",
    orderIndex: 0
  })

  useEffect(() => {
    const loadNews = async () => {
      try {
        setInitialLoading(true)
        const response = await apiFetch<NewsResponse>(`/api/news/admin/all?page=1&limit=100`)
        const newsItem = response.data.find(item => item.id === newsId)

        if (!newsItem) {
          toast({ title: "Ошибка", description: "Новость не найдена", variant: "destructive" as any })
          router.push("/admin/news")
          return
        }

        setTitle(newsItem.title)
        setContent(newsItem.content)
        setCoverImageUrl(newsItem.coverImageUrl || "")
        setPublished(newsItem.published)
        setAttachments(newsItem.attachments?.map(att => ({
          type: att.type as AttachmentType,
          url: att.url,
          title: att.title,
          description: att.description,
          orderIndex: att.orderIndex
        })) || [])
      } catch (error: any) {
        toast({
          title: "Ошибка",
          description: error?.message || "Не удалось загрузить новости",
          variant: "destructive" as any
        })
        router.push("/admin/news")
      } finally {
        setInitialLoading(false)
      }
    }

    if (newsId) {
      loadNews()
    }
  }, [newsId, router])

  const handleAddAttachment = () => {
    if (!newAttachment.url) {
      toast({ title: "Ошибка", description: "Нужна ссылка на вложение", variant: "destructive" as any })
      return
    }

    setAttachments([...attachments, { ...newAttachment, orderIndex: attachments.length }])
    setNewAttachment({
      type: "photo",
      url: "",
      title: "",
      description: "",
      orderIndex: 0
    })
    setShowAttachmentForm(false)
  }

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast({ title: "Ошибка", description: "Заголовок обязателен", variant: "destructive" as any })
      return
    }

    if (!content.trim()) {
      toast({ title: "Ошибка", description: "Текст обязателен", variant: "destructive" as any })
      return
    }

    try {
      setLoading(true)

      await apiFetch(`/api/news/${newsId}`, {
        method: "PUT",
        body: JSON.stringify({
          title,
          content,
          coverImageUrl: coverImageUrl || null,
          published,
          attachments: attachments.length > 0 ? attachments : []
        })
      })

      toast({ title: "Новость обновлена" })
      router.push("/admin/news")
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось обновить новость",
        variant: "destructive" as any
      })
    } finally {
      setLoading(false)
    }
  }

  const getAttachmentIcon = (type: AttachmentType) => {
    const item = attachmentTypes.find(t => t.value === type)
    return item?.icon || FileText
  }

  if (initialLoading) {
    return (
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        <div className="text-[var(--color-text-3)]">Загрузка...</div>
      </main>
    )
  }

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/news"
          className="p-2 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-2xl font-semibold text-[var(--color-text-1)]">Редактировать новость</h2>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
        <div className="card p-4 space-y-4">
          <div>
            <label className="block text-sm text-[var(--color-text-3)] mb-2">
              Заголовок <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] focus:outline-none focus:border-[#00a3ff] transition-colors"
              placeholder="Введите заголовок новости"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--color-text-3)] mb-2">
              Обложка
            </label>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                if (f.type && !ALLOWED_COVER_TYPES.includes(f.type)) {
                  toast({
                    title: "Неподдерживаемый тип изображения",
                    description: "Поддерживаются: JPG, PNG, WEBP",
                    variant: "destructive" as any,
                  })
                  e.currentTarget.value = ""
                  return
                }
                setCoverUploading(true)
                try {
                  const url = await uploadMedia(f)
                  setCoverImageUrl(url)
                  toast({ title: "Обложка загружена" })
                } catch (err: any) {
                  toast({
                    title: "Ошибка",
                    description: err?.message || "Не удалось загрузить обложку",
                    variant: "destructive" as any,
                  })
                } finally {
                  setCoverUploading(false)
                  e.currentTarget.value = ""
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] text-sm transition-colors disabled:opacity-60"
                disabled={coverUploading}
              >
                {coverUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
                {coverUploading ? "Загрузка..." : "Загрузить обложку"}
              </button>
              {coverImageUrl && (
                <button
                  type="button"
                  onClick={() => setCoverImageUrl("")}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-transparent hover:bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-2)] text-sm transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </button>
              )}
            </div>
            {coverImageUrl && (
              <div className="mt-3">
                <img
                  src={coverImageUrl}
                  alt="Предпросмотр"
                  className="w-full max-w-md h-48 object-cover rounded-lg"
                />
                <div className="mt-2 text-xs text-[var(--color-text-3)] break-all">{coverImageUrl}</div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-[var(--color-text-3)] mb-2">
              Текст <span className="text-red-400">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="w-full px-4 py-3 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] focus:outline-none focus:border-[#00a3ff] transition-colors resize-none"
              placeholder="Напишите текст новости..."
              required
            />
          </div>
        </div>

        <div className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm text-[var(--color-text-3)]">Вложения</label>
            <button
              type="button"
              onClick={() => setShowAttachmentForm(!showAttachmentForm)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border-1)] text-[var(--color-text-1)] text-sm rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Добавить вложение
            </button>
          </div>

          {showAttachmentForm && (
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg p-4 space-y-3">
              <div>
                <label className="block text-xs text-[var(--color-text-3)] mb-2">Тип</label>
                <select
                  value={newAttachment.type}
                  onChange={(e) => setNewAttachment({ ...newAttachment, type: e.target.value as AttachmentType })}
                  className="w-full px-3 py-2 bg-[var(--color-surface-1)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] text-sm focus:outline-none focus:border-[#00a3ff]"
                >
                  {attachmentTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-[var(--color-text-3)] mb-2">Ссылка <span className="text-red-400">*</span></label>
                <input
                  type="url"
                  value={newAttachment.url}
                  onChange={(e) => setNewAttachment({ ...newAttachment, url: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--color-surface-1)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] text-sm placeholder:text-[var(--color-text-3)] focus:outline-none focus:border-[#00a3ff]"
                  placeholder="https://example.com/file.pdf"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--color-text-3)] mb-2">Название</label>
                <input
                  type="text"
                  value={newAttachment.title}
                  onChange={(e) => setNewAttachment({ ...newAttachment, title: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--color-surface-1)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] text-sm placeholder:text-[var(--color-text-3)] focus:outline-none focus:border-[#00a3ff]"
                  placeholder="Название вложения"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--color-text-3)] mb-2">Описание</label>
                <input
                  type="text"
                  value={newAttachment.description}
                  onChange={(e) => setNewAttachment({ ...newAttachment, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--color-surface-1)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] text-sm placeholder:text-[var(--color-text-3)] focus:outline-none focus:border-[#00a3ff]"
                  placeholder="Короткое описание"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddAttachment}
                  className="flex-1 px-4 py-2 bg-[#00a3ff] hover:bg-[#0090e0] text-white text-sm rounded-lg transition-colors"
                >
                  Добавить
                </button>
                <button
                  type="button"
                  onClick={() => setShowAttachmentForm(false)}
                  className="px-4 py-2 bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-1)] text-sm rounded-lg transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="space-y-2">
              {attachments.map((att, index) => {
                const Icon = getAttachmentIcon(att.type)
                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg"
                  >
                    <Icon className="w-5 h-5 text-[#00a3ff]" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[var(--color-text-1)] text-sm font-medium">
                        {att.title || att.url}
                      </div>
                      {att.description && (
                        <div className="text-[var(--color-text-3)] text-xs truncate">
                          {att.description}
                        </div>
                      )}
                      <div className="text-[var(--color-text-3)] text-xs truncate">
                        {att.url}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(index)}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card p-4 flex items-center gap-3">
          <input
            type="checkbox"
            id="published"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="w-5 h-5 rounded bg-[var(--color-surface-1)] border-[var(--color-border-1)] text-[#00a3ff] focus:ring-[#00a3ff] focus:ring-offset-0"
          />
          <label htmlFor="published" className="text-[var(--color-text-1)] text-sm cursor-pointer">
            Публиковать сразу
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-[#00a3ff] hover:bg-[#0090e0] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {loading ? "Сохранение..." : "Сохранить изменения"}
          </button>
          <Link
            href="/admin/news"
            className="px-6 py-3 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border-1)] text-[var(--color-text-1)] rounded-lg transition-colors"
          >
            Отмена
          </Link>
        </div>
     </form>
    </main>
  )
}
