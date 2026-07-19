import assert from 'node:assert/strict'
import test from 'node:test'
import { externalRatingSourceLabel, externalRatingText, hasExternalRating } from './externalRating.ts'

test('legacy ratings are hidden without a provider source', () => {
  assert.equal(hasExternalRating(1200, undefined), false)
  assert.equal(externalRatingText(1200, undefined), '')
})

test('recognized provider ratings retain their pool attribution', () => {
  assert.equal(hasExternalRating(1811, 'lichess:rapid'), true)
  assert.equal(externalRatingSourceLabel('lichess:rapid'), 'Lichess Rapid')
  assert.equal(externalRatingText(1811, 'lichess:rapid'), '1811 · Lichess Rapid')
})
