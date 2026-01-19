import { redirect } from "next/navigation"

export default function SchedulePage() {
  redirect("/dashboard?tab=schedule")
}
