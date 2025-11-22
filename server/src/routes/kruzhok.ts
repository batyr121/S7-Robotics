import { Router } from "express";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../types";
import { prisma } from "../db.js";
import { body, param, query } from "express-validator";
import { validate } from "../middleware/validate";
import { isAdmin, protect } from "../middleware/auth.js";
// import { UserRole } from "@prisma/client";
import crypto from "crypto";

export const router = Router();

// Helper function to generate a unique access code
function generateAccessCode(): string {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

// --- ADMIN ROUTES ---

// POST / - Create a new Kruzhok (mounted at /api/kruzhok, requires subscription)
router.post(
  "/",
  protect,
  [
    body("name").isString().trim().notEmpty().withMessage("Kruzhok name is required"),
    body("description").optional().isString().trim(),
    body("maxCapacity").optional().isInt({ min: 0 }).toInt(),
  ],
  validate,
  async (req, res) => {
    const { name, description, maxCapacity } = req.body;
    const userId = req.user.id;

    try {
      // Check subscription
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
      });

      if (!subscription || subscription.status !== "ACTIVE") {
        return res.status(403).json({ message: "Active subscription required to create kruzhok" });
      }

      // Check kruzhok limit
      const userKruzhoks = await prisma.kruzhok.count({
        where: { adminId: userId },
      });

      if (userKruzhoks >= subscription.maxKruzhoks) {
        return res.status(403).json({
          message: `Kruzhok limit reached. Your plan allows ${subscription.maxKruzhoks} kruzhoks.`,
          currentCount: userKruzhoks,
          maxAllowed: subscription.maxKruzhoks,
        });
      }

      // Generate access code
      const accessCode = generateAccessCode();

      const kruzhok = await prisma.kruzhok.create({
        data: {
          name,
          description,
          maxCapacity,
          adminId: userId,
          accessCode,
        },
      });

      res.status(201).json(kruzhok);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to create Kruzhok" });
    }
  }
);

// POST /api/admin/kruzhok - Create a new Kruzhok (admin - no limits)
router.post(
  "/admin/kruzhok",
  protect,
  isAdmin,
  [
    body("name").isString().trim().notEmpty().withMessage("Kruzhok name is required"),
    body("description").optional().isString().trim(),
    body("maxCapacity").optional().isInt({ min: 0 }).toInt(),
    body("adminId").optional().isString().trim().notEmpty().withMessage("Admin ID must be a valid string"),
    body("isPaid").optional().isBoolean().withMessage("isPaid must be a boolean"),
  ],
  validate,
  async (req, res) => {
    const { name, description, maxCapacity, adminId, isPaid } = req.body;

    try {
      // If isPaid is true, simulate payment processing
      let subscriptionStatus = "FREE";
      let subscriptionExpiresAt = null;

      if (isPaid) {
        // Simulate payment processing (in real scenario, integrate with payment gateway)
        // For now, we'll mark it as PENDING_PAYMENT and require admin to confirm
        subscriptionStatus = "PENDING_PAYMENT";
      }

      // Generate access code for free clubs or as backup for paid clubs
      const accessCode = generateAccessCode();

      const kruzhok = await prisma.kruzhok.create({
        data: {
          name,
          description,
          maxCapacity,
          adminId: adminId || null,
          isPaid: isPaid || false,
          accessCode,
          subscriptionStatus,
          subscriptionExpiresAt,
        },
      });

      res.status(201).json({
        ...kruzhok,
        message: isPaid
          ? "Paid club created. Waiting for payment confirmation."
          : "Free club created successfully.",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to create Kruzhok" });
    }
  }
);

// POST /api/admin/kruzhok/:id/confirm-payment - Confirm payment for paid club
router.post(
  "/admin/kruzhok/:id/confirm-payment",
  protect,
  isAdmin,
  [param("id").isString().trim().notEmpty().withMessage("Kruzhok ID is required")],
  validate,
  async (req, res) => {
    const { id } = req.params;

    try {
      const kruzhok = await prisma.kruzhok.findUnique({ where: { id } });

      if (!kruzhok) {
        return res.status(404).json({ message: "Kruzhok not found" });
      }

      if (!kruzhok.isPaid) {
        return res.status(400).json({ message: "This is not a paid club" });
      }

      // Set subscription to active for 1 year
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const updated = await prisma.kruzhok.update({
        where: { id },
        data: {
          subscriptionStatus: "ACTIVE_PAID",
          subscriptionExpiresAt: expiresAt,
        },
      });

      res.json({
        ...updated,
        message: "Payment confirmed. Subscription is now active.",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to confirm payment" });
    }
  }
);

// PUT /api/admin/kruzhok/:id - Update Kruzhok details
router.put(
  "/admin/kruzhok/:id",
  protect,
  isAdmin,
  [
    param("id").isString().trim().notEmpty().withMessage("Kruzhok ID is required"),
    body("name").optional().isString().trim().notEmpty(),
    body("description").optional().isString().trim(),
    body("maxCapacity").optional().isInt({ min: 0 }).toInt(),
    body("isActive").optional().isBoolean(),
    body("adminId").optional().isString().trim().notEmpty(),
  ],
  validate,
  async (req, res) => {
    const { id } = req.params;
    const { name, description, maxCapacity, isActive, adminId } = req.body;

    try {
      const kruzhok = await prisma.kruzhok.update({
        where: { id },
        data: {
          name,
          description,
          maxCapacity,
          isActive,
          adminId,
        },
      });
      res.json(kruzhok);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to update Kruzhok" });
    }
  }
);

// DELETE /api/admin/kruzhok/:id - Delete a Kruzhok
router.delete(
  "/admin/kruzhok/:id",
  protect,
  isAdmin,
  [param("id").isString().trim().notEmpty().withMessage("Kruzhok ID is required")],
  validate,
  async (req, res) => {
    const { id } = req.params;

    try {
      await prisma.kruzhok.delete({
        where: { id },
      });
      res.json({ message: "Kruzhok successfully deleted" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to delete Kruzhok" });
    }
  }
);

// GET /api/admin/kruzhok/:id/enrollment-requests - Get pending enrollment requests
router.get(
  "/admin/kruzhok/:id/enrollment-requests",
  protect,
  isAdmin,
  [param("id").isString().trim().notEmpty().withMessage("Kruzhok ID is required")],
  validate,
  async (req, res) => {
    const { id: kruzhokId } = req.params;

    try {
      const requests = await prisma.kruzhokMember.findMany({
        where: {
          kruzhokId,
          enrollmentStatus: "PENDING",
        },
        include: {
          user: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });
      res.json(requests);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch enrollment requests" });
    }
  }
);

// POST /api/admin/kruzhok/:id/approve-enrollment/:memberId - Approve enrollment request
router.post(
  "/admin/kruzhok/:id/approve-enrollment/:memberId",
  protect,
  isAdmin,
  [
    param("id").isString().trim().notEmpty().withMessage("Kruzhok ID is required"),
    param("memberId").isString().trim().notEmpty().withMessage("Member ID is required"),
  ],
  validate,
  async (req, res) => {
    const { id: kruzhokId, memberId } = req.params;

    try {
      const member = await prisma.kruzhokMember.update({
        where: { id: memberId },
        data: {
          enrollmentStatus: "APPROVED",
        },
        include: {
          user: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

      res.json({
        ...member,
        message: "Enrollment request approved",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to approve enrollment" });
    }
  }
);

// POST /api/admin/kruzhok/:id/reject-enrollment/:memberId - Reject enrollment request
router.post(
  "/admin/kruzhok/:id/reject-enrollment/:memberId",
  protect,
  isAdmin,
  [
    param("id").isString().trim().notEmpty().withMessage("Kruzhok ID is required"),
    param("memberId").isString().trim().notEmpty().withMessage("Member ID is required"),
  ],
  validate,
  async (req, res) => {
    const { id: kruzhokId, memberId } = req.params;

    try {
      // Delete the rejected enrollment request
      await prisma.kruzhokMember.delete({
        where: { id: memberId },
      });

      res.json({ message: "Enrollment request rejected and deleted" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to reject enrollment" });
    }
  }
);

// POST /api/admin/kruzhok/:id/enroll - Enroll a user into the Kruzhok (direct admin enrollment)
router.post(
  "/admin/kruzhok/:id/enroll",
  protect,
  isAdmin,
  [
    param("id").isString().trim().notEmpty().withMessage("Kruzhok ID is required"),
    body("userId").isString().trim().notEmpty().withMessage("User ID is required"),
  ],
  validate,
  async (req, res) => {
    const { id: kruzhokId } = req.params;
    const { userId } = req.body;

    try {
      // Check if user is already enrolled
      const existingEnrollment = await prisma.kruzhokMember.findUnique({
        where: {
          kruzhokId_userId: {
            kruzhokId,
            userId,
          },
        },
      });

      if (existingEnrollment) {
        return res.status(409).json({ message: "User is already enrolled in this Kruzhok" });
      }

      const enrollment = await prisma.kruzhokMember.create({
        data: {
          kruzhokId,
          userId,
          enrollmentStatus: "APPROVED", // Direct admin enrollment is auto-approved
        },
        include: {
          user: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });
      res.status(201).json(enrollment);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to enroll user" });
    }
  }
);

// DELETE /api/admin/kruzhok/:kruzhokId/unenroll/:userId - Unenroll a user
router.delete(
  "/admin/kruzhok/:kruzhokId/unenroll/:userId",
  protect,
  isAdmin,
  [
    param("kruzhokId").isString().trim().notEmpty().withMessage("Kruzhok ID is required"),
    param("userId").isString().trim().notEmpty().withMessage("User ID is required"),
  ],
  validate,
  async (req, res) => {
    const { kruzhokId, userId } = req.params;

    try {
      await prisma.kruzhokMember.delete({
        where: {
          kruzhokId_userId: {
            kruzhokId,
            userId,
          },
        },
      });
      res.json({ message: "User successfully unenrolled" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to unenroll user" });
    }
  }
);

// GET /api/admin/kruzhok/:id/members - Get all members of a Kruzhok
router.get(
  "/admin/kruzhok/:id/members",
  protect,
  isAdmin,
  [param("id").isString().trim().notEmpty().withMessage("Kruzhok ID is required")],
  validate,
  async (req, res) => {
    const { id: kruzhokId } = req.params;

    try {
      const members = await prisma.kruzhokMember.findMany({
        where: { kruzhokId },
        include: {
          user: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });
      res.json(members);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  }
);

// POST /api/admin/kruzhok/:id/session - Create a new session for a Kruzhok
router.post(
  "/admin/kruzhok/:id/session",
  protect,
  isAdmin,
  [
    param("id").isString().trim().notEmpty().withMessage("Kruzhok ID is required"),
    body("sessionDate").isISO8601().toDate().withMessage("Valid session date is required"),
    body("topic").optional().isString().trim(),
  ],
  validate,
  async (req, res) => {
    const { id: kruzhokId } = req.params;
    const { sessionDate, topic } = req.body;

    try {
      const session = await (prisma as any).kruzhokSession.upsert({
        where: { kruzhokId_date: { kruzhokId, date: sessionDate } },
        update: { topic: topic ?? undefined },
        create: { kruzhokId, date: sessionDate, topic },
      });
      res.status(201).json(session);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to create session" });
    }
  }
);

// GET /api/admin/kruzhok/:id/sessions - Get all sessions for a Kruzhok
router.get(
  "/admin/kruzhok/:id/sessions",
  protect,
  isAdmin,
  [param("id").isString().trim().notEmpty().withMessage("Kruzhok ID is required")],
  validate,
  async (req, res) => {
    const { id: kruzhokId } = req.params;

    try {
      const sessions = await (prisma as any).kruzhokSession.findMany({
        where: { kruzhokId },
        orderBy: { date: "desc" },
      });
      res.json(sessions);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  }
);

// POST /api/admin/session/:sessionId/attendance - Record attendance for a session
router.post(
  "/admin/session/:sessionId/attendance",
  protect,
  isAdmin,
  [
    param("sessionId").isString().trim().notEmpty().withMessage("Session ID is required"),
    body().isArray().withMessage("Body must be an array of attendance records"),
    body("*.studentId").isString().trim().notEmpty().withMessage("Student ID is required for each record"),
    body("*.present").isBoolean().withMessage("present must be boolean"),
  ],
  validate,
  async (req, res) => {
    const { sessionId } = req.params as any;
    const attendanceRecords = req.body as any[];

    try {
      const results = await prisma.$transaction(
        attendanceRecords.map((record: any) =>
          (prisma as any).kruzhokAttendance.upsert({
            where: { sessionId_extraStudentId: { sessionId, extraStudentId: record.studentId } },
            update: { present: Boolean(record.present), markedAt: new Date() },
            create: { sessionId, extraStudentId: record.studentId, present: Boolean(record.present) },
          })
        )
      );
      res.json({ message: "Attendance recorded successfully", results });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to record attendance" });
    }
  }
);

// GET /api/admin/session/:sessionId/attendance - Get attendance for a session
router.get(
  "/admin/session/:sessionId/attendance",
  protect,
  isAdmin,
  [param("sessionId").isString().trim().notEmpty().withMessage("Session ID is required")],
  validate,
  async (req, res) => {
    const { sessionId } = req.params as any;

    try {
      const attendance = await (prisma as any).kruzhokAttendance.findMany({
        where: { sessionId },
        include: { extraStudent: true },
      });
      const rows = (attendance || []).map((a: any) => ({
        studentId: a.extraStudentId,
        fullName: a.extraStudent?.fullName,
        present: a.present,
        markedAt: a.markedAt,
      }))
      res.json(rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch attendance" });
    }
  }
);

// --- PUBLIC/USER ROUTES ---

// GET / - Get a list of all active Kruzhoks
router.get("/", async (_req, res) => {
  try {
    const kruzhoks = await prisma.kruzhok.findMany({
      where: { isActive: true },
      include: {
        admin: {
          select: { id: true, fullName: true },
        },
        _count: {
          select: { members: true },
        },
      },
    });
    res.json(kruzhoks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch Kruzhoks" });
  }
});

// POST /enroll-by-code - User enrollment using access code
router.post(
  "/enroll-by-code",
  protect,
  [body("accessCode").isString().trim().notEmpty().withMessage("Access code is required")],
  validate,
  async (req, res) => {
    const userId = req.user.id;
    const { accessCode } = req.body;

    try {
      // Find the kruzhok by access code
      const kruzhok = await prisma.kruzhok.findUnique({
        where: { accessCode },
      });

      if (!kruzhok) {
        return res.status(404).json({ message: "Invalid access code" });
      }

      // Check if user is already enrolled
      const existingEnrollment = await prisma.kruzhokMember.findUnique({
        where: {
          kruzhokId_userId: {
            kruzhokId: kruzhok.id,
            userId,
          },
        },
      });

      if (existingEnrollment) {
        return res.status(409).json({
          message: "You are already enrolled in this Kruzhok",
          status: existingEnrollment.enrollmentStatus,
        });
      }

      // Create enrollment request with PENDING status (needs admin approval)
      const enrollment = await prisma.kruzhokMember.create({
        data: {
          kruzhokId: kruzhok.id,
          userId,
          enrollmentStatus: "PENDING", // Pending approval from club owner
        },
        include: {
          kruzhok: {
            select: { id: true, name: true },
          },
        },
      });

      res.status(201).json({
        ...enrollment,
        message: "Enrollment request sent. Waiting for club owner approval.",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to process enrollment request" });
    }
  }
);

// GET /my-clubs - Get a list of clubs the authenticated user is enrolled in
router.get("/my-clubs", protect, async (req, res) => {
  const userId = req.user.id;

  try {
    const enrollments = await prisma.kruzhokMember.findMany({
      where: {
        userId,
        enrollmentStatus: "APPROVED", // Only show approved enrollments
      },
      include: {
        kruzhok: {
          include: {
            admin: {
              select: { id: true, fullName: true },
            },
            _count: {
              select: { members: true },
            },
          },
        },
      },
    });

    const myClubs = enrollments.map((e) => e.kruzhok);
    res.json(myClubs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch user's clubs" });
  }
});

// GET /my-requests - Get user's pending enrollment requests
router.get("/my-requests", protect, async (req, res) => {
  const userId = req.user.id;

  try {
    const requests = await prisma.kruzhokMember.findMany({
      where: {
        userId,
        enrollmentStatus: "PENDING",
      },
      include: {
        kruzhok: {
          select: { id: true, name: true, description: true },
        },
      },
    });

    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch enrollment requests" });
  }
});

// GET /my-attendance - Get the authenticated user's attendance record
router.get("/my-attendance", protect, async (req, res) => {
  const userId = req.user.id;

  try {
    const memberRecords = await prisma.kruzhokMember.findMany({
      where: { userId },
      select: {
        id: true,
        kruzhok: {
          select: { id: true, name: true },
        },
      },
    });

    const memberIds = memberRecords.map((m) => m.id);

    const attendance = await prisma.attendanceRecord.findMany({
      where: {
        memberId: {
          in: memberIds,
        },
      },
      include: {
        session: {
          select: {
            sessionDate: true,
            topic: true,
            kruzhok: {
              select: { name: true, id: true },
            },
          },
        },
      },
      orderBy: {
        recordedAt: "desc",
      },
    });

    const result = attendance.map((record) => ({
      status: record.status,
      notes: record.notes,
      recordedAt: record.recordedAt,
      sessionDate: record.session.sessionDate,
      sessionTopic: record.session.topic,
      kruzhokName: record.session.kruzhok.name,
      kruzhokId: record.session.kruzhok.id,
    }));

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch user's attendance" });
  }
});

// GET /all-user-data - Aggregated data for Kruzhok page
router.get("/all-user-data", protect, async (req, res) => {
  try {
    const userId = req.user.id

    const [allKruzhoks, myApprovedEnrollments, myPendingRequests, subscription] = await Promise.all([
      prisma.kruzhok.findMany({
        where: { isActive: true },
        include: {
          admin: { select: { fullName: true } },
          _count: { select: { members: true } },
        },
      }),
      prisma.kruzhokMember.findMany({
        where: { userId, enrollmentStatus: "APPROVED" },
        include: { kruzhok: { include: { admin: { select: { fullName: true } }, _count: { select: { members: true } } } } },
      }),
      prisma.kruzhokMember.findMany({
        where: { userId, enrollmentStatus: "PENDING" },
        select: { id: true, kruzhokId: true },
      }),
      prisma.subscription.findUnique({ where: { userId } }).catch(() => null as any),
    ])

    const myKruzhoks = myApprovedEnrollments.map((e) => e.kruzhok)
    const canCreateKruzhok = (req.user.role === "ADMIN") || (!!subscription && (subscription as any).status === "ACTIVE")

    res.json({
      myKruzhoks,
      allKruzhoks,
      myRequests: myPendingRequests,
      canCreateKruzhok,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Failed to fetch user data" })
  }
})

// Attendance: list grid data
router.get(
  "/:kruzhokId/attendance",
  protect,
  [
    param("kruzhokId").isString().trim().notEmpty(),
    query("from").optional().isISO8601().toDate(),
    query("to").optional().isISO8601().toDate(),
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { kruzhokId } = req.params as any
      const userId = req.user!.id
      const kruzhok = await prisma.kruzhok.findUnique({ where: { id: kruzhokId } })
      if (!kruzhok) return res.status(404).json({ message: "Kruzhok not found" })
      const isOwner = (kruzhok as any)?.adminId === userId || (kruzhok as any)?.ownerId === userId
      const isAdminUser = req.user!.role === "ADMIN"
      const canView = isOwner || isAdminUser
      if (!canView) {
        const m = await prisma.kruzhokSubscription.findFirst({ where: { kruzhokId, userId } }).catch(() => null as any)
        if (!m) return res.status(403).json({ message: "Forbidden" })
      }

      const fromDate: Date | undefined = (req.query as any).from
      const toDate: Date | undefined = (req.query as any).to
      const whereSession: any = { kruzhokId }
      if (fromDate || toDate) whereSession.date = {}
      if (fromDate) whereSession.date.gte = fromDate
      if (toDate) whereSession.date.lte = toDate

      const [students, sessions] = await Promise.all([
        (prisma as any).kruzhokExtraStudent.findMany({ where: { kruzhokId }, orderBy: { createdAt: "asc" } }),
        (prisma as any).kruzhokSession.findMany({ where: whereSession, orderBy: { date: "asc" } }),
      ])
      const sessionIds = sessions.map((s: any) => s.id)
      const attendance = sessionIds.length
        ? await (prisma as any).kruzhokAttendance.findMany({ where: { sessionId: { in: sessionIds } } })
        : []

      const dates = sessions.map((s: any) => new Date(s.date).toISOString().slice(0, 10))
      const marks: Record<string, Record<string, boolean>> = {}
      for (const st of students) marks[st.id] = {}
      for (const a of attendance as any[]) {
        const ses = sessions.find((s: any) => s.id === a.sessionId)
        if (!ses) continue
        const d = new Date(ses.date).toISOString().slice(0, 10)
        if (!marks[a.extraStudentId]) marks[a.extraStudentId] = {}
        marks[a.extraStudentId][d] = Boolean(a.present)
      }

      res.json({
        students: students.map((s: any) => ({ id: s.id, fullName: s.fullName })),
        dates,
        marks,
      })
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Failed to load attendance" })
    }
  }
)

// Attendance: add student (mentor/admin)
router.post(
  "/:kruzhokId/students",
  protect,
  [param("kruzhokId").isString().trim().notEmpty(), body("fullName").isString().trim().notEmpty()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { kruzhokId } = req.params as any
      const { fullName } = req.body as any
      const kruzhok = await prisma.kruzhok.findUnique({ where: { id: kruzhokId } })
      if (!kruzhok) return res.status(404).json({ message: "Kruzhok not found" })
      const isOwner = (kruzhok as any)?.adminId === req.user!.id || (kruzhok as any)?.ownerId === req.user!.id
      const isAdminUser = req.user!.role === "ADMIN"
      if (!isOwner && !isAdminUser) return res.status(403).json({ message: "Forbidden" })
      const created = await (prisma as any).kruzhokExtraStudent.create({ data: { kruzhokId, fullName } })
      res.status(201).json({ id: created.id, fullName: created.fullName })
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Failed to add student" })
    }
  }
)

// Attendance: add date (session)
router.post(
  "/:kruzhokId/sessions",
  protect,
  [param("kruzhokId").isString().trim().notEmpty(), body("date").isISO8601().toDate(), body("topic").optional().isString()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { kruzhokId } = req.params as any
      const { date, topic } = req.body as any
      const kruzhok = await prisma.kruzhok.findUnique({ where: { id: kruzhokId } })
      if (!kruzhok) return res.status(404).json({ message: "Kruzhok not found" })
      const isOwner = (kruzhok as any)?.adminId === req.user!.id || (kruzhok as any)?.ownerId === req.user!.id
      const isAdminUser = req.user!.role === "ADMIN"
      if (!isOwner && !isAdminUser) return res.status(403).json({ message: "Forbidden" })
      const created = await (prisma as any).kruzhokSession.upsert({
        where: { kruzhokId_date: { kruzhokId, date } },
        update: { topic: topic ?? undefined },
        create: { kruzhokId, date, topic },
      })
      res.status(201).json({ id: created.id, date: created.date, topic: created.topic })
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Failed to add session" })
    }
  }
)

// Attendance: toggle mark
router.post(
  "/:kruzhokId/attendance/toggle",
  protect,
  [param("kruzhokId").isString().trim().notEmpty(), body("studentId").isString().notEmpty(), body("date").isISO8601().toDate()],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { kruzhokId } = req.params as any
      const { studentId, date } = req.body as any
      const kruzhok = await prisma.kruzhok.findUnique({ where: { id: kruzhokId } })
      if (!kruzhok) return res.status(404).json({ message: "Kruzhok not found" })
      const isOwner = (kruzhok as any)?.adminId === req.user!.id || (kruzhok as any)?.ownerId === req.user!.id
      const isAdminUser = req.user!.role === "ADMIN"
      if (!isOwner && !isAdminUser) return res.status(403).json({ message: "Forbidden" })

      const session = await (prisma as any).kruzhokSession.upsert({
        where: { kruzhokId_date: { kruzhokId, date } },
        update: {},
        create: { kruzhokId, date },
      })
      const existing = await (prisma as any).kruzhokAttendance.findUnique({
        where: { sessionId_extraStudentId: { sessionId: session.id, extraStudentId: studentId } },
      }).catch(() => null as any)
      if (!existing) {
        const created = await (prisma as any).kruzhokAttendance.create({
          data: { sessionId: session.id, extraStudentId: studentId, present: true, markedById: req.user!.id },
        })
        return res.status(201).json({ present: created.present })
      }
      const updated = await (prisma as any).kruzhokAttendance.update({
        where: { sessionId_extraStudentId: { sessionId: session.id, extraStudentId: studentId } },
        data: { present: !existing.present, markedById: req.user!.id, markedAt: new Date() },
      })
      res.json({ present: updated.present })
    } catch (error) {
      console.error(error)
      res.status(500).json({ message: "Failed to toggle attendance" })
    }
  }
)

// GET /:id - Kruzhok details (basic)
router.get("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params
    const k = await prisma.kruzhok.findUnique({
      where: { id },
      include: { admin: { select: { fullName: true } } },
    })
    if (!k) return res.status(404).json({ message: "Kruzhok not found" })
    res.json({ id: k.id, name: k.name, description: k.description, accessCode: (k as any).accessCode, admin: k.admin })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Failed to fetch kruzhok" })
  }
})

// GET /:kruzhokId/scheduled-lessons - simplified schedule feed compatible with client
router.get("/:kruzhokId/scheduled-lessons", protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" })
    const { kruzhokId } = req.params as { kruzhokId: string }
    const userId = req.user.id

    // membership/owner/admin check (similar to kruzhok-lessons router)
    const [member, kruzhok] = await Promise.all([
      prisma.kruzhokMember.findUnique({ where: { kruzhokId_userId: { kruzhokId, userId } } }),
      prisma.kruzhok.findUnique({ where: { id: kruzhokId } }),
    ])
    const isOwner = (kruzhok as any)?.adminId === userId
    const isAdmin = req.user.role === "ADMIN"
    if (!member && !isOwner && !isAdmin) return res.status(403).json({ message: "Not a member of this kruzhok" })

    const lessons = await prisma.kruzhokLesson.findMany({
      where: { kruzhokId },
      orderBy: { orderIndex: "asc" },
      include: {
        quizzes: { select: { id: true, isActive: true, title: true } },
        matchingGames: { select: { id: true, isActive: true, title: true } },
      },
    })

    const result = lessons.map((l: any) => ({
      id: l.id,
      title: l.title,
      orderIndex: l.orderIndex ?? 0,
      lessonTemplateId: l.id,
      lessonTemplate: {
        mediaType: l.videoUrl ? "video" : (l.presentationUrl ? "presentation" : "resource"),
        contentUrl: l.videoUrl || l.presentationUrl || null,
        scenarioText: l.content || null,
        quizId: (l.quizzes && l.quizzes.length > 0) ? l.quizzes[0].id : null,
      },
      progress: undefined,
      scheduledDate: new Date().toISOString(),
      isAvailable: true,
    }))
    res.json(result)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Failed to fetch lessons" })
  }
})

// GET /:kruzhokId/lessons/:lessonId - normalized lesson details for client
router.get("/:kruzhokId/lessons/:lessonId", protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" })
    const { kruzhokId, lessonId } = req.params as { kruzhokId: string; lessonId: string }
    const userId = req.user.id

    const [member, lesson, kruzhok] = await Promise.all([
      prisma.kruzhokMember.findUnique({ where: { kruzhokId_userId: { kruzhokId, userId } } }),
      prisma.kruzhokLesson.findUnique({
        where: { id: lessonId },
        include: {
          quizzes: { include: { questions: { orderBy: { orderIndex: "asc" } } } },
          matchingGames: { include: { pairs: { orderBy: { orderIndex: "asc" } } } },
          kruzhok: { select: { adminId: true, accessCode: true } },
        },
      }),
      prisma.kruzhok.findUnique({ where: { id: kruzhokId }, select: { adminId: true, accessCode: true } }),
    ])

    if (!lesson) return res.status(404).json({ message: "Lesson not found" })

    const isOwner = kruzhok?.adminId === userId
    const isAdmin = req.user.role === "ADMIN"
    if (!member && !isOwner && !isAdmin) return res.status(403).json({ message: "Not a member of this kruzhok" })

    const payload = {
      id: lesson.id,
      title: lesson.title,
      lessonTemplate: {
        mediaType: (lesson as any).videoUrl ? "video" : ((lesson as any).presentationUrl ? "presentation" : "resource"),
        contentUrl: (lesson as any).videoUrl || (lesson as any).presentationUrl || null,
        scenarioText: (lesson as any).content || null,
        quizId: (lesson.quizzes && lesson.quizzes.length > 0) ? lesson.quizzes[0].id : null,
      },
      isMentor: isOwner || isAdmin,
      content: (lesson as any).content || null,
      showAccessCode: (lesson as any).showAccessCode || false,
      kruzhok: { accessCode: kruzhok?.accessCode },
      quizzes: lesson.quizzes,
      matchingGames: lesson.matchingGames,
    }

    res.json(payload)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Failed to fetch lesson" })
  }
})

// POST /:kruzhokId/lessons/:lessonId/complete - mark progress
router.post("/:kruzhokId/lessons/:lessonId/complete", protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" })
    const { kruzhokId, lessonId } = req.params as { kruzhokId: string; lessonId: string }
    const userId = req.user.id
    const { watchTimeSeconds } = (req.body || {}) as { watchTimeSeconds?: number }

    const member = await prisma.kruzhokMember.findUnique({ where: { kruzhokId_userId: { kruzhokId, userId } } })
    if (!member) return res.status(403).json({ message: "Not a member of this kruzhok" })

    const progress = await prisma.kruzhokLessonProgress.upsert({
      where: { lessonId_memberId: { lessonId, memberId: member.id } },
      update: { isCompleted: true, completedAt: new Date(), watchTimeSeconds: watchTimeSeconds || 0 },
      create: { lessonId, memberId: member.id, isCompleted: true, completedAt: new Date(), watchTimeSeconds: watchTimeSeconds || 0 },
    })

    res.json(progress)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Failed to mark lesson as complete" })
  }
})

// POST /:kruzhokId/lessons/:lessonId/end - no-op endpoint to signal end of lesson for mentors
router.post("/:kruzhokId/lessons/:lessonId/end", protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" })
    const { kruzhokId } = req.params as { kruzhokId: string }
    const userId = req.user.id
    const k = await prisma.kruzhok.findUnique({ where: { id: kruzhokId } })
    const isOwner = k?.adminId === userId
    const isAdmin = req.user.role === "ADMIN"
    if (!isOwner && !isAdmin) return res.status(403).json({ message: "Forbidden" })
    res.json({ ok: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Failed to end lesson" })
  }
});
