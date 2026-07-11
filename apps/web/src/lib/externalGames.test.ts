import assert from 'node:assert/strict'
import test from 'node:test'

import { ExternalGameImportError, loadExternalGames } from './externalGames.ts'

const pgn = `[Event "JU Test"]
[Site "https://example.test/game-1"]
[Date "2026.07.10"]
[Round "1"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]
[WhiteElo "1700"]
[BlackElo "1650"]
[Opening "Ruy Lopez"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`

test('loads and maps recent Chess.com games', async () => {
  const calls: string[] = []
  const fetchMock = async (input: string | URL | Request) => {
    const url = String(input)
    calls.push(url)
    if (url.endsWith('/archives')) {
      return Response.json({ archives: ['https://api.chess.com/pub/player/alice/games/2026/07'] })
    }
    return Response.json({
      games: [{
        black: { rating: 1650, username: 'Bob' },
        end_time: 1783641600,
        pgn,
        rules: 'chess',
        time_class: 'rapid',
        url: 'https://www.chess.com/game/live/123456',
        white: { rating: 1700, username: 'Alice' },
      }],
    })
  }

  const games = await loadExternalGames('chess.com', 'Alice', fetchMock as typeof fetch)

  assert.equal(calls.length, 2)
  assert.equal(games.length, 1)
  assert.equal(games[0].white, 'Alice')
  assert.equal(games[0].black, 'Bob')
  assert.equal(games[0].opening, 'Ruy Lopez')
  assert.deepEqual(games[0].moves, ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'])
})

test('loads Lichess NDJSON with embedded PGN', async () => {
  const fetchMock = async () => new Response(`${JSON.stringify({
    createdAt: 1783641600000,
    id: 'abc12345',
    opening: { name: 'Ruy Lopez' },
    pgn,
    players: {
      black: { rating: 1650, user: { name: 'Bob' } },
      white: { rating: 1700, user: { name: 'Alice' } },
    },
    variant: 'standard',
    winner: 'white',
  })}\n`, {
    headers: { 'content-type': 'application/x-ndjson' },
    status: 200,
  })

  const games = await loadExternalGames('lichess', 'Alice', fetchMock as typeof fetch)

  assert.equal(games.length, 1)
  assert.equal(games[0].key, 'lichess-game-1')
  assert.equal(games[0].result, '1-0')
  assert.equal(games[0].wRating, 1700)
})

test('skips unsupported variants and invalid PGNs', async () => {
  const fetchMock = async () => new Response([
    JSON.stringify({ id: 'atomic', pgn, variant: 'atomic' }),
    JSON.stringify({ id: 'broken', pgn: 'not a pgn', variant: 'standard' }),
  ].join('\n'), { status: 200 })

  const games = await loadExternalGames('lichess', 'Alice', fetchMock as typeof fetch)
  assert.deepEqual(games, [])
})

test('reports usernames that do not exist', async () => {
  const fetchMock = async () => new Response('', { status: 404 })

  await assert.rejects(
    loadExternalGames('chess.com', 'missing-user', fetchMock as typeof fetch),
    (error: unknown) => error instanceof ExternalGameImportError && error.status === 404,
  )
})
