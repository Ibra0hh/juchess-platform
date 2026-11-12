import assert from 'node:assert/strict'
import test from 'node:test'
import { sortPlayers } from '../src/lib/playerSorting.ts'

test('player sorting distinguishes visits, tournament play, and account age', () => {
  const players = [
    { id: 'a', name: 'Alpha', rating: 1200, tournaments: 2, visitDays: 8, lastVisitedAt: '2026-11-11', joinedAt: '2026-10-01' },
    { id: 'b', name: 'Beta', rating: 1100, tournaments: 3, visitDays: 2, lastVisitedAt: '2026-11-12', joinedAt: '2026-10-02' },
    { id: 'c', name: 'Charlie', rating: 1300, tournaments: 0, visitDays: 0, joinedAt: '2026-10-03' },
  ]
  const order = (mode) => sortPlayers(players, mode).map((player) => player.id).join('')
  assert.equal(order('rating'), 'cab')
  assert.equal(order('joined'), 'cba')
  assert.equal(order('recent'), 'bac')
  assert.equal(order('frequent'), 'abc')
  assert.equal(order('tournaments'), 'bac')
  assert.equal(order('name'), 'abc')
})
