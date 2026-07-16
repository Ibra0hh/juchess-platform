import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Camera, Edit3, ImagePlus, LogOut, Trash2, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import ProfileImageEditor from '../components/ProfileImageEditor'
import SiteHeader from '../components/SiteHeader'
import UniversityField from '../components/UniversityField'
import { useAuth } from '../context/useAuth'
import { formatAppwriteError, profileMediaUrl, type ProfileMediaKind } from '../lib/auth'
import { loadProfileGameHistory, type SampleGame } from '../lib/juchess'
import './ClubScreens.css'
import './ProfilePage.css'

type ProfileForm = {
  chessComUsername: string
  displayName: string
  lichessUsername: string
  phone: string
  university: string
  universityId: string
}

type PendingProfileImage = {
  file: File
  kind: ProfileMediaKind
}

function ProfilePage() {
  const navigate = useNavigate()
  const {
    loading,
    profile,
    removeProfileImage,
    signOut,
    updateProfile,
    uploadProfileImage,
    user,
  } = useAuth()
  const authenticated = Boolean(user || profile)
  const displayName = profile?.displayName || user?.name || profile?.email || 'Club member'
  const rating = profile?.rating ?? 1200
  const username = profile?.universityId || profile?.email?.split('@')[0] || user?.email.split('@')[0] || 'member'
  const initials = getInitials(displayName)
  const profileId = profile?.$id
  const avatarUrl = profileMediaUrl(profile?.avatarFileId)
  const coverUrl = profileMediaUrl(profile?.coverFileId)
  const [history, setHistory] = useState<SampleGame[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mediaBusy, setMediaBusy] = useState<ProfileMediaKind | null>(null)
  const [imageEditor, setImageEditor] = useState<PendingProfileImage | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [form, setForm] = useState<ProfileForm>(() => profileForm(profile))

  useEffect(() => {
    setForm(profileForm(profile))
  }, [profile])

  useEffect(() => {
    if (!authenticated || !profileId) {
      setHistory([])
      setHistoryLoading(false)
      setHistoryError('')
      return
    }

    let active = true
    setHistoryLoading(true)
    setHistoryError('')
    void loadProfileGameHistory(profileId)
      .then((games) => {
        if (active) setHistory(games)
      })
      .catch((error: unknown) => {
        if (active) setHistoryError(error instanceof Error ? error.message : 'Tournament history could not be loaded.')
      })
      .finally(() => {
        if (active) setHistoryLoading(false)
      })

    return () => {
      active = false
    }
  }, [authenticated, profileId])

  const stats = useMemo(() => buildProfileStats(history, profileId), [history, profileId])

  const handleSignOut = async () => {
    await signOut()
    navigate('/home')
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)
    try {
      await updateProfile(form)
      setEditing(false)
      setFeedback({ tone: 'success', text: 'Profile saved.' })
    } catch (error) {
      setFeedback({ tone: 'error', text: formatAppwriteError(error) })
    } finally {
      setSaving(false)
    }
  }

  const handleImage = (kind: ProfileMediaKind, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setFeedback(null)

    const selectionError = profileImageSelectionError(file)
    if (selectionError) {
      setFeedback({ tone: 'error', text: selectionError })
      return
    }

    setImageEditor({ file, kind })
  }

  const handleCroppedImage = async (file: File) => {
    if (!imageEditor) return
    const { kind } = imageEditor
    setMediaBusy(kind)
    setFeedback(null)
    try {
      await uploadProfileImage(kind, file)
      setImageEditor(null)
      setFeedback({ tone: 'success', text: `${kind === 'avatar' ? 'Profile picture' : 'Cover image'} updated.` })
    } catch (error) {
      const message = formatAppwriteError(error)
      setFeedback({ tone: 'error', text: message })
      throw new Error(message)
    } finally {
      setMediaBusy(null)
    }
  }

  const handleRemoveImage = async (kind: ProfileMediaKind) => {
    setMediaBusy(kind)
    setFeedback(null)
    try {
      await removeProfileImage(kind)
      setFeedback({ tone: 'success', text: `${kind === 'avatar' ? 'Profile picture' : 'Cover image'} removed.` })
    } catch (error) {
      setFeedback({ tone: 'error', text: formatAppwriteError(error) })
    } finally {
      setMediaBusy(null)
    }
  }

  if (loading) {
    return <ProfileStatus title="Checking profile" body="Loading your club session..." />
  }

  if (!authenticated) {
    return (
      <div className="club-screen" data-screen-label="Profile">
        <SiteHeader active="profile" />
        <main className="member-profile-main">
          <section className="member-profile-guest">
            <div className="member-profile-avatar fallback">JU</div>
            <h1>Your JuChess profile</h1>
            <p>Sign in to manage your profile and see the tournament games connected to your account.</p>
            <div>
              <Link to="/sign-in">Sign in</Link>
              <Link to="/sign-up">Create account</Link>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="club-screen" data-screen-label="Profile">
      <SiteHeader active="profile" profilePreview={{ avatarUrl, displayName, initials }} />
      <main className="member-profile-main">
        <section className="member-profile-hero">
          <div
            className={coverUrl ? 'member-profile-cover has-image' : 'member-profile-cover'}
            style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
          >
            <div className="member-profile-cover-actions">
              <label className="media-action">
                <ImagePlus size={17} />
                <span>{mediaBusy === 'cover' ? 'Uploading...' : coverUrl ? 'Change cover' : 'Add cover'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={Boolean(mediaBusy)}
                  onChange={(event) => handleImage('cover', event)}
                />
              </label>
              {coverUrl ? (
                <button
                  type="button"
                  className="media-icon-button"
                  title="Remove cover image"
                  disabled={Boolean(mediaBusy)}
                  onClick={() => void handleRemoveImage('cover')}
                >
                  <Trash2 size={17} />
                </button>
              ) : null}
            </div>
          </div>

          <div className="member-profile-summary">
            <div className="member-profile-avatar-wrap">
              <div className={avatarUrl ? 'member-profile-avatar has-image' : 'member-profile-avatar fallback'}>
                {avatarUrl ? <img src={avatarUrl} alt={`${displayName} profile`} /> : initials}
              </div>
              <label className="avatar-edit" title="Change profile picture">
                <Camera size={16} />
                <span className="sr-only">Change profile picture</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={Boolean(mediaBusy)}
                  onChange={(event) => handleImage('avatar', event)}
                />
              </label>
            </div>

            <div className="member-profile-name">
              <div>
                <h1>{displayName}</h1>
                <span>{profile?.status === 'pending' ? 'Pending member' : 'Club member'}</span>
              </div>
              <p>{username} · Member since {formatMemberSince(user?.$createdAt || profile?.$createdAt)}</p>
            </div>

            <div className="member-profile-actions">
              <button type="button" className="primary" onClick={() => { setEditing(true); setFeedback(null) }}>
                <Edit3 size={16} /> Edit profile
              </button>
              <button type="button" onClick={() => void handleSignOut()}>
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </div>

          {avatarUrl ? (
            <button
              type="button"
              className="remove-avatar"
              disabled={Boolean(mediaBusy)}
              onClick={() => void handleRemoveImage('avatar')}
            >
              <Trash2 size={14} /> Remove profile picture
            </button>
          ) : null}
        </section>

        {feedback ? <div className={`profile-feedback ${feedback.tone}`} role="status">{feedback.text}</div> : null}

        {editing ? (
          <section className="member-profile-editor" aria-labelledby="edit-profile-title">
            <div className="member-profile-editor-head">
              <div>
                <span>Account details</span>
                <h2 id="edit-profile-title">Edit profile</h2>
              </div>
              <button type="button" title="Close profile editor" onClick={() => { setEditing(false); setForm(profileForm(profile)) }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={(event) => void handleSave(event)}>
              <label>
                <span>Display name</span>
                <input required maxLength={128} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
              </label>
              <UniversityField required value={form.university} onChange={(university) => setForm({ ...form, university })} />
              <label>
                <span>University ID</span>
                <input required maxLength={64} value={form.universityId} onChange={(event) => setForm({ ...form, universityId: event.target.value })} />
              </label>
              <label>
                <span>Phone</span>
                <input required type="tel" maxLength={32} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </label>
              <label>
                <span>Email</span>
                <input type="email" value={profile?.email || user?.email || ''} disabled />
                <small>Email is managed by your sign-in account.</small>
              </label>
              <label>
                <span>Chess.com username</span>
                <input maxLength={80} value={form.chessComUsername} onChange={(event) => setForm({ ...form, chessComUsername: event.target.value })} />
              </label>
              <label>
                <span>Lichess username</span>
                <input maxLength={80} value={form.lichessUsername} onChange={(event) => setForm({ ...form, lichessUsername: event.target.value })} />
              </label>
              <div className="member-profile-editor-actions">
                <button type="button" onClick={() => { setEditing(false); setForm(profileForm(profile)) }}>Cancel</button>
                <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="profile-crew-cta">
          <div>
            <span>Club involvement</span>
            <h2>Want to help build JuChess?</h2>
            <p>Share your skills and interests with the HR team, then follow your application from your account.</p>
          </div>
          <Link to="/join-the-team">Join the working team &rarr;</Link>
        </section>

        <div className="member-profile-grid">
          <section className="profile-panel season-panel">
            <div className="profile-panel-heading">
              <span>Performance</span>
              <strong>{rating}</strong>
              <small>Club rating</small>
            </div>
            <h2>Tournament record</h2>
            <div className="season-stats">
              <MetricCard label="Games" value={String(stats.played)} />
              <MetricCard label="Wins" value={String(stats.wins)} tone="win" />
              <MetricCard label="Draws" value={String(stats.draws)} tone="accent" />
            </div>
            <div className="profile-facts">
              <FactRow label="Losses" value={String(stats.losses)} />
              <FactRow label="Games as White" value={String(stats.asWhite)} />
              <FactRow label="Games as Black" value={String(stats.asBlack)} />
              {profile?.university ? <FactRow label="University" value={profile.university} /> : null}
              {profile?.chessComUsername ? <FactRow label="Chess.com" value={profile.chessComUsername} /> : null}
              {profile?.lichessUsername ? <FactRow label="Lichess" value={profile.lichessUsername} /> : null}
            </div>
          </section>

          <section className="profile-panel recent-panel">
            <div className="panel-title-row">
              <h2>Tournament game history</h2>
              <Link to="/tools">Review room &rarr;</Link>
            </div>
            <div className="recent-list" aria-live="polite">
              {historyLoading ? <ProfileHistoryMessage text="Loading your games..." /> : null}
              {!historyLoading && historyError ? <ProfileHistoryMessage text={historyError} error /> : null}
              {!historyLoading && !historyError && history.length === 0 ? (
                <ProfileHistoryMessage text="No tournament games are connected to this account yet." />
              ) : null}
              {!historyLoading && !historyError ? history.map((game) => (
                <ProfileGameRow game={game} profileId={profileId} key={game.key} />
              )) : null}
            </div>
          </section>
        </div>
      </main>
      {imageEditor ? (
        <ProfileImageEditor
          key={`${imageEditor.kind}-${imageEditor.file.name}-${imageEditor.file.lastModified}`}
          file={imageEditor.file}
          kind={imageEditor.kind}
          onCancel={() => setImageEditor(null)}
          onSave={handleCroppedImage}
        />
      ) : null}
    </div>
  )
}

function ProfileStatus({ body, title }: { body: string; title: string }) {
  return (
    <div className="club-screen" data-screen-label="Profile">
      <SiteHeader active="profile" />
      <main className="member-profile-main">
        <section className="member-profile-guest">
          <div className="member-profile-avatar fallback">JU</div>
          <h1>{title}</h1>
          <p>{body}</p>
        </section>
      </main>
    </div>
  )
}

function ProfileGameRow({ game, profileId }: { game: SampleGame; profileId?: string }) {
  const isWhite = game.whiteProfileId === profileId
  const opponent = isWhite ? game.black : game.white
  const live = game.live || game.result === 'Live'
  const won = (isWhite && game.result === '1-0') || (!isWhite && game.result === '0-1')
  const draw = game.result.includes('1/2')
  const resultLabel = live ? 'LIVE' : draw ? '1/2' : won ? 'W' : 'L'

  return (
    <Link to={`/tools?game=${encodeURIComponent(game.id)}`} className="recent-game-row">
      <span className={live ? 'live' : draw ? 'draw' : won ? 'win' : 'loss'}>{resultLabel}</span>
      <span>
        <strong>vs {opponent}</strong>
        <small>{game.tournamentName || game.opening} - {game.round} - {isWhite ? 'White' : 'Black'}</small>
      </span>
      <em>{game.date}</em>
    </Link>
  )
}

function ProfileHistoryMessage({ error = false, text }: { error?: boolean; text: string }) {
  return <div className={error ? 'profile-history-message error' : 'profile-history-message'}>{text}</div>
}

function MetricCard({ label, tone, value }: { label: string; tone?: 'accent' | 'win'; value: string }) {
  return (
    <div className={tone ? `metric-card ${tone}` : 'metric-card'}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function buildProfileStats(games: SampleGame[], profileId?: string) {
  const stats = { asBlack: 0, asWhite: 0, draws: 0, losses: 0, played: 0, wins: 0 }
  games.forEach((game) => {
    if (game.live || game.result === '*' || game.result === 'Live') return
    const isWhite = game.whiteProfileId === profileId
    stats.played += 1
    if (isWhite) stats.asWhite += 1
    else stats.asBlack += 1
    if (game.result.includes('1/2')) stats.draws += 1
    else if ((isWhite && game.result === '1-0') || (!isWhite && game.result === '0-1')) stats.wins += 1
    else stats.losses += 1
  })
  return stats
}

function profileForm(profile: ReturnType<typeof useAuth>['profile']): ProfileForm {
  return {
    chessComUsername: profile?.chessComUsername || '',
    displayName: profile?.displayName || '',
    lichessUsername: profile?.lichessUsername || '',
    phone: profile?.phone || '',
    university: profile?.university || '',
    universityId: profile?.universityId || '',
  }
}

function formatMemberSince(value?: string) {
  if (!value) return 'your first club session'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'your first club session'
    : date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'JU'
}

function profileImageSelectionError(file: File) {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
  if (!allowedTypes.has(file.type)) return 'Choose a JPG, PNG, or WebP image.'
  if (file.size > 5 * 1024 * 1024) return 'Profile images must be 5 MB or smaller.'
  return ''
}

export default ProfilePage
