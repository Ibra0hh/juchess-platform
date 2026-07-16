import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import { TournamentPlayContext, type TournamentPlayContextValue } from './tournamentPlayContextValue'
import {
  loadActiveHostedTournamentGame,
  subscribeToPlayerTournamentGames,
  type HostedGameRow,
  type HostedTournamentRow,
} from '../lib/onlineTournament'
import {
  clearOnlineTournamentPlayLock,
  getOnlineTournamentPlayLock,
  setOnlineTournamentPlayLock,
} from '../lib/onlineTournamentPlayLock'

const ACTIVE_GAME_POLL_MS = 15_000

export function TournamentPlayProvider({ children }: { children: ReactNode }) {
  const { loading: authLoading, profile, user } = useAuth()
  const accountId = user?.$id ?? null
  const profileId = profile?.$id ?? null
  const canCheckAssignments = Boolean(accountId && profileId)
  const [activeGame, setActiveGame] = useState<HostedGameRow | null>(null)
  const [activeTournament, setActiveTournament] = useState<HostedTournamentRow | null>(null)
  const [checking, setChecking] = useState(canCheckAssignments)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef<Promise<void> | null>(null)

  const refresh = useCallback(async () => {
    if (!canCheckAssignments) {
      setActiveGame(null)
      setActiveTournament(null)
      setChecking(false)
      setError(null)
      clearOnlineTournamentPlayLock()
      return
    }
    if (requestRef.current) return requestRef.current

    const request = (async () => {
      try {
        const currentLock = getOnlineTournamentPlayLock()
        const response = await loadActiveHostedTournamentGame(currentLock?.gameId)
        setActiveGame(response.game)
        setActiveTournament(response.tournament)
        setError(null)
        if (response.game?.$id) setOnlineTournamentPlayLock(response.game.$id)
        else clearOnlineTournamentPlayLock()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not check your tournament assignment.')
      } finally {
        setChecking(false)
        requestRef.current = null
      }
    })()
    requestRef.current = request
    return request
  }, [canCheckAssignments])

  useEffect(() => {
    if (authLoading) return
    setChecking(canCheckAssignments)
    void refresh()
  }, [authLoading, canCheckAssignments, refresh])

  useEffect(() => {
    if (!canCheckAssignments) return
    const timer = window.setInterval(() => void refresh(), ACTIVE_GAME_POLL_MS)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [canCheckAssignments, refresh])

  useEffect(() => {
    if (!accountId || !profileId || activeGame) return
    let alive = true
    let unsubscribe: (() => void) | undefined
    void subscribeToPlayerTournamentGames(profileId, () => void refresh())
      .then((stop) => {
        if (alive) unsubscribe = stop
        else stop()
      })
      .catch(() => {
        // The periodic assignment check remains available if Realtime is blocked.
      })
    return () => {
      alive = false
      unsubscribe?.()
    }
  }, [accountId, activeGame, profileId, refresh])

  const value = useMemo<TournamentPlayContextValue>(() => ({
    activeGame,
    activeTournament,
    checking,
    error,
    refresh,
  }), [activeGame, activeTournament, checking, error, refresh])

  return <TournamentPlayContext.Provider value={value}>{children}</TournamentPlayContext.Provider>
}
