import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

if (
  import.meta.env.PROD &&
  window.isSecureContext &&
  (location.protocol === 'https:' || location.protocol === 'http:')
) {
  registerSW({
    immediate: true,
    onRegisterError(error) {
      console.error('Unable to register the offline app worker', error)
    },
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
