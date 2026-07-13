import { useEffect, useState } from 'react'
import {
  defaultBoardPreferences,
  normalizeBoardPreferences,
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

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch {
      // The board still works when storage is unavailable or full.
    }
  }, [preferences])

  return {
    ...preferences,
    setBoardTheme: (boardTheme: JuBoardTheme) => {
      setPreferences((current) => ({ ...current, boardTheme }))
    },
    setPieceTheme: (pieceTheme: JuPieceTheme) => {
      setPreferences((current) => ({ ...current, pieceTheme }))
    },
  }
}
