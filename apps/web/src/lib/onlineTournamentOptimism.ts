import type { SampleGame } from './juchess'

export function applyOptimisticHostedMove(
  game: SampleGame,
  moves: string[],
  result: string,
  movedAtMs: number,
): SampleGame {
  const mover = game.turn ?? (game.moves.length % 2 === 0 ? 'white' : 'black')
  const nextTurn = mover === 'white' ? 'black' : 'white'
  const moverClockKey = mover === 'white' ? 'whiteTimeMs' : 'blackTimeMs'
  const base = game[moverClockKey]
  const observedAt = game.clockObservedAtMs
    ?? timestamp(game.turnStartedAt)
    ?? timestamp(game.scheduledStartAt)
  const remaining = base === undefined
    ? undefined
    : Math.max(0, base - Math.max(0, movedAtMs - (observedAt ?? movedAtMs)))

  return {
    ...game,
    [moverClockKey]: remaining,
    clockObservedAtMs: movedAtMs,
    live: true,
    moves,
    result,
    status: 'live',
    turn: nextTurn,
    turnStartedAt: new Date(movedAtMs).toISOString(),
  }
}

function timestamp(value?: string) {
  if (!value) return undefined
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
