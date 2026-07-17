import { Channel, Query, type Models } from 'appwrite'
import { appwriteConfig, appwriteReady, realtime, storage, tablesDB } from './appwrite'
import { parseStoredMoves } from './storedMoves'

export { parseStoredMoves } from './storedMoves'

const tournamentAssetsBucketId = 'tournament-assets'
const tournamentMediaPrefix = 'ju-media'
const systemByeProfileId = 'system_bye'

export type TournamentStatus = 'Active' | 'Upcoming' | 'Completed'
export type OnlineTournamentPlatform = 'chessCom' | 'lichess' | 'juchess'

export type Tournament = {
  rowId?: string
  id: string
  name: string
  status: TournamentStatus
  date: string
  startsAt?: string
  playMode: 'inPerson' | 'online'
  onlinePlatform?: OnlineTournamentPlatform
  location: string
  format: string
  timeControl: string
  participants: number
  capacity?: number
  roundsTotal?: number
  currentRound?: number
  firstMoveGraceSeconds?: number
  disconnectGraceSeconds?: number
  chatPolicy?: 'full' | 'preset' | 'disabled'
  fairPlayMode?: 'standard' | 'strict' | 'proctored'
  round: string
  desc: string
  registeredPlayers?: Member[]
  publishedGames?: TournamentGame[]
  standings?: TournamentStanding[]
  bracketSnapshot?: PublishedBracketSnapshot
  media?: TournamentMedia[]
  mediaUnavailable?: boolean
}

export type TournamentStanding = {
  profileId: string
  rank: number
  points: number
  tieBreak: number
  played: number
  wins: number
  draws: number
  losses: number
}

export type TournamentMedia = {
  id: string
  name: string
  mimeType: string
  size: number
  createdAt: string
  tags: string[]
  viewUrl: string
  downloadUrl: string
}

type AppwriteTournamentRow = Models.Row & {
  slug?: string
  name?: string
  status?: 'draft' | 'upcoming' | 'active' | 'completed' | 'cancelled'
  format?: string
  timeControl?: string
  roundsTotal?: number
  currentRound?: number
  startsAt?: string
  endsAt?: string
  playMode?: 'inPerson' | 'online'
  onlinePlatform?: OnlineTournamentPlatform
  location?: string
  capacity?: number
  description?: string
  bracketSnapshot?: string
  firstMoveGraceSeconds?: number
  disconnectGraceSeconds?: number
  chatPolicy?: 'full' | 'preset' | 'disabled'
  fairPlayMode?: 'standard' | 'strict' | 'proctored'
}

type AppwriteRegistrationRow = Models.Row & {
  tournamentId?: string
  profileId?: string
  status?: 'pending' | 'confirmed' | 'waitlisted' | 'cancelled'
  seed?: number
}

type AppwriteProfileRow = Models.Row & {
  displayName?: string
  university?: string
  rating?: number
}

type AppwriteGameRow = Models.Row & {
  tournamentId?: string
  round?: number
  board?: number
  whiteProfileId?: string
  blackProfileId?: string
  status?: 'scheduled' | 'live' | 'completed' | 'forfeit'
  result?: '1-0' | '0-1' | '1/2-1/2' | '*'
  pgn?: string
  moveVersion?: number
  lastMoveAt?: string
  whiteTimeMs?: number
  blackTimeMs?: number
  clockObservedAtMs?: number
  turn?: 'white' | 'black'
  turnStartedAt?: string
  scheduledStartAt?: string
  firstMoveDeadlineAt?: string
  clockDeadlineAt?: string
  terminationReason?: 'checkmate' | 'draw' | 'resignation' | 'timeout' | 'noShow' | 'forfeit' | 'cancelled'
  forfeitedProfileId?: string
  startedAt?: string
  finishedAt?: string
}

type AppwriteStandingRow = Models.Row & {
  tournamentId?: string
  profileId?: string
  rank?: number
  points?: number
  tieBreak?: number
  played?: number
  wins?: number
  draws?: number
  losses?: number
}

type AppwriteAnnouncementRow = Models.Row & {
  title?: string
  body?: string
  audience?: 'public' | 'members' | 'organizers' | 'admins'
  status?: 'draft' | 'published' | 'archived'
  publishedAt?: string
}

export type Member = {
  id: string
  name: string
  rating: number
  university: string
}

export type TournamentGame = {
  id: string
  tournamentId: string
  round: number
  board: number
  white: Member
  black: Member
  status: 'scheduled' | 'live' | 'completed' | 'forfeit'
  result: '1-0' | '0-1' | '1/2-1/2' | '*'
  pgn?: string
  moveVersion: number
  lastMoveAt?: string
  whiteTimeMs?: number
  blackTimeMs?: number
  clockObservedAtMs?: number
  turn?: 'white' | 'black'
  turnStartedAt?: string
  scheduledStartAt?: string
  firstMoveDeadlineAt?: string
  clockDeadlineAt?: string
  terminationReason?: 'checkmate' | 'draw' | 'resignation' | 'timeout' | 'noShow' | 'forfeit' | 'cancelled'
  forfeitedProfileId?: string
  startedAt?: string
  finishedAt?: string
}

export type PublishedBracketSide = 'white' | 'black'
export type PublishedBracketView = 'winners' | 'losers' | 'final'

export type PublishedBracketMatch = {
  gameId?: string
  board?: number
  matchNumber?: number
  white: string
  black: string
  whiteScore?: string
  blackScore?: string
  winner?: PublishedBracketSide
  live?: boolean
  pending?: boolean
  next?: number
}

export type PublishedBracketRound = {
  name: string
  matches: PublishedBracketMatch[]
}

export type PublishedBracketSnapshot =
  | {
      version?: number
      type: 'single'
      title: string
      rounds: PublishedBracketRound[]
    }
  | {
      version?: number
      type: 'double'
      title: string
      brackets: Record<PublishedBracketView, PublishedBracketRound[]>
    }

export type Announcement = {
  id: string
  title: string
  body: string
  date: string
  publishedAt?: string
}

export type BoardCell = {
  key: string
  glyph: string
  isWhite: boolean
  isDark: boolean
}

export type GameSource = 'chess.com' | 'lichess' | 'tournament'

export type SampleGame = {
  key: string
  id: string
  source: GameSource
  white: string
  whiteProfileId?: string
  black: string
  blackProfileId?: string
  wRating: number
  bRating: number
  result: string
  date: string
  opening: string
  round: string
  fen: string
  moves: string[]
  pgn?: string
  live?: boolean
  status?: 'scheduled' | 'live' | 'completed' | 'forfeit'
  moveVersion?: number
  lastMoveAt?: string
  whiteTimeMs?: number
  blackTimeMs?: number
  clockObservedAtMs?: number
  turn?: 'white' | 'black'
  turnStartedAt?: string
  scheduledStartAt?: string
  firstMoveDeadlineAt?: string
  clockDeadlineAt?: string
  terminationReason?: TournamentGame['terminationReason']
  forfeitedProfileId?: string
  onlinePlatform?: OnlineTournamentPlatform
  tournamentStatus?: TournamentStatus
  tournamentId?: string
  tournamentName?: string
  tournamentTimeControl?: string
  chatPolicy?: 'full' | 'preset' | 'disabled'
  fairPlayMode?: 'standard' | 'strict' | 'proctored'
}

export const tableIds = {
  profiles: 'profiles',
  tournaments: 'tournaments',
  registrations: 'registrations',
  attendance: 'attendance_confirmations',
  games: 'games',
  standings: 'standings',
  announcements: 'announcements',
  crewApplications: 'crew_applications',
  gameMessages: 'game_messages',
  fairPlayEvents: 'fair_play_events',
  fairPlayReviews: 'fair_play_reviews',
  adminAudit: 'admin_audit',
  identityBlocks: 'identity_blocks',
  ipBlocks: 'ip_blocks',
} as const

const tournamentFormatOrder = [
  'Swiss',
  'Round robin',
  'Double round robin',
  'Single elimination',
  'Double elimination',
  'Multi-stage',
  'Team',
  'Arena',
] as const

const pieceGlyphs: Record<string, string> = {
  p: '\u265f',
  n: '\u265e',
  b: '\u265d',
  r: '\u265c',
  q: '\u265b',
  k: '\u265a',
}

export function fenBoard(fen: string): BoardCell[] {
  const boardFen = fen.split(' ')[0] || '8/8/8/8/8/8/8/8'
  const rows = boardFen.split('/')
  const cells: BoardCell[] = []

  rows.forEach((row, rankIndex) => {
    let fileIndex = 0

    row.split('').forEach((char) => {
      const emptyCount = Number.parseInt(char, 10)

      if (Number.isInteger(emptyCount) && emptyCount > 0) {
        for (let i = 0; i < emptyCount; i += 1) {
          cells.push({
            key: `${rankIndex}-${fileIndex}`,
            glyph: '',
            isWhite: false,
            isDark: (rankIndex + fileIndex) % 2 === 1,
          })
          fileIndex += 1
        }
        return
      }

      cells.push({
        key: `${rankIndex}-${fileIndex}`,
        glyph: pieceGlyphs[char.toLowerCase()] || '',
        isWhite: char === char.toUpperCase(),
        isDark: (rankIndex + fileIndex) % 2 === 1,
      })
      fileIndex += 1
    })
  })

  return cells.slice(0, 64)
}

export function findSampleGame(_value: string | null | undefined): SampleGame | null {
  return null
}

export async function loadTournamentGame(gameId: string | null | undefined): Promise<SampleGame | null> {
  if (!appwriteReady || !gameId) return null

  try {
    const row = await tablesDB.getRow<AppwriteGameRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: tableIds.games,
      rowId: gameId,
    })
    if (row.blackProfileId === 'system_bye') return null
    const [profiles, tournamentNames, tournament] = await Promise.all([
      loadProfilesForGame(row),
      loadTournamentNames(row.tournamentId ? [row.tournamentId] : []),
      row.tournamentId ? tablesDB.getRow<AppwriteTournamentRow>({
        databaseId: appwriteConfig.databaseId,
        tableId: tableIds.tournaments,
        rowId: row.tournamentId,
      }).catch(() => null) : Promise.resolve(null),
    ])
    const game = appwriteGameToSampleGame(row, profiles, tournamentNames)
    if (!game) return null
    return {
      ...game,
      onlinePlatform: normalizeOnlinePlatform(tournament?.onlinePlatform),
      tournamentStatus: mapStatus(tournament?.status) ?? undefined,
      tournamentTimeControl: tournament?.timeControl,
      chatPolicy: tournament?.chatPolicy,
      fairPlayMode: tournament?.fairPlayMode,
    }
  } catch (error) {
    console.warn('JuChess cloud game read failed.', error)
    return null
  }
}

export async function loadTournamentGameArchive(): Promise<SampleGame[]> {
  if (!appwriteReady) return []

  try {
    const games = await listVisibleGameRows()
    const [profiles, tournaments] = await Promise.all([
      listCloudRowsByIds<AppwriteProfileRow>(tableIds.profiles, games.flatMap((row) => [row.whiteProfileId, row.blackProfileId])),
      listCloudRowsByIds<AppwriteTournamentRow>(tableIds.tournaments, games.map((row) => row.tournamentId)),
    ])
    const profileMap = mapProfiles(profiles)
    const tournamentNames = mapTournamentNames(tournaments)
    const mapped = games
      .filter((row) => (
        row.blackProfileId !== 'system_bye'
        && (row.status === 'live' || row.status === 'completed' || row.status === 'forfeit')
      ))
      .sort((a, b) => gameTimestamp(b) - gameTimestamp(a))
      .map((row) => appwriteGameToSampleGame(row, profileMap, tournamentNames))
      .filter((game): game is SampleGame => Boolean(game))

    return mapped
  } catch (error) {
    console.warn('JuChess cloud game archive read failed.', error)
    throw new Error('Tournament game archive is unavailable right now.')
  }
}

export async function loadProfileGameHistory(profileId: string | null | undefined): Promise<SampleGame[]> {
  if (!appwriteReady || !profileId) return []

  try {
    const games = await listVisibleGameRows(profileId)
    const [profiles, tournaments] = await Promise.all([
      listCloudRowsByIds<AppwriteProfileRow>(tableIds.profiles, games.flatMap((row) => [row.whiteProfileId, row.blackProfileId])),
      listCloudRowsByIds<AppwriteTournamentRow>(tableIds.tournaments, games.map((row) => row.tournamentId)),
    ])
    const profileMap = mapProfiles(profiles)
    const tournamentNames = mapTournamentNames(tournaments)

    return games
      .filter((row) => (
        row.blackProfileId !== 'system_bye'
        && (row.whiteProfileId === profileId || row.blackProfileId === profileId)
        && (row.status === 'live' || row.status === 'completed' || row.status === 'forfeit')
      ))
      .sort((a, b) => gameTimestamp(b) - gameTimestamp(a))
      .map((row) => appwriteGameToSampleGame(row, profileMap, tournamentNames))
      .filter((game): game is SampleGame => Boolean(game))
  } catch (error) {
    console.warn('JuChess player game history read failed.', error)
    throw new Error('Tournament game history is unavailable right now.')
  }
}

async function listVisibleGameRows(profileId?: string) {
  const statusQuery = Query.equal('status', ['live', 'completed', 'forfeit'])
  const profileQuery = profileId
    ? Query.or([
        Query.equal('whiteProfileId', profileId),
        Query.equal('blackProfileId', profileId),
      ])
    : null
  const queries = [profileQuery, statusQuery].filter(
    (query): query is string => Boolean(query),
  )

  try {
    return await listAllCloudRows<AppwriteGameRow>(tableIds.games, queries)
  } catch (error) {
    console.warn('Indexed game query is unavailable; using the compatibility scan.', error)
    return await listAllCloudRows<AppwriteGameRow>(tableIds.games)
  }
}

async function loadProfilesForGame(row: AppwriteGameRow) {
  const profiles = new Map<string, Member>()
  await Promise.all([row.whiteProfileId, row.blackProfileId].filter(Boolean).map(async (profileId) => {
    try {
      const profile = await tablesDB.getRow<AppwriteProfileRow>({
        databaseId: appwriteConfig.databaseId,
        tableId: tableIds.profiles,
        rowId: profileId as string,
      })
      profiles.set(profile.$id, {
        id: profile.$id,
        name: profile.displayName || profile.$id,
        rating: profile.rating ?? 1200,
        university: profile.university || '',
      })
    } catch {
      // Missing profile rows should not block opening a saved game.
    }
  }))
  return profiles
}

function appwriteGameToSampleGame(
  row: AppwriteGameRow,
  profiles: Map<string, Member>,
  tournamentNames = new Map<string, string>(),
): SampleGame | null {
  if (!row.whiteProfileId || !row.blackProfileId) return null

  const white = profiles.get(row.whiteProfileId) ?? {
    id: row.whiteProfileId,
    name: row.whiteProfileId,
    rating: 1200,
    university: '',
  }
  const black = profiles.get(row.blackProfileId) ?? {
    id: row.blackProfileId,
    name: row.blackProfileId,
    rating: 1200,
    university: '',
  }
  const moves = parseStoredMoves(row.pgn)
  const tournamentName = row.tournamentId
    ? tournamentNames.get(row.tournamentId) || 'Tournament game'
    : 'Tournament game'
  return {
    key: row.$id,
    id: row.$id,
    source: 'tournament',
    white: white.name,
    whiteProfileId: row.whiteProfileId,
    black: black.name,
    blackProfileId: row.blackProfileId,
    wRating: white.rating,
    bRating: black.rating,
    result: row.status === 'live' ? 'Live' : row.result || '*',
    date: formatDate(row.finishedAt || row.startedAt || row.$updatedAt || row.$createdAt),
    opening: tournamentName,
    round: `Round ${row.round ?? 1} · Board ${row.board ?? 1}`,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves,
    pgn: row.pgn,
    live: row.status === 'live',
    status: row.status ?? 'scheduled',
    moveVersion: Math.max(0, row.moveVersion ?? 0),
    lastMoveAt: row.lastMoveAt,
    whiteTimeMs: row.whiteTimeMs,
    blackTimeMs: row.blackTimeMs,
    turnStartedAt: row.turnStartedAt,
    scheduledStartAt: row.scheduledStartAt,
    firstMoveDeadlineAt: row.firstMoveDeadlineAt,
    clockDeadlineAt: row.clockDeadlineAt,
    terminationReason: row.terminationReason,
    forfeitedProfileId: row.forfeitedProfileId,
    tournamentId: row.tournamentId,
    tournamentName,
  }
}

async function loadTournamentNames(tournamentIds: string[]) {
  const names = new Map<string, string>()
  await Promise.all([...new Set(tournamentIds)].map(async (tournamentId) => {
    try {
      const row = await tablesDB.getRow<AppwriteTournamentRow>({
        databaseId: appwriteConfig.databaseId,
        tableId: tableIds.tournaments,
        rowId: tournamentId,
      })
      names.set(row.$id, tournamentName(row))
    } catch {
      // A missing tournament title should not block opening its saved game.
    }
  }))
  return names
}

function mapTournamentNames(rows: AppwriteTournamentRow[]) {
  return new Map(rows.map((row) => [row.$id, tournamentName(row)]))
}

function tournamentName(row: AppwriteTournamentRow) {
  return row.name?.trim() || row.format?.trim() || 'Tournament game'
}

function gameTimestamp(row: AppwriteGameRow) {
  const value = row.finishedAt || row.startedAt || row.$updatedAt || row.$createdAt
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export type TournamentLoadResult = {
  tournaments: Tournament[]
  source: 'cloud' | 'unavailable'
  error?: unknown
}

export type TournamentDetailLoadResult = {
  tournament: Tournament | null
  source: 'cloud' | 'unavailable'
  error?: unknown
}

type TournamentDetailLookup =
  | { rowId: string }
  | { slug: string }

const tournamentDetailRequests = new Map<string, Promise<TournamentDetailLoadResult>>()
const tournamentDetailPageSize = 100

export async function subscribeToTournamentGameChanges(tournamentId: string, onChange: () => void) {
  const subscription = await realtime.subscribe(
    Channel.tablesdb(appwriteConfig.databaseId).table(tableIds.games).row(),
    onChange,
    [Query.equal('tournamentId', tournamentId)],
  )
  return () => {
    void subscription.unsubscribe()
  }
}

export async function subscribeToTournamentChanges(tournamentId: string, onChange: () => void) {
  const subscriptions = await Promise.allSettled([
    realtime.subscribe(
      Channel.tablesdb(appwriteConfig.databaseId).table(tableIds.tournaments).row(tournamentId),
      onChange,
    ),
    realtime.subscribe(
      Channel.tablesdb(appwriteConfig.databaseId).table(tableIds.games).row(),
      onChange,
      [Query.equal('tournamentId', tournamentId)],
    ),
    realtime.subscribe(
      Channel.tablesdb(appwriteConfig.databaseId).table(tableIds.standings).row(),
      onChange,
      [Query.equal('tournamentId', tournamentId)],
    ),
    realtime.subscribe(
      Channel.tablesdb(appwriteConfig.databaseId).table(tableIds.registrations).row(),
      onChange,
      [Query.equal('tournamentId', tournamentId)],
    ),
  ])
  return () => {
    subscriptions.forEach((subscription) => {
      if (subscription.status === 'fulfilled') void subscription.value.unsubscribe()
    })
  }
}

export async function subscribeToTournamentGameRow(gameId: string, onChange: () => void) {
  const subscription = await realtime.subscribe(
    Channel.tablesdb(appwriteConfig.databaseId).table(tableIds.games).row(gameId),
    onChange,
  )
  return () => {
    void subscription.unsubscribe()
  }
}

export type AnnouncementLoadResult = {
  announcements: Announcement[]
  source: 'cloud' | 'unavailable'
  error?: unknown
}

const hiddenProductionRowIds = new Set(['tt'])

function isPublicTestRow(row: Models.Row & { name?: string; slug?: string }) {
  const name = row.name?.trim().toLocaleLowerCase()
  const slug = row.slug?.trim().toLocaleLowerCase()
  return Boolean(import.meta.env?.PROD)
    && (
      row.$id.startsWith('seed_')
      || hiddenProductionRowIds.has(row.$id)
      || hiddenProductionRowIds.has(name ?? '')
      || hiddenProductionRowIds.has(slug ?? '')
    )
}

export async function loadTournamentSummaries(): Promise<TournamentLoadResult> {
  return loadTournamentRows(false)
}

export async function loadTournaments(): Promise<TournamentLoadResult> {
  return loadTournamentRows(true)
}

export async function subscribeToVisibleGameChanges(onChange: () => void) {
  const subscription = await realtime.subscribe(
    Channel.tablesdb(appwriteConfig.databaseId).table(tableIds.games).row(),
    onChange,
    [Query.equal('status', ['live', 'completed', 'forfeit'])],
  )
  return () => {
    void subscription.unsubscribe()
  }
}

/**
 * Loads one public tournament and only its related rows. Canonical slices are
 * deliberately all-or-nothing: a failed games, registrations, or standings
 * read must not be presented as an authoritative empty tournament.
 */
export function loadTournamentDetail(lookup: TournamentDetailLookup): Promise<TournamentDetailLoadResult> {
  const value = 'rowId' in lookup ? lookup.rowId.trim() : lookup.slug.trim()
  const key = `${'rowId' in lookup ? 'row' : 'slug'}:${value}`
  const existing = tournamentDetailRequests.get(key)
  if (existing) return existing

  const request = loadTournamentDetailUncached(lookup).finally(() => {
    if (tournamentDetailRequests.get(key) === request) tournamentDetailRequests.delete(key)
  })
  tournamentDetailRequests.set(key, request)
  return request
}

async function loadTournamentDetailUncached(lookup: TournamentDetailLookup): Promise<TournamentDetailLoadResult> {
  const value = 'rowId' in lookup ? lookup.rowId.trim() : lookup.slug.trim()
  if (!appwriteReady || !value) {
    return {
      tournament: null,
      source: 'unavailable',
      error: new Error(appwriteReady
        ? 'A tournament identifier is required.'
        : 'Cloud connection is not configured for this app.'),
    }
  }

  try {
    const tournamentRow = await findTournamentDetailRow(lookup)
    if (!tournamentRow || isPublicTestRow(tournamentRow)) {
      return { tournament: null, source: 'cloud' }
    }

    const tournamentId = tournamentRow.$id
    const [registrations, games, standings] = await Promise.all([
      listAllTournamentRows<AppwriteRegistrationRow>(tableIds.registrations, tournamentId),
      listAllTournamentRows<AppwriteGameRow>(tableIds.games, tournamentId),
      listAllTournamentRows<AppwriteStandingRow>(tableIds.standings, tournamentId),
    ])
    const profiles = mapProfiles(await listTournamentProfiles(registrations, games, standings))
    let media: Models.File[] = []
    let mediaUnavailable = false
    if (tournamentRow.status === 'completed') {
      try {
        media = await listTournamentMediaFiles(tournamentId)
      } catch (error) {
        mediaUnavailable = true
        console.warn('Tournament media read failed.', error)
      }
    }
    const playersByTournament = groupRegisteredPlayers(registrations, profiles)
    const gamesByTournament = groupPublishedGames(games, profiles)
    const standingsByTournament = groupTournamentStandings(standings)
    const participantCounts = groupRegistrationCounts(registrations)
    const mediaByTournament = groupTournamentMedia(media)

    const tournament = mapAppwriteTournament(
      tournamentRow,
      participantCounts,
      playersByTournament,
      gamesByTournament,
      standingsByTournament,
      mediaByTournament,
    )
    if (tournament) tournament.mediaUnavailable = mediaUnavailable

    return {
      tournament,
      source: 'cloud',
    }
  } catch (error) {
    console.warn('JuChess cloud tournament detail read failed.', error)
    return { tournament: null, source: 'unavailable', error }
  }
}

async function findTournamentDetailRow(lookup: TournamentDetailLookup) {
  if ('rowId' in lookup) {
    return tablesDB.getRow<AppwriteTournamentRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: tableIds.tournaments,
      rowId: lookup.rowId.trim(),
    })
  }

  const response = await tablesDB.listRows<AppwriteTournamentRow>({
    databaseId: appwriteConfig.databaseId,
    tableId: tableIds.tournaments,
    queries: [Query.equal('slug', lookup.slug.trim()), Query.limit(1)],
    total: false,
    ttl: 0,
  })
  return response.rows[0] ?? null
}

async function listAllTournamentRows<T extends Models.Row>(tableId: string, tournamentId: string) {
  return await listAllCloudRows<T>(tableId, [Query.equal('tournamentId', tournamentId)])
}

async function listAllCloudRows<T extends Models.Row>(
  tableId: string,
  queries: string[] = [],
  ttl = 0,
) {
  const rows: T[] = []
  let cursor: string | undefined

  do {
    const response = await tablesDB.listRows<T>({
      databaseId: appwriteConfig.databaseId,
      tableId,
      queries: [
        ...queries,
        Query.limit(tournamentDetailPageSize),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
      total: false,
      ttl,
    })
    rows.push(...response.rows)
    if (response.rows.length < tournamentDetailPageSize) break

    const nextCursor = response.rows.at(-1)?.$id
    if (!nextCursor || nextCursor === cursor) {
      throw new Error(`Could not continue paginating ${tableId}.`)
    }
    cursor = nextCursor
  } while (cursor)

  return rows
}

async function listCloudRowsByIds<T extends Models.Row>(
  tableId: string,
  values: Array<string | null | undefined>,
) {
  const ids = [...new Set(values.filter((value): value is string => Boolean(value)))]
  if (!ids.length) return []
  const chunks = Array.from(
    { length: Math.ceil(ids.length / tournamentDetailPageSize) },
    (_value, index) => ids.slice(index * tournamentDetailPageSize, (index + 1) * tournamentDetailPageSize),
  )
  const responses = await Promise.all(chunks.map((chunk) => tablesDB.listRows<T>({
    databaseId: appwriteConfig.databaseId,
    tableId,
    queries: [Query.equal('$id', chunk), Query.limit(tournamentDetailPageSize)],
    total: false,
    ttl: 0,
  })))
  return responses.flatMap((response) => response.rows)
}

async function listTournamentProfiles(
  registrations: AppwriteRegistrationRow[],
  games: AppwriteGameRow[],
  standings: AppwriteStandingRow[],
) {
  const profileIds = new Set<string>()
  registrations.forEach((row) => {
    if (row.status === 'confirmed' && row.profileId) profileIds.add(row.profileId)
  })
  games.forEach((row) => {
    if (row.whiteProfileId && row.whiteProfileId !== systemByeProfileId) profileIds.add(row.whiteProfileId)
    if (row.blackProfileId && row.blackProfileId !== systemByeProfileId) profileIds.add(row.blackProfileId)
  })
  standings.forEach((row) => {
    if (row.profileId) profileIds.add(row.profileId)
  })

  const ids = [...profileIds]
  if (!ids.length) return []

  const chunks = Array.from(
    { length: Math.ceil(ids.length / tournamentDetailPageSize) },
    (_value, index) => ids.slice(index * tournamentDetailPageSize, (index + 1) * tournamentDetailPageSize),
  )
  const responses = await Promise.all(chunks.map((chunk) => tablesDB.listRows<AppwriteProfileRow>({
    databaseId: appwriteConfig.databaseId,
    tableId: tableIds.profiles,
    queries: [Query.equal('$id', chunk), Query.limit(tournamentDetailPageSize)],
    total: false,
    ttl: 0,
  })))
  const rows = responses.flatMap((response) => response.rows)
  const returnedIds = new Set(rows.map((row) => row.$id))
  const missingIds = ids.filter((id) => !returnedIds.has(id))
  if (missingIds.length) {
    throw new Error(`Tournament references unavailable player profiles: ${missingIds.join(', ')}`)
  }
  return rows
}

async function listTournamentMediaFiles(tournamentId: string) {
  const files: Models.File[] = []
  let cursor: string | undefined

  do {
    const response = await storage.listFiles({
      bucketId: tournamentAssetsBucketId,
      queries: [
        Query.startsWith('name', `${tournamentMediaPrefix}--${tournamentId}--`),
        Query.limit(tournamentDetailPageSize),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
      total: false,
    })
    files.push(...response.files)
    if (response.files.length < tournamentDetailPageSize) break

    const nextCursor = response.files.at(-1)?.$id
    if (!nextCursor || nextCursor === cursor) {
      throw new Error('Could not continue paginating tournament media.')
    }
    cursor = nextCursor
  } while (cursor)

  return files
}

async function loadTournamentRows(includeDetails: boolean): Promise<TournamentLoadResult> {
  if (!appwriteReady) {
    return {
      tournaments: [],
      source: 'unavailable',
      error: new Error('Cloud connection is not configured for this app.'),
    }
  }

  try {
    const tournamentRows = listAllCloudRows<AppwriteTournamentRow>(tableIds.tournaments)
    const registrationRows = listAllCloudRows<AppwriteRegistrationRow>(tableIds.registrations)
    const profileRows = includeDetails
      ? listAllCloudRows<AppwriteProfileRow>(tableIds.profiles)
      : Promise.resolve<AppwriteProfileRow[]>([])
    const gameRows = includeDetails
      ? listAllCloudRows<AppwriteGameRow>(tableIds.games)
      : Promise.resolve<AppwriteGameRow[]>([])
    const standingRows = includeDetails
      ? listAllCloudRows<AppwriteStandingRow>(tableIds.standings)
      : Promise.resolve<AppwriteStandingRow[]>([])
    const mediaFiles = includeDetails
      ? safeListTournamentMedia()
      : Promise.resolve<Models.File[]>([])

    const [tournamentRowsResponse, registrations, profilesResponse, gamesResponse, standingsResponse, mediaResponse] = await Promise.all([
      tournamentRows,
      registrationRows,
      profileRows,
      gameRows,
      standingRows,
      mediaFiles,
    ])

    const profiles = mapProfiles(profilesResponse)
    const playersByTournament = groupRegisteredPlayers(registrations, profiles)
    const gamesByTournament = groupPublishedGames(gamesResponse, profiles)
    const standingsByTournament = groupTournamentStandings(standingsResponse)
    const participantCounts = groupRegistrationCounts(registrations)
    const mediaByTournament = groupTournamentMedia(mediaResponse)

    const rows = uniqueTournamentsByFormat(tournamentRowsResponse
      .filter((row) => !isPublicTestRow(row))
      .map((row) => mapAppwriteTournament(
        row,
        participantCounts,
        playersByTournament,
        gamesByTournament,
        standingsByTournament,
        mediaByTournament,
      ))
      .filter((tournament): tournament is Tournament => Boolean(tournament)))
      .sort(compareTournaments)

    return {
      tournaments: rows,
      source: 'cloud',
    }
  } catch (error) {
    console.warn('JuChess cloud tournament read failed.', error)
    return { tournaments: [], source: 'unavailable', error }
  }
}

async function safeListTournamentMedia() {
  try {
    const files: Models.File[] = []
    let cursor: string | undefined
    do {
      const response = await storage.listFiles({
        bucketId: tournamentAssetsBucketId,
        queries: [
          Query.limit(tournamentDetailPageSize),
          ...(cursor ? [Query.cursorAfter(cursor)] : []),
        ],
        total: false,
      })
      files.push(...response.files)
      if (response.files.length < tournamentDetailPageSize) break
      const nextCursor = response.files.at(-1)?.$id
      if (!nextCursor || nextCursor === cursor) throw new Error('Tournament media pagination did not advance.')
      cursor = nextCursor
    } while (cursor)
    return files
  } catch (error) {
    console.warn('Tournament media read failed.', error)
    return []
  }
}

function groupTournamentMedia(files: Models.File[]) {
  const groups = new Map<string, TournamentMedia[]>()

  files.forEach((file) => {
    const parts = file.name.split('--')
    if (parts.length < 4 || parts[0] !== tournamentMediaPrefix || !parts[1]) return
    const tagged = parts[3]?.startsWith('tags=')
    const tags = tagged
      ? parts[3].slice(5).split('+').map(decodeMediaTag).filter(Boolean)
      : []
    const nameIndex = tagged ? 4 : 3
    const list = groups.get(parts[1]) ?? []
    list.push({
      id: file.$id,
      name: parts.slice(nameIndex).join('--').replaceAll('_', ' '),
      mimeType: file.mimeType,
      size: file.sizeOriginal,
      createdAt: file.$createdAt,
      tags,
      viewUrl: storage.getFileView({ bucketId: tournamentAssetsBucketId, fileId: file.$id }),
      downloadUrl: storage.getFileDownload({ bucketId: tournamentAssetsBucketId, fileId: file.$id }),
    })
    groups.set(parts[1], list)
  })

  groups.forEach((items) => items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  return groups
}

function decodeMediaTag(value: string) {
  try {
    return decodeURIComponent(value).trim()
  } catch {
    return value.replaceAll('_', ' ').trim()
  }
}

export async function loadAnnouncements(): Promise<AnnouncementLoadResult> {
  if (!appwriteReady) {
    return {
      announcements: [],
      source: 'unavailable',
      error: new Error('Cloud connection is not configured for this app.'),
    }
  }

  try {
    const response = await tablesDB.listRows<AppwriteAnnouncementRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: tableIds.announcements,
      queries: [
        Query.equal('audience', 'public'),
        Query.equal('status', 'published'),
        Query.orderDesc('publishedAt'),
        Query.limit(6),
      ],
      total: false,
    })

    return {
      announcements: response.rows
        .filter((row) => !isPublicTestRow(row))
        .map(mapAnnouncement)
        .filter((item): item is Announcement => Boolean(item)),
      source: 'cloud',
    }
  } catch (error) {
    console.warn('JuChess cloud announcement read failed.', error)
    return { announcements: [], source: 'unavailable', error }
  }
}

function mapAnnouncement(row: AppwriteAnnouncementRow): Announcement | null {
  if (!row.title || !row.body) return null

  return {
    id: row.$id,
    title: row.title,
    body: row.body,
    date: formatDate(row.publishedAt),
    publishedAt: row.publishedAt,
  }
}

function uniqueTournamentsByFormat(tournaments: Tournament[]) {
  const rows = new Map<string, Tournament>()
  tournaments.forEach((tournament) => {
    if (!rows.has(tournament.id)) rows.set(tournament.id, tournament)
  })
  return Array.from(rows.values())
}

function mapProfiles(rows: AppwriteProfileRow[]) {
  const profiles = new Map<string, Member>()
  rows.forEach((row) => {
    profiles.set(row.$id, {
      id: row.$id,
      name: row.displayName || row.$id,
      rating: row.rating ?? 1200,
      university: row.university || '',
    })
  })
  return profiles
}

function groupRegistrationCounts(rows: AppwriteRegistrationRow[]) {
  const counts = new Map<string, number>()
  const countedPlayers = new Set<string>()

  rows.forEach((row) => {
    if (!row.tournamentId || !row.profileId || row.status !== 'confirmed') return
    const key = `${row.tournamentId}:${row.profileId}`
    if (countedPlayers.has(key)) return
    countedPlayers.add(key)
    counts.set(row.tournamentId, (counts.get(row.tournamentId) ?? 0) + 1)
  })

  return counts
}

function groupRegisteredPlayers(rows: AppwriteRegistrationRow[], profiles: Map<string, Member>) {
  const groups = new Map<string, Map<string, Member & { seed?: number }>>()

  rows.forEach((row) => {
    if (!row.tournamentId || !row.profileId || row.status !== 'confirmed') return
    const profile = profiles.get(row.profileId)
    if (!profile) return
    const list = groups.get(row.tournamentId) ?? new Map<string, Member & { seed?: number }>()
    const existing = list.get(row.profileId)
    if (!existing || (row.seed ?? 9999) < (existing.seed ?? 9999)) {
      list.set(row.profileId, { ...profile, seed: row.seed })
    }
    groups.set(row.tournamentId, list)
  })

  return new Map(Array.from(groups.entries()).map(([tournamentId, playersById]) => [
    tournamentId,
    [...playersById.values()]
      .sort((a, b) => (a.seed ?? 9999) - (b.seed ?? 9999) || a.name.localeCompare(b.name))
      .map(({ seed: _seed, ...player }) => player),
  ]))
}

function groupPublishedGames(rows: AppwriteGameRow[], profiles: Map<string, Member>) {
  const groups = new Map<string, TournamentGame[]>()
  const byeMember: Member = {
    id: systemByeProfileId,
    name: 'Bye',
    rating: 0,
    university: '',
  }

  rows.forEach((row) => {
    if (!row.tournamentId || !row.whiteProfileId || !row.blackProfileId) return
    const white = row.whiteProfileId === systemByeProfileId ? byeMember : profiles.get(row.whiteProfileId)
    const black = row.blackProfileId === systemByeProfileId ? byeMember : profiles.get(row.blackProfileId)
    if (!white || !black) return
    const list = groups.get(row.tournamentId) ?? []
    list.push({
      id: row.$id,
      tournamentId: row.tournamentId,
      round: row.round ?? 1,
      board: row.board ?? list.length + 1,
      white,
      black,
      status: row.status ?? 'scheduled',
      result: row.result ?? '*',
      pgn: row.pgn,
      moveVersion: Math.max(0, row.moveVersion ?? 0),
      lastMoveAt: row.lastMoveAt,
      whiteTimeMs: row.whiteTimeMs,
      blackTimeMs: row.blackTimeMs,
      turnStartedAt: row.turnStartedAt,
      scheduledStartAt: row.scheduledStartAt,
      firstMoveDeadlineAt: row.firstMoveDeadlineAt,
      clockDeadlineAt: row.clockDeadlineAt,
      terminationReason: row.terminationReason,
      forfeitedProfileId: row.forfeitedProfileId,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
    })
    groups.set(row.tournamentId, list)
  })

  return new Map(Array.from(groups.entries()).map(([tournamentId, games]) => [
    tournamentId,
    games.sort((a, b) => a.round - b.round || a.board - b.board),
  ]))
}

function groupTournamentStandings(rows: AppwriteStandingRow[]) {
  const groups = new Map<string, TournamentStanding[]>()

  rows.forEach((row) => {
    if (!row.tournamentId || !row.profileId || !Number.isFinite(row.points)) return
    const list = groups.get(row.tournamentId) ?? []
    list.push({
      profileId: row.profileId,
      rank: Number.isFinite(row.rank) ? Math.max(1, Number(row.rank)) : list.length + 1,
      points: Number(row.points),
      tieBreak: Number(row.tieBreak) || 0,
      played: Math.max(0, Number(row.played) || 0),
      wins: Math.max(0, Number(row.wins) || 0),
      draws: Math.max(0, Number(row.draws) || 0),
      losses: Math.max(0, Number(row.losses) || 0),
    })
    groups.set(row.tournamentId, list)
  })

  groups.forEach((standings) => standings.sort((a, b) => (
    a.rank - b.rank
    || b.points - a.points
    || b.tieBreak - a.tieBreak
    || a.profileId.localeCompare(b.profileId)
  )))
  return groups
}

function mapAppwriteTournament(
  row: AppwriteTournamentRow,
  participantCounts: Map<string, number>,
  playersByTournament: Map<string, Member[]>,
  gamesByTournament: Map<string, TournamentGame[]>,
  standingsByTournament: Map<string, TournamentStanding[]>,
  mediaByTournament: Map<string, TournamentMedia[]>,
): Tournament | null {
  if (!row.format || !row.timeControl) return null

  const status = mapStatus(row.status)
  if (!status) return null
  const format = normalizeTournamentFormat(row.format)
  const name = row.name?.trim() || format
  const slug = row.slug?.trim() || formatRouteId(name) || row.$id

  return {
    rowId: row.$id,
    id: slug,
    name,
    status,
    date: formatDateRange(row.startsAt, row.endsAt),
    startsAt: row.startsAt,
    playMode: row.playMode === 'online' ? 'online' : 'inPerson',
    onlinePlatform: normalizeOnlinePlatform(row.onlinePlatform),
    location: row.playMode === 'online'
      ? onlinePlatformLabel(normalizeOnlinePlatform(row.onlinePlatform))
      : row.location || 'University of Jordan',
    format,
    timeControl: row.timeControl,
    participants: participantCounts.get(row.$id) ?? 0,
    capacity: row.capacity,
    roundsTotal: row.roundsTotal,
    currentRound: row.currentRound,
    firstMoveGraceSeconds: row.firstMoveGraceSeconds,
    disconnectGraceSeconds: row.disconnectGraceSeconds,
    chatPolicy: row.chatPolicy,
    fairPlayMode: row.fairPlayMode,
    round: formatRound(row),
    desc: row.description || 'Club tournament details will be published by the organizers.',
    registeredPlayers: playersByTournament.get(row.$id) ?? [],
    publishedGames: gamesByTournament.get(row.$id) ?? [],
    standings: standingsByTournament.get(row.$id) ?? [],
    bracketSnapshot: parsePublishedBracketSnapshot(row.bracketSnapshot),
    media: mediaByTournament.get(row.$id) ?? [],
  }
}

function normalizeOnlinePlatform(value?: string): OnlineTournamentPlatform | undefined {
  return value === 'chessCom' || value === 'lichess' || value === 'juchess' ? value : undefined
}

function onlinePlatformLabel(value?: OnlineTournamentPlatform) {
  if (value === 'chessCom') return 'Chess.com'
  if (value === 'lichess') return 'Lichess'
  if (value === 'juchess') return 'JuChess'
  return 'Online'
}

function parsePublishedBracketSnapshot(value?: string): PublishedBracketSnapshot | undefined {
  if (!value) return undefined

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (parsed.type === 'single') {
      return {
        version: typeof parsed.version === 'number' ? parsed.version : undefined,
        type: 'single',
        title: typeof parsed.title === 'string' ? parsed.title : 'Single elimination bracket',
        rounds: sanitizePublishedBracketRounds(parsed.rounds),
      }
    }

    if (parsed.type === 'double') {
      const brackets = parsed.brackets && typeof parsed.brackets === 'object'
        ? parsed.brackets as Partial<Record<PublishedBracketView, unknown>>
        : {}

      return {
        version: typeof parsed.version === 'number' ? parsed.version : undefined,
        type: 'double',
        title: typeof parsed.title === 'string' ? parsed.title : 'Double elimination bracket',
        brackets: {
          winners: sanitizePublishedBracketRounds(brackets.winners),
          losers: sanitizePublishedBracketRounds(brackets.losers),
          final: sanitizePublishedBracketRounds(brackets.final),
        },
      }
    }
  } catch {
    return undefined
  }

  return undefined
}

function sanitizePublishedBracketRounds(value: unknown): PublishedBracketRound[] {
  if (!Array.isArray(value)) return []

  return value
    .map((round): PublishedBracketRound | null => {
      if (!round || typeof round !== 'object') return null
      const row = round as { name?: unknown; matches?: unknown }
      if (typeof row.name !== 'string' || !Array.isArray(row.matches)) return null
      return {
        name: row.name,
        matches: row.matches
          .map((match) => sanitizePublishedBracketMatch(match))
          .filter((match): match is PublishedBracketMatch => Boolean(match)),
      }
    })
    .filter((round): round is PublishedBracketRound => Boolean(round))
}

function sanitizePublishedBracketMatch(value: unknown): PublishedBracketMatch | null {
  if (!value || typeof value !== 'object') return null
  const match = value as Record<string, unknown>
  if (typeof match.white !== 'string' || typeof match.black !== 'string') return null

  return {
    black: match.black,
    blackScore: typeof match.blackScore === 'string' ? match.blackScore : undefined,
    board: typeof match.board === 'number' ? match.board : undefined,
    gameId: typeof match.gameId === 'string' ? match.gameId : undefined,
    live: Boolean(match.live),
    matchNumber: typeof match.matchNumber === 'number' ? match.matchNumber : undefined,
    next: typeof match.next === 'number' ? match.next : undefined,
    pending: Boolean(match.pending),
    white: match.white,
    whiteScore: typeof match.whiteScore === 'string' ? match.whiteScore : undefined,
    winner: match.winner === 'white' || match.winner === 'black' ? match.winner : undefined,
  }
}

function normalizeTournamentFormat(format: string) {
  const value = format.trim()
  if (/^round[-\s]?robin$/i.test(value)) return 'Round robin'
  if (/^double\s+round[-\s]?robin$/i.test(value)) return 'Double round robin'
  return value
}

function formatRouteId(format: string) {
  return format
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function mapStatus(status: AppwriteTournamentRow['status']): TournamentStatus | null {
  if (status === 'active') return 'Active'
  if (status === 'upcoming') return 'Upcoming'
  if (status === 'completed') return 'Completed'
  return null
}

function formatRound(row: AppwriteTournamentRow) {
  if (row.currentRound && row.roundsTotal) {
    return `Round ${row.currentRound} of ${row.roundsTotal}`
  }

  if (row.currentRound) {
    return `Round ${row.currentRound}`
  }

  if (row.status === 'upcoming') {
    return 'Registration open'
  }

  if (row.status === 'completed') {
    return 'Final'
  }

  return 'In progress'
}

function formatDateRange(startsAt?: string, endsAt?: string) {
  if (!startsAt && !endsAt) return 'Date TBA'
  if (!startsAt) return `Ends ${formatDate(endsAt)}`
  if (!endsAt || startsAt === endsAt) return formatDate(startsAt)
  const startLabel = formatDate(startsAt)
  const endLabel = formatDate(endsAt)
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`
}

function formatDate(value?: string) {
  if (!value) return 'TBA'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function compareTournaments(a: Tournament, b: Tournament) {
  const statusOrder: Record<TournamentStatus, number> = {
    Upcoming: 0,
    Active: 1,
    Completed: 2,
  }

  return statusOrder[a.status] - statusOrder[b.status]
    || tournamentFormatRank(a.format) - tournamentFormatRank(b.format)
    || a.name.localeCompare(b.name)
}

function tournamentFormatRank(format: string) {
  const index = tournamentFormatOrder.findIndex((item) => item === format)
  return index >= 0 ? index : tournamentFormatOrder.length
}
