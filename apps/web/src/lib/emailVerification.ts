import { ExecutionMethod } from 'appwrite'
import {
  account,
  appwriteConfig,
  appwriteReady,
  clearFunctionJwtCache,
  createAccountFunctionHeaders,
  functions,
} from './appwrite'
import { isExistingSessionError, normalizeAccountEmail } from './authSession'
import {
  resolveCurrentEmailVerificationState,
  type CurrentEmailVerificationState,
} from './emailVerificationState'

export type { CurrentEmailVerificationState } from './emailVerificationState'

export type VerificationResendResult = 'sent' | 'already-verified'
export type VerificationConfirmation = {
  verified: boolean
  alreadyVerified: boolean
}

type VerificationFunctionResponse = {
  ok?: boolean
  error?: string
  alreadyVerified?: boolean
  expiresAt?: string | null
  verified?: boolean
}

export function isEmailAlreadyVerifiedError(error: unknown) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'type' in error
    && error.type === 'user_email_already_verified',
  )
}

export async function getCurrentEmailVerificationState(
  expectedUserId: string,
): Promise<CurrentEmailVerificationState> {
  if (!appwriteReady) return 'unknown'

  try {
    const user = await account.get()
    return resolveCurrentEmailVerificationState(user, expectedUserId)
  } catch {
    return 'unknown'
  }
}

export async function resendEmailVerification(
  email: string,
  password: string,
  expectedUserId = '',
): Promise<VerificationResendResult> {
  if (!appwriteReady) {
    throw new Error('Cloud accounts are not configured for this app.')
  }

  const normalizedEmail = email.trim()
  if (!normalizedEmail || !password) {
    throw new Error('Enter your email and password to request a new verification link.')
  }

  let shouldDeleteSession = false
  try {
    const session = await createVerificationSession(normalizedEmail, password)
    const { user } = session
    shouldDeleteSession = session.created || !user.emailVerification
    if (expectedUserId && user.$id !== expectedUserId) {
      throw new Error('Use the JuChess account associated with this verification link.')
    }
    if (user.emailVerification) return 'already-verified'

    await sendEmailVerificationChallenge()
    return 'sent'
  } finally {
    if (!shouldDeleteSession) {
      try {
        const currentUser = await account.get()
        shouldDeleteSession = !currentUser.emailVerification
          && normalizeAccountEmail(currentUser.email) === normalizeAccountEmail(normalizedEmail)
      } catch {
        // No matching session was created, or its state could not be confirmed safely.
      }
    }
    if (shouldDeleteSession) {
      try {
        await account.deleteSession({ sessionId: 'current' })
      } catch {
        // An expired or rejected session is already signed out from JuChess's perspective.
      } finally {
        clearFunctionJwtCache()
      }
    }
  }
}

async function createVerificationSession(email: string, password: string) {
  try {
    await account.createEmailPasswordSession({ email, password })
    clearFunctionJwtCache()
    return { created: true, user: await account.get() }
  } catch (error) {
    if (!isExistingSessionError(error)) throw error

    const user = await account.get()
    if (normalizeAccountEmail(user.email) !== normalizeAccountEmail(email)) {
      throw new Error(`You are already signed in as ${user.email}. Sign out before using another account.`)
    }
    return { created: false, user }
  }
}

export async function sendEmailVerificationChallenge() {
  const payload = await runVerificationAction('/send', {}, true)
  return {
    alreadyVerified: Boolean(payload.alreadyVerified),
    expiresAt: payload.expiresAt ?? null,
  }
}

export async function confirmEmailVerificationLink(
  challengeId: string,
  token: string,
): Promise<VerificationConfirmation> {
  const payload = await runVerificationAction('/confirm-link', { challengeId, token })
  return {
    verified: Boolean(payload.verified),
    alreadyVerified: Boolean(payload.alreadyVerified),
  }
}

export async function confirmEmailVerificationCode(
  email: string,
  code: string,
): Promise<VerificationConfirmation> {
  const payload = await runVerificationAction('/confirm-code', { email: email.trim(), code })
  return {
    verified: Boolean(payload.verified),
    alreadyVerified: Boolean(payload.alreadyVerified),
  }
}

async function runVerificationAction(
  path: string,
  body: Record<string, unknown>,
  authenticated = false,
) {
  if (!appwriteReady) throw new Error('Cloud accounts are not configured for this app.')

  const headers = authenticated
    ? await createAccountFunctionHeaders()
    : { 'content-type': 'application/json' }
  const execution = await functions.createExecution({
    functionId: appwriteConfig.verificationFunctionId,
    body: JSON.stringify(body),
    async: false,
    xpath: path,
    method: ExecutionMethod.POST,
    headers,
  })

  if (execution.status === 'failed') {
    throw new Error(execution.errors || 'The email verification service execution failed.')
  }

  let payload: VerificationFunctionResponse
  try {
    payload = JSON.parse(execution.responseBody) as VerificationFunctionResponse
  } catch {
    throw new Error('The email verification service returned an unreadable response.')
  }
  if (execution.responseStatusCode >= 400 || payload.ok === false) {
    throw new Error(payload.error || 'Email verification could not be completed right now.')
  }
  return payload
}
