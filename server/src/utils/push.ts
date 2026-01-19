import webpush from "web-push"
import { env } from "../env"
import { prisma } from "../db"

const db = prisma as any

let configured = false
let configFailed = false

function ensureConfig() {
    if (configured || configFailed) return
    const publicKey = env.VAPID_PUBLIC_KEY
    const privateKey = env.VAPID_PRIVATE_KEY
    const subject = env.VAPID_SUBJECT || "mailto:support@s7robotics.local"
    if (!publicKey || !privateKey) {
        configFailed = true
        return
    }
    webpush.setVapidDetails(subject, publicKey, privateKey)
    configured = true
}

export function getVapidPublicKey(): string | null {
    return env.VAPID_PUBLIC_KEY || null
}

export async function sendPushToUser(userId: string, payload: { title: string; body: string }) {
    ensureConfig()
    if (!configured) return
    const subscriptions = await db.pushSubscription.findMany({
        where: { userId }
    }).catch(() => [])

    if (!subscriptions || subscriptions.length === 0) return

    const failedEndpoints: string[] = []
    await Promise.all(
        subscriptions.map(async (sub: any) => {
            try {
                await webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.p256dh, auth: sub.auth }
                    },
                    JSON.stringify(payload)
                )
            } catch (err: any) {
                const status = err?.statusCode || err?.status || 0
                if (status === 404 || status === 410) {
                    failedEndpoints.push(sub.endpoint)
                }
            }
        })
    )

    if (failedEndpoints.length > 0) {
        await db.pushSubscription.deleteMany({
            where: { userId, endpoint: { in: failedEndpoints } }
        }).catch(() => {})
    }
}
