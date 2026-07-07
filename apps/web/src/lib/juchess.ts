import { Query, type Models } from 'appwrite'
import { appwriteConfig, appwriteReady, tablesDB } from './appwrite'

export type TournamentStatus = 'Active' | 'Upcoming' | 'Completed'

export type Tournament = {
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
}

type AppwriteRegistrationRow = Models.Row & {
  tournamentId?: string
  status?: 'pending' | 'confirmed' | 'waitlisted' | 'cancelled'
}

export type Member = {
  id: string
  name: string
  rating: number
  universityId: string
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
]

export const demoTournaments: Tournament[] = [
  {
    id: 'spring-open',
    name: 'JU Spring Open 2026',
    status: 'Active',
    date: 'Jun 14 - Jul 12, 2026',
    location: 'Student Union Hall B',
    format: 'Swiss',
    timeControl: '15+10 Rapid',
    participants: 12,
    capacity: 32,
    round: 'Round 4 of 7',
    desc: "The club's flagship open - seven Swiss rounds across four weekends, open to all JU students and staff.",
  },
  {
    id: 'faculty-rr',
    name: 'Faculty Round-Robin',
    status: 'Active',
    date: 'May 3 - May 31, 2026',
    location: 'Engineering Lounge',
    format: 'Round-robin',
    timeControl: '10+5 Rapid',
    participants: 6,
    capacity: 6,
    round: 'Final - 5 rounds',
    desc: 'Six faculty champions, everyone plays everyone once.',
  },
  {
    id: 'masters-drr',
    name: 'Masters Double Round-Robin',
    status: 'Active',
    date: 'Jun 1 - Jul 20, 2026',
    location: 'Library Seminar Room 2',
    format: 'Double round-robin',
    timeControl: '25+10 Classical',
    participants: 4,
    capacity: 4,
    round: 'Cycle 2 - Round 5 of 6',
    desc: 'Top four club ratings meet twice - once with each color.',
  },
  {
    id: 'knockout-cup',
    name: 'JU Knockout Cup',
    status: 'Active',
    date: 'Jun 20 - Jul 10, 2026',
    location: 'Hall A',
    format: 'Single elimination',
    timeControl: '10+0 Blitz',
    participants: 16,
    capacity: 16,
    round: 'Semifinals',
    desc: 'Sixteen enter, one lifts the cup. Straight knockout, no second chances.',
  },
  {
    id: 'blitz-de',
    name: 'Summer Blitz Double Elimination',
    status: 'Active',
    date: 'Jun 26 - Jul 5, 2026',
    location: 'Hall A',
    format: 'Double elimination',
    timeControl: '5+3 Blitz',
    participants: 12,
    capacity: 12,
    round: 'Losers Round 3',
    desc: 'Twelve blitz players, two lives each. Lose once, drop to the losers bracket; lose twice, you are out.',
  },
  {
    id: 'autumn-qualifier',
    name: 'Autumn Team Qualifier',
    status: 'Upcoming',
    date: 'Sep 12 - Sep 19, 2026',
    location: 'Student Union Hall B',
    format: 'Swiss team',
    timeControl: '15+10 Rapid',
    participants: 0,
    capacity: 40,
    round: 'Registration open',
    desc: 'Qualifying event for the university rapid team selection.',
  },
  {
    id: 'beginner-arena',
    name: 'Beginner Friday Arena',
    status: 'Upcoming',
    date: 'Aug 7, 2026',
    location: 'Club Room',
    format: 'Arena',
    timeControl: '5+0 Blitz',
    participants: 0,
    capacity: 48,
    round: 'Registration open',
    desc: 'A low-pressure club night for new players and casual members.',
  },
  {
    id: 'winter-classic',
    name: 'Winter Classic 2025',
    status: 'Completed',
    date: 'Dec 5 - Dec 19, 2025',
    location: 'Library Seminar Room 2',
    format: 'Swiss',
    timeControl: '30+30 Classical',
    participants: 18,
    capacity: 24,
    round: 'Final',
    desc: 'The previous semester classical championship.',
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
    makeSampleGame('tournament', 1, 0, 1, '1-0', 'Jul 2, 2026', 'Ruy Lopez: Closed', 'Spring Open - R4'),
    makeSampleGame('tournament', 6, 2, 3, '1/2-1/2', 'Jul 2, 2026', 'Catalan Opening', 'Spring Open - R4'),
    makeSampleGame('tournament', 3, 4, 5, '1-0', 'Jul 2, 2026', 'Sicilian: Alapin', 'Spring Open - R4'),
    makeSampleGame('tournament', 8, 1, 4, '1-0', 'Jun 27, 2026', "Queen's Gambit Accepted", 'Knockout Cup - QF'),
    makeSampleGame('tournament', 2, 3, 2, '0-1', 'Jun 27, 2026', 'London System', 'Knockout Cup - QF'),
    makeSampleGame('tournament', 5, 0, 5, '1-0', 'Jun 20, 2026', 'Italian Game: Giuoco Piano', 'Masters DRR - R3'),
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

export async function loadTournaments(): Promise<TournamentLoadResult> {
  if (!appwriteReady) {
    return {
      tournaments: [],
      source: 'unavailable',
      error: new Error('Cloud connection is not configured for this app.'),
    }
  }

  try {
    const [response, participantCounts] = await Promise.all([
      tablesDB.listRows<AppwriteTournamentRow>({
        databaseId: appwriteConfig.databaseId,
        tableId: tableIds.tournaments,
        queries: [Query.limit(100)],
        total: false,
        ttl: 30,
      }),
      loadRegistrationCounts(),
    ])

    const rows = response.rows
      .map((row) => mapAppwriteTournament(row, participantCounts))
      .filter((tournament): tournament is Tournament => Boolean(tournament))
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

async function loadRegistrationCounts() {
  const counts = new Map<string, number>()

  try {
    const response = await tablesDB.listRows<AppwriteRegistrationRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: tableIds.registrations,
      queries: [Query.limit(500)],
      total: false,
      ttl: 30,
    })

    response.rows.forEach((row) => {
      if (!row.tournamentId || row.status === 'cancelled') return
      counts.set(row.tournamentId, (counts.get(row.tournamentId) ?? 0) + 1)
    })
  } catch (error) {
    console.warn('JuChess registration count read failed.', error)
  }

  return counts
}

function mapAppwriteTournament(
  row: AppwriteTournamentRow,
  participantCounts: Map<string, number>,
): Tournament | null {
  if (!row.name || !row.format || !row.timeControl) return null

  const status = mapStatus(row.status)
  if (!status) return null

  return {
    id: row.slug || row.$id,
    name: row.name,
    status,
    date: formatDateRange(row.startsAt, row.endsAt),
    location: row.location || 'University of Jordan',
    format: row.format,
    timeControl: row.timeControl,
    participants: participantCounts.get(row.$id) ?? 0,
    capacity: row.capacity,
    round: formatRound(row),
    desc: row.description || 'Club tournament details will be published by the organizers.',
  }
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
    Active: 0,
    Upcoming: 1,
    Completed: 2,
  }

  return statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name)
}
