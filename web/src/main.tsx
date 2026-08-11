import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

/**
 * Keep the installed app on the current build.
 *
 * An iPhone home screen app is resumed far more often than it is launched, and
 * on a resume nothing goes looking for a new service worker: the phone can sit
 * on an old bundle for days, which looks exactly like a feature that was never
 * shipped. Checking on every wake, and applying the update the moment one is
 * found, is what stops that.
 */
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateSW(true)
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => void registration.update()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
    window.setInterval(check, 30 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
