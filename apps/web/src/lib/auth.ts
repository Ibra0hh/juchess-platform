import { ID, Permission, Query, Role, type Models } from 'appwrite'
import { account, appwriteConfig, appwriteReady, tablesDB } from './appwrite'
import { tableIds } from './juchess'

export type ProfileRole = 'member' | 'organizer' | 'admin'
export type ProfileStatus = 'pending' | 'active' | 'suspended'

export type AuthProfile = Models.Row & {
  accountId: string
  displayName: string
  universityId?: string
  email: string
  rating?: number
  role?: ProfileRole
  status?: ProfileStatus
  avatarFileId?: string
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
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  if (!appwriteReady) return null

  try {
    const user = await account.get()
    const profile = await loadProfile(user.$id)
    return { user, profile }
  } catch {
    return null
  }
}

export async function signInWithEmail(input: SignInInput): Promise<AuthSession> {
  requireAppwriteReady()

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

export function formatAppwriteError(error: unknown) {
  if (error instanceof Error && error.message) return error.message

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }

  return 'Something went wrong. Please try again.'
}

async function createProfileForUser(user: Models.User, input: SignUpInput) {
  try {
    await tablesDB.createRow<AuthProfile>({
      databaseId: appwriteConfig.databaseId,
      tableId: tableIds.profiles,
      rowId: ID.unique(),
      data: {
        accountId: user.$id,
        displayName: input.fullName,
        universityId: input.universityId?.trim() || undefined,
        email: input.email,
        rating: 1200,
        role: 'member',
        status: 'pending',
      },
      permissions: [
        Permission.read(Role.user(user.$id)),
        Permission.update(Role.user(user.$id)),
      ],
    })
  } catch (error) {
    console.warn('JuChess profile creation failed after Appwrite signup.', error)
  }
}

function requireAppwriteReady() {
  if (!appwriteReady) {
    throw new Error('Appwrite is not configured for this app.')
  }
}

function appUrl(path: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return new URL(`${base}${path}`, window.location.origin).toString()
}
