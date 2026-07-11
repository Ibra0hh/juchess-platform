import { parseReviewGame } from './gameReview.ts'
import type { GameSource, SampleGame } from './juchess.ts'

export type ExternalGameSource = Exclude<GameSource, 'tournament'>

type FetchLike = typeof fetch

type ChessComArchiveResponse = {
  archives?: unknown
}

type ChessComPlayer = {
  rating?: number
  username?: string
}

type ChessComGame = {
  black?: ChessComPlayer
  eco?: string
  end_time?: number
  pgn?: string
  rules?: string
  time_class?: string
  url?: string
  white?: ChessComPlayer
}

type LichessPlayer = {
  rating?: number
  user?: {
    name?: string
  }
}

type LichessGame = {
  createdAt?: number
  id?: string
  lastMoveAt?: number
  opening?: {
    name?: string
  }
  pgn?: string
  players?: {
    black?: LichessPlayer
    white?: LichessPlayer
  }
  variant?: string
  winner?: 'black' | 'white'
}

export class ExternalGameImportError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ExternalGameImportError'
    this.status = status
  }
}

export async function loadExternalGames(
  source: ExternalGameSource,
  username: string,
  fetchImpl: FetchLike = fetch,
): Promise<SampleGame[]> {
  const normalizedUsername = username.trim()
  if (!normalizedUsername) {
    throw new ExternalGameImportError(`Enter a ${sourceName(source)} username.`)
  }

  return source === 'chess.com'
    ? loadChessComGames(normalizedUsername, fetchImpl)
    : loadLichessGames(normalizedUsername, fetchImpl)
}

async function loadChessComGames(username: string, fetchImpl: FetchLike) {
  const encodedUsername = encodeURIComponent(username.toLowerCase())
  const archiveResponse = await fetchExternal(
    `https://api.chess.com/pub/player/${encodedUsername}/games/archives`,
    { headers: { Accept: 'application/json' } },
    fetchImpl,
    'Chess.com',
  )
  const archivePayload = await archiveResponse.json() as ChessComArchiveResponse
  const archives = Array.isArray(archivePayload.archives)
    ? archivePayload.archives.filter((value): value is string => typeof value === 'string')
    : []

  if (!archives.length) return []

  const games: ChessComGame[] = []
  const recentArchives = archives.slice(-3).reverse()
  for (const archiveUrl of recentArchives) {
    const response = await fetchExternal(
      archiveUrl,
      { headers: { Accept: 'application/json' } },
      fetchImpl,
      'Chess.com',
    )
    const payload = await response.json() as { games?: unknown }
    if (Array.isArray(payload.games)) games.push(...payload.games as ChessComGame[])
    if (games.length >= 20) break
  }

  return games
    .filter((game) => game.rules === 'chess' && typeof game.pgn === 'string')
    .sort((a, b) => (b.end_time ?? 0) - (a.end_time ?? 0))
    .slice(0, 20)
    .map((game, index) => sampleGameFromPgn({
      fallbackBlack: game.black?.username,
      fallbackBlackRating: game.black?.rating,
      fallbackDate: game.end_time ? game.end_time * 1000 : undefined,
      fallbackId: gameIdFromUrl(game.url) || `${username}-${index + 1}`,
      fallbackOpening: openingFromChessComEco(game.eco)
        || (game.time_class ? `${titleCase(game.time_class)} game` : undefined),
      fallbackWhite: game.white?.username,
      fallbackWhiteRating: game.white?.rating,
      pgn: game.pgn as string,
      source: 'chess.com',
    }))
    .filter((game): game is SampleGame => Boolean(game))
}

async function loadLichessGames(username: string, fetchImpl: FetchLike) {
  const query = new URLSearchParams({
    clocks: 'false',
    evals: 'false',
    literate: 'false',
    max: '20',
    moves: 'true',
    opening: 'true',
    pgnInJson: 'true',
  })
  const response = await fetchExternal(
    `https://lichess.org/api/games/user/${encodeURIComponent(username)}?${query.toString()}`,
    { headers: { Accept: 'application/x-ndjson' } },
    fetchImpl,
    'Lichess',
  )
  const body = await response.text()
  const rows = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as LichessGame]
      } catch {
        return []
      }
    })

  return rows
    .filter((game) => game.variant === 'standard' && typeof game.pgn === 'string')
    .sort((a, b) => (b.lastMoveAt ?? b.createdAt ?? 0) - (a.lastMoveAt ?? a.createdAt ?? 0))
    .map((game, index) => sampleGameFromPgn({
      fallbackBlack: game.players?.black?.user?.name,
      fallbackBlackRating: game.players?.black?.rating,
      fallbackDate: game.lastMoveAt ?? game.createdAt,
      fallbackId: game.id || `${username}-${index + 1}`,
      fallbackOpening: game.opening?.name,
      fallbackWhite: game.players?.white?.user?.name,
      fallbackWhiteRating: game.players?.white?.rating,
      pgn: game.pgn as string,
      source: 'lichess',
    }))
    .filter((game): game is SampleGame => Boolean(game))
}

async function fetchExternal(
  input: string,
  init: RequestInit,
  fetchImpl: FetchLike,
  provider: string,
) {
  let response: Response
  try {
    response = await fetchImpl(input, init)
  } catch {
    throw new ExternalGameImportError(`${provider} could not be reached. Check your connection and try again.`)
  }

  if (response.ok) return response
  if (response.status === 404) {
    throw new ExternalGameImportError(`${provider} username was not found.`, response.status)
  }
  if (response.status === 429) {
    throw new ExternalGameImportError(`${provider} is receiving too many requests. Wait a moment and try again.`, response.status)
  }
  throw new ExternalGameImportError(`${provider} returned an error (${response.status}).`, response.status)
}

function sampleGameFromPgn({
  fallbackBlack,
  fallbackBlackRating,
  fallbackDate,
  fallbackId,
  fallbackOpening,
  fallbackWhite,
  fallbackWhiteRating,
  pgn,
  source,
}: {
  fallbackBlack?: string
  fallbackBlackRating?: number
  fallbackDate?: number
  fallbackId: string
  fallbackOpening?: string
  fallbackWhite?: string
  fallbackWhiteRating?: number
  pgn: string
  source: ExternalGameSource
}): SampleGame | null {
  try {
    const parsed = parseReviewGame({ pgn })
    const headers = parsed.headers
    const id = gameIdFromSiteHeader(headers.Site) || fallbackId
    const event = headers.Event?.trim()
    return {
      bRating: numericHeader(headers.BlackElo) ?? fallbackBlackRating ?? 0,
      black: headers.Black?.trim() || fallbackBlack || 'Black',
      date: formatGameDate(headers.UTCDate || headers.Date, fallbackDate),
      fen: parsed.initialFen,
      id,
      key: `${source}-${id}`,
      moves: parsed.moves,
      opening: headers.Opening?.trim() || fallbackOpening || headers.ECO?.trim() || 'Standard game',
      pgn,
      result: headers.Result || '*',
      round: event && event !== '?' ? event : sourceName(source),
      source,
      wRating: numericHeader(headers.WhiteElo) ?? fallbackWhiteRating ?? 0,
      white: headers.White?.trim() || fallbackWhite || 'White',
    }
  } catch {
    return null
  }
}

function numericHeader(value?: string) {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function formatGameDate(headerDate?: string, fallbackTimestamp?: number) {
  const normalized = headerDate?.trim().replace(/\./g, '-')
  const fromHeader = normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? new Date(`${normalized}T00:00:00Z`)
    : null
  const date = fromHeader && !Number.isNaN(fromHeader.getTime())
    ? fromHeader
    : fallbackTimestamp
      ? new Date(fallbackTimestamp)
      : null

  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Date unavailable'
}

function gameIdFromUrl(value?: string) {
  if (!value) return ''
  try {
    const segments = new URL(value).pathname.split('/').filter(Boolean)
    return segments.at(-1) || ''
  } catch {
    return value.split('/').filter(Boolean).at(-1) || ''
  }
}

function gameIdFromSiteHeader(value?: string) {
  if (!value) return ''
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return gameIdFromUrl(value)
  } catch {
    return ''
  }
}

function sourceName(source: ExternalGameSource) {
  return source === 'chess.com' ? 'Chess.com' : 'Lichess'
}

function openingFromChessComEco(value?: string) {
  if (!value) return ''
  const slug = gameIdFromUrl(value)
  return decodeURIComponent(slug)
    .split(/-\d+\./, 1)[0]
    .replace(/-/g, ' ')
    .trim()
}

function titleCase(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value
}
