import { ExecutionMethod, Query, type Models } from 'appwrite'
import { appwriteConfig, appwriteReady, functions, tablesDB } from './appwrite'
import { tableIds } from './juchess'

export type RegistrationStatus = 'pending' | 'confirmed' | 'waitlisted' | 'cancelled'

export type MyRegistration = Models.Row & {
  tournamentId: string
  profileId: string
  status: RegistrationStatus
  seed?: number
}

export type AttendanceStatus = 'pending' | 'confirmed' | 'declined'
export type AttendanceDeliveryStatus = 'pending' | 'sent' | 'unavailable' | 'failed' | 'skipped'

export type MyAttendanceConfirmation = Models.Row & {
  tournamentId: string
  profileId: string
  registrationId: string
  status: AttendanceStatus
  reminderSentAt?: string
  reminderEmailStatus?: AttendanceDeliveryStatus
  reminderPushStatus?: AttendanceDeliveryStatus
  respondedAt?: string
  responseSource?: 'web' | 'app' | 'email'
}

/**
 * Registration writes go through the player-actions function. The client is not
 * allowed to create these rows directly: the server derives the profile from the
 * session and always starts a registration as `pending`, so a player cannot
 * approve themselves or register on someone else's behalf.
 */
async function runPlayerAction<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  requireReady()

  const execution = await functions.createExecution({
    functionId: appwriteConfig.playerFunctionId,
    body: JSON.stringify(body),
    async: false,
    xpath: path,
    method: ExecutionMethod.POST,
    headers: { 'content-type': 'application/json' },
  })

  let payload: { ok?: boolean; error?: string } & Record<string, unknown>
  try {
    payload = JSON.parse(execution.responseBody)
  } catch {
    throw new Error('The club server returned an unreadable response.')
  }

  if (execution.responseStatusCode >= 400 || payload.ok === false) {
    throw new Error(payload.error || 'Could not update your registration.')
  }

  return payload as T
}

export async function loadMyRegistration(
  tournamentRowId: string,
  profileId: string,
): Promise<MyRegistration | null> {
  if (!appwriteReady || !tournamentRowId || !profileId) return null

  const response = await tablesDB.listRows<MyRegistration>({
    databaseId: appwriteConfig.databaseId,
    tableId: tableIds.registrations,
    queries: [
      Query.equal('tournamentId', tournamentRowId),
      Query.equal('profileId', profileId),
      Query.limit(10),
    ],
    total: false,
  })

  const active = response.rows.find((row) => row.status !== 'cancelled')
  return active ?? response.rows[0] ?? null
}

/**
 * Attendance responses are private. Row permissions let a player read only
 * their own attendance row; all writes still go through a server function.
 */
export async function loadMyAttendance(
  tournamentRowId: string,
  profileId: string,
): Promise<MyAttendanceConfirmation | null> {
  if (!appwriteReady || !tournamentRowId || !profileId) return null

  try {
    const response = await tablesDB.listRows<MyAttendanceConfirmation>({
      databaseId: appwriteConfig.databaseId,
      tableId: tableIds.attendance,
      queries: [
        Query.equal('tournamentId', tournamentRowId),
        Query.equal('profileId', profileId),
        Query.limit(1),
      ],
      total: false,
    })
    return response.rows[0] ?? null
  } catch {
    return null
  }
}

export async function registerForTournament(tournamentRowId: string): Promise<MyRegistration> {
  const payload = await runPlayerAction<{ row: MyRegistration }>('/registrations', {
    tournamentId: tournamentRowId,
  })
  return payload.row
}

export async function cancelMyRegistration(registrationRowId: string): Promise<MyRegistration> {
  const payload = await runPlayerAction<{ row: MyRegistration }>(
    `/registrations/${registrationRowId}/cancel`,
  )
  return payload.row
}

export async function respondToAttendance(
  registrationRowId: string,
  status: Exclude<AttendanceStatus, 'pending'>,
): Promise<MyAttendanceConfirmation> {
  const payload = await runPlayerAction<{ row: MyAttendanceConfirmation }>(
    `/registrations/${registrationRowId}/attendance`,
    { status, source: 'web' },
  )
  return payload.row
}

function requireReady() {
  if (!appwriteReady) {
    throw new Error('Cloud registration is not configured for this app.')
  }
}
