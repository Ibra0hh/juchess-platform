import assert from 'node:assert/strict'
import test from 'node:test'

import { ExternalGameImportError, loadExternalGames, loadExternalGamesPage } from './externalGames.ts'

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

function pgnFor(id: string) {
  return pgn.replace('https://example.test/game-1', `https://example.test/${id}`)
}

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

test('uses Chess.com game URLs when PGN Site is only the provider name', async () => {
  const providerSitePgn = pgn.replace(
    '[Site "https://example.test/game-1"]',
    '[Site "Chess.com"]',
  )
  const fetchMock = async (input: string | URL | Request) => {
    if (String(input).endsWith('/archives')) {
      return Response.json({ archives: ['https://api.chess.com/pub/player/alice/games/2026/07'] })
    }
    return Response.json({
      games: [
        {
          end_time: 1783641602,
          pgn: providerSitePgn,
          rules: 'chess',
          url: 'https://www.chess.com/game/live/222222',
        },
        {
          end_time: 1783641601,
          pgn: providerSitePgn,
          rules: 'chess',
          url: 'https://www.chess.com/game/live/111111',
        },
      ],
    })
  }

  const games = await loadExternalGames('chess.com', 'Alice', fetchMock as typeof fetch)

  assert.deepEqual(games.map((game) => game.key), [
    'chess.com-222222',
    'chess.com-111111',
  ])
})

test('pages backward through Chess.com archives without replacing or repeating games', async () => {
  const archiveCalls: string[] = []
  const gamesByArchive: Record<string, Array<{ end_time: number; pgn: string; rules: string; url: string }>> = {
    '2026/06': [
      { end_time: 1781000002, pgn: pgnFor('june-2'), rules: 'chess', url: 'https://www.chess.com/game/live/june-2' },
      { end_time: 1781000001, pgn: pgnFor('june-1'), rules: 'chess', url: 'https://www.chess.com/game/live/june-1' },
    ],
    '2026/07': [
      { end_time: 1784000003, pgn: pgnFor('july-3'), rules: 'chess', url: 'https://www.chess.com/game/live/july-3' },
      { end_time: 1784000002, pgn: pgnFor('july-2'), rules: 'chess', url: 'https://www.chess.com/game/live/july-2' },
      { end_time: 1784000001, pgn: pgnFor('july-1'), rules: 'chess', url: 'https://www.chess.com/game/live/july-1' },
    ],
  }
  const fetchMock = async (input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith('/archives')) {
      return Response.json({
        archives: [
          'https://api.chess.com/pub/player/alice/games/2026/06',
          'https://api.chess.com/pub/player/alice/games/2026/07',
        ],
      })
    }
    const archive = url.slice(-7)
    archiveCalls.push(archive)
    return Response.json({ games: gamesByArchive[archive] })
  }

  const firstPage = await loadExternalGamesPage(
    'chess.com',
    'Alice',
    { pageSize: 2 },
    fetchMock as typeof fetch,
  )
  const secondPage = await loadExternalGamesPage(
    'chess.com',
    'Alice',
    { cursor: firstPage.nextCursor, pageSize: 2 },
    fetchMock as typeof fetch,
  )
  const finalPage = await loadExternalGamesPage(
    'chess.com',
    'Alice',
    { cursor: secondPage.nextCursor, pageSize: 2 },
    fetchMock as typeof fetch,
  )

  assert.deepEqual(firstPage.games.map((game) => game.id), ['july-3', 'july-2'])
  assert.deepEqual(secondPage.games.map((game) => game.id), ['july-1', 'june-2'])
  assert.deepEqual(finalPage.games.map((game) => game.id), ['june-1'])
  assert.equal(finalPage.nextCursor, null)
  assert.deepEqual(archiveCalls, ['2026/07', '2026/07', '2026/06', '2026/06'])
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

test('uses Lichess until cursors to load older pages', async () => {
  const requestedUrls: URL[] = []
  const firstRows = [
    { createdAt: 1784000003000, id: 'latest', lastMoveAt: 1784000003000, pgn: pgnFor('latest'), variant: 'standard' },
    { createdAt: 1784000002000, id: 'middle', lastMoveAt: 1784000002000, pgn: pgnFor('middle'), variant: 'standard' },
    { createdAt: 1784000001000, id: 'next', lastMoveAt: 1784000001000, pgn: pgnFor('next'), variant: 'standard' },
  ]
  const olderRows = [
    { createdAt: 1783000002000, id: 'older-2', lastMoveAt: 1783000002000, pgn: pgnFor('older-2'), variant: 'standard' },
    { createdAt: 1783000001000, id: 'older-1', lastMoveAt: 1783000001000, pgn: pgnFor('older-1'), variant: 'standard' },
  ]
  const fetchMock = async (input: string | URL | Request) => {
    const url = new URL(String(input))
    requestedUrls.push(url)
    const rows = url.searchParams.has('until') ? olderRows : firstRows
    return new Response(rows.map((row) => JSON.stringify(row)).join('\n'), { status: 200 })
  }

  const firstPage = await loadExternalGamesPage(
    'lichess',
    'Alice',
    { pageSize: 2 },
    fetchMock as typeof fetch,
  )
  const secondPage = await loadExternalGamesPage(
    'lichess',
    'Alice',
    { cursor: firstPage.nextCursor, pageSize: 2 },
    fetchMock as typeof fetch,
  )

  assert.deepEqual(firstPage.games.map((game) => game.id), ['latest', 'middle'])
  assert.deepEqual(secondPage.games.map((game) => game.id), ['older-2', 'older-1'])
  assert.equal(secondPage.nextCursor, null)
  assert.equal(requestedUrls[0].searchParams.get('max'), '50')
  assert.equal(requestedUrls[1].searchParams.get('until'), '1784000001999')
})

test('reports usernames that do not exist', async () => {
  const fetchMock = async () => new Response('', { status: 404 })

  await assert.rejects(
    loadExternalGames('chess.com', 'missing-user', fetchMock as typeof fetch),
    (error: unknown) => error instanceof ExternalGameImportError && error.status === 404,
  )
})
