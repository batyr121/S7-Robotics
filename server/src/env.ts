import "dotenv/config"
import { z } from "zod"

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  APP_SECRET: z.string().min(16),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MEDIA_DIR: z.string().default("./media"),
  CORS_ORIGIN: z.string().optional(),
  EMAIL_PASSWORD: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
})

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  APP_SECRET: process.env.APP_SECRET,
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  MEDIA_DIR: process.env.MEDIA_DIR,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT,
})
