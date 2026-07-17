import { type FormEvent, useEffect, useRef, useState } from 'react'
import { CheckCircle2, MailCheck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { formatAppwriteError } from '../lib/auth'
import {
  confirmEmailVerificationCode,
  confirmEmailVerificationLink,
  getCurrentEmailVerificationState,
  resendEmailVerification,
} from '../lib/emailVerification'
import './AuthPage.css'
import './VerifyEmailPage.css'

type VerificationStatus = 'checking' | 'sent' | 'verified' | 'error'
type VerifiedAction = 'home' | 'sign-in'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const started = useRef(false)
  const challengeId = searchParams.get('challenge') ?? ''
  const challengeToken = searchParams.get('token') ?? ''
  const legacyUserId = searchParams.get('userId') ?? ''
  const legacySecret = searchParams.get('secret') ?? ''
  const email = searchParams.get('email') ?? ''
  const hasChallengeLink = Boolean(challengeId && challengeToken)
  const hasLegacyLink = Boolean(legacyUserId && legacySecret)
  const hasVerificationToken = hasChallengeLink || hasLegacyLink
  const [status, setStatus] = useState<VerificationStatus>(hasVerificationToken ? 'checking' : 'sent')
  const [message, setMessage] = useState(
    hasVerificationToken
      ? 'Confirming that this email belongs to you...'
      : email
        ? `We sent a verification link and six-digit code to ${email}.`
        : 'We sent a verification link and six-digit code to your email address.',
  )
  const [resendEmail, setResendEmail] = useState(email)
  const [resendPassword, setResendPassword] = useState('')
  const [resending, setResending] = useState(false)
  const [resendError, setResendError] = useState('')
  const [verifiedAction, setVerifiedAction] = useState<VerifiedAction>('sign-in')
  const [codeEmail, setCodeEmail] = useState(email)
  const [verificationCode, setVerificationCode] = useState('')
  const [checkingCode, setCheckingCode] = useState(false)
  const [codeError, setCodeError] = useState('')

  useEffect(() => {
    if (!hasVerificationToken || started.current) return
    started.current = true

    if (hasChallengeLink) {
      void confirmEmailVerificationLink(challengeId, challengeToken)
        .then((result) => {
          const routeBase = import.meta.env.VITE_ROUTER_BASE || import.meta.env.BASE_URL
          window.history.replaceState(null, '', `${routeBase}verify-email?verified=1`)
          setStatus('verified')
          setVerifiedAction(result.alreadyVerified ? 'home' : 'sign-in')
          setMessage(result.alreadyVerified
            ? 'Your email is already verified. Thank you.'
            : 'Your email is verified. Sign in to finish your player profile.')
        })
        .catch((error: unknown) => {
          setStatus('error')
          setMessage(formatAppwriteError(error))
        })
      return
    }

    // Appwrite's former verification links lasted seven days. JuChess no
    // longer consumes them because every newly issued proof must obey the
    // server-enforced two-hour limit.
    void getCurrentEmailVerificationState(legacyUserId)
      .then((currentState) => {
        if (currentState !== 'verified') {
          setStatus('error')
          setMessage('This older verification link is no longer active. Request a fresh two-hour email below.')
          return
        }
        const routeBase = import.meta.env.VITE_ROUTER_BASE || import.meta.env.BASE_URL
        window.history.replaceState(null, '', `${routeBase}verify-email?verified=1`)
        setStatus('verified')
        setVerifiedAction('home')
        setMessage('Your email is already verified. Thank you.')
      })
      .catch(() => {
        setStatus('error')
        setMessage('This older verification link is no longer active. Request a fresh two-hour email below.')
      })
  }, [challengeId, challengeToken, hasChallengeLink, hasVerificationToken, legacyUserId])

  async function handleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (checkingCode) return

    setCheckingCode(true)
    setCodeError('')
    try {
      const result = await confirmEmailVerificationCode(codeEmail, verificationCode)
      const routeBase = import.meta.env.VITE_ROUTER_BASE || import.meta.env.BASE_URL
      window.history.replaceState(null, '', `${routeBase}verify-email?verified=1`)
      setStatus('verified')
      setVerifiedAction(result.alreadyVerified ? 'home' : 'sign-in')
      setMessage(result.alreadyVerified
        ? 'Your email is already verified. Thank you.'
        : 'Your email is verified. Sign in to finish your player profile.')
      setVerificationCode('')
    } catch (error) {
      setCodeError(formatAppwriteError(error))
    } finally {
      setCheckingCode(false)
    }
  }

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (resending) return

    setResending(true)
    setResendError('')
    try {
      const result = await resendEmailVerification(resendEmail, resendPassword, legacyUserId)
      const routeBase = import.meta.env.VITE_ROUTER_BASE || import.meta.env.BASE_URL
      window.history.replaceState(null, '', `${routeBase}verify-email`)
      setResendPassword('')
      setCodeEmail(resendEmail.trim())
      setVerificationCode('')
      setCodeError('')

      if (result === 'already-verified') {
        setStatus('verified')
        setVerifiedAction('home')
        setMessage('Your email is already verified. Thank you.')
        return
      }

      setStatus('sent')
      setMessage(`We sent a fresh verification link and six-digit code to ${resendEmail.trim()}.`)
    } catch (error) {
      setResendError(formatAppwriteError(error))
    } finally {
      setResending(false)
    }
  }

  const verified = status === 'verified'
  const failed = status === 'error'
  const canEnterCode = status === 'sent' || failed

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
            <p className="auth-verification-help">Open the latest JuChess email and use its button on any device, or enter the six-digit code below. Both expire after two hours.</p>
          ) : null}
          {canEnterCode ? (
            <form className="verification-code-form" onSubmit={handleCode}>
              <div className="verification-form-heading">
                <strong>Enter the code on this device</strong>
                <span>Use the six digits from your latest JuChess email.</span>
              </div>
              <label>
                Email address
                <input
                  type="email"
                  name="verification-email"
                  autoComplete="email"
                  value={codeEmail}
                  onChange={(event) => setCodeEmail(event.target.value)}
                  required
                />
              </label>
              <label>
                Six-digit code
                <input
                  className="verification-code-input"
                  type="text"
                  name="verification-code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                />
              </label>
              {codeError ? <p className="verification-resend-error" role="alert">{codeError}</p> : null}
              <button className="verification-resend-button" type="submit" disabled={checkingCode}>
                {checkingCode ? 'Checking code...' : 'Verify with code'}
              </button>
            </form>
          ) : null}
          {failed ? (
            <>
              <div className="verification-method-divider"><span>Need a fresh email?</span></div>
              <p className="auth-verification-help">For security, enter the email and password you registered with. A resend disables every older link and code.</p>
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
            <Link className="auth-secondary-button" to={verified && verifiedAction === 'home' ? '/home' : '/sign-in'}>
              {verified
                ? verifiedAction === 'home' ? 'Go to home' : 'Continue to sign in'
                : 'Return to sign in'}
            </Link>
          ) : null}
        </section>
      </main>
    </div>
  )
}
