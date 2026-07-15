import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AuthContext, type AuthContextValue } from './authContextValue'
import { appwriteReady } from '../lib/appwrite'
import {
  completeOAuthTokenSession,
  formatAppwriteError,
  getCurrentSession,
  loadPreviewProfileByEmail,
  deleteProfileMedia,
  saveBoardAppearance,
  saveExternalGameUsername,
  saveProfileDetails,
  signInWithEmail,
  signOutCurrentUser,
  signUpWithEmail,
  uploadProfileMedia,
  type AuthProfile,
  type ProfileMediaKind,
  type ProfileUpdateInput,
  type SignInInput,
  type SignUpInput,
} from '../lib/auth'
import type { BoardPreferences } from '../lib/boardAppearance'
import type { Models } from 'appwrite'

type PreviewAuthSession = {
  user: Models.User
  profile: AuthProfile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const previewSession = useMemo(() => createPreviewSessionFromUrl(), [])
  const [user, setUser] = useState<Models.User | null>(previewSession?.user ?? null)
  const [profile, setProfile] = useState<AuthProfile | null>(previewSession?.profile ?? null)
  const [loading, setLoading] = useState(!previewSession)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (previewSession) {
      const nextSession = await loadAppwritePreviewSession(previewSession)
      setUser(nextSession.user)
      setProfile(nextSession.profile)
      setLoading(false)
      setError(null)
      return
    }

    if (!appwriteReady) {
      setUser(null)
      setProfile(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const session = await getCurrentSession()
      setUser(session?.user ?? null)
      setProfile(session?.profile ?? null)
    } catch (caught) {
      setError(formatAppwriteError(caught))
      setUser(null)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [previewSession])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signIn = useCallback(async (input: SignInInput) => {
    if (previewSession) {
      const nextSession = createPreviewSession(input.email)
      setUser(nextSession.user)
      setProfile(nextSession.profile)
      setError(null)
      return
    }

    setError(null)
    const session = await signInWithEmail(input)
    setUser(session.user)
    setProfile(session.profile)
  }, [previewSession])

  const completeOAuth = useCallback(async (userId: string, secret: string) => {
    setError(null)
    const session = await completeOAuthTokenSession(userId, secret)
    setUser(session.user)
    setProfile(session.profile)
    return session
  }, [])

  const signUp = useCallback(async (input: SignUpInput) => {
    if (previewSession) {
      const nextSession = createPreviewSession(input.email, input.fullName)
      setUser(nextSession.user)
      setProfile(nextSession.profile)
      setError(null)
      return
    }

    setError(null)
    await signUpWithEmail(input)
    setUser(null)
    setProfile(null)
  }, [previewSession])

  const signOut = useCallback(async () => {
    if (previewSession) {
      setUser(previewSession.user)
      setProfile(previewSession.profile)
      return
    }

    await signOutCurrentUser()
    setUser(null)
    setProfile(null)
  }, [previewSession])

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

    const updated = await saveExternalGameUsername(profile.$id, source, normalized)
    setProfile(updated)
  }, [previewSession, profile])

  const saveBoardPreferences = useCallback(async (preferences: BoardPreferences) => {
    if (!profile) return

    if (previewSession || profile.$id.startsWith('preview-')) {
      setProfile({ ...profile, ...preferences } as AuthProfile)
      return
    }

    const updated = await saveBoardAppearance(profile.$id, preferences)
    setProfile(updated)
  }, [previewSession, profile])

  const updateProfile = useCallback(async (input: ProfileUpdateInput) => {
    if (!profile) throw new Error('Sign in before editing your profile.')

    if (previewSession || profile.$id.startsWith('preview-')) {
      setProfile({
        ...profile,
        ...input,
        displayName: input.displayName.trim(),
        chessComUsername: input.chessComUsername?.trim().toLowerCase() || undefined,
        lichessUsername: input.lichessUsername?.trim().toLowerCase() || undefined,
      } as AuthProfile)
      return
    }

    const updated = await saveProfileDetails(profile.$id, input)
    setProfile(updated)
  }, [previewSession, profile])

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
    [completeOAuth, error, linkExternalGameUsername, loading, previewSession, profile, refresh, removeProfileImage, saveBoardPreferences, signIn, signOut, signUp, updateProfile, uploadProfileImage, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function createPreviewSessionFromUrl() {
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

  return { user, profile }
}

async function loadAppwritePreviewSession(fallbackSession: PreviewAuthSession): Promise<PreviewAuthSession> {
  try {
    const realProfile = await loadPreviewProfileByEmail(fallbackSession.user.email)
    if (!realProfile) return fallbackSession

    const user = {
      ...fallbackSession.user,
      $id: realProfile.accountId,
      email: realProfile.email,
      name: realProfile.displayName,
    } as unknown as Models.User

    return { user, profile: realProfile }
  } catch (error) {
    console.warn('JuChess preview profile could not be loaded from the cloud.', error)
    return fallbackSession
  }
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
