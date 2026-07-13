import { useEffect, useState } from 'react'
import { identifyOpening, type OpeningIdentity } from '../lib/openingBook'

export function useOpeningIdentity(fen: string, moves: string[]) {
  const [opening, setOpening] = useState<OpeningIdentity | null>(null)
  const movesKey = moves.join('\u0001')

  useEffect(() => {
    if (!movesKey) {
      setOpening(null)
      return
    }

    let active = true
    void identifyOpening(fen, movesKey.split('\u0001')).then((identity) => {
      if (active) setOpening(identity)
    }).catch(() => {
      if (active) setOpening(null)
    })

    return () => {
      active = false
    }
  }, [fen, movesKey])

  return opening
}
