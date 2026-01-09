import { Router, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth, requireAdmin } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

export const router = Router()

// Get pending certificate requests (admin only)
router.get("/pending", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requests = await prisma.certificateRequest.findMany({
      where: { status: "PENDING" },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        kruzhok: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { requestedAt: "desc" },
    })

    return res.json(requests)
  } catch (error) {
    console.error("Error fetching pending certificates:", error)
    return res.status(500).json({
      error: "Failed to fetch pending certificates",
      code: "SERVER_ERROR"
    })
  }
})

// Get user's certificates
router.get("/my", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id

  try {
    const certificates = await prisma.certificateRequest.findMany({
      where: {
        userId,
        status: "SENT",
      },
      include: {
        kruzhok: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { sentAt: "desc" },
    })

    return res.json(certificates)
  } catch (error) {
    console.error("Error fetching user certificates:", error)
    return res.status(500).json({
      error: "Failed to fetch certificates",
      code: "SERVER_ERROR"
    })
  }
})

// Issue certificate (admin only)
router.post("/:requestId/issue", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { requestId } = req.params
  const schema = z.object({
    certificateUrl: z.string().url("Invalid certificate URL"),
    adminNotes: z.string().optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    if (parsed.error.formErrors.fieldErrors) {
      Object.entries(parsed.error.formErrors.fieldErrors).forEach(([field, errors]) => {
        fieldErrors[field] = errors || []
      })
    }
    return res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      fields: fieldErrors,
      message: Object.values(fieldErrors).flat().join(", ")
    })
  }

  const data = parsed.data

  try {
    const request = await prisma.certificateRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    })

    if (!request) {
      return res.status(404).json({
        error: "Certificate request not found",
        code: "NOT_FOUND"
      })
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        error: "Certificate request is not pending",
        code: "INVALID_STATUS"
      })
    }

    await prisma.certificateRequest.update({
      where: { id: requestId },
      data: {
        status: "SENT",
        certificateUrl: data.certificateUrl,
        sentAt: new Date(),
        reviewedAt: new Date(),
        reviewedById: req.user!.id,
        adminNotes: data.adminNotes,
      },
    })

    await prisma.notification.create({
      data: {
        userId: request.userId,
        title: "Certificate issued",
        message: "Your certificate is ready. You can download it in your profile.",
        type: "CERTIFICATE_ISSUED",
        metadata: {
          certificateRequestId: requestId,
          certificateUrl: data.certificateUrl,
        },
      },
    })

    return res.json({
      success: true,
      message: "Certificate issued"
    })
  } catch (error) {
    console.error("Error issuing certificate:", error)
    return res.status(500).json({
      error: "Failed to issue certificate",
      code: "SERVER_ERROR"
    })
  }
})

// Deny certificate request (admin only)
router.post("/:requestId/deny", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { requestId } = req.params
  const schema = z.object({
    adminNotes: z.string().min(1, "Reason is required"),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      message: "A rejection reason is required."
    })
  }

  const data = parsed.data

  try {
    const request = await prisma.certificateRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    })

    if (!request) {
      return res.status(404).json({
        error: "Certificate request not found",
        code: "NOT_FOUND"
      })
    }

    await prisma.certificateRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: req.user!.id,
        adminNotes: data.adminNotes,
      },
    })

    await prisma.notification.create({
      data: {
        userId: request.userId,
        title: "Certificate request rejected",
        message: `Your certificate request was rejected. Reason: ${data.adminNotes}`,
        type: "CERTIFICATE_DENIED",
        metadata: { certificateRequestId: requestId },
      },
    })

    return res.json({
      success: true,
      message: "Request rejected"
    })
  } catch (error) {
    console.error("Error denying certificate:", error)
    return res.status(500).json({
      error: "Failed to deny certificate request",
      code: "SERVER_ERROR"
    })
  }
})

// Auto-create certificate request when XP threshold reached
export async function checkAndCreateCertificateRequest(
  userId: string,
  kruzhokId: string,
  currentXP: number,
  taskDescription: string,
  thresholdXP: number = 100
) {
  try {
    const existingRequest = await prisma.certificateRequest.findFirst({
      where: {
        userId,
        kruzhokId,
        status: { in: ["PENDING", "SENT"] },
      },
    })

    if (existingRequest) {
      return null
    }

    if (currentXP < thresholdXP) {
      return null
    }

    const request = await prisma.certificateRequest.create({
      data: {
        userId,
        kruzhokId,
        totalXP: currentXP,
        thresholdXP,
        taskDescription,
        status: "PENDING",
      },
    })

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    })

    await Promise.all(
      admins.map((admin) =>
        prisma.notification.create({
          data: {
            userId: admin.id,
            title: "New certificate request",
            message: `A student reached ${currentXP} XP and requested a certificate.`,
            type: "CERTIFICATE_REQUEST",
            metadata: { certificateRequestId: request.id },
          },
        })
      )
    )

    return request
  } catch (error) {
    console.error("Error creating certificate request:", error)
    return null
  }
}
