import { createContext } from 'react'
import type { Models } from 'appwrite'
import type { AuthProfile, SignInInput, SignUpInput } from '../lib/auth'
import type { BoardPreferences } from '../lib/boardAppearance'

export type AuthContextValue = {
  ready: boolean
  loading: boolean
  user: Models.User | null
  profile: AuthProfile | null
  error: string | null
  refresh: () => Promise<void>
  signIn: (input: SignInInput) => Promise<void>
  signUp: (input: SignUpInput) => Promise<void>
  signOut: () => Promise<void>
  linkExternalGameUsername: (
    source: 'chess.com' | 'lichess',
    username: string,
  ) => Promise<void>
  saveBoardPreferences: (preferences: BoardPreferences) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
