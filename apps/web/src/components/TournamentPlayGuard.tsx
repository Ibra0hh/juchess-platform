import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useTournamentPlay } from '../context/useTournamentPlay'
import { getFairPlaySessionId } from '../hooks/useFairPlayMonitor'
import { recordHostedFairPlayEvent } from '../lib/onlineTournament'
import { compactCrestUrl } from '../lib/brand'
import RouteSkeleton from './RouteSkeleton'

export function TournamentPlayGuard({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { profile, user } = useAuth()
  const { activeGame, checking, error, refresh } = useTournamentPlay()
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

  if (user && profile && checking) return <RouteSkeleton />
  if (user && profile && error && !gameId) {
    return (
      <main className="prototype-missing" role="alert">
        <img src={compactCrestUrl} alt="JuChess logo" />
        <h1>Safety check unavailable</h1>
        <p>JuChess could not confirm whether this account has an active tournament board. Private features remain paused until the canonical assignment check succeeds.</p>
        <button type="button" onClick={() => void refresh()}>Retry safety check</button>
      </main>
    )
  }
  if (!gameId) return children

  const selectedGameId = location.pathname === '/games'
    ? new URLSearchParams(location.search).get('game')
    : null
  if (location.pathname === '/games' && selectedGameId === gameId) return children

  return <Navigate to={`/games?game=${encodeURIComponent(gameId)}`} replace />
}
