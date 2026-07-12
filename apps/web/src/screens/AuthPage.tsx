import { useMemo, useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/useAuth'
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
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
          phone: phone.trim(),
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
              Cloud accounts are not configured yet. Account sign-in will be available after setup.
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
                <label>
                  Phone number
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="0791234567"
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
              <span className="auth-password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            {passwordHint ? <small className="auth-hint">{passwordHint}</small> : null}

            {message ? (
              <div className="auth-error" role="alert">
                {message}
              </div>
            ) : null}

            <button className="auth-submit-button" type="submit" disabled={!ready || submitting}>
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
