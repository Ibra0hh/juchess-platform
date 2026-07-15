import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

const routerBase = import.meta.env.VITE_ROUTER_BASE || import.meta.env.BASE_URL

function syncPhoneDesktopMode() {
  const layoutWidth = window.innerWidth
  const physicalShortSide = Math.min(window.screen.width, window.screen.height)
  const isTouchDesktopViewport =
    layoutWidth >= 900 &&
    layoutWidth <= 1100 &&
    navigator.maxTouchPoints > 0 &&
    window.matchMedia('(pointer: coarse)').matches
  const isPhoneDesktopMode =
    layoutWidth >= 900 && (physicalShortSide <= 600 || isTouchDesktopViewport)
  const root = document.documentElement

  if (!isPhoneDesktopMode) {
    delete root.dataset.phoneDesktopMode
    root.style.removeProperty('--phone-desktop-zoom')
    return
  }

  const densityAdjustedWidth = layoutWidth / Math.max(1, window.devicePixelRatio)
  const phoneWidth = Math.max(320, Math.min(window.screen.width, densityAdjustedWidth))
  const zoom = Math.min(2.75, Math.max(1, layoutWidth / phoneWidth))
  root.dataset.phoneDesktopMode = 'true'
  root.style.setProperty('--phone-desktop-zoom', String(zoom))
}

syncPhoneDesktopMode()
window.addEventListener('resize', syncPhoneDesktopMode, { passive: true })
window.addEventListener('orientationchange', syncPhoneDesktopMode, { passive: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={routerBase}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
