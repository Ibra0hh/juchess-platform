import { ID, Permission, Query, Role, type Models } from 'appwrite'
import { appwriteConfig, appwriteReady, tablesDB } from './appwrite'
import { tableIds } from './juchess'

export type RegistrationStatus = 'pending' | 'confirmed' | 'waitlisted' | 'cancelled'

export type MyRegistration = Models.Row & {
  tournamentId: string
  profileId: string
  status: RegistrationStatus
  seed?: number
  checkInCode?: string
  checkedIn?: boolean
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

export async function registerForTournament(
  tournamentRowId: string,
  profileId: string,
  accountId: string,
): Promise<MyRegistration> {
  requireReady()

  const existing = await loadMyRegistration(tournamentRowId, profileId)
  if (existing && existing.status !== 'cancelled') return existing

  if (existing) {
    return await tablesDB.updateRow<MyRegistration>({
      databaseId: appwriteConfig.databaseId,
      tableId: tableIds.registrations,
      rowId: existing.$id,
      data: { status: 'pending', checkedIn: false },
    })
  }

  return await tablesDB.createRow<MyRegistration>({
    databaseId: appwriteConfig.databaseId,
    tableId: tableIds.registrations,
    rowId: ID.unique(),
    data: {
      tournamentId: tournamentRowId,
      profileId,
      status: 'pending',
      checkedIn: false,
    },
    permissions: [
      Permission.read(Role.user(accountId)),
      Permission.update(Role.user(accountId)),
    ],
  })
}

export async function cancelMyRegistration(registrationRowId: string): Promise<MyRegistration> {
  requireReady()

  return await tablesDB.updateRow<MyRegistration>({
    databaseId: appwriteConfig.databaseId,
    tableId: tableIds.registrations,
    rowId: registrationRowId,
    data: { status: 'cancelled', checkedIn: false },
  })
}

export function checkInQrPayload(registration: MyRegistration) {
  return `JUCHESS-CHECKIN:${registration.$id}:${registration.checkInCode ?? ''}`
}

function requireReady() {
  if (!appwriteReady) {
    throw new Error('Cloud registration is not configured for this app.')
  }
}
