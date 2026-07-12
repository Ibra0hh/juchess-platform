import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useTournamentPlay } from '../context/useTournamentPlay'
import { getFairPlaySessionId } from '../hooks/useFairPlayMonitor'
import { recordHostedFairPlayEvent } from '../lib/onlineTournament'

export function TournamentPlayGuard({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { activeGame } = useTournamentPlay()
  const gameId = activeGame?.$id

  useEffect(() => {
    if (!gameId || location.pathname !== '/tools') return
    void recordHostedFairPlayEvent(
      gameId,
      'analysisAttempt',
      getFairPlaySessionId(),
      { metadata: { pathname: location.pathname } },
    ).catch(() => {
      // The redirect remains authoritative even if telemetry is unavailable.
    })
  }, [gameId, location.pathname])

  if (!gameId) return children

  const selectedGameId = location.pathname === '/games'
    ? new URLSearchParams(location.search).get('game')
    : null
  if (location.pathname === '/games' && selectedGameId === gameId) return children

  return <Navigate to={`/games?game=${encodeURIComponent(gameId)}`} replace />
}
