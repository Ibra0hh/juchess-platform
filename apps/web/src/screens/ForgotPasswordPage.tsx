import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import {
  completePasswordRecovery,
  formatAppwriteError,
  requestPasswordRecovery,
} from '../lib/auth'
import { appwriteReady } from '../lib/appwrite'
import { compactCrestUrl } from '../lib/brand'
import {
  ACCOUNT_EMAIL_MAX_LENGTH,
  ACCOUNT_PASSWORD_MAX_LENGTH,
  normalizeAuthEmail,
  validateNewPassword,
} from '../lib/authValidation'
import './AuthPage.css'

function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [recoveryLink, setRecoveryLink] = useState(() => {
    const initialUserId = params.get('userId') ?? ''
    const initialSecret = params.get('secret') ?? ''
    return {
      userId: initialUserId,
      secret: initialSecret,
      invalidLink: Boolean(initialUserId || initialSecret) && !(initialUserId && initialSecret),
    }
  })
  const { userId, secret, invalidLink } = recoveryLink
  const isReset = Boolean(userId && secret)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const submissionInFlight = useRef(false)

  useEffect(() => {
    if (params.has('userId') || params.has('secret')) {
      navigate('/forgot-password', { replace: true })
    }
  }, [navigate, params])

  const title = invalidLink ? 'Recovery link needs attention' : isReset ? 'Set a new password' : 'Reset your password'
  const subtitle = invalidLink
    ? 'This recovery link is incomplete. Request a fresh link to continue securely.'
    : isReset
    ? 'Choose a new password for your JuChess account.'
    : 'We will send a recovery link to your account email.'

  const buttonLabel = useMemo(() => {
    if (submitting) return 'Working...'
    return isReset ? 'Update password' : 'Send recovery link'
  }, [isReset, submitting])

  function openRecoveryRequest() {
    setRecoveryLink({ userId: '', secret: '', invalidLink: false })
    setMessage(null)
    setDone(false)
    navigate('/forgot-password', { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submissionInFlight.current || done) return
    submissionInFlight.current = true
    setSubmitting(true)
    setMessage(null)
    setDone(false)

    try {
      if (isReset) {
        const passwordProblem = validateNewPassword(password)
        if (passwordProblem) throw new Error(passwordProblem)
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.')
        }
        await completePasswordRecovery(userId, secret, password)
        setDone(true)
        setMessage('Password updated. You can sign in now.')
        setPassword('')
        setConfirmPassword('')
      } else {
        await requestPasswordRecovery(normalizeAuthEmail(email))
        setDone(true)
        setMessage('Recovery email sent if this account exists.')
      }
    } catch (error) {
      setMessage(formatAppwriteError(error))
    } finally {
      submissionInFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-screen" data-screen-label="Forgot Password">
      <SiteHeader active="profile" />
      <main className="auth-main">
        <section className="auth-panel compact" aria-labelledby="forgot-title">
          <div className="auth-brand">
            <img src={compactCrestUrl} alt="Chess Club JU logo" />
            <span>Account recovery</span>
          </div>

          <h1 id="forgot-title">{title}</h1>
          <p>{subtitle}</p>

          {!appwriteReady ? (
            <div className="auth-note" role="status">
              Cloud accounts are not configured yet. Recovery will be available after setup.
            </div>
          ) : null}

          {message ? (
            <div className={done ? 'auth-success' : 'auth-error'} role={done ? 'status' : 'alert'}>
              {message}
            </div>
          ) : null}

          {invalidLink ? (
            <button className="auth-submit-link" type="button" onClick={openRecoveryRequest}>
              Request a new recovery link
            </button>
          ) : done ? (
            <Link className="auth-submit-link" to="/sign-in">Continue to sign in</Link>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit} aria-busy={submitting}>
              {isReset ? (
                <>
                  <label>
                    New password
                    <input
                      type="password"
                      name="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={8}
                      maxLength={ACCOUNT_PASSWORD_MAX_LENGTH}
                      autoComplete="new-password"
                      placeholder="••••••••"
                    />
                  </label>
                  <div className="auth-password-rules" aria-label="Password requirements">
                    <span className={password.length >= 8 ? 'met' : ''}>8+ characters</span>
                    <span className={/[A-Z]/.test(password) ? 'met' : ''}>1 uppercase letter</span>
                    <span className={/[0-9]/.test(password) ? 'met' : ''}>1 number</span>
                  </div>
                  <label>
                    Confirm new password
                    <input
                      type="password"
                      name="confirm-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                      minLength={8}
                      maxLength={ACCOUNT_PASSWORD_MAX_LENGTH}
                      autoComplete="new-password"
                      placeholder="••••••••"
                    />
                  </label>
                </>
              ) : (
                <label>
                  Email
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    maxLength={ACCOUNT_EMAIL_MAX_LENGTH}
                    autoComplete="email"
                    placeholder="name@email.com"
                  />
                </label>
              )}

              <button type="submit" disabled={!appwriteReady || submitting}>
                {buttonLabel}
              </button>
            </form>
          )}

          <div className="auth-switch">
            <Link to="/sign-in">Back to sign in</Link>
          </div>
        </section>
      </main>
    </div>
  )
}

export default ForgotPasswordPage
