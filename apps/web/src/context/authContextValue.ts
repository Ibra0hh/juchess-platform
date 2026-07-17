import { createContext } from 'react'
import type { Models } from 'appwrite'
import type {
  AuthProfile,
  AuthSession,
  ProfileMediaKind,
  ProfileUpdateInput,
  SignInInput,
  SignUpInput,
} from '../lib/auth'
import type { BoardPreferences } from '../lib/boardAppearance'

export type AuthContextValue = {
  ready: boolean
  loading: boolean
  user: Models.User | null
  profile: AuthProfile | null
  sessionProvider: string | null
  error: string | null
  refresh: () => Promise<AuthSession | null>
  completeOAuth: (userId: string, secret: string) => Promise<AuthSession>
  signIn: (input: SignInInput) => Promise<AuthSession>
  signUp: (input: SignUpInput) => Promise<void>
  signOut: () => Promise<void>
  linkExternalGameUsername: (
    source: 'chess.com' | 'lichess',
    username: string,
  ) => Promise<void>
  saveBoardPreferences: (preferences: BoardPreferences) => Promise<void>
  updateProfile: (input: ProfileUpdateInput) => Promise<void>
  uploadProfileImage: (kind: ProfileMediaKind, file: File) => Promise<void>
  removeProfileImage: (kind: ProfileMediaKind) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
