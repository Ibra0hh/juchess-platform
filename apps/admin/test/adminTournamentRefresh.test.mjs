import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createSingleFlightTask,
  resolveTournamentSnapshot,
} from '../src/lib/adminTournamentRefresh.ts'

test('failed canonical refresh retains the exact last known-good snapshot', () => {
  const previous = [{ id: 'published-event', publishedGames: 8 }]
  const error = new Error('games unavailable')
  const resolved = resolveTournamentSnapshot(previous, {
    tournaments: [],
    source: 'unavailable',
    error,
  })

  assert.strictEqual(resolved.tournaments, previous)
  assert.equal(resolved.source, 'unavailable')
  assert.strictEqual(resolved.error, error)
  assert.equal(resolved.replaced, false)
})

test('successful canonical refresh atomically replaces the snapshot', () => {
  const next = [{ id: 'published-event', publishedGames: 10 }]
  const resolved = resolveTournamentSnapshot([], {
    tournaments: next,
    source: 'cloud',
  })

  assert.strictEqual(resolved.tournaments, next)
  assert.equal(resolved.source, 'cloud')
  assert.equal(resolved.error, undefined)
  assert.equal(resolved.replaced, true)
})

test('single-flight task shares an overlapping request and resets after completion', async () => {
  let calls = 0
  let finish
  const task = createSingleFlightTask(() => {
    calls += 1
    return new Promise((resolve) => { finish = resolve })
  })

  const first = task()
  const overlapping = task()
  assert.strictEqual(overlapping, first)
  assert.equal(calls, 1)

  finish('done')
  assert.equal(await first, 'done')

  const next = task()
  assert.equal(calls, 2)
  finish('again')
  assert.equal(await next, 'again')
})

test('single-flight task resets after a rejected request', async () => {
  let calls = 0
  const task = createSingleFlightTask(async () => {
    calls += 1
    if (calls === 1) throw new Error('temporary failure')
    return 'recovered'
  })

  await assert.rejects(task(), /temporary failure/)
  assert.equal(await task(), 'recovered')
  assert.equal(calls, 2)
})
