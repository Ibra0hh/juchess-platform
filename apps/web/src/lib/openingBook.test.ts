import assert from 'node:assert/strict'
import test from 'node:test'
import { Chess } from 'chess.js'
import { findOpeningInBook, positionKey, type OpeningBookData } from './openingBook.ts'

const game = new Chess()
game.move('e4')
game.move('e5')
game.move('Nf3')
game.move('Nc6')
game.move('Bb5')

const book: OpeningBookData = {
  license: 'CC0-1.0',
  openingCount: 1,
  positions: {
    [positionKey(game.fen())]: ['C60', 'Ruy Lopez'],
  },
  sequences: {
    'e2e4 e7e5 g1f3 b8c6 f1b5': ['C60', 'Ruy Lopez'],
  },
  source: 'test',
  version: 1,
}

test('finds the deepest exact opening sequence', () => {
  assert.deepEqual(findOpeningInBook(book, new Chess().fen(), ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']), {
    eco: 'C60',
    name: 'Ruy Lopez',
  })
})

test('recognizes transposed positions and ignores unknown openings', () => {
  const transposed = {
    ...book,
    sequences: {},
  }
  assert.equal(findOpeningInBook(transposed, new Chess().fen(), ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])?.eco, 'C60')
  assert.equal(findOpeningInBook(book, new Chess().fen(), ['h4']), null)
})
