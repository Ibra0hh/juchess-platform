export type ProfileCompletionFields = {
  displayName?: string | null
  university?: string | null
  universityId?: string | null
  phone?: string | null
}

const PROFILE_COMPLETION_PATHS = new Set(['/auth/callback', '/complete-profile', '/verify-email'])

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
    && !PROFILE_COMPLETION_PATHS.has(pathname)
}
