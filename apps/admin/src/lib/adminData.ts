import { ExecutionMethod, ID, Query, type Models } from 'appwrite'
import { account, appwriteConfig, appwriteReady, functions, storage, tablesDB } from './appwrite'
import { tableIds, type TournamentStatus } from './juchess'

export type AdminRole = 'superAdmin' | 'admin' | 'organizer'
export type AdminStatus = 'active' | 'suspended'
export type OnlineTournamentPlatform = 'chessCom' | 'lichess' | 'juchess'
export type RecruitmentStatus = 'submitted' | 'reviewing' | 'shortlisted' | 'interview' | 'accepted' | 'rejected' | 'withdrawn'

const tournamentAssetsBucketId = 'tournament-assets'
const tournamentMediaPrefix = 'ju-media'
const profileMediaBucketId = 'avatars'

export type TournamentMedia = {
  id: string
  tournamentId: string
  name: string
  storedName: string
  mimeType: string
  size: number
  createdAt: string
  tags: string[]
  viewUrl: string
  downloadUrl: string
}

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
  status?: 'draft' | 'upcoming' | 'active' | 'completed' | 'archived' | 'cancelled'
  format?: string
  timeControl?: string
  roundsTotal?: number
  currentRound?: number
  startsAt?: string
  endsAt?: string
  registrationDeadline?: string
  playMode?: 'inPerson' | 'online'
  onlinePlatform?: OnlineTournamentPlatform
  location?: string
  capacity?: number
  description?: string
  bracketSnapshot?: string
  physicalBoards?: number
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
  procedureWave?: number
  physicalBoard?: number
  queuePosition?: number
  startedAt?: string
  finishedAt?: string
}

type AppwriteRegistrationRow = Models.Row & {
  tournamentId?: string
  profileId?: string
  status?: 'pending' | 'confirmed' | 'waitlisted' | 'cancelled'
  seed?: number
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

type AppwriteProfileRow = Models.Row & {
  displayName?: string
  email?: string
  universityId?: string
  phone?: string
  rating?: number
  role?: string
  status?: string
  avatarFileId?: string
  coverFileId?: string
}

export type RecruitmentApplicant = {
  id: string
  displayName: string
  email: string
  phone: string
  universityId: string
  rating: number
  status: string
  avatarFileId?: string
  coverFileId?: string
}

export type RecruitmentReview = Models.Row & {
  applicationId: string
  internalNotes?: string
  interviewAt?: string
  assignedTo?: string
  updatedByAdminId: string
  updatedAt: string
}

export type RecruitmentApplication = Models.Row & {
  profileId: string
  accountId: string
  interests: string[]
  skills: string
  contribution: string
  developmentGoals?: string
  availability: string
  portfolioUrl?: string
  status: RecruitmentStatus
  submittedAt: string
  updatedAt: string
  applicant: RecruitmentApplicant | null
  review: RecruitmentReview | null
}

export type RecruitmentApplicationsResult = {
  applications: RecruitmentApplication[]
  error?: string
}

export type RecruitmentReviewInput = {
  status: RecruitmentStatus
  internalNotes: string
  interviewAt: string
  assignedTo: string
}

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
  roundsTotal?: number
  currentRound?: number
  startsAt?: string
  registrationDeadline?: string
  playMode: 'inPerson' | 'online'
  onlinePlatform?: OnlineTournamentPlatform
  location?: string
  description?: string
  publishedGames: number
  publishedGameRows: AdminGame[]
  standings: AdminStanding[]
  bracketSnapshot?: string
  physicalBoards: number
}

export type AdminStanding = {
  id: string
  tournamentId: string
  profileId: string
  rank: number
  points: number
  tieBreak: number
  played: number
  wins: number
  draws: number
  losses: number
}

export type AdminGame = {
  id: string
  tournamentId: string
  round: number
  board: number
  whiteProfileId: string
  blackProfileId: string
  whiteName: string
  blackName: string
  whiteRating: number
  blackRating: number
  status: 'scheduled' | 'live' | 'completed' | 'forfeit'
  result: '1-0' | '0-1' | '1/2-1/2' | '*'
  pgn?: string
  procedureWave?: number
  physicalBoard?: number
  queuePosition?: number
  startedAt?: string
  finishedAt?: string
}

export type AdminRegistrationStatus = 'pending' | 'confirmed' | 'waitlisted' | 'cancelled'
export type AdminAttendanceStatus = 'pending' | 'confirmed' | 'declined'
export type AdminAttendanceDeliveryStatus = 'pending' | 'sent' | 'unavailable' | 'failed' | 'skipped'

export type AdminRegistration = {
  rowId: string
  tournamentId: string
  profileId: string
  playerName: string
  email?: string
  universityId?: string
  rating?: number
  status: AdminRegistrationStatus
  seed?: number
  attendanceStatus?: AdminAttendanceStatus
  attendanceRemindedAt?: string
  attendanceRespondedAt?: string
  attendanceResponseSource?: 'web' | 'app' | 'email'
  attendanceEmailStatus?: AdminAttendanceDeliveryStatus
  attendancePushStatus?: AdminAttendanceDeliveryStatus
}

export type RegistrationLoadResult = {
  registrations: AdminRegistration[]
  error?: unknown
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
  registrationDeadline?: string
  playMode?: 'inPerson' | 'online'
  onlinePlatform?: OnlineTournamentPlatform
  location?: string
  capacity?: number
  description?: string
  physicalBoards?: number
  createdByProfileId?: string
}

export type PairingPublishInput = {
  round: number
  board: number
  whiteProfileId: string
  blackProfileId: string
  status?: 'scheduled' | 'live'
  result?: '*'
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
    const [rows, participantCounts, gamesByTournament, standingsByTournament] = await Promise.all([
      tablesDB.listRows<AppwriteTournamentRow>({
        databaseId: appwriteConfig.databaseId,
        tableId: tableIds.tournaments,
        queries: [Query.limit(100)],
        total: false,
        // Tournament edits must be reflected immediately after Save changes.
        // Appwrite list caches are not invalidated by row updates.
        ttl: 0,
      }),
      loadRegistrationCounts(),
      loadPublishedGamesByTournament(),
      loadStandingsByTournament(),
    ])

    const tournaments = uniqueTournamentsByFormat(rows.rows
      .map((row) => mapTournament(row, participantCounts, gamesByTournament, standingsByTournament))
      .filter((tournament): tournament is AdminTournament => Boolean(tournament)))
      .sort(compareTournaments)

    return {
      tournaments,
      source: 'cloud',
    }
  } catch (error) {
    return { tournaments: [], source: 'unavailable', error }
  }
}

function uniqueTournamentsByFormat(tournaments: AdminTournament[]) {
  const rows = new Map<string, AdminTournament>()
  tournaments.forEach((tournament) => {
    if (!rows.has(tournament.id)) rows.set(tournament.id, tournament)
  })
  return Array.from(rows.values())
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

export async function publishTournamentPairings(rowId: string, games: PairingPublishInput[], bracketSnapshot?: string) {
  const response = await runAdminAction<{ rows: AppwriteGameRow[] }>({
    method: ExecutionMethod.POST,
    path: `/tournaments/${rowId}/pairings/publish`,
    body: {
      games: games.map((game) => ({
        round: game.round,
        board: game.board,
        whiteProfileId: game.whiteProfileId,
        blackProfileId: game.blackProfileId,
        status: game.status ?? 'scheduled',
        result: game.result ?? '*',
      })),
      bracketSnapshot,
    },
  })

  return response.rows
}

export async function unpublishTournamentPairings(rowId: string) {
  const response = await runAdminAction<{ deleted: number }>({
    method: ExecutionMethod.POST,
    path: `/tournaments/${rowId}/pairings/unpublish`,
    body: {},
  })

  return response.deleted
}

export async function submitTournamentGameResult(input: {
  gameId?: string
  tournamentId?: string
  round?: number
  board?: number
  result: '1-0' | '0-1' | '1/2-1/2' | '*'
  status?: 'live' | 'completed'
  pgn?: string
}) {
  const response = await runAdminAction<{ row: AppwriteGameRow }>({
    method: ExecutionMethod.POST,
    path: input.gameId
      ? `/games/${input.gameId}/result`
      : `/tournaments/${input.tournamentId}/games/result`,
    body: cleanBlockInput({
      round: input.round,
      board: input.board,
      result: input.result,
      status: input.status,
      pgn: input.pgn,
    }),
  })

  return response.row
}

export async function listTournamentMedia(tournamentId: string): Promise<TournamentMedia[]> {
  const response = await storage.listFiles({
    bucketId: tournamentAssetsBucketId,
    queries: [Query.limit(500)],
    total: false,
  })

  return response.files
    .map(mapTournamentMedia)
    .filter((item): item is TournamentMedia => item?.tournamentId === tournamentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function uploadTournamentMedia(tournamentId: string, file: File) {
  const storedName = `${tournamentMediaPrefix}--${tournamentId}--${Date.now()}--${sanitizeMediaName(file.name)}`
  const storedFile = new File([file], storedName, { type: file.type, lastModified: file.lastModified })

  await storage.createFile({
    bucketId: tournamentAssetsBucketId,
    fileId: ID.unique(),
    file: storedFile,
  })
}

export async function deleteTournamentMedia(fileId: string) {
  await storage.deleteFile({ bucketId: tournamentAssetsBucketId, fileId })
}

export async function updateTournamentMediaTags(item: TournamentMedia, tags: string[]) {
  const parts = item.storedName.split('--')
  if (parts.length < 4 || parts[0] !== tournamentMediaPrefix) {
    throw new Error('This media filename cannot be updated.')
  }

  const nameIndex = parts[3]?.startsWith('tags=') ? 4 : 3
  const originalName = parts.slice(nameIndex).join('--') || sanitizeMediaName(item.name)
  const normalizedTags = normalizeMediaTags(tags)
  const encodedTags = encodeMediaTags(normalizedTags)
  const tagSegment = encodedTags.length
    ? `--tags=${encodedTags.join('+')}`
    : ''
  const prefix = `${tournamentMediaPrefix}--${parts[1]}--${parts[2]}${tagSegment}--`
  const name = `${prefix}${originalName.slice(-Math.max(20, 240 - prefix.length))}`
  const updated = await storage.updateFile({
    bucketId: tournamentAssetsBucketId,
    fileId: item.id,
    name,
  })
  return mapTournamentMedia(updated)
}

function mapTournamentMedia(file: Models.File): TournamentMedia | null {
  const parts = file.name.split('--')
  if (parts.length < 4 || parts[0] !== tournamentMediaPrefix || !parts[1]) return null

  const tagged = parts[3]?.startsWith('tags=')
  const tags = tagged
    ? parts[3].slice(5).split('+').map(decodeMediaTag).filter(Boolean)
    : []
  const nameIndex = tagged ? 4 : 3

  return {
    id: file.$id,
    tournamentId: parts[1],
    name: parts.slice(nameIndex).join('--').replaceAll('_', ' '),
    storedName: file.name,
    mimeType: file.mimeType,
    size: file.sizeOriginal,
    createdAt: file.$createdAt,
    tags,
    viewUrl: storage.getFileView({ bucketId: tournamentAssetsBucketId, fileId: file.$id }),
    downloadUrl: storage.getFileDownload({ bucketId: tournamentAssetsBucketId, fileId: file.$id }),
  }
}

function normalizeMediaTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase().slice(0, 32)).filter(Boolean))).slice(0, 12)
}

function encodeMediaTag(tag: string) {
  return encodeURIComponent(tag).replaceAll('-', '%2D')
}

function encodeMediaTags(tags: string[]) {
  const encoded: string[] = []
  for (const tag of tags) {
    const next = encodeMediaTag(tag)
    if ([...encoded, next].join('+').length > 96) break
    encoded.push(next)
  }
  return encoded
}

function decodeMediaTag(tag: string) {
  try {
    return decodeURIComponent(tag).trim()
  } catch {
    return tag.replaceAll('_', ' ').trim()
  }
}

function sanitizeMediaName(value: string) {
  const safe = value.trim().replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '')
  return (safe || 'tournament-media').slice(-120)
}

export async function configureTournamentProcedure(rowId: string, physicalBoards: number) {
  return await runAdminAction<{ physicalBoards: number; updatedGames: number }>({
    method: ExecutionMethod.POST,
    path: `/tournaments/${rowId}/procedure/configure`,
    body: { physicalBoards },
  })
}

export type FairPlayProfileSummary = {
  profileId: string
  events: number
  hiddenCount: number
  hiddenDurationMs: number
  fullscreenExits: number
  disconnects: number
  analysisAttempts: number
  lastEventAt?: string
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high'
}

export type FairPlayReport = {
  byProfile: FairPlayProfileSummary[]
  events: Array<Record<string, unknown>>
}

export async function loadTournamentFairPlayReport(tournamentId: string) {
  return await runAdminAction<FairPlayReport>({
    method: ExecutionMethod.POST,
    path: '/fair-play/report',
    body: { tournamentId },
  })
}

export async function startTournamentGame(gameId: string, physicalBoard: number) {
  const response = await runAdminAction<{ row: AppwriteGameRow }>({
    method: ExecutionMethod.POST,
    path: `/games/${gameId}/start`,
    body: { physicalBoard },
  })

  return response.row
}

export async function updateTournamentGamePgn(gameId: string, pgn: string) {
  const response = await runAdminAction<{ row: AppwriteGameRow }>({
    method: ExecutionMethod.POST,
    path: `/games/${gameId}/pgn`,
    body: { pgn },
  })

  return response.row
}

/** The bye sentinel is a scheduling placeholder, never a club member. */
export const SYSTEM_BYE_PROFILE_ID = 'system_bye'

export type ClubPlayer = {
  id: string
  name: string
  universityId: string
  rating: number
  email: string
  phone: string
  role: string
  status: string
  avatarUrl: string
  coverUrl: string
}

export type ClubPlayersResult = {
  players: ClubPlayer[]
  error?: string
}

export type PlayerEmailStatus = {
  ready: boolean
  provider: string | null
}

export type PlayerEmailSendResult = {
  messageId: string
  status?: string
  queued: Array<{ profileId: string; name: string }>
  skipped: Array<{ profileId: string; name: string; reason: string }>
}

export async function loadClubPlayers(): Promise<ClubPlayersResult> {
  if (!appwriteReady) return { players: [] }

  try {
    const response = await runAdminAction<{ rows: AppwriteProfileRow[] }>({
      method: ExecutionMethod.GET,
      path: '/players',
    })

    const players = response.rows
      .filter((row) => row.$id !== SYSTEM_BYE_PROFILE_ID)
      .map((row) => ({
        id: row.$id,
        name: row.displayName || row.$id,
        universityId: row.universityId || '-',
        rating: row.rating ?? 1200,
        email: row.email ?? '',
        phone: row.phone ?? '',
        role: row.role ?? 'member',
        status: row.status ?? 'active',
        avatarUrl: profileMediaUrl(row.avatarFileId),
        coverUrl: profileMediaUrl(row.coverFileId),
      }))
      .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))

    return { players }
  } catch (error) {
    console.warn('JuChess club players could not be loaded.', error)
    return { players: [], error: formatAdminError(error) }
  }
}

export function profileMediaUrl(fileId?: string) {
  if (!fileId) return ''
  if (/^(blob:|data:|https?:)/.test(fileId)) return fileId
  return String(storage.getFileView({ bucketId: profileMediaBucketId, fileId }))
}

export async function loadRecruitmentApplications(): Promise<RecruitmentApplicationsResult> {
  if (!appwriteReady) return { applications: [] }

  try {
    return await runAdminAction<RecruitmentApplicationsResult>({
      method: ExecutionMethod.GET,
      path: '/recruitment/applications',
    })
  } catch (error) {
    return { applications: [], error: formatAdminError(error) }
  }
}

export async function updateRecruitmentApplication(applicationId: string, input: RecruitmentReviewInput) {
  const response = await runAdminAction<{ row: RecruitmentApplication; review: RecruitmentReview | null }>({
    method: ExecutionMethod.PATCH,
    path: `/recruitment/applications/${applicationId}`,
    body: input,
  })
  return response
}

export async function deleteClubPlayers(profileIds: string[]) {
  const response = await runAdminAction<{ deleted: Array<{ profileId: string; name: string }> }>({
    method: ExecutionMethod.DELETE,
    path: '/players',
    body: { profileIds },
  })

  return response.deleted
}

export async function loadPlayerEmailStatus(): Promise<PlayerEmailStatus> {
  return await runAdminAction<PlayerEmailStatus>({
    method: ExecutionMethod.GET,
    path: '/players/email/status',
  })
}

export async function sendPlayerEmail(input: { profileIds: string[]; subject: string; message: string }) {
  return await runAdminAction<PlayerEmailSendResult>({
    method: ExecutionMethod.POST,
    path: '/players/email',
    body: input,
  })
}

export async function countPendingRegistrations(): Promise<number> {
  if (!appwriteReady) return 0

  try {
    const response = await tablesDB.listRows({
      databaseId: appwriteConfig.databaseId,
      tableId: tableIds.registrations,
      queries: [Query.equal('status', 'pending'), Query.limit(1000)],
      total: false,
    })
    return response.rows.length
  } catch {
    return 0
  }
}

export type AdminAttendanceConfirmation = {
  rowId: string
  tournamentId: string
  profileId: string
  registrationId: string
  status: AdminAttendanceStatus
  reminderSentAt?: string
  respondedAt?: string
  responseSource?: 'web' | 'app' | 'email'
  reminderEmailStatus?: AdminAttendanceDeliveryStatus
  reminderPushStatus?: AdminAttendanceDeliveryStatus
}

/**
 * Attendance responses are private. Staff fetch them through the admin
 * function while players can read only their own row.
 */
export async function loadTournamentAttendance(tournamentRowId: string): Promise<AdminAttendanceConfirmation[]> {
  if (!appwriteReady || !tournamentRowId) return []

  try {
    const response = await runAdminAction<{ attendance: Array<Record<string, unknown>> }>({
      method: ExecutionMethod.GET,
      path: `/tournaments/${tournamentRowId}/attendance`,
    })

    return (response.attendance ?? []).map((row) => ({
      rowId: String(row.$id ?? ''),
      tournamentId: String(row.tournamentId ?? ''),
      profileId: String(row.profileId ?? ''),
      registrationId: String(row.registrationId ?? ''),
      status: (row.status === 'confirmed' || row.status === 'declined' ? row.status : 'pending'),
      reminderSentAt: typeof row.reminderSentAt === 'string' ? row.reminderSentAt : undefined,
      respondedAt: typeof row.respondedAt === 'string' ? row.respondedAt : undefined,
      responseSource: row.responseSource === 'web' || row.responseSource === 'app' || row.responseSource === 'email'
        ? row.responseSource
        : undefined,
      reminderEmailStatus: parseAttendanceDeliveryStatus(row.reminderEmailStatus),
      reminderPushStatus: parseAttendanceDeliveryStatus(row.reminderPushStatus),
    }))
  } catch (error) {
    console.warn('JuChess attendance confirmations could not be loaded.', error)
    return []
  }
}

function parseAttendanceDeliveryStatus(value: unknown): AdminAttendanceDeliveryStatus | undefined {
  return value === 'pending' || value === 'sent' || value === 'unavailable' || value === 'failed' || value === 'skipped'
    ? value
    : undefined
}

export type AdvanceRoundResult = {
  advanced: boolean
  completed?: boolean
  currentRound?: number
  stageTwo?: boolean
  reset?: boolean
  reason?: string
}

export async function advanceTournamentRound(rowId: string, completedRound?: number) {
  return await runAdminAction<AdvanceRoundResult>({
    method: ExecutionMethod.POST,
    path: `/tournaments/${rowId}/rounds/next`,
    body: cleanBlockInput({ completedRound }),
  })
}

export async function loadTournamentRegistrations(tournamentRowId: string): Promise<RegistrationLoadResult> {
  if (!appwriteReady || !tournamentRowId) return { registrations: [] }

  try {
    const [response, attendanceRows] = await Promise.all([
      tablesDB.listRows<AppwriteRegistrationRow>({
        databaseId: appwriteConfig.databaseId,
        tableId: tableIds.registrations,
        queries: [Query.equal('tournamentId', tournamentRowId), Query.limit(500)],
        total: false,
        ttl: 0,
      }),
      loadTournamentAttendance(tournamentRowId),
    ])
    const profiles = await loadProfilesById(response.rows.map((row) => row.profileId).filter(Boolean) as string[])
    const attendanceByRegistration = new Map(attendanceRows.map((row) => [row.registrationId, row]))

    const registrations = response.rows
      .map((row) => mapRegistration(row, profiles, attendanceByRegistration.get(row.$id)))
      .filter((row): row is AdminRegistration => Boolean(row))

    return {
      registrations: dedupeAdminRegistrations(registrations).sort(compareRegistrationRows),
    }
  } catch (error) {
    return { registrations: [], error }
  }
}

export async function updateRegistrationStatus(
  rowId: string,
  input: {
    status?: AdminRegistrationStatus
    seed?: number
  },
) {
  const response = await runAdminAction<{ row: AppwriteRegistrationRow }>({
    method: ExecutionMethod.POST,
    path: `/registrations/${rowId}/confirm`,
    body: cleanBlockInput(input),
  })

  return response.row
}

export async function addTournamentParticipant(tournamentRowId: string, profileId: string) {
  const response = await runAdminAction<{ row: AppwriteRegistrationRow; attendance: Record<string, unknown> }>(
    {
      method: ExecutionMethod.POST,
      path: `/tournaments/${tournamentRowId}/participants`,
      body: { profileId },
    },
  )

  return response
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
  const countedPlayers = new Set<string>()

  try {
    const response = await tablesDB.listRows<AppwriteRegistrationRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: tableIds.registrations,
      queries: [Query.limit(500)],
      total: false,
      ttl: 0,
    })

    response.rows.forEach((row) => {
      if (!row.tournamentId || row.status !== 'confirmed') return
      const key = `${row.tournamentId}:${row.profileId}`
      if (!row.profileId || countedPlayers.has(key)) return
      countedPlayers.add(key)
      counts.set(row.tournamentId, (counts.get(row.tournamentId) ?? 0) + 1)
    })
  } catch (error) {
    console.warn('Admin registration count read failed.', error)
  }

  return counts
}

async function loadPublishedGamesByTournament() {
  const gamesByTournament = new Map<string, AdminGame[]>()

  try {
    const [gameResponse, profileResponse] = await Promise.all([
      tablesDB.listRows<AppwriteGameRow>({
        databaseId: appwriteConfig.databaseId,
        tableId: tableIds.games,
        queries: [Query.limit(1000)],
        total: false,
        ttl: 0,
      }),
      tablesDB.listRows<AppwriteProfileRow>({
        databaseId: appwriteConfig.databaseId,
        tableId: tableIds.profiles,
        queries: [Query.limit(1000)],
        total: false,
        ttl: 0,
      }),
    ])
    const profiles = new Map(profileResponse.rows.map((row) => [row.$id, row]))

    gameResponse.rows.forEach((row) => {
      if (!row.tournamentId || !row.whiteProfileId || !row.blackProfileId) return
      const white = profiles.get(row.whiteProfileId)
      const black = profiles.get(row.blackProfileId)
      const list = gamesByTournament.get(row.tournamentId) ?? []
      list.push({
        id: row.$id,
        tournamentId: row.tournamentId,
        round: row.round ?? 1,
        board: row.board ?? list.length + 1,
        whiteProfileId: row.whiteProfileId,
        blackProfileId: row.blackProfileId,
        whiteName: white?.displayName || row.whiteProfileId,
        blackName: black?.displayName || row.blackProfileId,
        whiteRating: white?.rating ?? 1200,
        blackRating: black?.rating ?? 1200,
        status: row.status ?? 'scheduled',
        result: row.result ?? '*',
        pgn: row.pgn,
        procedureWave: row.procedureWave,
        physicalBoard: row.physicalBoard,
        queuePosition: row.queuePosition,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
      })
      gamesByTournament.set(row.tournamentId, list)
    })
  } catch (error) {
    console.warn('Admin game read failed.', error)
  }

  return new Map(Array.from(gamesByTournament.entries()).map(([tournamentId, games]) => [
    tournamentId,
    games.sort((a, b) => a.round - b.round || a.board - b.board),
  ]))
}

async function loadStandingsByTournament() {
  const standingsByTournament = new Map<string, AdminStanding[]>()

  try {
    const response = await tablesDB.listRows<AppwriteStandingRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: tableIds.standings,
      queries: [Query.limit(1000)],
      total: false,
      ttl: 0,
    })

    response.rows.forEach((row) => {
      if (!row.tournamentId || !row.profileId) return
      const list = standingsByTournament.get(row.tournamentId) ?? []
      list.push({
        id: row.$id,
        tournamentId: row.tournamentId,
        profileId: row.profileId,
        rank: row.rank ?? list.length + 1,
        points: row.points ?? 0,
        tieBreak: row.tieBreak ?? 0,
        played: row.played ?? 0,
        wins: row.wins ?? 0,
        draws: row.draws ?? 0,
        losses: row.losses ?? 0,
      })
      standingsByTournament.set(row.tournamentId, list)
    })
  } catch (error) {
    console.warn('Admin standings read failed.', error)
  }

  return new Map(Array.from(standingsByTournament.entries()).map(([tournamentId, standings]) => [
    tournamentId,
    standings.sort((a, b) => a.rank - b.rank || b.points - a.points || a.profileId.localeCompare(b.profileId)),
  ]))
}

async function loadProfilesById(profileIds: string[]) {
  const uniqueIds = Array.from(new Set(profileIds.filter(Boolean)))
  const profiles = new Map<string, AppwriteProfileRow>()
  if (!uniqueIds.length) return profiles

  try {
    const response = await runAdminAction<{ rows: AppwriteProfileRow[] }>({
      method: ExecutionMethod.POST,
      path: '/profiles/lookup',
      body: { ids: uniqueIds },
    })

    response.rows.forEach((row) => profiles.set(row.$id, row))
    if (profiles.size === uniqueIds.length) return profiles
  } catch (error) {
    console.warn('Admin server profile lookup failed.', error)
  }

  try {
    const response = await tablesDB.listRows<AppwriteProfileRow>({
      databaseId: appwriteConfig.databaseId,
      tableId: tableIds.profiles,
      queries: [Query.limit(500)],
      total: false,
    })

    response.rows.forEach((row) => {
      if (uniqueIds.includes(row.$id)) profiles.set(row.$id, row)
    })
  } catch (error) {
    console.warn('Admin profile lookup for registrations failed.', error)
  }

  return profiles
}

function mapTournament(
  row: AppwriteTournamentRow,
  participantCounts: Map<string, number>,
  gamesByTournament: Map<string, AdminGame[]>,
  standingsByTournament: Map<string, AdminStanding[]>,
): AdminTournament | null {
  if (!row.format || !row.timeControl) return null
  const status = row.status === 'cancelled' ? 'archived' : row.status
  if (!status) return null
  const format = normalizeTournamentFormat(row.format)
  const name = row.name?.trim() || format
  const slug = row.slug?.trim() || formatRouteId(name) || row.$id
  const games = gamesByTournament.get(row.$id) ?? []

  return {
    id: slug,
    rowId: row.$id,
    slug,
    name,
    status,
    players: participantCounts.get(row.$id) ?? 0,
    capacity: row.capacity ?? 0,
    format,
    timeControl: row.timeControl,
    round: formatRound(row),
    roundsTotal: row.roundsTotal,
    currentRound: row.currentRound,
    startsAt: row.startsAt,
    registrationDeadline: row.registrationDeadline,
    playMode: row.playMode === 'online' ? 'online' : 'inPerson',
    onlinePlatform: normalizeOnlinePlatform(row.onlinePlatform),
    location: row.location,
    description: row.description,
    publishedGames: games.length,
    publishedGameRows: games,
    standings: standingsByTournament.get(row.$id) ?? [],
    bracketSnapshot: row.bracketSnapshot,
    physicalBoards: Math.max(1, Math.min(64, Math.floor(row.physicalBoards ?? 3))),
  }
}

function normalizeTournamentFormat(format: string) {
  const value = format.trim()
  if (/^round[-\s]?robin$/i.test(value)) return 'Round robin'
  if (/^double\s+round[-\s]?robin$/i.test(value)) return 'Double round robin'
  return value
}

function normalizeOnlinePlatform(value?: string): OnlineTournamentPlatform | undefined {
  return value === 'chessCom' || value === 'lichess' || value === 'juchess' ? value : undefined
}

function formatRouteId(format: string) {
  return format
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function mapRegistration(
  row: AppwriteRegistrationRow,
  profiles: Map<string, AppwriteProfileRow>,
  attendance?: AdminAttendanceConfirmation,
): AdminRegistration | null {
  if (!row.tournamentId || !row.profileId) return null
  const profile = profiles.get(row.profileId)

  return {
    rowId: row.$id,
    tournamentId: row.tournamentId,
    profileId: row.profileId,
    playerName: profile?.displayName || row.profileId,
    email: profile?.email,
    universityId: profile?.universityId,
    rating: profile?.rating,
    status: row.status ?? 'pending',
    seed: row.seed,
    attendanceStatus: attendance?.status,
    attendanceRemindedAt: attendance?.reminderSentAt,
    attendanceRespondedAt: attendance?.respondedAt,
    attendanceResponseSource: attendance?.responseSource,
    attendanceEmailStatus: attendance?.reminderEmailStatus,
    attendancePushStatus: attendance?.reminderPushStatus,
  }
}

function compareRegistrationRows(a: AdminRegistration, b: AdminRegistration) {
  const statusRank: Record<AdminRegistrationStatus, number> = {
    pending: 0,
    confirmed: 1,
    waitlisted: 2,
    cancelled: 3,
  }

  return statusRank[a.status] - statusRank[b.status] ||
    (a.seed ?? 9999) - (b.seed ?? 9999) ||
    a.playerName.localeCompare(b.playerName)
}

function dedupeAdminRegistrations(rows: AdminRegistration[]) {
  const registrations = new Map<string, AdminRegistration>()
  const statusRank: Record<AdminRegistrationStatus, number> = {
    confirmed: 4,
    waitlisted: 3,
    pending: 2,
    cancelled: 1,
  }

  rows.forEach((row) => {
    const key = `${row.tournamentId}:${row.profileId}`
    const existing = registrations.get(key)
    if (!existing) {
      registrations.set(key, row)
      return
    }

    const existingRank = statusRank[existing.status]
    const nextRank = statusRank[row.status]
    if (nextRank > existingRank) registrations.set(key, row)
  })

  return [...registrations.values()]
}

function formatRound(row: AppwriteTournamentRow) {
  if (row.currentRound && row.roundsTotal) return `Round ${row.currentRound} of ${row.roundsTotal}`
  if (row.currentRound) return `Round ${row.currentRound}`
  if (row.status === 'completed') return 'Final'
  if (row.status === 'upcoming' || row.status === 'draft') return 'Registration'
  if (row.status === 'archived' || row.status === 'cancelled') return 'Archived'
  return 'In progress'
}

function statusOrder(status: TournamentStatus) {
  if (status === 'upcoming') return 0
  if (status === 'draft') return 1
  if (status === 'active') return 2
  if (status === 'completed') return 3
  return 4
}

function compareTournaments(a: AdminTournament, b: AdminTournament) {
  return statusOrder(a.status) - statusOrder(b.status) ||
    tournamentFormatRank(a.format) - tournamentFormatRank(b.format) ||
    a.name.localeCompare(b.name)
}

function tournamentFormatRank(format: string) {
  const index = tournamentFormatOrder.findIndex((item) => item === format)
  return index >= 0 ? index : tournamentFormatOrder.length
}

async function runAdminAction<T>({
  method,
  path,
  body = {},
}: {
  method: ExecutionMethod
  path: string
  body?: Record<string, unknown>
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
