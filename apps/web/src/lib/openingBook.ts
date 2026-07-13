import { Chess, type Square } from 'chess.js'

export type OpeningIdentity = {
  eco: string
  name: string
}

type OpeningTuple = [eco: string, name: string]

export type OpeningBookData = {
  license: string
  openingCount: number
  positions: Record<string, OpeningTuple>
  sequences: Record<string, OpeningTuple>
  source: string
  version: number
}

let openingBookPromise: Promise<OpeningBookData> | null = null

export async function identifyOpening(fen: string, moves: string[]) {
  if (!moves.length) return null
  const book = await loadOpeningBook()
  return findOpeningInBook(book, fen, moves)
}

export async function loadOpeningBook() {
  openingBookPromise ??= fetch(`${import.meta.env.BASE_URL}data/chess-openings.json`, {
    cache: 'force-cache',
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Opening book could not be loaded: HTTP ${response.status}`)
    return await response.json() as OpeningBookData
  }).catch((error) => {
    openingBookPromise = null
    throw error
  })
  return openingBookPromise
}

export function findOpeningInBook(book: OpeningBookData, fen: string, moves: string[]) {
  const game = new Chess(fen)
  const positions = [positionKey(game.fen())]
  const uciMoves: string[] = []

  for (const move of moves) {
    const played = playStoredMove(game, move)
    if (!played) break
    uciMoves.push(`${played.from}${played.to}${played.promotion ?? ''}`)
    positions.push(positionKey(game.fen()))
  }

  for (let ply = uciMoves.length; ply > 0; ply -= 1) {
    const exact = book.sequences[uciMoves.slice(0, ply).join(' ')]
    if (exact) return tupleToIdentity(exact)
    const transposition = book.positions[positions[ply]]
    if (transposition) return tupleToIdentity(transposition)
  }

  return null
}

export function positionKey(fen: string) {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ')
}

function playStoredMove(game: Chess, move: string) {
  try {
    if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) {
      return game.move({
        from: move.slice(0, 2) as Square,
        promotion: move.slice(4, 5) || undefined,
        to: move.slice(2, 4) as Square,
      })
    }
    return game.move(move)
  } catch {
    return null
  }
}

function tupleToIdentity([eco, name]: OpeningTuple): OpeningIdentity {
  return { eco, name }
}
