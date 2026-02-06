import { prisma } from "../db"

const db = prisma as any

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000
const DEFAULT_LOOKAHEAD_DAYS = 7

const toAmount = (value: any) => {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value) || 0
  if (value && typeof value.toNumber === "function") return value.toNumber()
  if (value && typeof value.toString === "function") return Number(value.toString()) || 0
  return 0
}

const formatCurrency = (amount: number, currency = "KZT") => {
  const label = currency === "KZT" ? "тг" : currency
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount || 0)} ${label}`
}

const getIntervalMs = () => {
  const raw = Number(process.env.SUBSCRIPTION_REMINDER_JOB_INTERVAL_MS || "")
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_INTERVAL_MS
  return raw
}

const getLookaheadDays = () => {
  const raw = Number(process.env.SUBSCRIPTION_REMINDER_LOOKAHEAD_DAYS || "")
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LOOKAHEAD_DAYS
  return Math.floor(raw)
}

type ReminderSubscription = {
  id: string
  parentId: string
  amount: any
  currency?: string | null
  endDate: Date
  student?: { fullName?: string | null } | null
}

const getDaysLeft = (endDate: Date, now: Date) =>
  Math.max(1, Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))

const pluralizeRu = (count: number, one: string, few: string, many: string) => {
  const n = Math.abs(count) % 100
  const n1 = n % 10
  if (n > 10 && n < 20) return many
  if (n1 > 1 && n1 < 5) return few
  if (n1 === 1) return one
  return many
}

const getStudentName = (subscription: ReminderSubscription) =>
  subscription.student?.fullName?.trim() || "ваш ребенок"

const buildSingleReminderMessage = (subscription: ReminderSubscription, now: Date) => {
  const daysLeft = getDaysLeft(subscription.endDate, now)
  const amountLabel = formatCurrency(toAmount(subscription.amount), subscription.currency || "KZT")
  const endDateLabel = subscription.endDate.toLocaleDateString("ru-RU")
  const studentName = getStudentName(subscription)
  return `Через ${daysLeft} дн. истекает абонемент для ${studentName}. Сумма к оплате: ${amountLabel}. Дата окончания: ${endDateLabel}.`
}

const buildMultiReminderMessage = (
  subscriptions: ReminderSubscription[],
  now: Date,
  lookaheadDays: number
) => {
  const count = subscriptions.length
  const subscriptionWord = pluralizeRu(count, "абонемент", "абонемента", "абонементов")
  const details = subscriptions
    .map((subscription) => {
      const daysLeft = getDaysLeft(subscription.endDate, now)
      const amountLabel = formatCurrency(toAmount(subscription.amount), subscription.currency || "KZT")
      const endDateLabel = subscription.endDate.toLocaleDateString("ru-RU")
      const studentName = getStudentName(subscription)
      return `${studentName}: через ${daysLeft} дн., ${amountLabel}, до ${endDateLabel}`
    })
    .join("; ")

  return `В ближайшие ${lookaheadDays} дн. истекают ${count} ${subscriptionWord} для ваших детей: ${details}.`
}

export async function runSubscriptionReminderJobOnce() {
  const now = new Date()
  const lookaheadDays = getLookaheadDays()
  const reminderCutoff = new Date(now)
  reminderCutoff.setDate(reminderCutoff.getDate() + lookaheadDays)

  const subscriptions = await db.parentSubscription.findMany({
    where: {
      status: "ACTIVE",
      endDate: { gte: now, lte: reminderCutoff },
      reminderSentAt: null
    },
    include: {
      student: { select: { fullName: true } }
    },
    orderBy: { endDate: "asc" },
    take: 500
  })

  if (!subscriptions || subscriptions.length === 0) return

  const markedSubscriptions: ReminderSubscription[] = []

  for (const subscription of subscriptions) {
    const endDate = subscription.endDate ? new Date(subscription.endDate) : null
    if (!endDate) continue

    // Cross-instance deduplication: only one worker updates reminderSentAt from null.
    const marked = await db.parentSubscription.updateMany({
      where: { id: subscription.id, reminderSentAt: null },
      data: { reminderSentAt: now }
    })
    if (!marked?.count) continue

    markedSubscriptions.push({
      ...subscription,
      endDate
    })
  }

  if (markedSubscriptions.length === 0) return

  const subscriptionsByParent = new Map<string, ReminderSubscription[]>()
  for (const subscription of markedSubscriptions) {
    const list = subscriptionsByParent.get(subscription.parentId) || []
    list.push(subscription)
    subscriptionsByParent.set(subscription.parentId, list)
  }

  for (const [parentId, parentSubscriptions] of subscriptionsByParent.entries()) {
    const sortedSubscriptions = [...parentSubscriptions].sort(
      (a, b) => a.endDate.getTime() - b.endDate.getTime()
    )
    const isMulti = sortedSubscriptions.length > 1
    const title = isMulti ? "Скоро продление абонементов" : "Скоро продление абонемента"
    const message = isMulti
      ? buildMultiReminderMessage(sortedSubscriptions, now, lookaheadDays)
      : buildSingleReminderMessage(sortedSubscriptions[0], now)
    const subscriptionIds = sortedSubscriptions.map((s) => s.id)
    const metadata = isMulti
      ? { subscriptionIds }
      : { subscriptionId: subscriptionIds[0] }

    await db.notification.create({
      data: {
        userId: parentId,
        title,
        message,
        type: "subscription_reminder",
        metadata
      }
    }).catch(async () => {
      // Roll back markers so reminders can be retried on next run.
      await db.parentSubscription.updateMany({
        where: { id: { in: subscriptionIds }, reminderSentAt: now },
        data: { reminderSentAt: null }
      }).catch(() => null)
    })
  }
}

let reminderTimer: NodeJS.Timeout | null = null

export function startSubscriptionReminderJob() {
  if (reminderTimer) return
  const intervalMs = getIntervalMs()

  const run = async () => {
    try {
      await runSubscriptionReminderJobOnce()
    } catch (error) {
      console.error("[subscription-reminders] job failed:", error)
    }
  }

  run().catch(() => null)
  reminderTimer = setInterval(() => {
    run().catch(() => null)
  }, intervalMs)
}
