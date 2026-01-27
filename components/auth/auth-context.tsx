"use client"
import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { apiFetch, clearTokens, getTokens, setTokens } from "@/lib/api"

export type Role = "user" | "student" | "parent" | "mentor" | "admin"
export interface User {
  id: string
  email: string
  fullName?: string
  role: Role
  level?: number
  xp?: number
  educationalInstitution?: string
  primaryRole?: string
  age?: number
}

function mapBackendRoleToAppRole(role: string, primaryRole?: string): Role {
  const r = String(role || "").toUpperCase()
  if (r === "ADMIN") return "admin"
  if (r === "MENTOR") return "mentor"
  if (r === "PARENT") return "parent"
  if (r === "STUDENT") return "student"
  if (r === "USER" || r === "GUEST") {
    const p = String(primaryRole || "").toLowerCase()
    if (p === "mentor") return "mentor"
    if (p === "parent") return "parent"
    if (p === "student") return "student"
    return "user"
  }
  return "user"
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  register: (email: string, password: string, remember?: boolean) => Promise<void>
  login: (email: string, password: string, remember?: boolean) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (patch: Partial<User> & { institution?: string; primaryRole?: string; age?: number }) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const tokens = getTokens()
    if (!tokens) { setLoading(false); return }
    apiFetch<{ id: string; email: string; role: "USER" | "STUDENT" | "PARENT" | "MENTOR" | "ADMIN" | "GUEST"; fullName?: string; xp?: number; educationalInstitution?: string; primaryRole?: string; age?: number }>("/auth/me")
      .then((u) => {
        const appRole = mapBackendRoleToAppRole(u.role, u.primaryRole)
        setUser({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          role: appRole,
          level: 1,
          xp: typeof u.xp === 'number' ? u.xp : 0,
          educationalInstitution: u.educationalInstitution,
          primaryRole: u.primaryRole,
          age: typeof u.age === 'number' ? u.age : undefined,
        })
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const registerFn = async (email: string, password: string, remember = true) => {
    const body = { email, password, fullName: email }
    const data = await apiFetch<{ accessToken: string; refreshToken: string; user: { id: string; email: string; role: "USER" | "STUDENT" | "PARENT" | "MENTOR" | "ADMIN" | "GUEST"; fullName?: string; xp?: number; educationalInstitution?: string; primaryRole?: string; age?: number } }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(body) }
    )
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
    const appRole = mapBackendRoleToAppRole(data.user.role, data.user.primaryRole)
    setUser({ 
      id: data.user.id, 
      email: data.user.email, 
      fullName: data.user.fullName, 
      role: appRole, 
      level: 1, 
      xp: typeof data.user.xp === 'number' ? data.user.xp : 0,
      educationalInstitution: data.user.educationalInstitution,
      primaryRole: data.user.primaryRole,
      age: typeof data.user.age === 'number' ? data.user.age : undefined,
    })
  }

  const loginFn = async (email: string, password: string, remember = true) => {
    const body = { email, password }
    const data = await apiFetch<{ accessToken: string; refreshToken: string; user: { id: string; email: string; role: "USER" | "STUDENT" | "PARENT" | "MENTOR" | "ADMIN" | "GUEST"; fullName?: string; xp?: number; educationalInstitution?: string; primaryRole?: string; age?: number } }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify(body) }
    )
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
    const appRole = mapBackendRoleToAppRole(data.user.role, data.user.primaryRole)
    setUser({ 
      id: data.user.id, 
      email: data.user.email, 
      fullName: data.user.fullName, 
      role: appRole, 
      level: 1, 
      xp: typeof data.user.xp === 'number' ? data.user.xp : 0,
      educationalInstitution: data.user.educationalInstitution,
      primaryRole: data.user.primaryRole,
      age: typeof data.user.age === 'number' ? data.user.age : undefined,
    })
  }

  const logoutFn = async () => {
    try {
      const t = getTokens()
      if (t?.refreshToken) {
        await fetch("/auth/logout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ refreshToken: t.refreshToken }),
        }).catch(() => null)
      }
    } finally {
      setUser(null)
      clearTokens()
    }
  }

  const updateProfileFn = async (patch: Partial<User> & { institution?: string; primaryRole?: string; age?: number }) => {
    if (!user) return
    try {
      const body: any = {
        fullName: patch.fullName,
        educationalInstitution: patch.institution || patch.educationalInstitution,
        primaryRole: patch.primaryRole,
        age: typeof patch.age === 'number' ? patch.age : undefined,
      }
      const updated = await apiFetch<{ id: string; email: string; role: "USER" | "STUDENT" | "PARENT" | "MENTOR" | "ADMIN" | "GUEST"; fullName?: string; educationalInstitution?: string; primaryRole?: string; age?: number }>(
        "/auth/me",
        { method: "PUT", body: JSON.stringify(body) }
      )
      setUser({ 
        ...user, 
        fullName: updated.fullName ?? user.fullName,
        educationalInstitution: updated.educationalInstitution ?? user.educationalInstitution,
        primaryRole: updated.primaryRole ?? user.primaryRole,
        age: typeof updated.age === 'number' ? updated.age : user.age,
      })
    } catch {
    }
  }

  const value = useMemo<AuthContextValue>(() => ({ user, loading, register: registerFn, login: loginFn, logout: logoutFn, updateProfile: updateProfileFn }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth должен использоваться внутри AuthProvider")
  return ctx
}
