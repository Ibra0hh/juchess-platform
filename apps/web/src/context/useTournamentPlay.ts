import { useContext } from 'react'
import { TournamentPlayContext } from './tournamentPlayContextValue'

export function useTournamentPlay() {
  const context = useContext(TournamentPlayContext)
  if (!context) throw new Error('useTournamentPlay must be used inside TournamentPlayProvider.')
  return context
}
