import assert from 'node:assert/strict'
import test from 'node:test'
import {
  defaultBoardPreferences,
  normalizeBoardPreferences,
} from './boardAppearance.ts'

test('board appearance accepts the supported experimental themes', () => {
  assert.deepEqual(normalizeBoardPreferences({ boardTheme: 'brown', pieceTheme: 'alpha' }), {
    boardTheme: 'brown',
    pieceTheme: 'alpha',
  })
})

test('board appearance rejects stale or unknown saved themes', () => {
  assert.deepEqual(normalizeBoardPreferences({ boardTheme: 'unknown', pieceTheme: 'missing' }), defaultBoardPreferences)
  assert.deepEqual(normalizeBoardPreferences(null), defaultBoardPreferences)
})
