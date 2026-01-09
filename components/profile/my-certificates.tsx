"use client"
import { useEffect, useState } from "react"
import { apiFetch } from "@/lib/api"
import { Award, Download, FileText } from "lucide-react"
import { toast } from "@/hooks/use-toast"

type Certificate = {
  id: string
  kruzhok: {
    id: string
    title: string
  }
  totalXP: number
  certificateUrl: string
  sentAt: string
}

export default function MyCertificates() {
  const [loading, setLoading] = useState(true)
  const [certificates, setCertificates] = useState<Certificate[]>([])

  useEffect(() => {
    loadCertificates()
  }, [])

  const loadCertificates = async () => {
    setLoading(true)
    try {
      const data = await apiFetch<Certificate[]>("/api/certificates/my")
      setCertificates(data || [])
    } catch (error: any) {
      toast({
        title: "Unable to load certificates",
        description: error.message || "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-6">
        <div className="text-white/60">Loading certificates...</div>
      </div>
    )
  }

  if (certificates.length === 0) {
    return (
      <div className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-8 text-center">
        <Award className="w-16 h-16 text-white/40 mx-auto mb-4" />
        <div className="text-white text-lg font-semibold mb-2">No certificates yet</div>
        <div className="text-white/60 text-sm">
          Earn XP in classes to unlock your first certificate.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <Award className="w-6 h-6 text-[#00a3ff]" />
        <h2 className="text-white text-xl font-semibold">My certificates</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {certificates.map((cert) => (
          <div
            key={cert.id}
            className="bg-[#16161c] border border-[#2a2a35] rounded-2xl p-5 text-white hover:border-[#00a3ff]/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-[#00a3ff]" />
                  <div className="text-lg font-semibold">{cert.kruzhok.title}</div>
                </div>
                <div className="text-white/60 text-sm">
                  Issued on: {new Date(cert.sentAt).toLocaleDateString("en-US")}
                </div>
                <div className="text-[#00a3ff] text-sm mt-1">XP: {cert.totalXP}</div>
              </div>
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#00a3ff] to-[#0066cc] flex items-center justify-center">
                <Award className="w-8 h-8 text-white" />
              </div>
            </div>

            <a
              href={cert.certificateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00a3ff] hover:bg-[#0088cc] text-black font-medium transition-colors w-full justify-center"
            >
              <Download className="w-4 h-4" />
              Download certificate
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
