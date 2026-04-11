import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerFcmServiceWorker } from './firebase.js'

// Pre-register the Firebase Messaging service worker as early as possible.
// This prevents the "no active service worker" race condition on mobile Chrome
// and speeds up FCM token retrieval when the user enables notifications.
registerFcmServiceWorker()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
