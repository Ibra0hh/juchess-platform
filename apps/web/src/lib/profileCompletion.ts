export type ProfileCompletionFields = {
  displayName?: string | null
  university?: string | null
  universityId?: string | null
  phone?: string | null
}

const PROFILE_COMPLETION_PATHS = new Set(['/auth/callback', '/complete-profile', '/forgot-password', '/verify-email'])
const AUTHENTICATED_ROUTES = new Set(['/complete-profile', '/join-the-team', '/profile'])

export type ProfileCompletionAuthMethod = 'google' | 'email' | 'account'
export const applicationPath = '/join-the-team'
export type ApplicationReturn = typeof applicationPath
const verificationReturnKey = 'juchess.applicationVerificationUntil'

export function applicationReturn(value: string | null | undefined): ApplicationReturn | null {
  return value === applicationPath ? applicationPath : null
}

export function withApplicationReturn(path: string, destination?: ApplicationReturn | null) {
  if (!applicationReturn(destination)) return path
  return `${path}${path.includes('?') ? '&' : '?'}next=${encodeURIComponent(applicationPath)}`
}

// Email links can open in a different tab. Store only an expiry, never an
// account identifier or verification proof, and read it only on a proof link.
export function rememberApplicationVerification(destination: ApplicationReturn | null) {
  try {
    if (destination) window.localStorage.setItem(verificationReturnKey, String(Date.now() + 2 * 60 * 60 * 1000))
    else window.localStorage.removeItem(verificationReturnKey)
  } catch {
    // The explicit query still works when browser storage is unavailable.
  }
}

export function pendingApplicationVerification(): ApplicationReturn | null {
  try {
    const until = Number(window.localStorage.getItem(verificationReturnKey))
    return Number.isFinite(until) && until > Date.now() ? applicationPath : null
  } catch {
    return null
  }
}

export function profileCompletionAuthMethod(sessionProvider: string | null | undefined): ProfileCompletionAuthMethod {
  const provider = sessionProvider?.trim().toLowerCase()
  if (provider === 'google') return 'google'
  if (provider === 'email') return 'email'
  return 'account'
}

export function profileNeedsCompletion(profile: ProfileCompletionFields | null | undefined) {
  return !profile?.displayName?.trim()
    || !profile.university?.trim()
    || !profile.universityId?.trim()
    || !profile.phone?.trim()
}

export function postAuthenticationDestination(
  profile: ProfileCompletionFields | null | undefined,
  destination?: ApplicationReturn | null,
) {
  return profileNeedsCompletion(profile)
    ? withApplicationReturn('/complete-profile', destination)
    : applicationReturn(destination) ?? '/profile'
}

export function routeRequiresAuthenticatedSession(pathname: string) {
  return AUTHENTICATED_ROUTES.has(normalizePathname(pathname))
}

export function shouldRedirectToProfileCompletion({
  loading,
  pathname,
  profile,
  signedIn,
}: {
  loading: boolean
  pathname: string
  profile: ProfileCompletionFields | null | undefined
  signedIn: boolean
}) {
  return !loading
    && signedIn
    && profileNeedsCompletion(profile)
    && !PROFILE_COMPLETION_PATHS.has(normalizePathname(pathname))
}

function normalizePathname(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}
