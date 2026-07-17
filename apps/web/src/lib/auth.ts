import { ExecutionMethod, ID, OAuthProvider, Permission, Query, Role, type Models } from 'appwrite'
import { account, appwriteConfig, appwriteReady, createPlayerFunctionHeaders, functions, storage, tablesDB } from './appwrite'
import { tableIds } from './juchess'
import type { BoardPreferences } from './boardAppearance'
import { isExistingSessionError, normalizeAccountEmail } from './authSession'
import { sendEmailVerificationChallenge } from './emailVerification'

export type ProfileRole = 'member' | 'organizer' | 'admin'
export type ProfileStatus = 'active' | 'suspended'

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

export type PublicProfile = Models.Row & {
  displayName: string
  university?: string | null
  rating?: number
  status?: ProfileStatus
  avatarFileId?: string
  coverFileId?: string
  chessComUsername?: string | null
  lichessUsername?: string | null
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
  sessionProvider: string | null
}

export type SignInInput = {
  email: string
  password: string
}

export type SignUpInput = SignInInput & {
  fullName: string
  university?: string
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

class EmailVerificationRequiredError extends Error {}

export async function getCurrentSession(): Promise<AuthSession | null> {
  if (!appwriteReady) return null

  let user: Models.User
  try {
    user = await account.get()
  } catch (error) {
    if (isMissingAccountSession(error)) return null
    throw error
  }

  if (!user.emailVerification) {
    await deleteCurrentSession()
    return null
  }

  try {
    const [profile, sessionProvider] = await Promise.all([
      loadOwnerProfile(),
      loadCurrentSessionProvider(),
    ])
    if (profile?.status === 'suspended') {
      throw new AccessBlockedError('This account is blocked by club administration.')
    }
    await assertAccessAllowed({
      email: user.email,
      universityId: profile?.universityId ?? undefined,
      phone: profile?.phone ?? undefined,
    })
    return { user, profile, sessionProvider }
  } catch (error) {
    if (error instanceof AccessBlockedError) {
      try {
        await account.deleteSession({ sessionId: 'current' })
      } catch {
        // The session may already be invalid on the cloud side.
      }
      throw error
    }

    throw error
  }
}

function isMissingAccountSession(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && Number((error as { code?: unknown }).code) === 401
}

export async function signInWithEmail(input: SignInInput): Promise<AuthSession> {
  requireAppwriteReady()
  await assertAccessAllowed({ email: input.email })

  await createEmailPasswordSessionOrReuseCurrent(input)

  const user = await account.get()
  if (!user.emailVerification) {
    let verificationSent = false
    try {
      await sendCurrentUserEmailVerification()
      verificationSent = true
    } catch (error) {
      console.warn('JuChess could not resend the email verification link.', error)
    } finally {
      await deleteCurrentSession()
    }

    throw new EmailVerificationRequiredError(
      verificationSent
        ? 'Verify your email before signing in. We sent a new two-hour link and six-digit code.'
        : 'Verify your email before signing in. Open the most recent JuChess verification email.',
    )
  }

  const session = await getCurrentSession()
  if (!session) {
    throw new Error('Sign in succeeded, but the account session could not be loaded.')
  }

  return session
}

export async function signUpWithEmail(input: SignUpInput): Promise<void> {
  requireAppwriteReady()
  await assertAccessAllowed({ email: input.email })
  await assertNoActiveSessionForAccountCreation(input.email)

  await account.create({
    userId: ID.unique(),
    email: input.email,
    password: input.password,
    name: input.fullName,
  })

  await createEmailPasswordSessionOrReuseCurrent(input)

  try {
    await sendCurrentUserEmailVerification()
  } finally {
    await deleteCurrentSession()
  }
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

export async function loadClubLeaderboard(): Promise<PublicProfile[]> {
  if (!appwriteReady) return []

  const response = await tablesDB.listRows<PublicProfile>({
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

export async function saveProfileDetails(input: ProfileUpdateInput) {
  requireAppwriteReady()
  const displayName = input.displayName.trim()
  if (!displayName) throw new Error('Display name is required.')
  const university = input.university?.trim()
  if (!university) throw new Error('University is required.')
  const universityId = input.universityId?.trim()
  if (!universityId) throw new Error('University ID is required.')
  const phone = normalizeJordanPhone(input.phone)
  if (!phone) throw new Error('Phone number is required.')

  return await updateOwnerProfile({
    displayName,
    university,
    universityId,
    phone,
    chessComUsername: optionalUsername(input.chessComUsername),
    lichessUsername: optionalUsername(input.lichessUsername),
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
    const updated = await updateOwnerProfile({ [field]: uploaded.$id })

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

  const updated = await updateOwnerProfile({ [field]: null })
  await storage.deleteFile({ bucketId: profileMediaBucketId, fileId }).catch(() => undefined)
  return updated
}

export function profileMediaUrl(fileId?: string) {
  if (!fileId) return ''
  if (/^(blob:|data:|https?:)/.test(fileId)) return fileId
  return String(storage.getFileView({ bucketId: profileMediaBucketId, fileId }))
}

export async function saveExternalGameUsername(
  source: 'chess.com' | 'lichess',
  username: string,
) {
  requireAppwriteReady()
  const normalized = username.trim().toLowerCase()
  if (!normalized) throw new Error('Enter a username before linking the account.')

  return await updateOwnerProfile({
    [source === 'chess.com' ? 'chessComUsername' : 'lichessUsername']: normalized,
  })
}

export async function saveBoardAppearance(
  preferences: BoardPreferences,
) {
  requireAppwriteReady()
  return await updateOwnerProfile({
    boardTheme: preferences.boardTheme,
    pieceTheme: preferences.pieceTheme,
    arrowColor: preferences.arrowColor,
    markColor: preferences.markColor,
  })
}

async function loadOwnerProfile() {
  return await runProfileAction(ExecutionMethod.GET, {}, true)
}

async function loadCurrentSessionProvider() {
  try {
    const session = await account.getSession({ sessionId: 'current' })
    return session.provider?.trim().toLowerCase() || null
  } catch {
    // Provider metadata should never invalidate an otherwise healthy account session.
    return null
  }
}

async function updateOwnerProfile(data: Record<string, unknown>) {
  const profile = await runProfileAction(ExecutionMethod.POST, data)
  if (!profile) throw new Error('The player profile service returned no profile.')
  return profile
}

async function runProfileAction(
  method: ExecutionMethod,
  body: Record<string, unknown>,
  allowMissing = false,
): Promise<AuthProfile | null> {
  requireAppwriteReady()
  const headers = await createPlayerFunctionHeaders()
  const execution = await functions.createExecution({
    functionId: appwriteConfig.playerFunctionId,
    body: JSON.stringify(body),
    async: false,
    xpath: '/profile',
    method,
    headers,
  })

  let payload: { ok?: boolean; row?: AuthProfile | null; error?: string; detail?: string }
  try {
    payload = JSON.parse(execution.responseBody) as typeof payload
  } catch {
    throw new Error('The player profile service returned an unreadable response.')
  }

  if (allowMissing && execution.responseStatusCode === 404) return null
  if (execution.responseStatusCode >= 400 || payload.ok === false) {
    throw new Error(payload.detail || payload.error || 'The player profile service rejected the request.')
  }
  if (allowMissing && !payload.row) return null
  if (!payload.row) throw new Error('The player profile service returned no profile.')
  return payload.row
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

function requireAppwriteReady() {
  if (!appwriteReady) {
    throw new Error('Cloud accounts are not configured for this app.')
  }
}

async function sendCurrentUserEmailVerification() {
  await sendEmailVerificationChallenge()
}

async function deleteCurrentSession() {
  try {
    await account.deleteSession({ sessionId: 'current' })
  } catch {
    // A failed or expired session is already signed out from the app's perspective.
  }
}

async function createEmailPasswordSessionOrReuseCurrent(input: SignInInput) {
  try {
    await account.createEmailPasswordSession({
      email: input.email,
      password: input.password,
    })
  } catch (error) {
    if (!isExistingSessionError(error)) throw error

    const currentUser = await account.get()
    if (normalizeAccountEmail(currentUser.email) !== normalizeAccountEmail(input.email)) {
      throw new Error(`You are already signed in as ${currentUser.email}. Sign out before switching accounts.`)
    }

    // The requested account is already authenticated in this browser. Reuse
    // that secure session instead of asking Appwrite to create a duplicate.
  }
}

async function assertNoActiveSessionForAccountCreation(email: string) {
  try {
    const currentUser = await account.get()
    if (normalizeAccountEmail(currentUser.email) === normalizeAccountEmail(email)) {
      throw new Error('This account already exists and is signed in. Continue to your profile instead.')
    }
    throw new Error(`You are already signed in as ${currentUser.email}. Sign out before creating another account.`)
  } catch (error) {
    if (isMissingAccountSession(error)) return
    throw error
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

function isSeedProfile(profile: PublicProfile) {
  return profile.$id.startsWith('showcase_')
    || profile.$id.startsWith('seed_profile_')
    || profile.$id === 'system_bye'
}

function appUrl(path: string) {
  const routeBase = import.meta.env.VITE_ROUTER_BASE || import.meta.env.BASE_URL
  const base = routeBase.replace(/\/$/, '')
  return new URL(`${base}${path}`, window.location.origin).toString()
}
