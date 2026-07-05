import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { formatAppwriteError } from '../lib/auth'
import './AuthPage.css'

type AuthPageProps = {
  mode: 'sign-in' | 'sign-up'
}

function AuthPage({ mode }: AuthPageProps) {
  const { ready, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const isSignup = mode === 'sign-up'
  const [fullName, setFullName] = useState('')
  const [universityId, setUniversityId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const title = isSignup ? 'Create your club account' : 'Sign in to JuChess'
  const subtitle = isSignup
    ? 'Join the tournament system with your University of Jordan chess profile.'
    : 'Open your registrations, games, saved analyses and profile.'

  const passwordHint = useMemo(() => {
    if (!isSignup) return null
    return password.length >= 8 ? 'Password length is ready.' : 'Use at least 8 characters.'
  }, [isSignup, password.length])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)

    try {
      if (isSignup) {
        await signUp({
          fullName: fullName.trim(),
          universityId: universityId.trim(),
          email: email.trim(),
          password,
        })
        navigate('/profile')
      } else {
        await signIn({ email: email.trim(), password })
        navigate('/profile')
      }
    } catch (error) {
      setMessage(formatAppwriteError(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-screen" data-screen-label={isSignup ? 'Sign Up' : 'Sign In'}>
      <SiteHeader active="profile" />
      <main className="auth-main">
        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-brand">
            <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="Chess Club JU logo" />
            <span>Chess Club JU</span>
          </div>

          <h1 id="auth-title">{title}</h1>
          <p>{subtitle}</p>

          {!ready ? (
            <div className="auth-note" role="status">
              Appwrite is not configured yet. Add VITE_APPWRITE_ENDPOINT, VITE_APPWRITE_PROJECT_ID
              and VITE_APPWRITE_DATABASE_ID to enable real accounts.
            </div>
          ) : null}

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup ? (
              <>
                <label>
                  Full name
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Ibrahim Ahmad"
                  />
                </label>
                <label>
                  University ID
                  <input
                    value={universityId}
                    onChange={(event) => setUniversityId(event.target.value)}
                    autoComplete="username"
                    placeholder="2026xxxxx"
                  />
                </label>
              </>
            ) : null}

            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="student@ju.edu.jo"
              />
            </label>

            <label>
              <span className="auth-label-row">
                Password
                {!isSignup ? <Link to="/forgot-password">Forgot?</Link> : null}
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder="••••••••"
              />
            </label>

            {passwordHint ? <small className="auth-hint">{passwordHint}</small> : null}

            {message ? (
              <div className="auth-error" role="alert">
                {message}
              </div>
            ) : null}

            <button type="submit" disabled={!ready || submitting}>
              {submitting ? 'Working...' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="auth-switch">
            {isSignup ? (
              <>
                Do you have an account? <Link to="/sign-in">Sign in</Link>
              </>
            ) : (
              <>
                New to the club? <Link to="/sign-up">Create account</Link>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default AuthPage
