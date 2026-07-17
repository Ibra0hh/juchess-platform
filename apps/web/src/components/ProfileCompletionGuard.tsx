import type { ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { routeRequiresAuthenticatedSession, shouldRedirectToProfileCompletion } from '../lib/profileCompletion'
import RouteSkeleton from './RouteSkeleton'

export function ProfileCompletionGuard({ children }: { children: ReactNode }) {
  const { error, loading, profile, refresh, signOut, user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  async function restartSignIn() {
    await signOut().catch(() => undefined)
    navigate('/sign-in', { replace: true })
  }

  const requiresSession = routeRequiresAuthenticatedSession(location.pathname)

  if (loading && requiresSession) return <RouteSkeleton />

  if (error && requiresSession) {
    return (
      <main className="session-recovery" role="alert">
        <section>
          <span className="session-recovery-mark" aria-hidden="true">!</span>
          <p className="session-recovery-kicker">Account connection</p>
          <h1>We couldn't finish loading your account.</h1>
          <p>{error}</p>
          <div>
            <button type="button" onClick={() => void refresh()}>Try again</button>
            <button className="secondary" type="button" onClick={() => void restartSignIn()}>Sign in again</button>
          </div>
        </section>
      </main>
    )
  }

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
