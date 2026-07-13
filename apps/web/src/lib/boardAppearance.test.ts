import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'
import {
  boardThemeOptions,
  defaultBoardPreferences,
  normalizeBoardPreferences,
} from './boardAppearance.ts'

test('board appearance accepts the supported experimental themes', () => {
  assert.deepEqual(normalizeBoardPreferences({ boardTheme: 'brown', pieceTheme: 'alpha' }), {
    boardTheme: 'brown',
    pieceTheme: 'alpha',
  })
})

test('board appearance exposes the full board catalogue', () => {
  assert.equal(boardThemeOptions.length, 31)
  assert.deepEqual(normalizeBoardPreferences({ boardTheme: 'parchment', pieceTheme: 'juchess' }), {
    boardTheme: 'parchment',
    pieceTheme: 'juchess',
  })

  for (const option of boardThemeOptions) {
    if (option.id === 'juchess') continue
    assert.equal(existsSync(new URL(`../../public/chess-boards/${option.id}.png`, import.meta.url)), true)
    assert.equal(existsSync(new URL(`../../public/chess-boards/thumbs/${option.id}.jpg`, import.meta.url)), true)
  }
})

test('board appearance rejects stale or unknown saved themes', () => {
  assert.deepEqual(normalizeBoardPreferences({ boardTheme: 'unknown', pieceTheme: 'missing' }), defaultBoardPreferences)
  assert.deepEqual(normalizeBoardPreferences(null), defaultBoardPreferences)
})
