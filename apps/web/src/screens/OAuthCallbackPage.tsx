import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { formatAppwriteError } from '../lib/auth'
import { compactCrestUrl } from '../lib/brand'
import { postAuthenticationDestination } from '../lib/profileCompletion'
import './AuthPage.css'

export default function OAuthCallbackPage() {
  const { completeOAuth, refresh, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const started = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const userId = searchParams.get('userId')
    const secret = searchParams.get('secret')
    navigate('/auth/callback', { replace: true })

    if (!userId || !secret) {
      setError('The Google sign-in response is incomplete. Please start again.')
      return
    }

    void completeOAuth(userId, secret)
      .then((session) => {
        navigate(postAuthenticationDestination(session.profile), { replace: true })
      })
      .catch((caught) => setError(formatAppwriteError(caught)))
  }, [completeOAuth, navigate, searchParams])

  async function retrySessionLoad() {
    if (retrying) return
    setRetrying(true)
    setError(null)
    const session = await refresh()
    if (session) {
      navigate(postAuthenticationDestination(session.profile), { replace: true })
      return
    }
    setError('The JuChess session is not available yet. Start Google sign-in again.')
    setRetrying(false)
  }

  async function restartSignIn() {
    await signOut().catch(() => undefined)
    navigate('/sign-in', { replace: true })
  }

  return (
    <div className="auth-screen">
      <AuthHeader />
      <main className="auth-main prototype-auth-main signin">
        <section className="auth-panel prototype-auth-panel signin auth-callback-panel" aria-live="polite">
          <img src={compactCrestUrl} alt="" />
          <h1>{error ? 'Sign-in needs attention' : retrying ? 'Checking your session' : 'Finishing your sign-in'}</h1>
          <p>{error || 'Checking whether your JuChess player profile is ready...'}</p>
          {!error ? <span className="auth-spinner" aria-hidden="true" /> : null}
          {error ? (
            <div className="auth-callback-actions">
              <button className="auth-submit-button" type="button" disabled={retrying} onClick={() => void retrySessionLoad()}>
                {retrying ? 'Checking...' : 'Try loading session again'}
              </button>
              <button className="auth-secondary-button" type="button" onClick={() => void restartSignIn()}>Start sign-in again</button>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  )
}

function AuthHeader() {
  return (
    <header className="auth-site-header">
      <Link to="/home">
        <img src={compactCrestUrl} alt="Chess Club JU crest" />
        <span>JuChess</span>
      </Link>
    </header>
  )
}
