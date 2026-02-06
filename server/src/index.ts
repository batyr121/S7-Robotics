import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import cookieParser from "cookie-parser"
import path from "path"
import { env } from "./env"
import { prisma } from "./db"
import { router as authRouter } from "./routes/auth"
import { router as adminRouter } from "./routes/admin"
import { router as eventsRouter } from "./routes/events"
import { router as bytesizeRouter } from "./routes/bytesize"
import { router as uploadRouter } from "./routes/uploads"
import { router as newsRouter } from "./routes/news"
import { router as programsRouter } from "./routes/programs"
import { router as subscriptionsRouter } from "./routes/subscriptions"
import { router as certificatesRouter } from "./routes/certificates"
import { router as parentRouter } from "./routes/parent"
import { router as mentorRouter } from "./routes/mentor"
import { router as shopRouter } from "./routes/shop"
import { salaryRouter } from "./routes/salaries"
import { router as attendanceRouter } from "./routes/attendance"
import { router as attendanceLiveRouter } from "./routes/attendance-live"
import { router as notificationsRouter } from "./routes/notifications"
import { router as reviewsRouter } from "./routes/reviews"
import { router as studentRouter } from "./routes/student"
import { router as promotionsRouter } from "./routes/promotions"
import { router as pushRouter } from "./routes/push"
import { ensureDir } from "./utils/fs"
import { startSubscriptionReminderJob } from "./jobs/subscription-reminders"

const app = express()

app.use(helmet())
app.use(cookieParser())
app.use(express.json({ limit: "100mb" }))
app.use(express.urlencoded({ extended: false }))
const corsOrigin = env.CORS_ORIGIN
  ? env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
  : true
app.use(
  cors({
    origin: corsOrigin as any,
    credentials: true,
  })
)
app.set("trust proxy", 1)
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
)

ensureDir(env.MEDIA_DIR).catch((err) => console.error("Failed to ensure media dir", err))
app.use("/media", express.static(path.resolve(env.MEDIA_DIR)))
app.use("/api/media", express.static(path.resolve(env.MEDIA_DIR)))

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: "ok" })
  } catch (error) {
    res.status(500).json({ status: "error", error: String(error) })
  }
})

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: "ok" })
  } catch (error) {
    res.status(500).json({ status: "error", error: String(error) })
  }
})

app.use("/auth", authRouter)
app.use("/api/auth", authRouter)
app.use("/api/admin", adminRouter)
app.use("/events", eventsRouter)
app.use("/api/events", eventsRouter)
app.use("/bytesize", bytesizeRouter)
app.use("/api/bytesize", bytesizeRouter)
app.use("/uploads", uploadRouter)
app.use("/api/uploads", uploadRouter)
app.use("/news", newsRouter)
app.use("/api/news", newsRouter)
app.use("/api/programs", programsRouter)
app.use("/api/subscriptions", subscriptionsRouter)
app.use("/api/certificates", certificatesRouter)
app.use("/api/parent", parentRouter)
app.use("/api/mentor", mentorRouter)
app.use("/api/shop", shopRouter)
app.use("/api/salaries", salaryRouter)
app.use("/api/attendance", attendanceRouter)
app.use("/api/attendance-live", attendanceLiveRouter)
app.use("/api/notifications", notificationsRouter)
app.use("/api/reviews", reviewsRouter)
app.use("/api/student", studentRouter)
app.use("/api/promotions", promotionsRouter)
app.use("/api/push", pushRouter)

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" })
})

startSubscriptionReminderJob()

app.listen(env.PORT, () => {
  console.log(`Backend listening on port ${env.PORT}`)
})
