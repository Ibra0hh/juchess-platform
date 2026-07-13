import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import UniversityField from '../components/UniversityField'
import { formatAppwriteError } from '../lib/auth'
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
  const { loading, profile, updateProfile, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<CompletionForm>(() => createForm(profile, user?.name))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setForm(createForm(profile, user?.name))
  }, [profile, user?.name])

  if (loading) return <CompletionStatus />
  if (!user) return <Navigate to="/sign-in" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    if (!form.displayName.trim() || !form.university.trim() || !form.universityId.trim() || !form.phone.trim()) {
      setMessage('Full name, university, University ID, and phone number are required.')
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

  return (
    <div className="auth-screen">
      <header className="auth-site-header">
        <Link to="/home">
          <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="Chess Club JU crest" />
          <span>JuChess</span>
        </Link>
      </header>
      <main className="auth-main prototype-auth-main signup">
        <section className="auth-panel prototype-auth-panel signup social-profile-panel" aria-labelledby="complete-profile-title">
          <div className="auth-intro">
            <h1 id="complete-profile-title">Complete your club profile</h1>
            <p>Google verified your identity. Add the club details it does not provide.</p>
          </div>

          <div className="social-verified-account">
            <span>Verified Google account</span>
            <strong>{user.email}</strong>
          </div>

          <form className="auth-form prototype-auth-form" onSubmit={handleSubmit}>
            <AuthInput label="Full name" required value={form.displayName} onChange={(value) => setForm({ ...form, displayName: value })} placeholder="e.g. Ibrahim Ahmad" autoComplete="name" />
            <UniversityField required value={form.university} onChange={(university) => setForm({ ...form, university })} />
            <div className="auth-two-column">
              <AuthInput label="University ID" required value={form.universityId} onChange={(value) => setForm({ ...form, universityId: value })} placeholder="e.g. 0201234" autoComplete="username" />
              <AuthInput label="Phone number" required value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} placeholder="+962 7X XXX XXXX" autoComplete="tel" type="tel" />
            </div>
            <div className="auth-two-column">
              <AuthInput label="Chess.com username" value={form.chessComUsername} onChange={(value) => setForm({ ...form, chessComUsername: value })} placeholder="Optional" />
              <AuthInput label="Lichess username" value={form.lichessUsername} onChange={(value) => setForm({ ...form, lichessUsername: value })} placeholder="Optional" />
            </div>

            {message ? <div className="auth-error" role="alert">{message}</div> : null}
            <button className="auth-submit-button" type="submit" disabled={saving}>
              {saving ? 'Saving profile...' : 'Continue to JuChess'}
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}

function AuthInput({
  autoComplete,
  label,
  onChange,
  placeholder,
  required = false,
  type = 'text',
  value,
}: {
  autoComplete?: string
  label: string
  onChange: (value: string) => void
  placeholder: string
  required?: boolean
  type?: string
  value: string
}) {
  return (
    <label className="auth-field">
      <span className="auth-field-label">{label}{!required ? <em> (optional)</em> : null}</span>
      <input autoComplete={autoComplete} maxLength={128} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} type={type} value={value} />
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
