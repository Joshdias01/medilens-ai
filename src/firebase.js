import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// ─── FCM MESSAGING ────────────────────────────────────────────────────────────
// VAPID key from Firebase Console → Project Settings → Cloud Messaging → Web Push Certificates
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''

// ─── REGISTER THE SERVICE WORKER (called once at app startup) ─────────────────
// We pre-register the SW early and cache the promise so that getOrSaveFcmToken
// can simply await it rather than triggering a second registration race.
let _swRegistrationPromise = null

export const registerFcmServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null)
  if (_swRegistrationPromise) return _swRegistrationPromise

  _swRegistrationPromise = navigator.serviceWorker
    .register('/firebase-messaging-sw.js', { scope: '/' })
    .then(reg => {
      console.log('[FCM SW] Registered:', reg.scope)
      return reg
    })
    .catch(err => {
      console.warn('[FCM SW] Registration failed:', err.message)
      return null
    })

  return _swRegistrationPromise
}

// ─── GET / SAVE FCM TOKEN ─────────────────────────────────────────────────────
// Gets an FCM push token for the current device and saves it to Firestore.
// Uses arrayUnion so multiple devices (PC + phone) each keep their own token.
export const getOrSaveFcmToken = async (userId) => {
  try {
    const supported = await isSupported()
    if (!supported) {
      console.warn('[FCM] Not supported in this browser.')
      return null
    }

    if (!VAPID_KEY) {
      console.warn('[FCM] VITE_FIREBASE_VAPID_KEY is not set in .env')
      return null
    }

    // Wait for the SW that was registered at startup.
    // If it wasn't registered yet for some reason, register it now.
    const swReg = await registerFcmServiceWorker()
    if (!swReg) {
      console.warn('[FCM] Service worker could not be registered — notifications will not work.')
      return null
    }

    // Ensure the SW is fully active before calling getToken
    // (avoids "no active service worker" error on first load / mobile)
    if (swReg.installing || swReg.waiting) {
      await new Promise(resolve => {
        const sw = swReg.installing || swReg.waiting
        sw.addEventListener('statechange', function handler() {
          if (sw.state === 'activated') {
            sw.removeEventListener('statechange', handler)
            resolve()
          }
        })
        // Fallback timeout — don't block forever
        setTimeout(resolve, 5000)
      })
    }

    const messaging = getMessaging(app)
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg
    })

    if (!token) {
      console.warn('[FCM] getToken returned empty — check VAPID key in .env (.env must start with VITE_)')
      return null
    }

    console.log('[FCM] Token obtained:', token.slice(0, 20) + '...')

    // Save token to Firestore with arrayUnion (supports multiple devices)
    await updateDoc(doc(db, 'users', userId), {
      fcmTokens: arrayUnion(token),
      remindersEnabled: true,
      fcmUpdatedAt: new Date().toISOString()
    })

    return token
  } catch (err) {
    console.warn('[FCM] getOrSaveFcmToken error:', err.message)
    return null
  }
}

export const getMessagingInstance = async () => {
  try {
    const supported = await isSupported()
    if (!supported) return null
    return getMessaging(app)
  } catch { return null }
}