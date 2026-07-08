import { Query, type Models } from 'appwrite'
import { appwriteConfig, appwriteReady, tablesDB } from './appwrite'

export type TournamentStatus = 'Active' | 'Upcoming' | 'Completed'

export type Tournament = {
  rowId?: string
  id: string
  name: string
  status: TournamentStatus
  date: string
  location: string
  format: string
  timeControl: string
  participants: number
  capacity?: number
  round: string
  desc: string
  registeredPlayers?: Member[]
  publishedGames?: TournamentGame[]
  bracketSnapshot?: PublishedBracketSnapshot
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
  location?: string
  capacity?: number
  description?: string
  bracketSnapshot?: string
}

type AppwriteRegistrationRow = Models.Row & {
  tournamentId?: string
  profileId?: string
  status?: 'pending' | 'confirmed' | 'waitlisted' | 'cancelled'
  seed?: number
}

type AppwriteProfileRow = Models.Row & {
  displayName?: string
  universityId?: string
  email?: string
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
  universityId: string
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
}

export type PublishedBracketSide = 'white' | 'black'
export type PublishedBracketView = 'winners' | 'losers' | 'final'

export type PublishedBracketMatch = {
  board?: number
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

export type MoveClassification = 'Brilliant' | 'Great' | 'Book' | 'Best' | 'Mistake' | 'Blunder'

export type SampleGame = {
  key: string
  id: string
  source: GameSource
  white: string
  black: string
  wRating: number
  bRating: number
  result: string
  date: string
  opening: string
  round: string
  fen: string
  moves: string[]
  classes: MoveClassification[]
  evals: number[]
  wAcc: number
  bAcc: number
  live?: boolean
}

export const tableIds = {
  profiles: 'profiles',
  tournaments: 'tournaments',
  registrations: 'registrations',
  games: 'games',
  standings: 'standings',
  announcements: 'announcements',
  adminAudit: 'admin_audit',
  identityBlocks: 'identity_blocks',
  ipBlocks: 'ip_blocks',
} as const

export const members: Member[] = [
  { id: 'ibrahim', name: 'Ibrahim Ahmad', rating: 1810, universityId: 'ibrahim_ju' },
  { id: 'omar', name: 'Omar Saleh', rating: 1740, universityId: 'omar_saleh' },
  { id: 'leen', name: 'Leen Haddad', rating: 1685, universityId: 'leenh' },
  { id: 'yazan', name: 'Yazan Khaled', rating: 1602, universityId: 'ykhaled' },
  { id: 'sara', name: 'Sara Nasser', rating: 1550, universityId: 'sara_n' },
  { id: 'mohammad', name: 'Mohammad Al-Khatib', rating: 1490, universityId: 'mohammad_ak' },
  { id: 'rania', name: 'Rania Odeh', rating: 1465, universityId: 'rania_o' },
  { id: 'khaled', name: 'Khaled Mansour', rating: 1430, universityId: 'kmansour' },
  { id: 'tala', name: 'Tala Suleiman', rating: 1395, universityId: 'tala_s' },
  { id: 'hasan', name: 'Hasan Qasem', rating: 1370, universityId: 'hqasem' },
  { id: 'noor', name: 'Noor Barakat', rating: 1340, universityId: 'noorb' },
  { id: 'zaid', name: 'Zaid Hamdan', rating: 1310, universityId: 'zhamdan' },
  { id: 'amr', name: 'Amr Zaidan', rating: 1295, universityId: 'amr_zaidan' },
  { id: 'lina', name: 'Lina Shami', rating: 1270, universityId: 'lina_shami' },
  { id: 'fadi', name: 'Fadi Rimawi', rating: 1245, universityId: 'fadi_rimawi' },
  { id: 'dana', name: 'Dana Aqel', rating: 1220, universityId: 'dana_aqel' },
  { id: 'nour', name: 'Nour Alami', rating: 1198, universityId: 'nour_alami' },
  { id: 'tamer', name: 'Tamer Qasem', rating: 1184, universityId: 'tamer_qasem' },
  { id: 'salma', name: 'Salma Nouri', rating: 1166, universityId: 'salma_nouri' },
  { id: 'adam', name: 'Adam Kareem', rating: 1148, universityId: 'adam_kareem' },
]

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

export const demoTournaments: Tournament[] = [
  {
    id: 'swiss',
    name: 'Swiss',
    status: 'Upcoming',
    date: 'Jul 20, 2026',
    location: 'Student Union Hall B',
    format: 'Swiss',
    timeControl: '15+10 Rapid',
    participants: 20,
    capacity: 20,
    round: 'Registration open',
    desc: 'Swiss test tournament.',
  },
  {
    id: 'round-robin',
    name: 'Round robin',
    status: 'Upcoming',
    date: 'Jul 22, 2026',
    location: 'Engineering Lounge',
    format: 'Round robin',
    timeControl: '10+5 Rapid',
    participants: 16,
    capacity: 16,
    round: 'Registration open',
    desc: 'Round robin test tournament.',
  },
  {
    id: 'double-round-robin',
    name: 'Double round robin',
    status: 'Upcoming',
    date: 'Jul 24, 2026',
    location: 'Library Seminar Room 2',
    format: 'Double round robin',
    timeControl: '25+10 Classical',
    participants: 18,
    capacity: 18,
    round: 'Registration open',
    desc: 'Double round robin test tournament.',
  },
  {
    id: 'single-elimination',
    name: 'Single elimination',
    status: 'Upcoming',
    date: 'Jul 26, 2026',
    location: 'Hall A',
    format: 'Single elimination',
    timeControl: '10+0 Blitz',
    participants: 16,
    capacity: 16,
    round: 'Registration open',
    desc: 'Single elimination test tournament.',
  },
  {
    id: 'double-elimination',
    name: 'Double elimination',
    status: 'Upcoming',
    date: 'Jul 28, 2026',
    location: 'Hall A',
    format: 'Double elimination',
    timeControl: '5+3 Blitz',
    participants: 20,
    capacity: 20,
    round: 'Registration open',
    desc: 'Double elimination test tournament.',
  },
  {
    id: 'multi-stage',
    name: 'Multi-stage',
    status: 'Upcoming',
    date: 'Jul 30, 2026',
    location: 'Library Seminar Room 2',
    format: 'Multi-stage',
    timeControl: '10+5 Rapid',
    participants: 18,
    capacity: 18,
    round: 'Registration open',
    desc: 'Multi-stage test tournament.',
  },
  {
    id: 'team',
    name: 'Team',
    status: 'Upcoming',
    date: 'Aug 1, 2026',
    location: 'Hall A',
    format: 'Team',
    timeControl: '10+0 Rapid',
    participants: 16,
    capacity: 16,
    round: 'Registration open',
    desc: 'Team test tournament.',
  },
  {
    id: 'arena',
    name: 'Arena',
    status: 'Upcoming',
    date: 'Aug 3, 2026',
    location: 'Club Room',
    format: 'Arena',
    timeControl: '5+0 Blitz',
    participants: 20,
    capacity: 20,
    round: 'Registration open',
    desc: 'Arena test tournament.',
  },
]

export const liveGames = [
  { id: 'g1', board: 1, white: 'Ibrahim Ahmad', black: 'Omar Saleh', result: 'live' },
  { id: 'g2', board: 2, white: 'Leen Haddad', black: 'Yazan Khaled', result: 'live' },
]

const pieceGlyphs: Record<string, string> = {
  p: '\u265f',
  n: '\u265e',
  b: '\u265d',
  r: '\u265c',
  q: '\u265b',
  k: '\u265a',
}

const sampleFens = [
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R',
  'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1',
  'r2q1rk1/pp1bppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/2KR1B1R',
  'r1bqk2r/pp2bppp/2n1pn2/2pp4/3P1B2/2P1PN2/PP1N1PPP/R2QKB1R',
  'r3r1k1/pp3ppp/2p2n2/3q4/3P4/2NB4/PP3PPP/R2Q1RK1',
  '2r2rk1/pb2qppp/1pn1pn2/8/2PP4/1PN1PN2/PB2QPPP/2R2RK1',
  'r4rk1/1pp1qppp/p1np1n2/4p3/2B1P1b1/2NP1N2/PPP1QPPP/R1B2RK1',
  '3r2k1/5ppp/2p5/1pQ5/8/1P4P1/P4P1P/3q2K1',
  '8/5pk1/6p1/8/3K4/8/5PP1/8',
]

const sampleMoves = [
  'e4',
  'e5',
  'Nf3',
  'Nc6',
  'Bc4',
  'Bc5',
  'c3',
  'Nf6',
  'd4',
  'exd4',
  'cxd4',
  'Bb4+',
  'Nc3',
  'Nxe4',
  'O-O',
  'Bxc3',
  'd5',
  'Bf6',
  'Re1',
  'Ne7',
  'Rxe4',
  'd6',
  'Bg5',
  'Bxg5',
  'Nxg5',
  'h6',
  'Qe2',
  'hxg5',
  'Re1',
  'Be6',
  'dxe6',
  'f6',
  'Qd3',
  'gxe6',
  'Rxe6',
  'Kf7',
  'Qb3',
  'Qd7',
  'Rae1',
  'Rhe8',
]

const sampleClasses: MoveClassification[] = [
  'Book',
  'Book',
  'Book',
  'Book',
  'Book',
  'Book',
  'Best',
  'Best',
  'Best',
  'Great',
  'Best',
  'Book',
  'Best',
  'Mistake',
  'Best',
  'Best',
  'Great',
  'Best',
  'Best',
  'Best',
  'Brilliant',
  'Best',
  'Best',
  'Mistake',
  'Best',
  'Blunder',
  'Best',
  'Best',
  'Best',
  'Mistake',
  'Great',
  'Best',
  'Best',
  'Blunder',
  'Brilliant',
  'Best',
  'Best',
  'Best',
  'Great',
  'Best',
]

const sampleEvals = [
  0.2,
  0.2,
  0.3,
  0.2,
  0.4,
  0.3,
  0.4,
  0.4,
  0.5,
  0.3,
  0.4,
  0.4,
  0.6,
  1.1,
  1.2,
  1.0,
  1.4,
  1.3,
  1.4,
  1.5,
  2.2,
  2.0,
  2.1,
  2.9,
  3.0,
  4.6,
  4.4,
  4.5,
  4.6,
  5.4,
  5.6,
  5.5,
  5.7,
  7.2,
  8.5,
  8.3,
  8.6,
  8.8,
  9.4,
  9.6,
]

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

function memberName(index: number) {
  return members[index]?.name || members[0].name
}

function memberRating(index: number) {
  return members[index]?.rating || members[0].rating
}

function makeSampleGame(
  source: GameSource,
  id: number,
  whiteIndex: number,
  blackIndex: number,
  result: string,
  date: string,
  opening: string,
  round = '',
): SampleGame {
  return {
    key: `${source}-${id}`,
    id: String(id),
    source,
    white: memberName(whiteIndex),
    black: memberName(blackIndex),
    wRating: memberRating(whiteIndex),
    bRating: memberRating(blackIndex),
    result,
    date,
    opening,
    round,
    fen: sampleFens[id % sampleFens.length],
    moves: sampleMoves,
    classes: sampleClasses,
    evals: sampleEvals,
    wAcc: [91.4, 84.2, 88.7, 79.3, 93.1, 86.5][id % 6],
    bAcc: [83.6, 88.9, 76.2, 90.4, 81.7, 74.9][id % 6],
  }
}

export const sampleGamesBySource: Record<GameSource, SampleGame[]> = {
  'chess.com': [
    makeSampleGame('chess.com', 1, 0, 3, '1-0', 'Jun 30, 2026', 'Italian Game: Classical'),
    makeSampleGame('chess.com', 2, 1, 0, '0-1', 'Jun 28, 2026', 'Sicilian Defense: Najdorf'),
    makeSampleGame('chess.com', 3, 0, 5, '1/2-1/2', 'Jun 26, 2026', "Queen's Gambit Declined"),
    makeSampleGame('chess.com', 4, 2, 0, '0-1', 'Jun 22, 2026', 'Ruy Lopez: Berlin'),
    makeSampleGame('chess.com', 5, 0, 4, '1-0', 'Jun 19, 2026', 'Caro-Kann: Advance'),
    makeSampleGame('chess.com', 6, 0, 1, '1-0', 'Jun 15, 2026', 'English Opening'),
    makeSampleGame('chess.com', 7, 3, 0, '1/2-1/2', 'Jun 12, 2026', 'French Defense: Tarrasch'),
    makeSampleGame('chess.com', 8, 0, 2, '1-0', 'Jun 8, 2026', 'Scotch Game'),
  ],
  lichess: [
    makeSampleGame('lichess', 2, 4, 1, '0-1', 'Jul 1, 2026', "King's Indian Defense"),
    makeSampleGame('lichess', 5, 1, 2, '1-0', 'Jun 29, 2026', 'Vienna Game'),
    makeSampleGame('lichess', 7, 3, 1, '1/2-1/2', 'Jun 25, 2026', 'Slav Defense'),
    makeSampleGame('lichess', 1, 1, 5, '1-0', 'Jun 21, 2026', 'Italian Game: Evans Gambit'),
    makeSampleGame('lichess', 4, 2, 3, '1-0', 'Jun 18, 2026', 'Nimzo-Indian Defense'),
    makeSampleGame('lichess', 3, 5, 1, '0-1', 'Jun 14, 2026', 'Pirc Defense'),
  ],
  tournament: [
    makeSampleGame('tournament', 1, 0, 1, '1-0', 'Jul 2, 2026', 'Ruy Lopez: Closed', 'Swiss - R4'),
    makeSampleGame('tournament', 6, 2, 3, '1/2-1/2', 'Jul 2, 2026', 'Catalan Opening', 'Swiss - R4'),
    makeSampleGame('tournament', 3, 4, 5, '1-0', 'Jul 2, 2026', 'Sicilian: Alapin', 'Swiss - R4'),
    makeSampleGame('tournament', 8, 1, 4, '1-0', 'Jun 27, 2026', "Queen's Gambit Accepted", 'Single elimination - QF'),
    makeSampleGame('tournament', 2, 3, 2, '0-1', 'Jun 27, 2026', 'London System', 'Single elimination - QF'),
    makeSampleGame('tournament', 5, 0, 5, '1-0', 'Jun 20, 2026', 'Italian Game: Giuoco Piano', 'Double round robin - R3'),
  ],
}

export function findSampleGame(value: string | null | undefined): SampleGame | null {
  if (!value) return null

  return Object.values(sampleGamesBySource)
    .flat()
    .find((game) => game.key === value || game.id === value) || null
}

export type TournamentLoadResult = {
  tournaments: Tournament[]
  source: 'cloud' | 'unavailable'
  error?: unknown
}

export type AnnouncementLoadResult = {
  announcements: Announcement[]
  source: 'cloud' | 'unavailable'
  error?: unknown
}

export async function loadTournaments(): Promise<TournamentLoadResult> {
  if (!appwriteReady) {
    return {
      tournaments: [],
      source: 'unavailable',
      error: new Error('Cloud connection is not configured for this app.'),
    }
  }

  try {
    const response = await tablesDB.listRows<AppwriteTournamentRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: tableIds.tournaments,
      queries: [Query.limit(100)],
      total: false,
    })

    const [registrationRows, profileRows, gameRows] = await Promise.all([
      safeListRows<AppwriteRegistrationRow>(tableIds.registrations, [Query.limit(1000)], 'registrations'),
      safeListRows<AppwriteProfileRow>(tableIds.profiles, [Query.limit(1000)], 'profiles'),
      safeListRows<AppwriteGameRow>(tableIds.games, [Query.limit(1000)], 'games'),
    ])

    const profiles = mapProfiles(profileRows)
    const playersByTournament = groupRegisteredPlayers(registrationRows, profiles)
    const gamesByTournament = groupPublishedGames(gameRows, profiles)
    const participantCounts = groupRegistrationCounts(registrationRows)

    const rows = uniqueTournamentsByFormat(response.rows
      .map((row) => mapAppwriteTournament(row, participantCounts, playersByTournament, gamesByTournament))
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
        .map(mapAnnouncement)
        .filter((item): item is Announcement => Boolean(item)),
      source: 'cloud',
    }
  } catch (error) {
    console.warn('JuChess cloud announcement read failed.', error)
    return { announcements: [], source: 'unavailable', error }
  }
}

async function safeListRows<T extends Models.Row>(tableId: string, queries: string[], label: string) {
  try {
    const response = await tablesDB.listRows<T>({
      databaseId: appwriteConfig.databaseId,
      tableId,
      queries,
      total: false,
    })

    return response.rows
  } catch (error) {
    console.warn(`JuChess cloud ${label} read failed.`, error)
    return []
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
      name: row.displayName || row.email || row.$id,
      rating: row.rating ?? 1200,
      universityId: row.universityId || row.email || row.$id,
    })
  })
  return profiles
}

function groupRegistrationCounts(rows: AppwriteRegistrationRow[]) {
  const counts = new Map<string, number>()

  rows.forEach((row) => {
    if (!row.tournamentId || row.status === 'cancelled') return
    counts.set(row.tournamentId, (counts.get(row.tournamentId) ?? 0) + 1)
  })

  return counts
}

function groupRegisteredPlayers(rows: AppwriteRegistrationRow[], profiles: Map<string, Member>) {
  const groups = new Map<string, Array<Member & { seed?: number }>>()

  rows.forEach((row) => {
    if (!row.tournamentId || !row.profileId || row.status === 'cancelled') return
    const profile = profiles.get(row.profileId)
    if (!profile) return
    const list = groups.get(row.tournamentId) ?? []
    list.push({ ...profile, seed: row.seed })
    groups.set(row.tournamentId, list)
  })

  return new Map(Array.from(groups.entries()).map(([tournamentId, players]) => [
    tournamentId,
    players
      .sort((a, b) => (a.seed ?? 9999) - (b.seed ?? 9999) || a.name.localeCompare(b.name))
      .map(({ seed: _seed, ...player }) => player),
  ]))
}

function groupPublishedGames(rows: AppwriteGameRow[], profiles: Map<string, Member>) {
  const groups = new Map<string, TournamentGame[]>()

  rows.forEach((row) => {
    if (!row.tournamentId || !row.whiteProfileId || !row.blackProfileId) return
    const white = profiles.get(row.whiteProfileId)
    const black = profiles.get(row.blackProfileId)
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
    })
    groups.set(row.tournamentId, list)
  })

  return new Map(Array.from(groups.entries()).map(([tournamentId, games]) => [
    tournamentId,
    games.sort((a, b) => a.round - b.round || a.board - b.board),
  ]))
}

function mapAppwriteTournament(
  row: AppwriteTournamentRow,
  participantCounts: Map<string, number>,
  playersByTournament: Map<string, Member[]>,
  gamesByTournament: Map<string, TournamentGame[]>,
): Tournament | null {
  if (!row.format || !row.timeControl) return null

  const status = mapStatus(row.status)
  if (!status) return null
  const format = normalizeTournamentFormat(row.format)

  return {
    rowId: row.$id,
    id: formatRouteId(format),
    name: format,
    status,
    date: formatDateRange(row.startsAt, row.endsAt),
    location: row.location || 'University of Jordan',
    format,
    timeControl: row.timeControl,
    participants: participantCounts.get(row.$id) ?? 0,
    capacity: row.capacity,
    round: formatRound(row),
    desc: row.description || 'Club tournament details will be published by the organizers.',
    registeredPlayers: playersByTournament.get(row.$id) ?? [],
    publishedGames: gamesByTournament.get(row.$id) ?? [],
    bracketSnapshot: parsePublishedBracketSnapshot(row.bracketSnapshot),
  }
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
    live: Boolean(match.live),
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
  return `${formatDate(startsAt)} - ${formatDate(endsAt)}`
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
