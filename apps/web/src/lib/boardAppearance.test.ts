import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'
import {
  boardThemeOptions,
  defaultBoardPreferences,
  mergeBoardPreferences,
  normalizeBoardPreferences,
  pieceThemeAssetPath,
  pieceThemeOptions,
} from './boardAppearance.ts'

test('board appearance accepts the supported experimental themes', () => {
  assert.deepEqual(normalizeBoardPreferences({ boardTheme: 'brown', pieceTheme: 'alpha' }), {
    boardTheme: 'brown',
    pieceTheme: 'alpha',
  })
})

test('board appearance exposes the full board catalogue', () => {
  assert.equal(boardThemeOptions.length, 84)
  assert.deepEqual(normalizeBoardPreferences({ boardTheme: 'lichess-wood4', pieceTheme: 'juchess' }), {
    boardTheme: 'lichess-wood4',
    pieceTheme: 'juchess',
  })

  for (const option of boardThemeOptions) {
    if (option.asset === null || option.thumbnail === null) continue
    assert.equal(existsSync(new URL(`../../public/${option.asset}`, import.meta.url)), true, option.asset)
    assert.equal(existsSync(new URL(`../../public/${option.thumbnail}`, import.meta.url)), true, option.thumbnail)
  }
})

test('board appearance exposes every complete piece catalogue', () => {
  assert.equal(pieceThemeOptions.length, 90)
  assert.deepEqual(normalizeBoardPreferences({ boardTheme: 'juchess', pieceTheme: 'lichess-monarchy' }), {
    boardTheme: 'juchess',
    pieceTheme: 'lichess-monarchy',
  })

  for (const option of pieceThemeOptions) {
    for (const color of ['b', 'w'] as const) {
      for (const type of ['b', 'k', 'n', 'p', 'q', 'r'] as const) {
        const asset = pieceThemeAssetPath(option.id, color, type)
        assert.equal(existsSync(new URL(`../../public/${asset}`, import.meta.url)), true, asset)
      }
    }
  }
})

test('board appearance rejects stale or unknown saved themes', () => {
  assert.deepEqual(normalizeBoardPreferences({ boardTheme: 'unknown', pieceTheme: 'missing' }), defaultBoardPreferences)
  assert.deepEqual(normalizeBoardPreferences(null), defaultBoardPreferences)
})

test('profile appearance merges partial cloud preferences over the local fallback', () => {
  const local = normalizeBoardPreferences({ boardTheme: 'brown', pieceTheme: 'alpha' })
  assert.deepEqual(mergeBoardPreferences(local, { boardTheme: 'lichess-wood4' }), {
    boardTheme: 'lichess-wood4',
    pieceTheme: 'alpha',
  })
  assert.deepEqual(mergeBoardPreferences(local, { boardTheme: 'unknown', pieceTheme: 'missing' }), local)
})
