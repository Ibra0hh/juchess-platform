import { ExecutionMethod, Query, type Models } from 'appwrite'
import { account, appwriteConfig, appwriteReady, functions, tablesDB } from './appwrite'
import { tableIds, tournaments as prototypeTournaments, type TournamentStatus } from './juchess'

export type AdminProfile = Models.Row & {
  accountId: string
  displayName: string
  email: string
  role?: 'member' | 'organizer' | 'admin'
  status?: 'pending' | 'active' | 'suspended'
}

export type AdminSession = {
  user: Models.User
  profile: AdminProfile | null
  allowed: boolean
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

export type AdminTournament = {
  id: string
  rowId?: string
  slug: string
  name: string
  status: TournamentStatus
  players: number
  capacity: number
  format: string
  timeControl: string
  round: string
  startsAt?: string
  location?: string
  description?: string
}

export type TournamentInput = {
  slug: string
  name: string
  status: TournamentStatus
  format: string
  timeControl: string
  roundsTotal?: number
  currentRound?: number
  startsAt?: string
  endsAt?: string
  location?: string
  capacity?: number
  description?: string
  createdByProfileId?: string
}

export type AdminTournamentLoadResult = {
  tournaments: AdminTournament[]
  source: 'appwrite' | 'prototype'
  error?: unknown
}

const adminFunctionId = import.meta.env.VITE_APPWRITE_ADMIN_FUNCTION_ID ?? 'admin-actions'

export async function signInAdmin(email: string, password: string) {
  requireAppwriteReady()
  await account.createEmailPasswordSession({ email, password })
  return getAdminSession()
}

export async function signOutAdmin() {
  if (!appwriteReady) return
  await account.deleteSession({ sessionId: 'current' })
}

export async function getAdminSession(): Promise<AdminSession | null> {
  if (!appwriteReady) return null

  try {
    const user = await account.get()
    const profile = await loadAdminProfile(user.$id)
    const allowed = Boolean(
      profile
        && profile.status !== 'suspended'
        && (profile.role === 'admin' || profile.role === 'organizer'),
    )

    return { user, profile, allowed }
  } catch {
    return null
  }
}

export async function loadAdminTournaments(): Promise<AdminTournamentLoadResult> {
  if (!appwriteReady) {
    return { tournaments: mapPrototypeTournaments(), source: 'prototype' }
  }

  try {
    const [rows, participantCounts] = await Promise.all([
      tablesDB.listRows<AppwriteTournamentRow>({
        databaseId: appwriteConfig.databaseId,
        tableId: tableIds.tournaments,
        queries: [Query.limit(100)],
        total: false,
        ttl: 15,
      }),
      loadRegistrationCounts(),
    ])

    const tournaments = rows.rows
      .map((row) => mapTournament(row, participantCounts))
      .filter((tournament): tournament is AdminTournament => Boolean(tournament))
      .sort((a, b) => statusOrder(a.status) - statusOrder(b.status) || a.name.localeCompare(b.name))

    return {
      tournaments: tournaments.length ? tournaments : mapPrototypeTournaments(),
      source: tournaments.length ? 'appwrite' : 'prototype',
    }
  } catch (error) {
    return { tournaments: mapPrototypeTournaments(), source: 'prototype', error }
  }
}

export async function createTournament(input: TournamentInput) {
  const response = await runAdminAction<{ row: AppwriteTournamentRow }>({
    method: ExecutionMethod.POST,
    path: '/tournaments',
    body: cleanTournamentInput(input),
  })

  return response.row
}

export function formatAdminError(error: unknown) {
  if (error instanceof Error && error.message) return error.message

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }

  return 'Admin action failed.'
}

async function loadAdminProfile(accountId: string): Promise<AdminProfile | null> {
  const response = await tablesDB.listRows<AdminProfile>({
    databaseId: appwriteConfig.databaseId,
    tableId: tableIds.profiles,
    queries: [Query.equal('accountId', accountId), Query.limit(1)],
    total: false,
    ttl: 30,
  })

  return response.rows[0] ?? null
}

async function loadRegistrationCounts() {
  const counts = new Map<string, number>()

  try {
    const response = await tablesDB.listRows<AppwriteRegistrationRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: tableIds.registrations,
      queries: [Query.limit(500)],
      total: false,
      ttl: 15,
    })

    response.rows.forEach((row) => {
      if (!row.tournamentId || row.status === 'cancelled') return
      counts.set(row.tournamentId, (counts.get(row.tournamentId) ?? 0) + 1)
    })
  } catch (error) {
    console.warn('Admin registration count read failed.', error)
  }

  return counts
}

function mapTournament(
  row: AppwriteTournamentRow,
  participantCounts: Map<string, number>,
): AdminTournament | null {
  if (!row.name || !row.slug || !row.format || !row.timeControl) return null
  const status = row.status === 'draft' || row.status === 'cancelled' ? 'upcoming' : row.status
  if (!status) return null

  return {
    id: row.slug,
    rowId: row.$id,
    slug: row.slug,
    name: row.name,
    status,
    players: participantCounts.get(row.$id) ?? 0,
    capacity: row.capacity ?? 0,
    format: row.format,
    timeControl: row.timeControl,
    round: formatRound(row),
    startsAt: row.startsAt,
    location: row.location,
    description: row.description,
  }
}

function mapPrototypeTournaments(): AdminTournament[] {
  return prototypeTournaments.map((tournament) => ({
    id: tournament.id,
    slug: tournament.id,
    name: tournament.name,
    status: tournament.status,
    players: tournament.players,
    capacity: tournament.capacity,
    format: 'Prototype',
    timeControl: '15+10 Rapid',
    round: tournament.round,
  }))
}

function formatRound(row: AppwriteTournamentRow) {
  if (row.currentRound && row.roundsTotal) return `Round ${row.currentRound} of ${row.roundsTotal}`
  if (row.currentRound) return `Round ${row.currentRound}`
  if (row.status === 'completed') return 'Final'
  if (row.status === 'upcoming' || row.status === 'draft') return 'Registration'
  return 'In progress'
}

function statusOrder(status: TournamentStatus) {
  if (status === 'active') return 0
  if (status === 'upcoming') return 1
  return 2
}

async function runAdminAction<T>({
  method,
  path,
  body,
}: {
  method: ExecutionMethod
  path: string
  body: Record<string, unknown>
}): Promise<T> {
  requireAppwriteReady()

  const execution = await functions.createExecution({
    functionId: adminFunctionId,
    body: JSON.stringify(body),
    async: false,
    xpath: path,
    method,
    headers: {
      'content-type': 'application/json',
    },
  })

  const payload = parseExecutionBody<T & { ok?: boolean; error?: string; detail?: string }>(execution.responseBody)
  if (execution.responseStatusCode >= 400 || payload.ok === false) {
    throw new Error(payload.detail || payload.error || 'Admin function rejected the request.')
  }

  return payload
}

function parseExecutionBody<T>(body: string): T {
  try {
    return JSON.parse(body) as T
  } catch {
    throw new Error('Admin function returned an unreadable response.')
  }
}

function cleanTournamentInput(input: TournamentInput): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== ''),
  )
}

function requireAppwriteReady() {
  if (!appwriteReady) {
    throw new Error('Appwrite is not configured for the admin app.')
  }
}
