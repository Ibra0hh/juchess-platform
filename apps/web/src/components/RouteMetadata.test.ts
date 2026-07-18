import assert from 'node:assert/strict'
import test from 'node:test'
import { metadataForPath } from '../lib/routeMetadata.ts'

test('public routes expose specific indexable metadata', () => {
  assert.equal(metadataForPath('/tools').title, 'Chess Tools & Game Review | JuChess')
  assert.notEqual(metadataForPath('/tools').index, false)
  assert.equal(metadataForPath('/privacy/').title, 'Privacy Policy | JuChess')
})

test('account, hidden product, and unknown routes are not indexed', () => {
  assert.equal(metadataForPath('/sign-in').index, false)
  assert.equal(metadataForPath('/games').index, false)
  assert.equal(metadataForPath('/leaderboard').index, false)
  assert.equal(metadataForPath('/missing-page').index, false)
})

test('dynamic tournament routes receive tournament metadata', () => {
  assert.equal(metadataForPath('/tournament/summer-open').title, 'Tournament Details | JuChess')
})
