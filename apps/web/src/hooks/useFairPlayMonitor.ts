import { useCallback, useEffect, useRef } from 'react'
import {
  recordHostedFairPlayEvent,
  type FairPlayEventType,
} from '../lib/onlineTournament'

const SESSION_KEY = 'juchess:fair-play-session'

export function getFairPlaySessionId() {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const created = crypto.randomUUID()
    window.sessionStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

export function useFairPlayMonitor(gameId: string | null, active: boolean) {
  const hiddenAtRef = useRef<number | null>(null)
  const blurredAtRef = useRef<number | null>(null)
  const wasFullscreenRef = useRef(Boolean(document.fullscreenElement))

  const send = useCallback((
    eventType: FairPlayEventType,
    durationMs = 0,
    metadata?: Record<string, unknown>,
  ) => {
    if (!active || !gameId) return
    void recordHostedFairPlayEvent(gameId, eventType, getFairPlaySessionId(), {
      durationMs,
      metadata,
    }).catch(() => {
      // Fair-play telemetry is best effort and must never interrupt the board.
    })
  }, [active, gameId])

  useEffect(() => {
    if (!active || !gameId) return
    send('heartbeat', 0, {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      visibility: document.visibilityState,
    })

    const heartbeat = window.setInterval(() => send('heartbeat'), 15_000)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        send('tabHidden')
      } else {
        const duration = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0
        hiddenAtRef.current = null
        send('tabVisible', duration)
      }
    }
    const onBlur = () => {
      blurredAtRef.current = Date.now()
      send('windowBlur')
    }
    const onFocus = () => {
      const duration = blurredAtRef.current ? Date.now() - blurredAtRef.current : 0
      blurredAtRef.current = null
      send('windowFocus', duration)
    }
    const onFullscreenChange = () => {
      const fullscreen = Boolean(document.fullscreenElement)
      if (wasFullscreenRef.current && !fullscreen) send('fullscreenExit')
      wasFullscreenRef.current = fullscreen
    }
    const onOffline = () => send('disconnect')
    const onOnline = () => send('reconnect')

    document.addEventListener('visibilitychange', onVisibilityChange)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [active, gameId, send])
}
