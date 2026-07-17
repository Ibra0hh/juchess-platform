import { type FormEvent, useEffect, useRef, useState } from 'react'
import { CheckCircle2, MailCheck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { completeEmailVerification, formatAppwriteError } from '../lib/auth'
import {
  getCurrentEmailVerificationState,
  isEmailAlreadyVerifiedError,
  resendEmailVerification,
} from '../lib/emailVerification'
import './AuthPage.css'
import './VerifyEmailPage.css'

type VerificationStatus = 'checking' | 'sent' | 'verified' | 'error'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const started = useRef(false)
  const userId = searchParams.get('userId') ?? ''
  const secret = searchParams.get('secret') ?? ''
  const email = searchParams.get('email') ?? ''
  const hasVerificationToken = Boolean(userId && secret)
  const [status, setStatus] = useState<VerificationStatus>(hasVerificationToken ? 'checking' : 'sent')
  const [message, setMessage] = useState(
    hasVerificationToken
      ? 'Confirming that this email belongs to you...'
      : email
        ? `We sent a verification link to ${email}.`
        : 'We sent a verification link to your email address.',
  )
  const [resendEmail, setResendEmail] = useState(email)
  const [resendPassword, setResendPassword] = useState('')
  const [resending, setResending] = useState(false)
  const [resendError, setResendError] = useState('')

  useEffect(() => {
    if (!hasVerificationToken || started.current) return
    started.current = true

    void completeEmailVerification(userId, secret)
      .then(() => {
        const routeBase = import.meta.env.VITE_ROUTER_BASE || import.meta.env.BASE_URL
        window.history.replaceState(null, '', `${routeBase}verify-email?verified=1`)
        setStatus('verified')
        setMessage('Your email is verified. Sign in to finish your player profile.')
      })
      .catch(async (error: unknown) => {
        const currentState = isEmailAlreadyVerifiedError(error)
          ? 'verified'
          : await getCurrentEmailVerificationState(userId)

        if (currentState === 'verified') {
          const routeBase = import.meta.env.VITE_ROUTER_BASE || import.meta.env.BASE_URL
          window.history.replaceState(null, '', `${routeBase}verify-email?verified=1`)
          setStatus('verified')
          setMessage('Your email is verified. Sign in to finish your player profile.')
          return
        }

        setStatus('error')
        setMessage('This verification link is invalid, expired, or has already been used.')
      })
  }, [hasVerificationToken, secret, userId])

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (resending) return

    setResending(true)
    setResendError('')
    try {
      const result = await resendEmailVerification(resendEmail, resendPassword, userId)
      const routeBase = import.meta.env.VITE_ROUTER_BASE || import.meta.env.BASE_URL
      window.history.replaceState(null, '', `${routeBase}verify-email`)
      setResendPassword('')

      if (result === 'already-verified') {
        setStatus('verified')
        setMessage('Your email is verified. Sign in to finish your player profile.')
        return
      }

      setStatus('sent')
      setMessage(`We sent a fresh verification link to ${resendEmail.trim()}.`)
    } catch (error) {
      setResendError(formatAppwriteError(error))
    } finally {
      setResending(false)
    }
  }

  const verified = status === 'verified'
  const failed = status === 'error'

  return (
    <div className="auth-screen" data-screen-label="Verify Email">
      <SiteHeader active="profile" />
      <main className="auth-main prototype-auth-main signin">
        <section className="auth-panel prototype-auth-panel signin auth-callback-panel" aria-live="polite">
          <span className={`auth-status-icon ${verified ? 'verified' : failed ? 'error' : ''}`} aria-hidden="true">
            {verified ? <CheckCircle2 size={34} /> : <MailCheck size={34} />}
          </span>
          <h1>{verified ? 'Email verified' : failed ? 'Link needs attention' : 'Check your inbox'}</h1>
          <p>{message}</p>
          {status === 'checking' ? <span className="auth-spinner" aria-hidden="true" /> : null}
          {status === 'sent' ? (
            <p className="auth-verification-help">Open the latest email from JuChess and press Verify email. The link expires after seven days.</p>
          ) : null}
          {failed ? (
            <>
              <p className="auth-verification-help">Request a fresh link below. For security, enter the email and password you registered with.</p>
              <form className="verification-resend-form" onSubmit={handleResend}>
                <label>
                  Email address
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={resendEmail}
                    onChange={(event) => setResendEmail(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    value={resendPassword}
                    onChange={(event) => setResendPassword(event.target.value)}
                    required
                  />
                </label>
                {resendError ? <p className="verification-resend-error" role="alert">{resendError}</p> : null}
                <button className="verification-resend-button" type="submit" disabled={resending}>
                  {resending ? 'Sending a new link...' : 'Resend verification email'}
                </button>
              </form>
            </>
          ) : null}
          {status !== 'checking' ? (
            <Link className="auth-secondary-button" to="/sign-in">
              {verified ? 'Continue to sign in' : 'Return to sign in'}
            </Link>
          ) : null}
        </section>
      </main>
    </div>
  )
}
