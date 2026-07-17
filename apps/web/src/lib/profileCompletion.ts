export type ProfileCompletionFields = {
  displayName?: string | null
  university?: string | null
  universityId?: string | null
  phone?: string | null
}

const PROFILE_COMPLETION_PATHS = new Set(['/auth/callback', '/complete-profile', '/verify-email'])
const AUTHENTICATED_ROUTES = new Set(['/complete-profile', '/join-the-team', '/profile'])

export type ProfileCompletionAuthMethod = 'google' | 'email' | 'account'
export type PostAuthenticationDestination = '/complete-profile' | '/profile'

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
): PostAuthenticationDestination {
  return profileNeedsCompletion(profile) ? '/complete-profile' : '/profile'
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
