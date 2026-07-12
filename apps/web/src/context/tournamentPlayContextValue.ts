import { createContext } from 'react'
import type { HostedGameRow, HostedTournamentRow } from '../lib/onlineTournament'

export type TournamentPlayContextValue = {
  activeGame: HostedGameRow | null
  activeTournament: HostedTournamentRow | null
  checking: boolean
  error: string | null
  refresh: () => Promise<void>
}

export const TournamentPlayContext = createContext<TournamentPlayContextValue | null>(null)
