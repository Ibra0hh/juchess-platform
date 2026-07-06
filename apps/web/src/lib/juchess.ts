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

export const liveGames = [
  { id: 'g1', board: 1, white: 'Ibrahim Ahmad', black: 'Omar Saleh', result: 'live' },
  { id: 'g2', board: 2, white: 'Leen Haddad', black: 'Yazan Khaled', result: 'live' },
]

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
