import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { formatAppwriteError, profileNeedsCompletion } from '../lib/auth'
import './AuthPage.css'

export default function OAuthCallbackPage() {
  const { completeOAuth } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const started = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const userId = searchParams.get('userId')
    const secret = searchParams.get('secret')
    const routeBase = import.meta.env.VITE_ROUTER_BASE || import.meta.env.BASE_URL
    window.history.replaceState(null, '', `${routeBase}auth/callback`)

    if (!userId || !secret) {
      setError('The Google sign-in response is incomplete. Please start again.')
      return
    }

    void completeOAuth(userId, secret)
      .then((session) => {
        navigate(profileNeedsCompletion(session.profile) ? '/complete-profile' : '/profile', { replace: true })
      })
      .catch((caught) => setError(formatAppwriteError(caught)))
  }, [completeOAuth, navigate, searchParams])

  return (
    <div className="auth-screen">
      <AuthHeader />
      <main className="auth-main prototype-auth-main signin">
        <section className="auth-panel prototype-auth-panel signin auth-callback-panel" aria-live="polite">
          <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="" />
          <h1>{error ? 'Sign-in needs attention' : 'Finishing your sign-in'}</h1>
          <p>{error || 'Creating your secure JuChess session...'}</p>
          {!error ? <span className="auth-spinner" aria-hidden="true" /> : null}
          {error ? <Link className="auth-secondary-button" to="/sign-in">Return to sign in</Link> : null}
        </section>
      </main>
    </div>
  )
}

function AuthHeader() {
  return (
    <header className="auth-site-header">
      <Link to="/home">
        <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="Chess Club JU crest" />
        <span>JuChess</span>
      </Link>
    </header>
  )
}
