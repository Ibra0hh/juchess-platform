import { parseReviewGame } from './gameReview.ts'
import type { GameSource, SampleGame } from './juchess.ts'

export type ExternalGameSource = Exclude<GameSource, 'tournament'>

export type ExternalGamesPage = {
  games: SampleGame[]
  nextCursor: string | null
}

export type ExternalGamesPageOptions = {
  cursor?: string | null
  pageSize?: number
}

export const externalGamesPageSize = 20

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
  const page = await loadExternalGamesPage(source, username, {}, fetchImpl)
  return page.games
}

export async function loadExternalGamesPage(
  source: ExternalGameSource,
  username: string,
  options: ExternalGamesPageOptions = {},
  fetchImpl: FetchLike = fetch,
): Promise<ExternalGamesPage> {
  const normalizedUsername = username.trim()
  if (!normalizedUsername) {
    throw new ExternalGameImportError(`Enter a ${sourceName(source)} username.`)
  }

  const pageSize = normalizePageSize(options.pageSize)

  return source === 'chess.com'
    ? loadChessComGames(normalizedUsername, options.cursor, pageSize, fetchImpl)
    : loadLichessGames(normalizedUsername, options.cursor, pageSize, fetchImpl)
}

async function loadChessComGames(
  username: string,
  cursor: string | null | undefined,
  pageSize: number,
  fetchImpl: FetchLike,
): Promise<ExternalGamesPage> {
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

  if (!archives.length) return { games: [], nextCursor: null }

  const parsedCursor = parseChessComCursor(cursor)
  let archiveIndex = parsedCursor?.archiveIndex ?? archives.length - 1
  let gameOffset = parsedCursor?.gameOffset ?? 0
  if (archiveIndex >= archives.length) {
    archiveIndex = archives.length - 1
    gameOffset = 0
  }

  const pageEntries: Array<{ afterCursor: string | null; game: SampleGame }> = []
  while (archiveIndex >= 0 && pageEntries.length <= pageSize) {
    const archiveUrl = archives[archiveIndex]
    const response = await fetchExternal(
      archiveUrl,
      { headers: { Accept: 'application/json' } },
      fetchImpl,
      'Chess.com',
    )
    const payload = await response.json() as { games?: unknown }
    const games = Array.isArray(payload.games) ? payload.games as ChessComGame[] : []
    const mappedGames = games
      .filter((game) => game.rules === 'chess' && typeof game.pgn === 'string')
      .sort((a, b) => (b.end_time ?? 0) - (a.end_time ?? 0))
      .map((game, index) => sampleGameFromPgn({
        fallbackBlack: game.black?.username,
        fallbackBlackRating: game.black?.rating,
        fallbackDate: game.end_time ? game.end_time * 1000 : undefined,
        fallbackId: gameIdFromUrl(game.url) || `${username}-${game.end_time ?? `${archiveIndex}-${index + 1}`}`,
        fallbackOpening: openingFromChessComEco(game.eco)
          || (game.time_class ? `${titleCase(game.time_class)} game` : undefined),
        fallbackWhite: game.white?.username,
        fallbackWhiteRating: game.white?.rating,
        pgn: game.pgn as string,
        source: 'chess.com',
      }))
      .filter((game): game is SampleGame => Boolean(game))

    for (let index = gameOffset; index < mappedGames.length && pageEntries.length <= pageSize; index += 1) {
      const afterCursor = index + 1 < mappedGames.length
        ? chessComCursor(archiveIndex, index + 1)
        : archiveIndex > 0
          ? chessComCursor(archiveIndex - 1, 0)
          : null
      pageEntries.push({ afterCursor, game: mappedGames[index] })
    }

    archiveIndex -= 1
    gameOffset = 0
  }

  return {
    games: pageEntries.slice(0, pageSize).map((entry) => entry.game),
    nextCursor: pageEntries.length > pageSize
      ? pageEntries[pageSize - 1]?.afterCursor ?? null
      : null,
  }
}

async function loadLichessGames(
  username: string,
  cursor: string | null | undefined,
  pageSize: number,
  fetchImpl: FetchLike,
): Promise<ExternalGamesPage> {
  const batchSize = Math.max(50, pageSize + 1)
  let until = parseLichessCursor(cursor)
  const pageEntries: Array<{ afterCursor: string | null; game: SampleGame }> = []

  while (pageEntries.length <= pageSize) {
    const query = new URLSearchParams({
      clocks: 'false',
      evals: 'false',
      literate: 'false',
      max: String(batchSize),
      moves: 'true',
      opening: 'true',
      pgnInJson: 'true',
      sort: 'dateDesc',
    })
    if (until) query.set('until', String(until))

    const response = await fetchExternal(
      `https://lichess.org/api/games/user/${encodeURIComponent(username)}?${query.toString()}`,
      { headers: { Accept: 'application/x-ndjson' } },
      fetchImpl,
      'Lichess',
    )
    const rows = parseLichessRows(await response.text())

    for (let index = 0; index < rows.length && pageEntries.length <= pageSize; index += 1) {
      const game = rows[index]
      if (game.variant !== 'standard' || typeof game.pgn !== 'string') continue
      const mappedGame = sampleGameFromPgn({
        fallbackBlack: game.players?.black?.user?.name,
        fallbackBlackRating: game.players?.black?.rating,
        fallbackDate: game.lastMoveAt ?? game.createdAt,
        fallbackId: game.id || `${username}-${game.lastMoveAt ?? game.createdAt ?? index + 1}`,
        fallbackOpening: game.opening?.name,
        fallbackWhite: game.players?.white?.user?.name,
        fallbackWhiteRating: game.players?.white?.rating,
        pgn: game.pgn,
        source: 'lichess',
      })
      if (!mappedGame) continue
      const timestamp = lichessGameTimestamp(game)
      pageEntries.push({
        afterCursor: timestamp ? lichessCursor(timestamp - 1) : null,
        game: mappedGame,
      })
    }

    if (pageEntries.length > pageSize || rows.length < batchSize) break
    const oldestTimestamp = lichessGameTimestamp(rows.at(-1))
    if (!oldestTimestamp || oldestTimestamp <= 1 || (until && oldestTimestamp >= until)) break
    until = oldestTimestamp - 1
  }

  return {
    games: pageEntries.slice(0, pageSize).map((entry) => entry.game),
    nextCursor: pageEntries.length > pageSize
      ? pageEntries[pageSize - 1]?.afterCursor ?? null
      : null,
  }
}

function parseLichessRows(body: string) {
  return body
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
    .sort((a, b) => lichessGameTimestamp(b) - lichessGameTimestamp(a))
}

function lichessGameTimestamp(game?: LichessGame) {
  return game?.lastMoveAt ?? game?.createdAt ?? 0
}

function chessComCursor(archiveIndex: number, gameOffset: number) {
  return `chess.com:${archiveIndex}:${gameOffset}`
}

function parseChessComCursor(cursor?: string | null) {
  const match = cursor?.match(/^chess\.com:(\d+):(\d+)$/)
  if (!match) return null
  return {
    archiveIndex: Number.parseInt(match[1], 10),
    gameOffset: Number.parseInt(match[2], 10),
  }
}

function lichessCursor(until: number) {
  return `lichess:${until}`
}

function parseLichessCursor(cursor?: string | null) {
  const match = cursor?.match(/^lichess:(\d+)$/)
  if (!match) return null
  const until = Number.parseInt(match[1], 10)
  return Number.isFinite(until) && until > 0 ? until : null
}

function normalizePageSize(pageSize?: number) {
  if (!Number.isFinite(pageSize)) return externalGamesPageSize
  return Math.min(100, Math.max(1, Math.floor(pageSize as number)))
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
