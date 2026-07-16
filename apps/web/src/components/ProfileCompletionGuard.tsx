import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { shouldRedirectToProfileCompletion } from '../lib/profileCompletion'
import RouteSkeleton from './RouteSkeleton'

export function ProfileCompletionGuard({ children }: { children: ReactNode }) {
  const { loading, profile, user } = useAuth()
  const location = useLocation()

  if (loading) return <RouteSkeleton />

  if (shouldRedirectToProfileCompletion({
    loading,
    pathname: location.pathname,
    profile,
    signedIn: Boolean(user),
  })) {
    return <Navigate to="/complete-profile" replace />
  }

  return children
}
