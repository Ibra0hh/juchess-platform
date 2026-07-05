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

export const tableIds = {
  profiles: 'profiles',
  tournaments: 'tournaments',
  registrations: 'registrations',
  games: 'games',
  standings: 'standings',
  announcements: 'announcements',
  adminAudit: 'admin_audit',
} as const

export const prototypeTournaments: Tournament[] = [
  {
    id: 'spring-open',
    name: 'JU Spring Open 2026',
    format: 'Swiss',
    status: 'Active',
    timeControl: '15+10 Rapid',
    date: 'Jun 14 - Jul 12, 2026',
    location: 'Student Union Hall B',
    participants: 12,
    round: 'Round 4 of 7',
    desc: "The club's flagship open - seven Swiss rounds across four weekends, open to all JU students and staff.",
  },
  {
    id: 'faculty-rr',
    name: 'Faculty Round-Robin',
    format: 'Round-robin',
    status: 'Active',
    timeControl: '10+5 Rapid',
    date: 'May 3 - May 31, 2026',
    location: 'Engineering Lounge',
    participants: 6,
    round: 'Final · 5 rounds',
    desc: 'Six faculty champions, everyone plays everyone once.',
  },
  {
    id: 'masters-drr',
    name: 'Masters Double Round-Robin',
    format: 'Double round-robin',
    status: 'Active',
    timeControl: '25+10 Classical',
    date: 'Jun 1 - Jul 20, 2026',
    location: 'Library Seminar Room 2',
    participants: 4,
    round: 'Cycle 2 · Round 5 of 6',
    desc: 'Top four club ratings meet twice - once with each color.',
  },
  {
    id: 'knockout-cup',
    name: 'JU Knockout Cup',
    format: 'Single elimination',
    status: 'Active',
    timeControl: '10+0 Blitz',
    date: 'Jun 20 - Jul 10, 2026',
    location: 'Hall A',
    participants: 16,
    round: 'Semifinals',
    desc: 'Sixteen enter, one lifts the cup. Straight knockout, no second chances.',
  },
  {
    id: 'blitz-de',
    name: 'Summer Blitz Double Elimination',
    format: 'Double elimination',
    status: 'Active',
    timeControl: '5+3 Blitz',
    date: 'Jun 26 - Jul 5, 2026',
    location: 'Hall A',
    participants: 12,
    round: 'Losers Round 3',
    desc: "Twelve blitz players, two lives each. Lose once, drop to the losers bracket; lose twice, you're out.",
  },
  {
    id: 'amman-league',
    name: 'Amman University League',
    format: 'League',
    status: 'Active',
    timeControl: '15+10 Rapid',
    date: 'Feb 8 - Nov 22, 2026',
    location: 'Rotating campuses',
    participants: 8,
    round: 'Week 14 of 22',
    desc: 'Season-long league - one fixture a week, three points for a win.',
  },
  {
    id: 'ju-gju-match',
    name: 'JU vs GJU Team Match',
    format: 'Team',
    status: 'Active',
    timeControl: '25+10 Classical',
    date: 'Jun 13, 2026',
    location: 'JU Main Auditorium',
    participants: 8,
    round: 'Final score 2.5 - 1.5',
    desc: 'Annual four-board friendly against German Jordanian University.',
  },
  {
    id: 'friday-arena',
    name: 'Friday Night Arena',
    format: 'Arena',
    status: 'Active',
    timeControl: '3+2 Blitz',
    date: 'Jul 3, 2026 · 7:00-9:00 PM',
    location: 'Online · Club room',
    participants: 12,
    round: 'In progress · ends 9:00 PM',
    desc: 'Two hours, unlimited games, streak bonuses. Highest score wins.',
  },
  {
    id: 'championship',
    name: 'JU Championship 2026',
    format: 'Multi-stage',
    status: 'Active',
    timeControl: '15+10 Rapid',
    date: 'May 10 - Jul 25, 2026',
    location: 'Hall A + Hall B',
    participants: 12,
    round: 'Stage 2 · Quarterfinals',
    desc: 'Stage 1: 12-player Swiss qualifies the top eight. Stage 2: knockout for the university title.',
  },
]

export const tournaments = prototypeTournaments

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

export const liveGames = [
  { id: 'g1', board: 1, white: 'Ibrahim Ahmad', black: 'Omar Saleh', result: 'live' },
  { id: 'g2', board: 2, white: 'Leen Haddad', black: 'Yazan Khaled', result: 'live' },
]

export type TournamentLoadResult = {
  tournaments: Tournament[]
  source: 'appwrite' | 'prototype'
  error?: unknown
}

export async function loadTournaments(): Promise<TournamentLoadResult> {
  if (!appwriteReady) {
    return { tournaments: prototypeTournaments, source: 'prototype' }
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
      tournaments: rows.length ? rows : prototypeTournaments,
      source: rows.length ? 'appwrite' : 'prototype',
    }
  } catch (error) {
    console.warn('JuChess Appwrite tournament read failed; using prototype data.', error)
    return { tournaments: prototypeTournaments, source: 'prototype', error }
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
    console.warn('JuChess Appwrite registration count read failed.', error)
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
