import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeTournamentLocationUrl } from '../src/lib/tournamentLocation.ts'

test('location links accept only complete HTTP and HTTPS URLs', () => {
  assert.equal(normalizeTournamentLocationUrl(' https://maps.app.goo.gl/example '), 'https://maps.app.goo.gl/example')
  assert.equal(normalizeTournamentLocationUrl('http://example.com/place'), 'http://example.com/place')
  assert.equal(normalizeTournamentLocationUrl(''), '')
  assert.throws(() => normalizeTournamentLocationUrl('maps.google.com/place'), /starting with https:\/\//)
  assert.throws(() => normalizeTournamentLocationUrl('javascript:alert(1)'), /starting with https:\/\//)
})
