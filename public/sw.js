self.addEventListener("push", (event) => {
  let payload = { title: "Notification", body: "" }
  try {
    if (event.data) {
      const data = event.data.json()
      payload = {
        title: data.title || payload.title,
        body: data.body || payload.body
      }
    }
  } catch {
    try {
      const text = event.data ? event.data.text() : ""
      payload.body = text || payload.body
    } catch {}
  }

  const options = {
    body: payload.body,
    icon: "/logo-s7.png",
    badge: "/logo-s7.png"
  }

  event.waitUntil(self.registration.showNotification(payload.title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      if (clientsArr.length > 0) {
        return clientsArr[0].focus()
      }
      return self.clients.openWindow("/")
    })
  )
})
