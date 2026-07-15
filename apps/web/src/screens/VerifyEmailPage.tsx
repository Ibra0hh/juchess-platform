import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, MailCheck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { completeEmailVerification, formatAppwriteError } from '../lib/auth'
import './AuthPage.css'

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

  useEffect(() => {
    if (!hasVerificationToken || started.current) return
    started.current = true

    void completeEmailVerification(userId, secret)
      .then(() => {
        const routeBase = import.meta.env.VITE_ROUTER_BASE || import.meta.env.BASE_URL
        window.history.replaceState(null, '', `${routeBase}verify-email?verified=1`)
        setStatus('verified')
        setMessage('Your email is verified. You can now sign in to JuChess.')
      })
      .catch((error) => {
        setStatus('error')
        setMessage(formatAppwriteError(error))
      })
  }, [hasVerificationToken, secret, userId])

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
            <p className="auth-verification-help">The link may be expired or already used. Sign in again and JuChess will send a fresh one.</p>
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
