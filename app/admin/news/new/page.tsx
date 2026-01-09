"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Trash2, Image, Video, FileText, Link as LinkIcon, Save } from "lucide-react"
import Link from "next/link"
import { apiFetch } from "@/lib/api"
import { toast } from "@/hooks/use-toast"

type AttachmentType = "photo" | "video" | "presentation" | "document" | "link"

interface Attachment {
  type: AttachmentType
  url: string
  title?: string
  description?: string
  orderIndex: number
}

const attachmentTypes: Array<{ value: AttachmentType; label: string; icon: any }> = [
  { value: "photo", label: "Photo", icon: Image },
  { value: "video", label: "Video", icon: Video },
  { value: "presentation", label: "Presentation", icon: FileText },
  { value: "document", label: "Document", icon: FileText },
  { value: "link", label: "Link", icon: LinkIcon }
]

export default function NewNewsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [coverImageUrl, setCoverImageUrl] = useState("")
  const [published, setPublished] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])

  const [showAttachmentForm, setShowAttachmentForm] = useState(false)
  const [newAttachment, setNewAttachment] = useState<Attachment>({
    type: "photo",
    url: "",
    title: "",
    description: "",
    orderIndex: 0
  })

  const handleAddAttachment = () => {
    if (!newAttachment.url) {
      toast({ title: "Error", description: "Attachment URL is required", variant: "destructive" as any })
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
      toast({ title: "Error", description: "Title is required", variant: "destructive" as any })
      return
    }

    if (!content.trim()) {
      toast({ title: "Error", description: "Content is required", variant: "destructive" as any })
      return
    }

    try {
      setLoading(true)

      await apiFetch("/api/news", {
        method: "POST",
        body: JSON.stringify({
          title,
          content,
          coverImageUrl: coverImageUrl || undefined,
          published,
          attachments: attachments.length > 0 ? attachments : undefined
        })
      })

      toast({ title: published ? "News published" : "News saved as draft" })
      router.push("/admin/news")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to create news",
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

  return (
    <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-slide-up">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/news"
          className="p-2 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-3)] hover:text-[var(--color-text-1)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-2xl font-semibold text-[var(--color-text-1)]">Create news</h2>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
        <div className="card p-4 space-y-4">
          <div>
            <label className="block text-sm text-[var(--color-text-3)] mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] focus:outline-none focus:border-[#00a3ff] transition-colors"
              placeholder="Enter news title"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--color-text-3)] mb-2">
              Cover image URL
            </label>
            <input
              type="url"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] focus:outline-none focus:border-[#00a3ff] transition-colors"
              placeholder="https://example.com/image.jpg"
            />
            {coverImageUrl && (
              <div className="mt-3">
                <img
                  src={coverImageUrl}
                  alt="Preview"
                  className="w-full max-w-md h-48 object-cover rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none"
                  }}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-[var(--color-text-3)] mb-2">
              Content <span className="text-red-400">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="w-full px-4 py-3 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] focus:outline-none focus:border-[#00a3ff] transition-colors resize-none"
              placeholder="Write the news content..."
              required
            />
          </div>
        </div>

        <div className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm text-[var(--color-text-3)]">Attachments</label>
            <button
              type="button"
              onClick={() => setShowAttachmentForm(!showAttachmentForm)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border-1)] text-[var(--color-text-1)] text-sm rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add attachment
            </button>
          </div>

          {showAttachmentForm && (
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-lg p-4 space-y-3">
              <div>
                <label className="block text-xs text-[var(--color-text-3)] mb-2">Type</label>
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
                <label className="block text-xs text-[var(--color-text-3)] mb-2">URL <span className="text-red-400">*</span></label>
                <input
                  type="url"
                  value={newAttachment.url}
                  onChange={(e) => setNewAttachment({ ...newAttachment, url: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--color-surface-1)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] text-sm placeholder:text-[var(--color-text-3)] focus:outline-none focus:border-[#00a3ff]"
                  placeholder="https://example.com/file.pdf"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--color-text-3)] mb-2">Title</label>
                <input
                  type="text"
                  value={newAttachment.title}
                  onChange={(e) => setNewAttachment({ ...newAttachment, title: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--color-surface-1)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] text-sm placeholder:text-[var(--color-text-3)] focus:outline-none focus:border-[#00a3ff]"
                  placeholder="Attachment title"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--color-text-3)] mb-2">Description</label>
                <input
                  type="text"
                  value={newAttachment.description}
                  onChange={(e) => setNewAttachment({ ...newAttachment, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--color-surface-1)] border border-[var(--color-border-1)] rounded-lg text-[var(--color-text-1)] text-sm placeholder:text-[var(--color-text-3)] focus:outline-none focus:border-[#00a3ff]"
                  placeholder="Short description"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddAttachment}
                  className="flex-1 px-4 py-2 bg-[#00a3ff] hover:bg-[#0090e0] text-white text-sm rounded-lg transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAttachmentForm(false)}
                  className="px-4 py-2 bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-1)] text-sm rounded-lg transition-colors"
                >
                  Cancel
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
            Publish immediately
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-[#00a3ff] hover:bg-[#0090e0] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {loading ? "Saving..." : "Save news"}
          </button>
          <Link
            href="/admin/news"
            className="px-6 py-3 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border-1)] text-[var(--color-text-1)] rounded-lg transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  )
}
