import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import {
  completePasswordRecovery,
  formatAppwriteError,
  requestPasswordRecovery,
} from '../lib/auth'
import { appwriteReady } from '../lib/appwrite'
import './AuthPage.css'

function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const userId = params.get('userId') ?? ''
  const secret = params.get('secret') ?? ''
  const isReset = Boolean(userId && secret)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const title = isReset ? 'Set a new password' : 'Reset your password'
  const subtitle = isReset
    ? 'Choose a new password for your JuChess account.'
    : 'We will send a recovery link to your Appwrite account email.'

  const buttonLabel = useMemo(() => {
    if (submitting) return 'Working...'
    return isReset ? 'Update password' : 'Send recovery link'
  }, [isReset, submitting])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    setDone(false)

    try {
      if (isReset) {
        await completePasswordRecovery(userId, secret, password)
        setDone(true)
        setMessage('Password updated. You can sign in now.')
      } else {
        await requestPasswordRecovery(email.trim())
        setDone(true)
        setMessage('Recovery email sent if this account exists.')
      }
    } catch (error) {
      setMessage(formatAppwriteError(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-screen" data-screen-label="Forgot Password">
      <SiteHeader active="profile" />
      <main className="auth-main">
        <section className="auth-panel compact" aria-labelledby="forgot-title">
          <div className="auth-brand">
            <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="Chess Club JU logo" />
            <span>Account recovery</span>
          </div>

          <h1 id="forgot-title">{title}</h1>
          <p>{subtitle}</p>

          {!appwriteReady ? (
            <div className="auth-note" role="status">
              Appwrite is not configured yet. Recovery is available after the web env values are set.
            </div>
          ) : null}

          <form className="auth-form" onSubmit={handleSubmit}>
            {isReset ? (
              <label>
                New password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </label>
            ) : (
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
            )}

            {message ? (
              <div className={done ? 'auth-success' : 'auth-error'} role={done ? 'status' : 'alert'}>
                {message}
              </div>
            ) : null}

            <button type="submit" disabled={!appwriteReady || submitting}>
              {buttonLabel}
            </button>
          </form>

          <div className="auth-switch">
            <Link to="/sign-in">Back to sign in</Link>
          </div>
        </section>
      </main>
    </div>
  )
}

export default ForgotPasswordPage
