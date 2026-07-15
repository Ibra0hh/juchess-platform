import { ExecutionMethod, ID, OAuthProvider, Permission, Query, Role, type Models } from 'appwrite'
import { account, appwriteConfig, appwriteReady, functions, storage, tablesDB } from './appwrite'
import { tableIds } from './juchess'
import type { BoardPreferences } from './boardAppearance'

export type ProfileRole = 'member' | 'organizer' | 'admin'
export type ProfileStatus = 'pending' | 'active' | 'suspended'

export type AuthProfile = Models.Row & {
  accountId: string
  displayName: string
  university?: string | null
  universityId?: string | null
  phone?: string | null
  email: string
  rating?: number
  role?: ProfileRole
  status?: ProfileStatus
  avatarFileId?: string
  coverFileId?: string
  chessComUsername?: string | null
  lichessUsername?: string | null
  boardTheme?: string
  pieceTheme?: string
  arrowColor?: string
  markColor?: string
}

export type ProfileUpdateInput = {
  displayName: string
  university?: string
  universityId?: string
  phone?: string
  chessComUsername?: string
  lichessUsername?: string
}

export type ProfileMediaKind = 'avatar' | 'cover'

const profileMediaBucketId = 'avatars'

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
  university: string
  universityId?: string
  phone?: string
  chessComUsername?: string
  lichessUsername?: string
}

export type SocialAuthProvider = 'apple' | 'google'

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
      universityId: profile?.universityId ?? undefined,
      phone: profile?.phone ?? undefined,
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
  if (!input.universityId?.trim() || !normalizeJordanPhone(input.phone)) {
    throw new Error('University ID and phone number are required.')
  }
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

export function startOAuthSession(provider: SocialAuthProvider) {
  requireAppwriteReady()

  account.createOAuth2Token({
    provider: provider === 'apple' ? OAuthProvider.Apple : OAuthProvider.Google,
    success: appUrl('/auth/callback'),
    failure: appUrl(`/sign-in?oauth=failed&provider=${provider}`),
  })
}

export async function completeOAuthTokenSession(userId: string, secret: string): Promise<AuthSession> {
  requireAppwriteReady()

  await account.createSession({ userId, secret })
  const session = await getCurrentSession()
  if (!session) {
    throw new Error('Google sign-in succeeded, but the JuChess session could not be loaded.')
  }

  return session
}

export function profileNeedsCompletion(profile: AuthProfile | null) {
  return !profile?.displayName?.trim()
    || !profile.university?.trim()
    || !profile.universityId?.trim()
    || !profile.phone?.trim()
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

export async function loadClubLeaderboard(): Promise<AuthProfile[]> {
  if (!appwriteReady) return []

  const response = await tablesDB.listRows<AuthProfile>({
    databaseId: appwriteConfig.databaseId,
    tableId: tableIds.profiles,
    queries: [Query.limit(5000)],
    total: false,
    ttl: 30,
  })

  return response.rows
    .filter((profile) => profile.status === 'active' && !isSeedProfile(profile))
    .sort((left, right) => (
      (right.rating ?? 0) - (left.rating ?? 0)
      || left.displayName.localeCompare(right.displayName)
    ))
}

export async function saveProfileDetails(profileId: string, input: ProfileUpdateInput) {
  requireAppwriteReady()
  const displayName = input.displayName.trim()
  if (!displayName) throw new Error('Display name is required.')
  const university = input.university?.trim()
  if (!university) throw new Error('University is required.')
  const universityId = input.universityId?.trim()
  if (!universityId) throw new Error('University ID is required.')
  const phone = normalizeJordanPhone(input.phone)
  if (!phone) throw new Error('Phone number is required.')

  return await tablesDB.updateRow<AuthProfile>({
    databaseId: appwriteConfig.databaseId,
    tableId: tableIds.profiles,
    rowId: profileId,
    data: {
      displayName,
      university,
      universityId,
      phone,
      chessComUsername: optionalUsername(input.chessComUsername),
      lichessUsername: optionalUsername(input.lichessUsername),
    },
  })
}

export async function uploadProfileMedia(
  profile: AuthProfile,
  accountId: string,
  kind: ProfileMediaKind,
  file: File,
) {
  requireAppwriteReady()
  validateProfileImage(file)

  const field = kind === 'avatar' ? 'avatarFileId' : 'coverFileId'
  const previousFileId = profile[field]
  const uploaded = await storage.createFile({
    bucketId: profileMediaBucketId,
    fileId: ID.unique(),
    file,
    permissions: [
      Permission.read(Role.any()),
      Permission.update(Role.user(accountId)),
      Permission.delete(Role.user(accountId)),
    ],
  })

  try {
    const updated = await tablesDB.updateRow<AuthProfile>({
      databaseId: appwriteConfig.databaseId,
      tableId: tableIds.profiles,
      rowId: profile.$id,
      data: { [field]: uploaded.$id },
    })

    if (previousFileId && previousFileId !== uploaded.$id) {
      void storage.deleteFile({ bucketId: profileMediaBucketId, fileId: previousFileId }).catch(() => undefined)
    }
    return updated
  } catch (error) {
    await storage.deleteFile({ bucketId: profileMediaBucketId, fileId: uploaded.$id }).catch(() => undefined)
    throw error
  }
}

export async function deleteProfileMedia(profile: AuthProfile, kind: ProfileMediaKind) {
  requireAppwriteReady()
  const field = kind === 'avatar' ? 'avatarFileId' : 'coverFileId'
  const fileId = profile[field]
  if (!fileId) return profile

  const updated = await tablesDB.updateRow<AuthProfile>({
    databaseId: appwriteConfig.databaseId,
    tableId: tableIds.profiles,
    rowId: profile.$id,
    data: { [field]: null },
  })
  await storage.deleteFile({ bucketId: profileMediaBucketId, fileId }).catch(() => undefined)
  return updated
}

export function profileMediaUrl(fileId?: string) {
  if (!fileId) return ''
  if (/^(blob:|data:|https?:)/.test(fileId)) return fileId
  return String(storage.getFileView({ bucketId: profileMediaBucketId, fileId }))
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
      arrowColor: preferences.arrowColor,
      markColor: preferences.markColor,
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
        university: input.university?.trim() || undefined,
        universityId: input.universityId?.trim() || undefined,
        phone: normalizeJordanPhone(input.phone),
        email: input.email,
        chessComUsername: optionalUsername(input.chessComUsername),
        lichessUsername: optionalUsername(input.lichessUsername),
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

function optionalUsername(value?: string) {
  return value?.trim().toLowerCase() || null
}

function validateProfileImage(file: File) {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
  if (!allowedTypes.has(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP image.')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Profile images must be 5 MB or smaller.')
  }
}

function isSeedProfile(profile: AuthProfile) {
  return profile.$id.startsWith('showcase_')
    || profile.accountId.startsWith('showcase_')
    || profile.universityId?.startsWith('SHOWCASE-') === true
    || profile.email.endsWith('@juchess.test')
}

function appUrl(path: string) {
  const routeBase = import.meta.env.VITE_ROUTER_BASE || import.meta.env.BASE_URL
  const base = routeBase.replace(/\/$/, '')
  return new URL(`${base}${path}`, window.location.origin).toString()
}
