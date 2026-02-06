import type { Request } from "express"

export type AppRole = "USER" | "STUDENT" | "PARENT" | "MENTOR" | "ADMIN" | "GUEST"

export type AuthenticatedRequest = Request & {
  user?: {
    id: string
    role: AppRole
    fullName?: string
    email?: string
    permissions?: string[]
  }
}
