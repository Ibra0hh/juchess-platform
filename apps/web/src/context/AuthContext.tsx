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

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Models.User | null>(null)
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signIn = useCallback(async (input: SignInInput) => {
    setError(null)
    const session = await signInWithEmail(input)
    setUser(session.user)
    setProfile(session.profile)
  }, [])

  const signUp = useCallback(async (input: SignUpInput) => {
    setError(null)
    const session = await signUpWithEmail(input)
    setUser(session.user)
    setProfile(session.profile)
  }, [])

  const signOut = useCallback(async () => {
    await signOutCurrentUser()
    setUser(null)
    setProfile(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ready: appwriteReady,
      loading,
      user,
      profile,
      error,
      refresh,
      signIn,
      signUp,
      signOut,
    }),
    [error, loading, profile, refresh, signIn, signOut, signUp, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }
  return context
}
