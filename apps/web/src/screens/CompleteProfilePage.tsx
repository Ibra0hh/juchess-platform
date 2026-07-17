import { useEffect, useState, type FormEvent } from 'react'
import { BadgeCheck, Mail } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import GoogleMark from '../components/GoogleMark'
import UniversityField from '../components/UniversityField'
import { formatAppwriteError } from '../lib/auth'
import { compactCrestUrl } from '../lib/brand'
import { profileCompletionAuthMethod, profileNeedsCompletion } from '../lib/profileCompletion'
import {
  PROFILE_DISPLAY_NAME_MAX_LENGTH,
  PROFILE_PHONE_INPUT_MAX_LENGTH,
  PROFILE_UNIVERSITY_ID_MAX_LENGTH,
  PROFILE_USERNAME_MAX_LENGTH,
  validateRequiredPlayerProfile,
} from '../lib/profileValidation'
import './AuthPage.css'

type CompletionForm = {
  displayName: string
  university: string
  universityId: string
  phone: string
  chessComUsername: string
  lichessUsername: string
}

export default function CompleteProfilePage() {
  const { loading, profile, sessionProvider, signOut, updateProfile, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<CompletionForm>(() => createForm(profile, user?.name))
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setForm(createForm(profile, user?.name))
  }, [profile, user?.name])

  if (loading) return <CompletionStatus />
  if (!user) return <Navigate to="/sign-in" replace />
  if (!profileNeedsCompletion(profile)) return <Navigate to="/profile" replace />

  const authMethod = profileCompletionAuthMethod(sessionProvider)
  const authContent = completionAuthContent(authMethod)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    const validationProblem = validateRequiredPlayerProfile(form)
    if (validationProblem) {
      setMessage(validationProblem)
      return
    }

    setSaving(true)
    try {
      await updateProfile(form)
      navigate('/profile', { replace: true })
    } catch (error) {
      setMessage(formatAppwriteError(error))
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOutWithoutProfile() {
    setMessage(null)
    setSigningOut(true)
    try {
      await signOut()
      navigate('/home', { replace: true })
    } catch (error) {
      setMessage(formatAppwriteError(error))
      setSigningOut(false)
    }
  }

  return (
    <div className="auth-screen">
      <header className="auth-site-header">
        <Link to="/home">
          <img src={compactCrestUrl} alt="Chess Club JU crest" />
          <span>JuChess</span>
        </Link>
      </header>
      <main className="auth-main prototype-auth-main signup">
        <section className="auth-panel prototype-auth-panel signup social-profile-panel" aria-labelledby="complete-profile-title">
          <div className="auth-intro">
            <h1 id="complete-profile-title">Complete your player profile</h1>
            <p>{authContent.intro}</p>
            <p className="profile-creation-note">Complete every required field before continuing to private JuChess features.</p>
          </div>

          <div className="social-verified-account">
            <span className="social-provider-mark">
              {authMethod === 'google' ? <GoogleMark size={20} /> : <Mail size={20} aria-hidden="true" />}
            </span>
            <div className="social-account-identity">
              <span>{authContent.label}</span>
              <strong>{user.name || authContent.fallbackName}</strong>
              <small>{user.email}</small>
            </div>
            <span className="social-verification-status"><BadgeCheck size={16} /> Verified</span>
          </div>

          <form className="auth-form prototype-auth-form" onSubmit={handleSubmit} aria-busy={saving || signingOut}>
            <AuthInput label="Full name" name="name" required value={form.displayName} onChange={(value) => setForm({ ...form, displayName: value })} placeholder="e.g. Ibrahim Ahmad" autoComplete="name" maxLength={PROFILE_DISPLAY_NAME_MAX_LENGTH} />
            <UniversityField required value={form.university} onChange={(university) => setForm({ ...form, university })} />
            <div className="auth-two-column">
              <AuthInput label="University ID" name="university-id" required value={form.universityId} onChange={(value) => setForm({ ...form, universityId: value })} placeholder="e.g. 0201234" autoComplete="username" maxLength={PROFILE_UNIVERSITY_ID_MAX_LENGTH} />
              <AuthInput label="Phone number" name="phone" required value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} placeholder="07X XXX XXXX" autoComplete="tel" type="tel" maxLength={PROFILE_PHONE_INPUT_MAX_LENGTH} />
            </div>
            <div className="auth-two-column">
              <AuthInput label="Chess.com username" name="chess-com-username" value={form.chessComUsername} onChange={(value) => setForm({ ...form, chessComUsername: value })} placeholder="username" maxLength={PROFILE_USERNAME_MAX_LENGTH} />
              <AuthInput label="Lichess username" name="lichess-username" value={form.lichessUsername} onChange={(value) => setForm({ ...form, lichessUsername: value })} placeholder="username" maxLength={PROFILE_USERNAME_MAX_LENGTH} />
            </div>

            {message ? <div className="auth-error" role="alert">{message}</div> : null}
            <button className="auth-submit-button" type="submit" disabled={saving || signingOut}>
              {saving ? 'Saving profile...' : 'Continue to JuChess'}
            </button>
            <button
              className="auth-secondary-button"
              type="button"
              disabled={saving || signingOut}
              onClick={() => void handleSignOutWithoutProfile()}
            >
              {signingOut ? 'Signing out...' : 'Sign out without creating a profile'}
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}

function completionAuthContent(authMethod: ReturnType<typeof profileCompletionAuthMethod>) {
  if (authMethod === 'google') {
    return {
      label: 'Signed in with Google',
      fallbackName: 'Google account',
      intro: 'Your Google sign-in is connected. Add the missing details required for JuChess tournaments and membership.',
    }
  }
  if (authMethod === 'email') {
    return {
      label: 'Signed in with email',
      fallbackName: 'JuChess account',
      intro: 'You signed in with email and password. Add the missing details required for JuChess tournaments and membership.',
    }
  }
  return {
    label: 'Signed in to JuChess',
    fallbackName: 'JuChess account',
    intro: 'Your JuChess account is signed in. Add the missing details required for tournaments and membership.',
  }
}

function AuthInput({
  autoComplete,
  label,
  maxLength = 128,
  name,
  onChange,
  placeholder,
  required = false,
  type = 'text',
  value,
}: {
  autoComplete?: string
  label: string
  maxLength?: number
  name: string
  onChange: (value: string) => void
  placeholder: string
  required?: boolean
  type?: string
  value: string
}) {
  return (
    <label className="auth-field">
      <span className="auth-field-label">{label}{!required ? <em> (optional)</em> : null}</span>
      <input autoComplete={autoComplete} maxLength={maxLength} name={name} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} type={type} value={value} />
    </label>
  )
}

function CompletionStatus() {
  return (
    <main className="auth-screen auth-callback-status" role="status">
      <span className="auth-spinner" aria-hidden="true" />
      <p>Loading your secure session...</p>
    </main>
  )
}

function createForm(profile: ReturnType<typeof useAuth>['profile'], accountName?: string): CompletionForm {
  return {
    displayName: profile?.displayName || accountName || '',
    university: profile?.university || '',
    universityId: profile?.universityId || '',
    phone: profile?.phone || '',
    chessComUsername: profile?.chessComUsername || '',
    lichessUsername: profile?.lichessUsername || '',
  }
}
