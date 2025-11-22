"use client"

const ACCESS_TOKEN_KEY = "s7.accessToken"
const REFRESH_TOKEN_KEY = "s7.refreshToken"

export type Tokens = { accessToken: string; refreshToken: string }

export function getTokens(): Tokens | null {
  try {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (accessToken && refreshToken) return { accessToken, refreshToken }
    const cookieMap = getCookieMap()
    const ca = cookieMap[ACCESS_TOKEN_KEY]
    const cr = cookieMap[REFRESH_TOKEN_KEY]
    if (ca && cr) return { accessToken: ca, refreshToken: cr }
    return null
  } catch {
    return null
  }
}

export function setTokens(t: Tokens) {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, t.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, t.refreshToken)
    setCookie(ACCESS_TOKEN_KEY, t.accessToken, 30)
    setCookie(REFRESH_TOKEN_KEY, t.refreshToken, 30)
  } catch {}
}

export function clearTokens() {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    deleteCookie(ACCESS_TOKEN_KEY)
    deleteCookie(REFRESH_TOKEN_KEY)
  } catch {}
}

function getCookieMap(): Record<string, string> {
  try {
    return document.cookie
      .split(";")
      .map((v) => v.trim())
      .filter(Boolean)
      .reduce((acc: Record<string, string>, pair) => {
        const idx = pair.indexOf("=")
        if (idx === -1) return acc
        const k = decodeURIComponent(pair.slice(0, idx))
        const val = decodeURIComponent(pair.slice(idx + 1))
        acc[k] = val
        return acc
      }, {})
  } catch {
    return {}
  }
}

function setCookie(name: string, value: string, days: number) {
  try {
    const d = new Date()
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000)
    const expires = `expires=${d.toUTCString()}`
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; ${expires}; path=/; SameSite=Lax`
  } catch {}
}

function deleteCookie(name: string) {
  try {
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`
  } catch {}
}

async function refreshTokens(currentRefresh: string): Promise<Tokens | null> {
  try {
    const apiUrl = typeof window !== 'undefined' && (window as any).ENV_API_URL 
      ? (window as any).ENV_API_URL 
      : (process.env.NEXT_PUBLIC_API_URL || '')
    
    const authPath = apiUrl ? `${apiUrl}/auth/refresh` : "/auth/refresh"
    const fallbackPath = apiUrl ? `${apiUrl}/api/auth/refresh` : "/api/auth/refresh"
    
    let res = await fetch(authPath, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: currentRefresh }),
    })
    if (!res.ok) {
      res = await fetch(fallbackPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: currentRefresh }),
      })
      if (!res.ok) return null
    }
    const data = (await res.json()) as { accessToken: string; refreshToken: string }
    setTokens(data)
    return data
  } catch {
    return null
  }
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const tokens = getTokens()
  const headers = new Headers(init.headers || {})
  if (!headers.has("content-type") && init.body) headers.set("content-type", "application/json")
  if (tokens?.accessToken) headers.set("authorization", `Bearer ${tokens.accessToken}`)
  if (!headers.has("cache-control")) headers.set("cache-control", "no-cache")

  // Используем NEXT_PUBLIC_API_URL если он указан, иначе относительный путь (для dev с rewrites)
  const apiUrl = typeof window !== 'undefined' && (window as any).ENV_API_URL 
    ? (window as any).ENV_API_URL 
    : (process.env.NEXT_PUBLIC_API_URL || '')
  const resolvePath = (p: string) => {
    if (apiUrl) return `${apiUrl}${p}`
    if (p.startsWith('/api/')) return p
    // Auto-prefix for backend routes when no NEXT_PUBLIC_API_URL is set
    const needsPrefix = ['/auth', '/courses', '/uploads', '/media', '/teams', '/events', '/news', '/programs', '/achievements', '/submissions', '/clubs', '/bytesize', '/kruzhok']
    if (needsPrefix.some(prefix => p.startsWith(prefix))) {
      return `/api${p}`
    }
    return p
  }
  const fullPath = resolvePath(path)

  const doFetch = async (): Promise<Response> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout
    try {
      const response = await fetch(fullPath, { ...init, headers, cache: "no-store", signal: controller.signal })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  let res = await doFetch()
  if (res.status === 401 && tokens?.refreshToken) {
    const newTokens = await refreshTokens(tokens.refreshToken)
    if (newTokens) {
      headers.set("authorization", `Bearer ${newTokens.accessToken}`)
      res = await doFetch()
    }
  }
  
  // Enhanced error handling with structured error format support
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    let errorData: any = null
    let msg = text
    
    try {
      errorData = JSON.parse(text)
      // Check if it's a structured error with fields
      if (errorData.fields || errorData.code) {
        // Preserve the full error object for frontend handling
        const error: any = new Error(errorData.message || errorData.error || `HTTP ${res.status}`)
        error.fields = errorData.fields
        error.code = errorData.code
        error.status = res.status
        throw error
      }
      msg = errorData.error || errorData.message || errorData.reason || text
    } catch (parseError) {
      // If parsing failed but it's the structured error we created above, rethrow it
      if (parseError instanceof Error && (parseError as any).fields) {
        throw parseError
      }
      // Otherwise use the text as message
      msg = text || `HTTP ${res.status}: ${res.statusText}`
    }
    
    // For errors 5xx add user-friendly message
    if (res.status >= 500) {
      msg = "Сервер временно недоступен. Пожалуйста, попробуйте позже."
    }
    
    // For 404 errors
    if (res.status === 404) {
      msg = "Запрашиваемый ресурс не найден."
    }
    
    // For 403 errors
    if (res.status === 403) {
      msg = "У вас недостаточно прав для выполнения этого действия."
    }
    
    // For 401 errors
    if (res.status === 401) {
      msg = "Ваша сессия истекла. Пожалуйста, войдите в систему снова."
    }
    
    // For 400 errors - keep original message if present
    if (res.status === 400 && !msg) {
      msg = "Некорректные данные. Проверьте введённую информацию."
    }
    
    // For network errors
    if (res.status === 0) {
      msg = "Проблемы с подключением к серверу. Проверьте ваше интернет-соединение."
    }
    
    const error: any = new Error(msg || `Ошибка сервера (${res.status})`)
    error.status = res.status
    throw error
  }
  return (await res.json()) as T
}
