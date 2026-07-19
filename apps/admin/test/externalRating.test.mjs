import assert from 'node:assert/strict'
import test from 'node:test'
import { externalRatingText, hasExternalRating } from '../src/lib/externalRating.ts'
import { playerDetailFields, playerDetailsText } from '../src/lib/playerDetails.ts'

test('external ratings require a recognized provider source', () => {
  assert.equal(hasExternalRating(1200, undefined), false)
  assert.equal(hasExternalRating(1842, 'chess.com:rapid'), true)
  assert.equal(externalRatingText(1842, 'chess.com:rapid'), '1842 · Chess.com Rapid')
})

test('copyable player details include every identity field and omit legacy ratings', () => {
  const player = {
    id: 'profile-123',
    name: 'Student Knight',
    universityId: '20260001',
    email: 'student@example.com',
    phone: '+962790000000',
    role: 'member',
    status: 'active',
    chessComUsername: 'student-knight',
    rating: 1200,
  }
  const fields = playerDetailFields(player)
  assert.equal(fields.some((field) => field.label === 'External rating'), false)
  assert.match(playerDetailsText(player), /Profile ID: profile-123/)
  assert.match(playerDetailsText(player), /Phone number: \+962790000000/)
})

test('copyable player details include provider-attributed ratings', () => {
  const fields = playerDetailFields({
    id: 'profile-456',
    name: 'Rated Knight',
    universityId: '20260002',
    email: 'rated@example.com',
    phone: '+962791111111',
    role: 'member',
    status: 'active',
    lichessUsername: 'rated-knight',
    rating: 1765,
    ratingSource: 'lichess:rapid',
    ratingUpdatedAt: '2026-07-19T10:00:00.000Z',
  })
  assert.deepEqual(fields.find((field) => field.label === 'External rating'), {
    label: 'External rating',
    value: '1765 · Lichess Rapid',
  })
})
