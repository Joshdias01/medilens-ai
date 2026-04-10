import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBrw5PB8aQCWwQ6k023X71cp3AKLH5jUVM",
  authDomain: "medilens-ai-c5afc.firebaseapp.com",
  projectId: "medilens-ai-c5afc",
  storageBucket: "medilens-ai-c5afc.firebasestorage.app",
  messagingSenderId: "681571207260",
  appId: "1:681571207260:web:0416f047cb3c368543fe99"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// ─── FCM MESSAGING ────────────────────────────────────────────────────────────
// Your VAPID key — get this from:
// Firebase Console → Project Settings → Cloud Messaging → Web Push Certificates → Generate key pair
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''

// Get the FCM push token and save it to the user's Firestore document
export const getOrSaveFcmToken = async (userId) => {
  try {
    const supported = await isSupported()
    if (!supported) return null

    // Register the SW (no-op if already registered)
    navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })

    // Wait until the service worker is fully active before calling getToken()
    // This prevents "Subscription failed - no active Service Worker" errors
    const swReg = await navigator.serviceWorker.ready

    const messaging = getMessaging(app)
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg
    })
    if (!token) {
      console.warn('FCM: getToken returned empty — check VAPID key in .env')
      return null
    }

    // Use arrayUnion so multiple devices (PC + phone) all get notifications
    // without overwriting each other's token
    await updateDoc(doc(db, 'users', userId), {
      fcmTokens: arrayUnion(token),
      remindersEnabled: true,
      fcmUpdatedAt: new Date().toISOString()
    })

    return token
  } catch (err) {
    console.warn('FCM token error:', err.message)
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