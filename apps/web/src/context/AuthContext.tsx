import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AuthContext, type AuthContextValue } from './authContextValue'
import { appwriteReady } from '../lib/appwrite'
import {
  completeOAuthTokenSession,
  formatAppwriteError,
  getCurrentSession,
  deleteProfileMedia,
  saveBoardAppearance,
  saveExternalGameUsername,
  saveProfileDetails,
  signInWithEmail,
  signOutCurrentUser,
  signUpWithEmail,
  uploadProfileMedia,
  type AuthProfile,
  type AuthSession,
  type ProfileMediaKind,
  type ProfileUpdateInput,
  type SignInInput,
  type SignUpInput,
} from '../lib/auth'
import type { BoardPreferences } from '../lib/boardAppearance'
import type { Models } from 'appwrite'

type PreviewAuthSession = AuthSession & { profile: AuthProfile }

export function AuthProvider({ children }: { children: ReactNode }) {
  const previewSession = useMemo(() => createPreviewSessionFromUrl(), [])
  const [user, setUser] = useState<Models.User | null>(previewSession?.user ?? null)
  const [profile, setProfile] = useState<AuthProfile | null>(previewSession?.profile ?? null)
  const [sessionProvider, setSessionProvider] = useState<string | null>(previewSession?.sessionProvider ?? null)
  const [loading, setLoading] = useState(!previewSession)
  const [error, setError] = useState<string | null>(null)
  const refreshGeneration = useRef(0)
  const refreshInFlight = useRef<Promise<AuthSession | null> | null>(null)

  const invalidateRefresh = useCallback(() => {
    refreshGeneration.current += 1
    refreshInFlight.current = null
    setLoading(false)
  }, [])

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current
    if (previewSession) {
      if (generation === refreshGeneration.current) {
        setUser(previewSession.user)
        setProfile(previewSession.profile)
        setSessionProvider(previewSession.sessionProvider)
        setLoading(false)
        setError(null)
      }
      return previewSession
    }

    if (!appwriteReady) {
      if (generation === refreshGeneration.current) {
        setUser(null)
        setProfile(null)
        setSessionProvider(null)
        setLoading(false)
      }
      return null
    }

    setLoading(true)
    setError(null)

    try {
      let request = refreshInFlight.current
      if (!request) {
        request = getCurrentSession()
        refreshInFlight.current = request
        void request.finally(() => {
          if (refreshInFlight.current === request) refreshInFlight.current = null
        }).catch(() => undefined)
      }
      const session = await request
      if (generation === refreshGeneration.current) {
        setUser(session?.user ?? null)
        setProfile(session?.profile ?? null)
        setSessionProvider(session?.sessionProvider ?? null)
      }
      return session
    } catch (caught) {
      if (generation === refreshGeneration.current) {
        setError(formatAppwriteError(caught))
        setUser(null)
        setProfile(null)
        setSessionProvider(null)
      }
      return null
    } finally {
      if (generation === refreshGeneration.current) setLoading(false)
    }
  }, [previewSession])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signIn = useCallback(async (input: SignInInput) => {
    invalidateRefresh()
    if (previewSession) {
      const nextSession = createPreviewSession(input.email)
      setUser(nextSession.user)
      setProfile(nextSession.profile)
      setSessionProvider(nextSession.sessionProvider)
      setError(null)
      return nextSession
    }

    setError(null)
    const session = await signInWithEmail(input)
    setUser(session.user)
    setProfile(session.profile)
    setSessionProvider(session.sessionProvider)
    return session
  }, [invalidateRefresh, previewSession])

  const completeOAuth = useCallback(async (userId: string, secret: string) => {
    invalidateRefresh()
    setError(null)
    const session = await completeOAuthTokenSession(userId, secret)
    setUser(session.user)
    setProfile(session.profile)
    setSessionProvider(session.sessionProvider)
    return session
  }, [invalidateRefresh])

  const signUp = useCallback(async (input: SignUpInput) => {
    invalidateRefresh()
    if (previewSession) {
      const nextSession = createPreviewSession(input.email, input.fullName)
      setUser(nextSession.user)
      setProfile(nextSession.profile)
      setSessionProvider(nextSession.sessionProvider)
      setError(null)
      return
    }

    setError(null)
    await signUpWithEmail(input)
    setUser(null)
    setProfile(null)
    setSessionProvider(null)
  }, [invalidateRefresh, previewSession])

  const signOut = useCallback(async () => {
    invalidateRefresh()
    if (previewSession) {
      setUser(previewSession.user)
      setProfile(previewSession.profile)
      setSessionProvider(previewSession.sessionProvider)
      return
    }

    try {
      await signOutCurrentUser()
    } finally {
      setUser(null)
      setProfile(null)
      setSessionProvider(null)
      setError(null)
    }
  }, [invalidateRefresh, previewSession])

  const linkExternalGameUsername = useCallback(async (
    source: 'chess.com' | 'lichess',
    username: string,
  ) => {
    if (!profile) throw new Error('Sign in before linking a game account.')
    const normalized = username.trim().toLowerCase()
    if (!normalized) throw new Error('Enter a username before linking the account.')
    const field = source === 'chess.com' ? 'chessComUsername' : 'lichessUsername'

    if (previewSession || profile.$id.startsWith('preview-')) {
      setProfile({ ...profile, [field]: normalized } as AuthProfile)
      return
    }

    const updated = await saveExternalGameUsername(source, normalized)
    setProfile(updated)
  }, [previewSession, profile])

  const saveBoardPreferences = useCallback(async (preferences: BoardPreferences) => {
    if (!profile) return

    if (previewSession || profile.$id.startsWith('preview-')) {
      setProfile({ ...profile, ...preferences } as AuthProfile)
      return
    }

    const updated = await saveBoardAppearance(preferences)
    setProfile(updated)
  }, [previewSession, profile])

  const updateProfile = useCallback(async (input: ProfileUpdateInput) => {
    if (!user) throw new Error('Sign in before creating or editing your profile.')

    if (previewSession) {
      if (!profile) throw new Error('The preview profile is unavailable.')
      setProfile({
        ...profile,
        ...input,
        displayName: input.displayName.trim(),
        chessComUsername: input.chessComUsername?.trim().toLowerCase() || undefined,
        lichessUsername: input.lichessUsername?.trim().toLowerCase() || undefined,
      } as AuthProfile)
      return
    }

    if (profile?.$id.startsWith('preview-')) {
      setProfile({
        ...profile,
        ...input,
        displayName: input.displayName.trim(),
        chessComUsername: input.chessComUsername?.trim().toLowerCase() || undefined,
        lichessUsername: input.lichessUsername?.trim().toLowerCase() || undefined,
      } as AuthProfile)
      return
    }

    const updated = await saveProfileDetails(input)
    setProfile(updated)
  }, [previewSession, profile, user])

  const uploadProfileImage = useCallback(async (kind: ProfileMediaKind, file: File) => {
    if (!profile || !user) throw new Error('Sign in before uploading a profile image.')

    if (previewSession || profile.$id.startsWith('preview-')) {
      const field = kind === 'avatar' ? 'avatarFileId' : 'coverFileId'
      setProfile({ ...profile, [field]: URL.createObjectURL(file) } as AuthProfile)
      return
    }

    const updated = await uploadProfileMedia(profile, user.$id, kind, file)
    setProfile(updated)
  }, [previewSession, profile, user])

  const removeProfileImage = useCallback(async (kind: ProfileMediaKind) => {
    if (!profile) return
    const field = kind === 'avatar' ? 'avatarFileId' : 'coverFileId'

    if (previewSession || profile.$id.startsWith('preview-')) {
      setProfile({ ...profile, [field]: undefined } as AuthProfile)
      return
    }

    const updated = await deleteProfileMedia(profile, kind)
    setProfile(updated)
  }, [previewSession, profile])

  const value = useMemo<AuthContextValue>(
    () => ({
      ready: Boolean(previewSession) || appwriteReady,
      loading,
      user,
      profile,
      sessionProvider,
      error,
      completeOAuth,
      linkExternalGameUsername,
      removeProfileImage,
      saveBoardPreferences,
      updateProfile,
      uploadProfileImage,
      refresh,
      signIn,
      signUp,
      signOut,
    }),
    [completeOAuth, error, linkExternalGameUsername, loading, previewSession, profile, refresh, removeProfileImage, saveBoardPreferences, sessionProvider, signIn, signOut, signUp, updateProfile, uploadProfileImage, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function createPreviewSessionFromUrl() {
  const previewEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_ADMIN_PREVIEW === 'true'
  if (!previewEnabled) return null
  const params = new URLSearchParams(window.location.search)
  if (params.get('adminPreview') !== '1' || params.get('mode') === 'guest') return null
  return createPreviewSession(params.get('previewEmail') || 'student.preview@ju.edu.jo')
}

function createPreviewSession(email: string, displayName = displayNameFromEmail(email)): PreviewAuthSession {
  const normalizedEmail = email.trim() || 'student.preview@ju.edu.jo'
  const normalizedName = displayName.trim() || displayNameFromEmail(normalizedEmail)

  const user = {
    $id: `preview-${normalizedEmail}`,
    email: normalizedEmail,
    name: normalizedName,
  } as unknown as Models.User

  const profile = {
    $id: `preview-profile-${normalizedEmail}`,
    accountId: user.$id,
    displayName: normalizedName,
    email: normalizedEmail,
    role: 'member',
    status: 'active',
    rating: 1200,
  } as unknown as AuthProfile

  return { user, profile, sessionProvider: 'email' }
}

function displayNameFromEmail(email: string) {
  const localPart = email.trim().split('@')[0] || 'Preview Member'
  const displayName = localPart
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(' ')

  return displayName || 'Preview Member'
}
