import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/useAuth'
import {
  defaultBoardPreferences,
  mergeBoardPreferences,
  normalizeBoardPreferences,
  type BoardPreferences,
  type JuBoardTheme,
  type JuPieceTheme,
} from '../lib/boardAppearance'

const STORAGE_KEY = 'juchess.boardPreferences.v1'

function loadBoardPreferences() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved ? normalizeBoardPreferences(JSON.parse(saved)) : defaultBoardPreferences
  } catch {
    return defaultBoardPreferences
  }
}

export function useBoardPreferences() {
  const [preferences, setPreferences] = useState(loadBoardPreferences)
  const preferencesRef = useRef(preferences)
  const saveTimerRef = useRef<number | null>(null)
  const { loading, profile, saveBoardPreferences } = useAuth()

  useEffect(() => {
    if (loading || !profile) return
    const next = mergeBoardPreferences(preferencesRef.current, profile)
    preferencesRef.current = next
    setPreferences(next)
  }, [loading, profile])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch {
      // The board still works when storage is unavailable or full.
    }
  }, [preferences])

  useEffect(() => () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current)
  }, [profile?.$id])

  const updatePreferences = useCallback((patch: Partial<BoardPreferences>) => {
    const next = { ...preferencesRef.current, ...patch }
    preferencesRef.current = next
    setPreferences(next)

    if (!profile) return
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      void saveBoardPreferences(next).catch((error) => {
        console.warn('JuChess could not sync board preferences to the profile.', error)
      })
    }, 300)
  }, [profile, saveBoardPreferences])

  return {
    ...preferences,
    setBoardTheme: (boardTheme: JuBoardTheme) => {
      updatePreferences({ boardTheme })
    },
    setPieceTheme: (pieceTheme: JuPieceTheme) => {
      updatePreferences({ pieceTheme })
    },
  }
}
