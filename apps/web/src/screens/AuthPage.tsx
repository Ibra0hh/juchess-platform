import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import UniversityField from '../components/UniversityField'
import GoogleMark from '../components/GoogleMark'
import {
  formatAppwriteError,
  startOAuthSession,
  type SocialAuthProvider,
} from '../lib/auth'
import './AuthPage.css'

type AuthPageProps = {
  mode: 'sign-in' | 'sign-up'
}

function AuthPage({ mode }: AuthPageProps) {
  const { ready, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isSignup = mode === 'sign-up'
  const [fullName, setFullName] = useState('')
  const [university, setUniversity] = useState('')
  const [universityId, setUniversityId] = useState('')
  const [phone, setPhone] = useState('')
  const [chessComUsername, setChessComUsername] = useState('')
  const [lichessUsername, setLichessUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [oauthProvider, setOauthProvider] = useState<SocialAuthProvider | null>(null)
  const [message, setMessage] = useState<string | null>(() => (
    searchParams.get('oauth') === 'failed'
      ? `${providerName(searchParams.get('provider'))} sign-in could not be completed. Try again or use your email.`
      : null
  ))

  const passwordRules = useMemo(() => ({
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  }), [password])
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password])
  const passwordReady = passwordRules.length && passwordRules.uppercase && passwordRules.number
  const passwordsMatch = confirmPassword.length > 0 && confirmPassword === password

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    if (isSignup && !passwordReady) {
      setMessage('Use at least 8 characters with one uppercase letter and one number.')
      return
    }
    if (isSignup && !passwordsMatch) {
      setMessage('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      if (isSignup) {
        await signUp({
          fullName: fullName.trim(),
          university: university.trim(),
          universityId: universityId.trim(),
          phone: phone.trim(),
          chessComUsername: chessComUsername.trim(),
          lichessUsername: lichessUsername.trim(),
          email: email.trim(),
          password,
        })
      } else {
        await signIn({ email: email.trim(), password })
      }
      navigate('/profile')
    } catch (error) {
      setMessage(formatAppwriteError(error))
    } finally {
      setSubmitting(false)
    }
  }

  function handleOAuth(provider: SocialAuthProvider) {
    setMessage(null)
    setOauthProvider(provider)
    try {
      startOAuthSession(provider)
    } catch (error) {
      setOauthProvider(null)
      setMessage(formatAppwriteError(error))
    }
  }

  const busy = submitting || oauthProvider !== null

  return (
    <div className="auth-screen" data-screen-label={isSignup ? 'Sign Up' : 'Sign In'}>
      <AuthSiteHeader />
      <main className={`auth-main prototype-auth-main ${isSignup ? 'signup' : 'signin'}`}>
        <section className={`auth-panel prototype-auth-panel ${isSignup ? 'signup' : 'signin'}`} aria-labelledby="auth-title">
          <div className="auth-intro">
            {!isSignup ? <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="" /> : null}
            <h1 id="auth-title">{isSignup ? 'Create Player Club Account' : 'Welcome back'}</h1>
            <p>{isSignup ? 'Join the University of Jordan Chess Club roster' : 'Sign in to your player club account'}</p>
          </div>

          {!ready ? (
            <div className="auth-note" role="status">
              Cloud accounts are not configured yet. Account sign-in will be available after setup.
            </div>
          ) : null}

          <SocialSignIn
            busy={busy}
            oauthProvider={oauthProvider}
            ready={ready}
            onSelect={handleOAuth}
          />

          <div className="auth-divider" aria-hidden="true">
            <span />
            <small>or with email</small>
            <span />
          </div>

          <form className="auth-form prototype-auth-form" onSubmit={handleSubmit}>
            {isSignup ? (
              <>
                <AuthField label="Full name">
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} required autoComplete="name" placeholder="e.g. Ibrahim Ahmad" />
                </AuthField>

                <div className="auth-two-column">
                  <AuthField label="Email">
                    <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="name@email.com" />
                  </AuthField>
                  <AuthField label="Phone number">
                    <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required autoComplete="tel" inputMode="tel" placeholder="07X XXX XXXX" />
                  </AuthField>
                </div>

                <UniversityField required value={university} onChange={setUniversity} />

                <AuthField label="University ID" help="Used for club verification only - never shown publicly.">
                  <input value={universityId} onChange={(event) => setUniversityId(event.target.value)} required autoComplete="username" placeholder="e.g. 0201234" />
                </AuthField>

                <div className="auth-two-column">
                  <AuthField label={<span>Chess.com username <em>(optional)</em></span>}>
                    <input value={chessComUsername} onChange={(event) => setChessComUsername(event.target.value)} placeholder="username" />
                  </AuthField>
                  <AuthField label={<span>Lichess username <em>(optional)</em></span>}>
                    <input value={lichessUsername} onChange={(event) => setLichessUsername(event.target.value)} placeholder="username" />
                  </AuthField>
                </div>

                <PasswordField
                  label="Password"
                  value={password}
                  showPassword={showPassword}
                  onChange={setPassword}
                  onToggle={() => setShowPassword((visible) => !visible)}
                  autoComplete="new-password"
                />

                <div className="auth-password-rules" aria-label="Password requirements">
                  <PasswordRule met={passwordRules.length}>8+ characters</PasswordRule>
                  <PasswordRule met={passwordRules.uppercase}>1 uppercase letter</PasswordRule>
                  <PasswordRule met={passwordRules.number}>1 number</PasswordRule>
                </div>
                <PasswordStrength score={passwordStrength.score} label={passwordStrength.label} />

                <PasswordField
                  label="Confirm password"
                  value={confirmPassword}
                  showPassword={showPassword}
                  onChange={setConfirmPassword}
                  onToggle={() => setShowPassword((visible) => !visible)}
                  autoComplete="new-password"
                />
                {confirmPassword && !passwordsMatch ? <small className="auth-mismatch">Passwords do not match yet.</small> : null}
              </>
            ) : (
              <>
                <AuthField label="Email">
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="name@email.com" />
                </AuthField>
                <PasswordField
                  label="Password"
                  value={password}
                  showPassword={showPassword}
                  onChange={setPassword}
                  onToggle={() => setShowPassword((visible) => !visible)}
                  autoComplete="current-password"
                />
                <div className="auth-forgot-row">
                  <Link to="/forgot-password">Forgot password?</Link>
                </div>
              </>
            )}

            {message ? <div className="auth-error" role="alert">{message}</div> : null}

            <button className="auth-submit-button" type="submit" disabled={!ready || busy}>
              {submitting ? 'Working...' : isSignup ? 'Create Account' : 'Sign In'}
            </button>

            {!isSignup ? (
              <>
                <Link className="auth-secondary-button" to="/sign-up">Sign Up</Link>
                <Link className="auth-guest-link" to="/home">Enter as guest</Link>
              </>
            ) : null}
          </form>

          {isSignup ? (
            <div className="auth-switch">Do you have an account? <Link to="/sign-in">Sign in</Link></div>
          ) : null}
        </section>
      </main>
      {!isSignup ? <footer className="auth-footer">University of Jordan Chess Club &middot; 2026</footer> : null}
    </div>
  )
}

function AuthSiteHeader() {
  return (
    <header className="auth-site-header">
      <Link to="/home">
        <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="Chess Club JU crest" />
        <span>JuChess</span>
      </Link>
    </header>
  )
}

function SocialSignIn({ busy, oauthProvider, onSelect, ready }: {
  busy: boolean
  oauthProvider: SocialAuthProvider | null
  onSelect: (provider: SocialAuthProvider) => void
  ready: boolean
}) {
  return (
    <div className="auth-social-row">
      <button type="button" className="auth-social google" disabled={!ready || busy} onClick={() => onSelect('google')}>
        <GoogleMark />
        <span>{oauthProvider === 'google' ? 'Connecting...' : 'Continue with Google'}</span>
      </button>
    </div>
  )
}

function AuthField({ children, help, label }: { children: ReactNode; help?: string; label: ReactNode }) {
  return (
    <label className="auth-field">
      <span className="auth-field-label">{label}</span>
      {children}
      {help ? <small>{help}</small> : null}
    </label>
  )
}

function PasswordField({ autoComplete, label, onChange, onToggle, showPassword, value }: {
  autoComplete: 'current-password' | 'new-password'
  label: ReactNode
  onChange: (value: string) => void
  onToggle: () => void
  showPassword: boolean
  value: string
}) {
  return (
    <AuthField label={label}>
      <span className="auth-password-field">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={8}
          autoComplete={autoComplete}
          placeholder="••••••••"
        />
        <button type="button" className="auth-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={onToggle}>
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </AuthField>
  )
}

function PasswordRule({ children, met }: { children: ReactNode; met: boolean }) {
  return <span className={met ? 'met' : ''}>{children}</span>
}

function PasswordStrength({ label, score }: { label: string; score: number }) {
  return (
    <div className={`auth-password-strength strength-${score}`}>
      <div className="auth-password-strength-label">
        <span>Password strength</span>
        <strong>{label}</strong>
      </div>
      <div
        className="auth-password-strength-meter"
        role="meter"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score}
        aria-valuetext={label}
      >
        {[1, 2, 3, 4].map((level) => <span key={level} className={score >= level ? 'active' : ''} />)}
      </div>
    </div>
  )
}

function getPasswordStrength(password: string) {
  if (!password) return { score: 0, label: 'Not set' }

  let score = 0
  if (password.length >= 8) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (password.length >= 12 || (/[a-z]/.test(password) && /[^A-Za-z0-9]/.test(password))) score += 1

  return {
    score,
    label: ['Weak', 'Weak', 'Fair', 'Good', 'Strong'][score],
  }
}

function providerName(provider: string | null) {
  return provider === 'apple' ? 'Apple' : 'Google'
}

export default AuthPage
