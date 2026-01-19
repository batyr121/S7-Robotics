import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { prisma } from "../db"
import { requireAuth, requireAdmin } from "../middleware/auth"
import type { AuthenticatedRequest } from "../types"

export const router = Router()

// Submit subscription request (user)
router.post("/request", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const schema = z.object({
    type: z.enum(["ONETIME_PURCHASE", "MONTHLY_SUBSCRIPTION"]).default("ONETIME_PURCHASE"),
    paymentComment: z.string().min(1),
    paymentProofUrl: z.string().optional(),
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
      message: Object.values(fieldErrors).flat().join(', ')
    })
  }
  
  const data = parsed.data
  const userId = req.user!.id
  
  try {
    // Check if user already has an active subscription
    const existingActive = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ["PENDING", "ACTIVE"] },
      },
    })
    
    if (existingActive) {
      return res.status(400).json({ 
        error: "You already have an active or pending subscription", 
        code: "SUBSCRIPTION_EXISTS" 
      })
    }
    
    // Check if payment comment is unique
    const existingComment = await prisma.subscription.findFirst({
      where: { paymentComment: data.paymentComment },
    })
    
    if (existingComment) {
      return res.status(400).json({ 
        error: "This payment code is already in use. Please use a unique code.", 
        code: "PAYMENT_COMMENT_DUPLICATE",
        fields: { paymentComment: ["Payment code is already in use"] },
        message: "Payment code is already in use"
      })
    }
    
    // Create subscription request
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        type: data.type,
        status: "PENDING",
        amount: 2000,
        currency: "KZT",
        paymentMethod: "KASPI",
        paymentComment: data.paymentComment,
        maxKruzhoks: 1,
        maxClassesPerKruzhok: 2,
        maxStudentsPerClass: 30,
      },
    })
    
    // Create notification for admins
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    })
    
    await Promise.all(
      admins.map((admin) =>
        prisma.notification.create({
          data: {
            userId: admin.id,
            title: "New subscription request",
            message: `User ${req.user!.fullName} requested a subscription`,
            type: "SUBSCRIPTION_REQUEST",
            metadata: { subscriptionId: subscription.id },
          },
        })
      )
    )
    
    return res.status(201).json({
      id: subscription.id,
      status: subscription.status,
      message: "Request submitted for review",
    })
  } catch (error) {
    console.error("Error creating subscription request:", error)
    return res.status(500).json({ 
      error: "Failed to create subscription request", 
      code: "SERVER_ERROR" 
    })
  }
})

// Get user's subscription status
router.get("/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id
  
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        OR: [
          { expiresAt: null }, // One-time purchases don't expire
          { expiresAt: { gt: new Date() } }, // Monthly subscriptions not expired
        ],
      },
      orderBy: { createdAt: "desc" },
    })
    
    if (!subscription) {
      return res.json({ hasActiveSubscription: false })
    }
    
    return res.json({
      hasActiveSubscription: true,
      subscription: {
        type: subscription.type,
        status: subscription.status,
        expiresAt: subscription.expiresAt,
        limits: {
          maxKruzhoks: subscription.maxKruzhoks,
          maxClassesPerKruzhok: subscription.maxClassesPerKruzhok,
          maxStudentsPerClass: subscription.maxStudentsPerClass,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching subscription status:", error)
    return res.status(500).json({ 
      error: "Failed to fetch subscription status", 
      code: "SERVER_ERROR" 
    })
  }
})

// Admin: Get all pending subscription requests
router.get("/admin/pending", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      where: { status: "PENDING" },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { requestedAt: "desc" },
    })
    
    return res.json({ subscriptions })
  } catch (error) {
    console.error("Error fetching pending subscriptions:", error)
    return res.status(500).json({ 
      error: "Failed to fetch pending subscriptions", 
      code: "SERVER_ERROR" 
    })
  }
})

// Admin: Approve subscription request
router.post("/admin/:id/approve", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const schema = z.object({
    adminNotes: z.string().optional(),
    expiresAt: z.string().datetime().optional(),
  })
  
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ 
      error: "Validation failed", 
      code: "VALIDATION_ERROR" 
    })
  }
  
  const data = parsed.data
  
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: { user: true },
    })
    
    if (!subscription) {
      return res.status(404).json({ 
        error: "Subscription not found", 
        code: "NOT_FOUND" 
      })
    }
    
    if (subscription.status !== "PENDING") {
      return res.status(400).json({ 
        error: "Subscription is not pending", 
        code: "INVALID_STATUS" 
      })
    }
    
    // Update subscription to ACTIVE
    await prisma.subscription.update({
      where: { id },
      data: {
        status: "ACTIVE",
        confirmedAt: new Date(),
        confirmedById: req.user!.id,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        adminNotes: data.adminNotes,
      },
    })
    
    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: subscription.userId,
        title: "Subscription activated",
        message: "Your subscription is now active. You can create groups.",
        type: "SUBSCRIPTION_APPROVED",
        metadata: { subscriptionId: id },
      },
    })
    
    return res.json({
      success: true,
      message: "Subscription activated",
    })
  } catch (error) {
    console.error("Error approving subscription:", error)
    return res.status(500).json({ 
      error: "Failed to approve subscription", 
      code: "SERVER_ERROR" 
    })
  }
})

// Admin: Reject subscription request
router.post("/admin/:id/reject", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const schema = z.object({
    adminNotes: z.string().min(1, "Reason is required"),
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
      message: "Provide a rejection reason"
    })
  }
  
  const data = parsed.data
  
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: { user: true },
    })
    
    if (!subscription) {
      return res.status(404).json({ 
        error: "Subscription not found", 
        code: "NOT_FOUND" 
      })
    }
    
    if (subscription.status !== "PENDING") {
      return res.status(400).json({ 
        error: "Subscription is not pending", 
        code: "INVALID_STATUS" 
      })
    }
    
    // Update subscription to REJECTED
    await prisma.subscription.update({
      where: { id },
      data: {
        status: "REJECTED",
        adminNotes: data.adminNotes,
      },
    })
    
    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: subscription.userId,
        title: "Subscription request rejected",
        message: `Your subscription request was rejected. Reason: ${data.adminNotes}`,
        type: "SUBSCRIPTION_REJECTED",
        metadata: { subscriptionId: id },
      },
    })
    
    return res.json({
      success: true,
      message: "Request rejected",
    })
  } catch (error) {
    console.error("Error rejecting subscription:", error)
    return res.status(500).json({ 
      error: "Failed to reject subscription", 
      code: "SERVER_ERROR" 
    })
  }
})
