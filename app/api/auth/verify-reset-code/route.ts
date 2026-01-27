import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const body = await request.json()

  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001"

  try {
    const response = await fetch(`${backendUrl}/auth/verify-reset-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Не удалось подключиться к сервису аутентификации" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
  }
}
