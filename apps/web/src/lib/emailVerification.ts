import { account, appwriteReady } from './appwrite'

export type VerificationResendResult = 'sent' | 'already-verified'

export async function resendEmailVerification(
  email: string,
  password: string,
): Promise<VerificationResendResult> {
  if (!appwriteReady) {
    throw new Error('Cloud accounts are not configured for this app.')
  }

  const normalizedEmail = email.trim()
  if (!normalizedEmail || !password) {
    throw new Error('Enter your email and password to request a new verification link.')
  }

  let sessionCreated = false
  try {
    await account.createEmailPasswordSession({
      email: normalizedEmail,
      password,
    })
    sessionCreated = true

    const user = await account.get()
    if (user.emailVerification) return 'already-verified'

    await account.createEmailVerification({
      url: verificationCallbackUrl(),
    })
    return 'sent'
  } finally {
    if (sessionCreated) {
      try {
        await account.deleteSession({ sessionId: 'current' })
      } catch {
        // An expired or rejected session is already signed out from JuChess's perspective.
      }
    }
  }
}

function verificationCallbackUrl() {
  const routeBase = import.meta.env.VITE_ROUTER_BASE || import.meta.env.BASE_URL
  const base = routeBase.replace(/\/$/, '')
  return new URL(`${base}/verify-email`, window.location.origin).toString()
}
