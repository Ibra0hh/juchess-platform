import { ExecutionMethod, ID, Permission, Query, Role, type Models } from 'appwrite'
import { account, appwriteConfig, appwriteReady, functions, tablesDB } from './appwrite'
import { tableIds } from './juchess'
import type { BoardPreferences } from './boardAppearance'

export type ProfileRole = 'member' | 'organizer' | 'admin'
export type ProfileStatus = 'pending' | 'active' | 'suspended'

export type AuthProfile = Models.Row & {
  accountId: string
  displayName: string
  universityId?: string
  phone?: string
  email: string
  rating?: number
  role?: ProfileRole
  status?: ProfileStatus
  avatarFileId?: string
  chessComUsername?: string
  lichessUsername?: string
  boardTheme?: string
  pieceTheme?: string
}

export type AuthSession = {
  user: Models.User
  profile: AuthProfile | null
}

export type SignInInput = {
  email: string
  password: string
}

export type SignUpInput = SignInInput & {
  fullName: string
  universityId?: string
  phone?: string
}

type AccessGuardInput = {
  email?: string
  universityId?: string
  phone?: string
}

class AccessBlockedError extends Error {}

export async function getCurrentSession(): Promise<AuthSession | null> {
  if (!appwriteReady) return null

  try {
    const user = await account.get()
    const profile = await ensureProfileForUser(user)
    if (profile?.status === 'suspended') {
      throw new AccessBlockedError('This account is blocked by club administration.')
    }
    await assertAccessAllowed({
      email: user.email,
      universityId: profile?.universityId,
      phone: profile?.phone,
    })
    return { user, profile }
  } catch (error) {
    if (error instanceof AccessBlockedError) {
      try {
        await account.deleteSession({ sessionId: 'current' })
      } catch {
        // The session may already be invalid on the cloud side.
      }
      throw error
    }

    return null
  }
}

export async function signInWithEmail(input: SignInInput): Promise<AuthSession> {
  requireAppwriteReady()
  await assertAccessAllowed({ email: input.email })

  await account.createEmailPasswordSession({
    email: input.email,
    password: input.password,
  })

  const session = await getCurrentSession()
  if (!session) {
    throw new Error('Sign in succeeded, but the account session could not be loaded.')
  }

  return session
}

export async function signUpWithEmail(input: SignUpInput): Promise<AuthSession> {
  requireAppwriteReady()
  await assertAccessAllowed({
    email: input.email,
    universityId: input.universityId,
    phone: input.phone,
  })

  const user = await account.create({
    userId: ID.unique(),
    email: input.email,
    password: input.password,
    name: input.fullName,
  })

  await account.createEmailPasswordSession({
    email: input.email,
    password: input.password,
  })

  await createProfileForUser(user, input)

  const session = await getCurrentSession()
  if (!session) {
    throw new Error('Account created, but the account session could not be loaded.')
  }

  return session
}

export async function signOutCurrentUser() {
  if (!appwriteReady) return
  await account.deleteSession({ sessionId: 'current' })
}

export async function requestPasswordRecovery(email: string) {
  requireAppwriteReady()

  await account.createRecovery({
    email,
    url: appUrl('/forgot-password'),
  })
}

export async function completePasswordRecovery(userId: string, secret: string, password: string) {
  requireAppwriteReady()

  await account.updateRecovery({
    userId,
    secret,
    password,
  })
}

export async function loadProfile(accountId: string): Promise<AuthProfile | null> {
  if (!appwriteReady) return null

  const response = await tablesDB.listRows<AuthProfile>({
    databaseId: appwriteConfig.databaseId,
    tableId: tableIds.profiles,
    queries: [Query.equal('accountId', accountId), Query.limit(1)],
    total: false,
    ttl: 30,
  })

  return response.rows[0] ?? null
}

export async function loadProfileByEmail(email: string): Promise<AuthProfile | null> {
  if (!appwriteReady) return null

  const normalizedEmail = email.trim()
  if (!normalizedEmail) return null

  const response = await tablesDB.listRows<AuthProfile>({
    databaseId: appwriteConfig.databaseId,
    tableId: tableIds.profiles,
    queries: [Query.equal('email', normalizedEmail), Query.limit(1)],
    total: false,
    ttl: 30,
  })

  return response.rows[0] ?? null
}

export async function loadPreviewProfileByEmail(email: string): Promise<AuthProfile | null> {
  return await loadProfileByEmail(email)
}

export async function saveExternalGameUsername(
  profileId: string,
  source: 'chess.com' | 'lichess',
  username: string,
) {
  requireAppwriteReady()
  const normalized = username.trim().toLowerCase()
  if (!normalized) throw new Error('Enter a username before linking the account.')

  return await tablesDB.updateRow<AuthProfile>({
    databaseId: appwriteConfig.databaseId,
    tableId: tableIds.profiles,
    rowId: profileId,
    data: {
      [source === 'chess.com' ? 'chessComUsername' : 'lichessUsername']: normalized,
    },
  })
}

export async function saveBoardAppearance(
  profileId: string,
  preferences: BoardPreferences,
) {
  requireAppwriteReady()
  return await tablesDB.updateRow<AuthProfile>({
    databaseId: appwriteConfig.databaseId,
    tableId: tableIds.profiles,
    rowId: profileId,
    data: {
      boardTheme: preferences.boardTheme,
      pieceTheme: preferences.pieceTheme,
    },
  })
}

export async function ensureProfileForUser(user: Models.User): Promise<AuthProfile | null> {
  const accountProfile = await loadProfile(user.$id)
  if (accountProfile) return accountProfile

  const emailProfile = await loadProfileByEmail(user.email)
  if (emailProfile) return emailProfile

  return await createProfileForUser(user, {
    fullName: user.name || user.email,
    email: user.email,
  })
}

export function formatAppwriteError(error: unknown) {
  if (error instanceof Error && error.message) return cloudMessage(error.message)

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return cloudMessage(message)
  }

  return 'Something went wrong. Please try again.'
}

function cloudMessage(value: string) {
  return value.replace(/appwrite/gi, 'cloud')
}

async function createProfileForUser(user: Models.User, input: Partial<SignUpInput> & Pick<SignUpInput, 'email'>) {
  try {
    return await tablesDB.createRow<AuthProfile>({
      databaseId: appwriteConfig.databaseId,
      tableId: tableIds.profiles,
      rowId: ID.unique(),
      data: {
        accountId: user.$id,
        displayName: input.fullName?.trim() || user.name || input.email,
        universityId: input.universityId?.trim() || undefined,
        phone: normalizeJordanPhone(input.phone),
        email: input.email,
        rating: 1200,
        role: 'member',
        status: 'pending',
      },
      permissions: [
        Permission.read(Role.any()),
        Permission.read(Role.user(user.$id)),
        Permission.update(Role.user(user.$id)),
      ],
    })
  } catch (error) {
    console.warn('JuChess profile creation failed after signup.', error)
    return null
  }
}

function requireAppwriteReady() {
  if (!appwriteReady) {
    throw new Error('Cloud accounts are not configured for this app.')
  }
}

async function assertAccessAllowed(input: AccessGuardInput) {
  if (!appwriteConfig.accessGuardFunctionId) return

  const execution = await functions.createExecution({
    functionId: appwriteConfig.accessGuardFunctionId,
    body: JSON.stringify({
      email: input.email?.trim(),
      universityId: input.universityId?.trim(),
      phone: normalizeJordanPhone(input.phone),
    }),
    async: false,
    xpath: '/check',
    method: ExecutionMethod.POST,
    headers: {
      'content-type': 'application/json',
    },
  })

  const payload = parseGuardBody(execution.responseBody)
  if (payload.allowed === false) {
    throw new AccessBlockedError(payload.reason || 'This account is blocked by club administration.')
  }

  if (execution.responseStatusCode >= 400 || payload.ok === false) {
    throw new Error(payload.reason || payload.error || 'This account is blocked by club administration.')
  }
}

function parseGuardBody(body: string): { ok?: boolean; allowed?: boolean; reason?: string; error?: string } {
  try {
    return JSON.parse(body) as { ok?: boolean; allowed?: boolean; reason?: string; error?: string }
  } catch {
    throw new Error('Access guard returned an unreadable response.')
  }
}

function normalizeJordanPhone(value?: string) {
  const raw = value?.trim()
  if (!raw) return undefined

  const compact = raw.replace(/[^\d+]/g, '')
  if (compact.startsWith('+962')) return `+962${compact.slice(4).replace(/\D/g, '')}`
  if (compact.startsWith('00962')) return `+962${compact.slice(5).replace(/\D/g, '')}`
  if (compact.startsWith('962')) return `+962${compact.slice(3).replace(/\D/g, '')}`

  const digits = compact.replace(/\D/g, '')
  if (digits.startsWith('0')) return `+962${digits.slice(1)}`
  if (digits.startsWith('7') && digits.length === 9) return `+962${digits}`
  return raw
}

function appUrl(path: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return new URL(`${base}${path}`, window.location.origin).toString()
}
