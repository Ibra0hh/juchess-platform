import { useEffect, useState } from 'react'

const STORAGE_KEY = 'juchess:online-tournament-play-lock'
const LOCK_DURATION_MS = 24 * 60 * 60 * 1000
const subscribers = new Set<() => void>()

export type OnlineTournamentPlayLock = {
  expiresAt: number
  gameId: string
}

export function getOnlineTournamentPlayLock(): OnlineTournamentPlayLock | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<OnlineTournamentPlayLock>
    if (typeof parsed.gameId !== 'string' || typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return { expiresAt: parsed.expiresAt, gameId: parsed.gameId }
  } catch {
    return null
  }
}

export function setOnlineTournamentPlayLock(gameId: string) {
  if (typeof window === 'undefined' || !gameId) return
  const lock: OnlineTournamentPlayLock = {
    expiresAt: Date.now() + LOCK_DURATION_MS,
    gameId,
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lock))
    notifySubscribers()
  } catch {
    // Storage restrictions must not interrupt the game screen.
  }
}

export function clearOnlineTournamentPlayLock(gameId?: string) {
  if (typeof window === 'undefined') return
  const current = getOnlineTournamentPlayLock()
  if (gameId && current?.gameId !== gameId) return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    notifySubscribers()
  } catch {
    // Storage restrictions must not interrupt the game screen.
  }
}

export function useOnlineTournamentPlayLock() {
  const [lock, setLock] = useState<OnlineTournamentPlayLock | null>(() => getOnlineTournamentPlayLock())

  useEffect(() => {
    const update = () => setLock(getOnlineTournamentPlayLock())
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) update()
    }

    subscribers.add(update)
    window.addEventListener('storage', handleStorage)
    return () => {
      subscribers.delete(update)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  return lock
}

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber())
}
