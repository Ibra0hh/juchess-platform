export type TournamentSnapshotResult<T> = {
  tournaments: T[]
  source: 'cloud' | 'unavailable'
  error?: unknown
}

export type ResolvedTournamentSnapshot<T> = {
  tournaments: T[]
  source: 'cloud' | 'unavailable'
  error?: unknown
  replaced: boolean
}

/**
 * A failed canonical read must never replace the last known-good snapshot with
 * empty arrays. Pairing publication controls derive their lock state from that
 * snapshot, so treating an outage as "no games" would fail open.
 */
export function resolveTournamentSnapshot<T>(
  previous: T[],
  result: TournamentSnapshotResult<T>,
): ResolvedTournamentSnapshot<T> {
  if (result.source !== 'cloud' || result.error) {
    return {
      tournaments: previous,
      source: 'unavailable',
      error: result.error ?? new Error('Canonical tournament data is unavailable.'),
      replaced: false,
    }
  }

  return {
    tournaments: result.tournaments,
    source: 'cloud',
    replaced: true,
  }
}

/** Deduplicates overlapping fallback, focus, realtime, and mutation refreshes. */
export function createSingleFlightTask<T>(task: () => Promise<T>) {
  let inFlight: Promise<T> | null = null

  return () => {
    if (inFlight) return inFlight

    const request = task()
    const tracked = request.finally(() => {
      if (inFlight === tracked) inFlight = null
    })
    inFlight = tracked
    return tracked
  }
}
