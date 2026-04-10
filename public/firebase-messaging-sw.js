// ─── FIREBASE MESSAGING SERVICE WORKER ───────────────────────────────────────
// This file MUST be at the root URL: /firebase-messaging-sw.js
// It handles FCM push notifications when the browser tab is closed.
// Firebase SDK version must match what you use in the main app.

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey:            'AIzaSyBrw5PB8aQCWwQ6k023X71cp3AKLH5jUVM',
  authDomain:        'medilens-ai-c5afc.firebaseapp.com',
  projectId:         'medilens-ai-c5afc',
  storageBucket:     'medilens-ai-c5afc.firebasestorage.app',
  messagingSenderId: '681571207260',
  appId:             '1:681571207260:web:0416f047cb3c368543fe99',
})

const messaging = firebase.messaging()

// ─── BACKGROUND MESSAGE HANDLER ───────────────────────────────────────────────
// Fires when a push arrives and the app is in the background or closed.
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload)

  const { title, body, icon, badge, tag, data } = payload.notification ?? payload.data ?? {}

  const notificationTitle = title || '⚠️ MediLens Health Reminder'
  const notificationOptions = {
    body:  body  || 'You have a new health update. Tap to view.',
    icon:  icon  || '/favicon.ico',
    badge: badge || '/favicon.ico',
    tag:   tag   || 'medilens-reminder',
    requireInteraction: false,
    data: data || {},
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

// ─── NOTIFICATION CLICK → OPEN THE APP ────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow('/')
      }
    })
  )
})
