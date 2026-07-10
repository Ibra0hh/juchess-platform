import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadChessComGames, ChessComError } from './chesscom'

// Deterministic tests: the real network is mocked so CI never flakes. A separate
// manual check hits the live api.chess.com endpoint.

function mockFetch(routes: Record<string, { status?: number; body?: unknown }>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const match = routes[url]
    if (!match) return { ok: false, status: 404, json: async () => ({}) }
    const status = match.status ?? 200
    return { ok: status >= 200 && status < 300, status, json: async () => match.body ?? {} }
  }))
}

afterEach(() => vi.unstubAllGlobals())

const ARCHIVES = 'https://api.chess.com/pub/player/tester/games/archives'
const MONTH = 'https://api.chess.com/pub/player/tester/2026/07'

function game(overrides: Record<string, unknown>) {
  return {
    url: 'https://chess.com/game/1',
    pgn: '[Event "x"]\n1. e4 e5',
    time_control: '600',
    time_class: 'rapid',
    end_time: 1000,
    rated: true,
    rules: 'chess',
    white: { username: 'tester', rating: 1500, result: 'win' },
    black: { username: 'rival', rating: 1480, result: 'resigned' },
    ...overrides,
  }
}

describe('loadChessComGames', () => {
  it('rejects an empty username without hitting the network', async () => {
    await expect(loadChessComGames('  ')).rejects.toBeInstanceOf(ChessComError)
  })

  it('maps a 404 archive to a clear "no player" error', async () => {
    mockFetch({ [ARCHIVES]: { status: 404 } })
    await expect(loadChessComGames('tester')).rejects.toThrow(/no chess\.com player/i)
  })

  it('normalizes results, ratings and dates, newest first', async () => {
    mockFetch({
      [ARCHIVES]: { body: { archives: [MONTH] } },
      [MONTH]: { body: { games: [
        game({ url: 'g1', end_time: 100, white: { username: 'tester', rating: 1500, result: 'win' }, black: { username: 'a', rating: 1490, result: 'checkmated' } }),
        game({ url: 'g2', end_time: 300, white: { username: 'b', rating: 1600, result: 'timeout' }, black: { username: 'tester', rating: 1510, result: 'win' } }),
        game({ url: 'g3', end_time: 200, white: { username: 'tester', result: 'agreed' }, black: { username: 'c', result: 'agreed' } }),
      ] } },
    })

    const games = await loadChessComGames('tester')
    expect(games.map((g) => g.id)).toEqual(['g2', 'g3', 'g1']) // sorted by end_time desc
    expect(games.find((g) => g.id === 'g1')?.result).toBe('1-0')
    expect(games.find((g) => g.id === 'g2')?.result).toBe('0-1')
    expect(games.find((g) => g.id === 'g3')?.result).toBe('1/2-1/2')
    expect(games.find((g) => g.id === 'g1')?.whiteRating).toBe(1500)
  })

  it('skips non-standard variants and games without a PGN', async () => {
    mockFetch({
      [ARCHIVES]: { body: { archives: [MONTH] } },
      [MONTH]: { body: { games: [
        game({ url: 'ok' }),
        game({ url: 'variant', rules: 'chess960' }),
        game({ url: 'nopgn', pgn: undefined }),
      ] } },
    })

    const games = await loadChessComGames('tester')
    expect(games.map((g) => g.id)).toEqual(['ok'])
  })

  it('honours the limit', async () => {
    mockFetch({
      [ARCHIVES]: { body: { archives: [MONTH] } },
      [MONTH]: { body: { games: Array.from({ length: 10 }, (_, i) => game({ url: `g${i}`, end_time: i })) } },
    })

    const games = await loadChessComGames('tester', 3)
    expect(games).toHaveLength(3)
  })
})
