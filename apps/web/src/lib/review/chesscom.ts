// Chess.com game import.
//
// Uses the public, key-free Chess.com API (api.chess.com/pub). It sends a
// permissive `Access-Control-Allow-Origin: *`, so the browser can call it
// directly with no proxy and no cost. A player enters their username and we
// return their most recent games, newest first.

export type ImportedGame = {
  /** Stable id (chess.com game URL) for dedupe and linking. */
  id: string
  url: string
  pgn: string
  whiteName: string
  blackName: string
  whiteRating?: number
  blackRating?: number
  /** '1-0' | '0-1' | '1/2-1/2'. */
  result: string
  timeClass: string
  timeControl: string
  rated: boolean
  endTime: number
  /** ISO date for display. */
  date: string
}

type RawPlayer = { username?: string; rating?: number; result?: string }
type RawGame = {
  url?: string
  pgn?: string
  time_control?: string
  time_class?: string
  end_time?: number
  rated?: boolean
  rules?: string
  white?: RawPlayer
  black?: RawPlayer
}

const API = 'https://api.chess.com/pub'
const MAX_MONTHS = 4

export class ChessComError extends Error {}

/**
 * Load a player's recent standard-chess games, newest first.
 * @param username chess.com handle (case-insensitive)
 * @param limit maximum games to return (default 30)
 */
export async function loadChessComGames(username: string, limit = 30): Promise<ImportedGame[]> {
  const handle = username.trim().toLowerCase()
  if (!handle) throw new ChessComError('Enter a Chess.com username.')

  const archivesRes = await fetchJson(`${API}/player/${encodeURIComponent(handle)}/games/archives`)
  if (archivesRes.status === 404) {
    throw new ChessComError(`No Chess.com player named "${username}".`)
  }
  if (!archivesRes.ok) {
    throw new ChessComError('Chess.com is unavailable right now. Please try again.')
  }

  const archives: string[] = archivesRes.body?.archives ?? []
  if (archives.length === 0) {
    throw new ChessComError(`"${username}" has no games on Chess.com yet.`)
  }

  // Walk from the most recent month backwards until we have enough games.
  const collected: ImportedGame[] = []
  for (const monthUrl of archives.slice(-MAX_MONTHS).reverse()) {
    const monthRes = await fetchJson(monthUrl)
    if (!monthRes.ok) continue

    const games: RawGame[] = monthRes.body?.games ?? []
    for (const game of games) {
      const normalized = normalizeGame(game)
      if (normalized) collected.push(normalized)
    }
    if (collected.length >= limit) break
  }

  collected.sort((a, b) => b.endTime - a.endTime)
  return collected.slice(0, limit)
}

function normalizeGame(game: RawGame): ImportedGame | null {
  if (!game.url || !game.pgn) return null
  if (game.rules && game.rules !== 'chess') return null // skip chess960, bughouse, etc.

  return {
    id: game.url,
    url: game.url,
    pgn: game.pgn,
    whiteName: game.white?.username ?? 'White',
    blackName: game.black?.username ?? 'Black',
    whiteRating: game.white?.rating,
    blackRating: game.black?.rating,
    result: resultFrom(game.white?.result, game.black?.result),
    timeClass: game.time_class ?? 'unknown',
    timeControl: game.time_control ?? '',
    rated: Boolean(game.rated),
    endTime: game.end_time ?? 0,
    date: game.end_time ? new Date(game.end_time * 1000).toISOString().slice(0, 10) : '',
  }
}

// Chess.com marks the loser with the reason (resigned, timeout, checkmated…) and
// the winner with 'win'; a draw marks both with a draw reason.
const DRAW_RESULTS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', 'timevsinsufficient', '50move'])

function resultFrom(white?: string, black?: string): string {
  if (white === 'win') return '1-0'
  if (black === 'win') return '0-1'
  if ((white && DRAW_RESULTS.has(white)) || (black && DRAW_RESULTS.has(black))) return '1/2-1/2'
  return '*'
}

async function fetchJson(url: string): Promise<{ ok: boolean; status: number; body: any }> {
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' } })
    const body = response.status === 200 ? await response.json() : null
    return { ok: response.ok, status: response.status, body }
  } catch {
    throw new ChessComError('Could not reach Chess.com. Check your connection.')
  }
}
