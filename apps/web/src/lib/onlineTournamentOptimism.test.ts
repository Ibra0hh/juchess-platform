import assert from 'node:assert/strict'
import test from 'node:test'
import type { SampleGame } from './juchess.ts'
import { applyOptimisticHostedMove } from './onlineTournamentOptimism.ts'

function game(overrides: Partial<SampleGame> = {}): SampleGame {
  return {
    black: 'Black',
    blackProfileId: 'black',
    id: 'game-1',
    live: true,
    moves: [],
    result: 'Live',
    round: 'Round 1',
    status: 'live',
    tournamentId: 'tournament-1',
    turn: 'white',
    white: 'White',
    whiteProfileId: 'white',
    ...overrides,
  }
}

test('optimistic hosted move renders immediately and freezes the mover clock', () => {
  const movedAtMs = Date.parse('2026-07-13T10:00:01.500Z')
  const current = game({
    clockObservedAtMs: Date.parse('2026-07-13T10:00:00.000Z'),
    whiteTimeMs: 300_000,
    blackTimeMs: 300_000,
  })

  const optimistic = applyOptimisticHostedMove(current, ['e4'], 'Live', movedAtMs)

  assert.deepEqual(optimistic.moves, ['e4'])
  assert.equal(optimistic.turn, 'black')
  assert.equal(optimistic.whiteTimeMs, 298_500)
  assert.equal(optimistic.blackTimeMs, 300_000)
  assert.equal(optimistic.clockObservedAtMs, movedAtMs)
  assert.equal(optimistic.moveVersion, current.moveVersion)
})

test('optimistic first move promotes a scheduled board to local live state', () => {
  const movedAtMs = Date.parse('2026-07-13T10:00:20.250Z')
  const current = game({
    live: false,
    scheduledStartAt: '2026-07-13T10:00:20.000Z',
    status: 'scheduled',
    whiteTimeMs: 300_000,
  })

  const optimistic = applyOptimisticHostedMove(current, ['e4'], 'Live', movedAtMs)

  assert.equal(optimistic.status, 'live')
  assert.equal(optimistic.live, true)
  assert.equal(optimistic.whiteTimeMs, 299_750)
  assert.equal(optimistic.turnStartedAt, '2026-07-13T10:00:20.250Z')
})
