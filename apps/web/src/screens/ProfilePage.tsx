import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { loadProfileGameHistory, type SampleGame } from '../lib/juchess'
import './ClubScreens.css'

function ProfilePage() {
  const navigate = useNavigate()
  const { loading, profile, signOut, user } = useAuth()
  const authenticated = Boolean(user || profile)
  const displayName = profile?.displayName || user?.name || profile?.email || 'Club member'
  const rating = profile?.rating ?? 1200
  const username = profile?.universityId || profile?.email?.split('@')[0] || user?.email.split('@')[0] || 'member'
  const initials = getInitials(displayName)
  const profileId = profile?.$id
  const [history, setHistory] = useState<SampleGame[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')

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

  if (loading) {
    return <ProfileStatus title="Checking profile" body="Loading your club session..." />
  }

  if (!authenticated) {
    return (
      <div className="club-screen" data-screen-label="Profile">
        <SiteHeader active="profile" />
        <main className="profile-main">
          <section className="profile-identity">
            <div className="profile-avatar">JU</div>
            <div className="profile-copy">
              <div className="profile-name-line">
                <h1>Guest profile</h1>
                <span>Signed out</span>
              </div>
              <p className="profile-handle">Sign in to see the tournament games connected to your account.</p>
            </div>
            <div className="profile-rating-card">
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
      <SiteHeader active="profile" profilePreview={{ displayName, initials }} />
      <main className="profile-main">
        <section className="profile-identity">
          <div className="profile-avatar">{initials}</div>
          <div className="profile-copy">
            <div className="profile-name-line">
              <h1>{displayName}</h1>
              <span>{profile?.status === 'pending' ? 'Pending member' : 'Club member'}</span>
            </div>
            <p className="profile-handle">{username} - Member since {formatMemberSince(user?.$createdAt || profile?.$createdAt)}</p>
          </div>
          <div className="profile-rating-card">
            <div>
              <strong>{rating}</strong>
              <span>Club rating</span>
            </div>
            <button type="button" onClick={() => void handleSignOut()}>
              Sign out
            </button>
          </div>
        </section>

        <div className="profile-grid">
          <section className="profile-panel season-panel">
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
    </div>
  )
}

function ProfileStatus({ body, title }: { body: string; title: string }) {
  return (
    <div className="club-screen" data-screen-label="Profile">
      <SiteHeader active="profile" />
      <main className="profile-main">
        <section className="profile-identity">
          <div className="profile-avatar">JU</div>
          <div className="profile-copy">
            <div className="profile-name-line"><h1>{title}</h1></div>
            <p className="profile-handle">{body}</p>
          </div>
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

function MetricCard({
  label,
  tone,
  value,
}: {
  label: string
  tone?: 'accent' | 'win'
  value: string
}) {
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

export default ProfilePage
