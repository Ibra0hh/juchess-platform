import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { appwriteReady } from '../lib/appwrite'
import {
  formatAppwriteError,
  getCurrentSession,
  signInWithEmail,
  signOutCurrentUser,
  signUpWithEmail,
  type AuthProfile,
  type SignInInput,
  type SignUpInput,
} from '../lib/auth'
import type { Models } from 'appwrite'

type AuthContextValue = {
  ready: boolean
  loading: boolean
  user: Models.User | null
  profile: AuthProfile | null
  error: string | null
  refresh: () => Promise<void>
  signIn: (input: SignInInput) => Promise<void>
  signUp: (input: SignUpInput) => Promise<void>
  signOut: () => Promise<void>
}

type PreviewAuthSession = {
  user: Models.User
  profile: AuthProfile
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const previewSession = useMemo(() => createPreviewSessionFromUrl(), [])
  const [user, setUser] = useState<Models.User | null>(previewSession?.user ?? null)
  const [profile, setProfile] = useState<AuthProfile | null>(previewSession?.profile ?? null)
  const [loading, setLoading] = useState(!previewSession)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (previewSession) {
      setUser(previewSession.user)
      setProfile(previewSession.profile)
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

  const signUp = useCallback(async (input: SignUpInput) => {
    if (previewSession) {
      const nextSession = createPreviewSession(input.email, input.fullName)
      setUser(nextSession.user)
      setProfile(nextSession.profile)
      setError(null)
      return
    }

    setError(null)
    const session = await signUpWithEmail(input)
    setUser(session.user)
    setProfile(session.profile)
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

  const value = useMemo<AuthContextValue>(
    () => ({
      ready: Boolean(previewSession) || appwriteReady,
      loading,
      user,
      profile,
      error,
      refresh,
      signIn,
      signUp,
      signOut,
    }),
    [error, loading, previewSession, profile, refresh, signIn, signOut, signUp, user],
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

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }
  return context
}
