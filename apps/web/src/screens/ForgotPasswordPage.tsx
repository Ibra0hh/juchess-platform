import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
import {
  resetPasswordWithRecoveryCode,
  resetPasswordWithRecoveryLink,
} from '../lib/passwordRecovery'
import {
  hasPasswordRecoveryParams,
  normalizePasswordRecoveryCode,
  parsePasswordRecoveryEntry,
  type PasswordRecoveryCredential,
  type PasswordRecoveryLocationState,
} from '../lib/passwordRecoveryState'
import './AuthPage.css'

type RecoveryView = 'request' | 'code' | 'link' | 'invalid' | 'complete'
type Feedback = { tone: 'error' | 'success'; message: string } | null

function proofCannotBeRetried(message: string) {
  return /invalid or expired|expired after|too many incorrect|secure (?:link|code) is invalid/i.test(message)
}

function PasswordFields({
  password,
  confirmPassword,
  setPassword,
  setConfirmPassword,
}: {
  password: string
  confirmPassword: string
  setPassword: (value: string) => void
  setConfirmPassword: (value: string) => void
}) {
  return (
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
          aria-describedby="recovery-password-rules"
          placeholder="••••••••"
        />
      </label>
      <div id="recovery-password-rules" className="auth-password-rules" aria-label="Password requirements">
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
          aria-invalid={Boolean(confirmPassword && password !== confirmPassword)}
          placeholder="••••••••"
        />
      </label>
    </>
  )
}

function ForgotPasswordPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [initialEntry] = useState(() => parsePasswordRecoveryEntry(
    location.search,
    location.state as PasswordRecoveryLocationState,
  ))
  const [credential, setCredential] = useState<PasswordRecoveryCredential | null>(() => (
    initialEntry.kind === 'link' ? initialEntry.credential : null
  ))
  const [view, setView] = useState<RecoveryView>(() => (
    initialEntry.kind === 'link' ? 'link' : initialEntry.kind
  ))
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const submissionInFlight = useRef(false)

  useLayoutEffect(() => {
    if (!hasPasswordRecoveryParams(location.search)) return
    navigate(
      { pathname: location.pathname, search: '', hash: location.hash },
      {
        replace: true,
        state: initialEntry.kind === 'link'
          ? { passwordRecoveryCredential: initialEntry.credential }
          : null,
      },
    )
  }, [initialEntry, location.hash, location.pathname, location.search, navigate])

  const title = view === 'invalid'
    ? 'Recovery link needs attention'
    : view === 'complete'
      ? 'Password updated'
      : view === 'link'
        ? 'Set a new password'
        : view === 'code'
          ? 'Enter your recovery code'
          : 'Reset your password'
  const subtitle = view === 'invalid'
    ? 'This link is incomplete, expired, or already used. Request a fresh email or use the latest six-digit code.'
    : view === 'complete'
      ? 'Your old sessions were closed. Sign in again with your new password.'
      : view === 'link'
        ? 'Choose a secure new password for your JuChess account.'
        : view === 'code'
          ? 'Enter the code from your newest JuChess recovery email, then choose a new password.'
          : 'We will email both a secure reset button and a six-digit code.'

  function clearSecretFromHistory() {
    navigate(
      { pathname: location.pathname, search: '', hash: location.hash },
      { replace: true, state: null },
    )
  }

  function resetSensitiveFields() {
    setCode('')
    setPassword('')
    setConfirmPassword('')
    setCredential(null)
  }

  function openRecoveryRequest() {
    resetSensitiveFields()
    setFeedback(null)
    setView('request')
    clearSecretFromHistory()
  }

  function openCodeEntry() {
    setCredential(null)
    setPassword('')
    setConfirmPassword('')
    setFeedback(null)
    setView('code')
    clearSecretFromHistory()
  }

  function validatePasswords() {
    const passwordProblem = validateNewPassword(password)
    if (passwordProblem) throw new Error(passwordProblem)
    if (password !== confirmPassword) throw new Error('Passwords do not match.')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submissionInFlight.current || view === 'complete') return
    submissionInFlight.current = true
    setSubmitting(true)
    setFeedback(null)

    try {
      if (view === 'request') {
        const normalizedEmail = normalizeAuthEmail(email)
        await requestPasswordRecovery(normalizedEmail)
        setEmail(normalizedEmail)
        setView('code')
        setFeedback({
          tone: 'success',
          message: 'If a JuChess password account exists for this email, a reset button and six-digit code are being sent. Use only the newest email.',
        })
        return
      }

      validatePasswords()
      if (view === 'link' && credential) {
        if (credential.kind === 'custom') {
          await resetPasswordWithRecoveryLink(credential.challengeId, credential.token, password)
        } else {
          await completePasswordRecovery(credential.userId, credential.secret, password)
        }
      } else if (view === 'code') {
        const normalizedCode = normalizePasswordRecoveryCode(code)
        if (normalizedCode.length !== 6) throw new Error('Enter the six-digit code from your JuChess email.')
        await resetPasswordWithRecoveryCode(normalizeAuthEmail(email), normalizedCode, password)
      } else {
        throw new Error('Request a fresh recovery email to continue.')
      }

      resetSensitiveFields()
      setView('complete')
      setFeedback({ tone: 'success', message: 'Password updated successfully.' })
      clearSecretFromHistory()
    } catch (error) {
      const message = formatAppwriteError(error)
      setFeedback({ tone: 'error', message })
      const linkCannotRetry = view === 'link' && proofCannotBeRetried(message)
      const codeCannotRetry = view === 'code' && /expired after|too many incorrect/i.test(message)
      if (linkCannotRetry || codeCannotRetry) {
        resetSensitiveFields()
        setView('invalid')
        clearSecretFromHistory()
      }
    } finally {
      submissionInFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-screen" data-screen-label="Forgot Password">
      <SiteHeader active="profile" />
      <main className="auth-main auth-recovery-main">
        <section className="auth-panel compact auth-recovery-panel" aria-labelledby="forgot-title">
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

          {feedback ? (
            <div
              className={feedback.tone === 'success' ? 'auth-success' : 'auth-error'}
              role={feedback.tone === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {feedback.message}
            </div>
          ) : null}

          {view === 'invalid' ? (
            <div className="auth-recovery-actions">
              <button className="auth-submit-link" type="button" onClick={openRecoveryRequest}>
                Send a new recovery email
              </button>
              <button className="auth-secondary-button" type="button" onClick={openCodeEntry}>
                Enter recovery code
              </button>
            </div>
          ) : view === 'complete' ? (
            <Link className="auth-submit-link" to="/sign-in">Continue to sign in</Link>
          ) : (
            <>
              <form className="auth-form" onSubmit={handleSubmit} aria-busy={submitting}>
                {view === 'request' || view === 'code' ? (
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
                ) : null}

                {view === 'code' ? (
                  <>
                    <label>
                      Six-digit recovery code
                      <input
                        className="auth-recovery-code-input"
                        type="text"
                        name="recovery-code"
                        value={code}
                        onChange={(event) => setCode(normalizePasswordRecoveryCode(event.target.value))}
                        required
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        autoComplete="one-time-code"
                        aria-label="Six-digit recovery code"
                        placeholder="000000"
                      />
                    </label>
                    <PasswordFields
                      password={password}
                      confirmPassword={confirmPassword}
                      setPassword={setPassword}
                      setConfirmPassword={setConfirmPassword}
                    />
                  </>
                ) : null}

                {view === 'link' ? (
                  <PasswordFields
                    password={password}
                    confirmPassword={confirmPassword}
                    setPassword={setPassword}
                    setConfirmPassword={setConfirmPassword}
                  />
                ) : null}

                <button type="submit" disabled={!appwriteReady || submitting}>
                  {submitting
                    ? 'Working...'
                    : view === 'request'
                      ? 'Send reset email'
                      : 'Update password'}
                </button>
              </form>

              <div className="auth-recovery-actions secondary">
                {view === 'request' ? (
                  <button className="auth-secondary-button" type="button" onClick={openCodeEntry}>
                    I already have a recovery code
                  </button>
                ) : (
                  <button className="auth-secondary-button" type="button" onClick={openRecoveryRequest}>
                    Send a new recovery email
                  </button>
                )}
              </div>
            </>
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
