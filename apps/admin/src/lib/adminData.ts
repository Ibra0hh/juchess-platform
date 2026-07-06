import { ExecutionMethod, Query, type Models } from 'appwrite'
import { account, appwriteConfig, appwriteReady, functions, tablesDB } from './appwrite'
import { tableIds, type TournamentStatus } from './juchess'

export type AdminRole = 'superAdmin' | 'admin' | 'organizer'
export type AdminStatus = 'active' | 'suspended'

export type AdminProfile = Models.Row & {
  accountId: string
  displayName: string
  email: string
  role: AdminRole
  status: AdminStatus
  teamId?: string
  membershipId?: string
  createdByAdminId?: string
  createdAt?: string
  notes?: string
}

export type AdminSession = {
  user: Models.User
  profile: AdminProfile | null
  allowed: boolean
  reason?: string
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
  source: 'cloud' | 'unavailable'
  error?: unknown
}

export type IdentityBlockType = 'email' | 'universityId' | 'phone'
export type BlockStatus = 'active' | 'lifted'

export type IdentityBlock = Models.Row & {
  type: IdentityBlockType
  value: string
  reason?: string
  status: BlockStatus
  targetUserId?: string
  targetProfileId?: string
  createdByProfileId: string
  createdAt: string
  liftedByProfileId?: string
  liftedAt?: string
}

export type IpBlock = Models.Row & {
  ipRange: string
  reason?: string
  status: BlockStatus
  createdByProfileId: string
  createdAt: string
  liftedByProfileId?: string
  liftedAt?: string
}

export type BlockListLoadResult = {
  identityBlocks: IdentityBlock[]
  ipBlocks: IpBlock[]
  error?: unknown
}

export type IdentityBlockInput = {
  type: IdentityBlockType
  value: string
  reason?: string
  targetUserId?: string
  targetProfileId?: string
  actorProfileId?: string
}

export type IpBlockInput = {
  ipRange: string
  reason?: string
  actorProfileId?: string
}

export type AdminProfileInput = {
  email: string
  displayName: string
  role: AdminRole
  accountId?: string
  notes?: string
  actorProfileId?: string
}

export type AdminProfileLoadResult = {
  admins: AdminProfile[]
  error?: unknown
}

const adminFunctionId = import.meta.env.VITE_APPWRITE_ADMIN_FUNCTION_ID ?? 'admin-actions'

export async function signInAdmin(email: string, password: string) {
  requireAppwriteReady()
  await clearCurrentSession()
  await account.createEmailPasswordSession({ email, password })
  const session = await getAdminSession()
  if (!session?.allowed) {
    await signOutAdmin().catch(() => undefined)
    throw new Error(session?.reason || 'This account is not registered for the admin panel.')
  }

  return session
}

export async function signOutAdmin() {
  if (!appwriteReady) return
  await account.deleteSession({ sessionId: 'current' })
}

async function clearCurrentSession() {
  await signOutAdmin().catch(() => undefined)
}

export async function getAdminSession(): Promise<AdminSession | null> {
  if (!appwriteReady) return null

  try {
    const user = await account.get()
    try {
      const response = await runAdminAction<{ profile: AdminProfile; allowed: boolean; reason?: string }>({
        method: ExecutionMethod.GET,
        path: '/admin/session',
        body: {},
      })

      return {
        user,
        profile: response.profile,
        allowed: response.allowed,
        reason: response.reason,
      }
    } catch (error) {
      return {
        user,
        profile: null,
        allowed: false,
        reason: formatAdminError(error),
      }
    }
  } catch {
    return null
  }
}

export async function loadAdminTournaments(): Promise<AdminTournamentLoadResult> {
  if (!appwriteReady) {
    return {
      tournaments: [],
      source: 'unavailable',
      error: new Error('Cloud connection is not configured for the admin app.'),
    }
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
      tournaments,
      source: 'cloud',
    }
  } catch (error) {
    return { tournaments: [], source: 'unavailable', error }
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

export async function updateTournament(rowId: string, input: Partial<TournamentInput>) {
  const response = await runAdminAction<{ row: AppwriteTournamentRow }>({
    method: ExecutionMethod.PATCH,
    path: `/tournaments/${rowId}`,
    body: cleanTournamentInput(input),
  })

  return response.row
}

export async function deleteTournament(rowId: string) {
  const response = await runAdminAction<{ rowId: string }>({
    method: ExecutionMethod.DELETE,
    path: `/tournaments/${rowId}`,
    body: {},
  })

  return response.rowId
}

export async function loadBlockLists(): Promise<BlockListLoadResult> {
  if (!appwriteReady) return { identityBlocks: [], ipBlocks: [] }

  try {
    return await runAdminAction<BlockListLoadResult>({
      method: ExecutionMethod.GET,
      path: '/blocks',
      body: {},
    })
  } catch (error) {
    return { identityBlocks: [], ipBlocks: [], error }
  }
}

export async function loadAdminProfiles(): Promise<AdminProfileLoadResult> {
  if (!appwriteReady) return { admins: [] }

  try {
    const response = await runAdminAction<AdminProfileLoadResult>({
      method: ExecutionMethod.GET,
      path: '/admin/admins',
      body: {},
    })
    return response
  } catch (error) {
    return { admins: [], error }
  }
}

export async function createAdminProfile(input: AdminProfileInput) {
  const response = await runAdminAction<{ row: AdminProfile }>({
    method: ExecutionMethod.POST,
    path: '/admin/admins',
    body: cleanBlockInput(input),
  })

  return response.row
}

export async function updateAdminStatus(adminId: string, status: AdminStatus, actorProfileId?: string) {
  const response = await runAdminAction<{ row: AdminProfile }>({
    method: ExecutionMethod.POST,
    path: `/admin/admins/${adminId}/status`,
    body: cleanBlockInput({ status, actorProfileId }),
  })

  return response.row
}

export async function blockIdentity(input: IdentityBlockInput) {
  const response = await runAdminAction<{ row: IdentityBlock }>({
    method: ExecutionMethod.POST,
    path: '/blocks/identity',
    body: cleanBlockInput(input),
  })

  return response.row
}

export async function unblockIdentity(blockId: string, actorProfileId?: string) {
  const response = await runAdminAction<{ row: IdentityBlock }>({
    method: ExecutionMethod.POST,
    path: `/blocks/identity/${blockId}/unblock`,
    body: cleanBlockInput({ actorProfileId }),
  })

  return response.row
}

export async function blockIp(input: IpBlockInput) {
  const response = await runAdminAction<{ row: IpBlock }>({
    method: ExecutionMethod.POST,
    path: '/blocks/ip',
    body: cleanBlockInput(input),
  })

  return response.row
}

export async function unblockIp(blockId: string, actorProfileId?: string) {
  const response = await runAdminAction<{ row: IpBlock }>({
    method: ExecutionMethod.POST,
    path: `/blocks/ip/${blockId}/unblock`,
    body: cleanBlockInput({ actorProfileId }),
  })

  return response.row
}

export function formatAdminError(error: unknown) {
  if (error instanceof Error && error.message) return cloudMessage(error.message)

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return cloudMessage(message)
  }

  return 'Admin action failed.'
}

function cloudMessage(value: string) {
  return value.replace(/appwrite/gi, 'cloud')
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
  const adminJwt = await account.createJWT({ duration: 900 })

  const execution = await functions.createExecution({
    functionId: adminFunctionId,
    body: JSON.stringify(body),
    async: false,
    xpath: path,
    method,
    headers: {
      'content-type': 'application/json',
      'juchess-admin-jwt': adminJwt.jwt,
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

function cleanTournamentInput(input: Partial<TournamentInput>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== ''),
  )
}

function cleanBlockInput(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== ''),
  )
}

function requireAppwriteReady() {
  if (!appwriteReady) {
    throw new Error('Cloud connection is not configured for the admin app.')
  }
}
