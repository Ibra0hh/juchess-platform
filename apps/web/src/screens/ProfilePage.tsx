import { Link, useNavigate } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { members, sampleGamesBySource } from '../lib/juchess'
import './ClubScreens.css'

function ProfilePage() {
  const navigate = useNavigate()
  const { profile, signOut, user } = useAuth()
  const defaultMember = members[0]
  const displayName = profile?.displayName || user?.name || defaultMember.name
  const rating = profile?.rating || defaultMember.rating
  const username = profile?.email?.split('@')[0] || defaultMember.universityId
  const initials = getInitials(displayName)
  const recentGames = sampleGamesBySource['chess.com'].slice(0, 5)

  const handleSignOut = async () => {
    await signOut()
    navigate('/home')
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
              <span>Club Champion</span>
            </div>
            <p className="profile-handle">{username} - Member since Sep 2023</p>
            <div className="profile-accounts">
              <span>
                Chess.com: <strong>ibrahimJU_1810</strong>
              </span>
              <span>
                Lichess: <strong>ibrahim_amman</strong>
              </span>
            </div>
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
            <h2>Season summary</h2>
            <div className="season-stats">
              <MetricCard label="Games" value="31" />
              <MetricCard label="Wins" value="22" tone="win" />
              <MetricCard label="Rating Delta" value="+86" tone="accent" />
            </div>
            <div className="profile-facts">
              <FactRow label="Active events" value="4 - leading JU Spring Open" />
              <FactRow label="Best result" value="1st - Faculty Round-Robin" />
              <FactRow label="Favorite opening" value="Ruy Lopez, Closed" />
            </div>
          </section>

          <section className="profile-panel recent-panel">
            <div className="panel-title-row">
              <h2>Recent games</h2>
              <Link to="/games">Review room &rarr;</Link>
            </div>
            <div className="recent-list">
              {recentGames.map((game) => {
                const isWhite = game.white === defaultMember.name
                const opponent = isWhite ? game.black : game.white
                const won = (isWhite && game.result === '1-0') || (!isWhite && game.result === '0-1')
                const draw = game.result.includes('1/2')

                return (
                  <Link to={`/games?game=${game.key}`} className="recent-game-row" key={game.key}>
                    <span className={draw ? 'draw' : won ? 'win' : 'loss'}>{draw ? '1/2' : won ? 'W' : 'L'}</span>
                    <span>
                      <strong>vs {opponent}</strong>
                      <small>
                        {game.opening} - {isWhite ? 'White' : 'Black'}
                      </small>
                    </span>
                    <em>{game.date.replace(', 2026', '')}</em>
                  </Link>
                )
              })}
            </div>
          </section>
        </div>

        <section className="profile-next-round">
          <span aria-hidden="true">{'\u2654'}</span>
          <div>
            <strong>Next round: JU Spring Open - Round 4 - Board 1 vs Omar Saleh</strong>
            <p>Fri Jul 3 - 5:00 PM - Student Union Hall B - You play White</p>
          </div>
          <Link to="/tournament/spring-open">Open tournament</Link>
        </section>
      </main>
    </div>
  )
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

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'IA'
}

export default ProfilePage
