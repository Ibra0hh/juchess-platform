import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { RefreshCw, Trophy, UsersRound } from 'lucide-react'
import SiteHeader from '../components/SiteHeader'
import {
  formatAppwriteError,
  loadClubLeaderboard,
  profileMediaUrl,
  type PublicProfile,
} from '../lib/auth'
import { externalRatingSourceLabel } from '../lib/externalRating'
import './ClubScreens.css'

const podiumOrder = [1, 0, 2] as const

function LeaderboardPage() {
  const [players, setPlayers] = useState<PublicProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadPlayers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setPlayers(await loadClubLeaderboard())
    } catch (caught) {
      setPlayers([])
      setError(formatAppwriteError(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPlayers()
  }, [loadPlayers])

  return (
    <div className="club-screen" data-screen-label="Leaderboard">
      <SiteHeader active="leaderboard" />
      <main className="leaderboard-main">
        <section className="club-title-block">
          <h1>Club Leaderboard</h1>
          <p>Ratings from linked Chess.com and Lichess player accounts.</p>
        </section>

        {loading ? <LeaderboardState icon="loading" title="Loading rankings" body="Reading the latest club ratings..." /> : null}
        {!loading && error ? (
          <LeaderboardState
            icon="error"
            title="Rankings could not be loaded"
            body={error}
            action={<button type="button" onClick={() => void loadPlayers()}><RefreshCw size={16} /> Try again</button>}
          />
        ) : null}
        {!loading && !error && players.length === 0 ? (
          <LeaderboardState
            icon="empty"
            title="No ranked players yet"
            body="The leaderboard will appear when real active member ratings are available."
          />
        ) : null}

        {!loading && !error && players.length > 0 ? (
          <>
            <section className="podium-grid" aria-label="Top ranked players">
              {podiumOrder.map((playerIndex) => {
                const player = players[playerIndex]
                if (!player) return null
                const rank = playerIndex + 1
                const avatarUrl = profileMediaUrl(player.avatarFileId)
                return (
                  <article className={`podium-card ${rank === 1 ? 'champion' : rank === 3 ? 'bronze' : 'light'}`} key={player.$id}>
                    <div className="podium-avatar" aria-hidden="true">
                      {avatarUrl ? <img src={avatarUrl} alt="" /> : initialsFor(player.displayName)}
                    </div>
                    <h2>{player.displayName}</h2>
                    <p>{player.university || 'University not listed'}</p>
                    <strong>{player.rating}</strong>
                    <span>{externalRatingSourceLabel(player.ratingSource)}</span>
                  </article>
                )
              })}
            </section>

            <section className="leaderboard-table-wrap" aria-label="Full club leaderboard">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>University</th>
                    <th>External rating</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, index) => (
                    <tr className={index === 0 ? 'leader-row' : undefined} key={player.$id}>
                      <td>{index + 1}</td>
                      <td>{player.displayName}</td>
                      <td>{player.university || 'University not listed'}</td>
                      <td><strong>{player.rating}</strong><small>{externalRatingSourceLabel(player.ratingSource)}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        ) : null}
      </main>
    </div>
  )
}

function LeaderboardState({
  action,
  body,
  icon,
  title,
}: {
  action?: ReactNode
  body: string
  icon: 'empty' | 'error' | 'loading'
  title: string
}) {
  return (
    <section className="leaderboard-state" aria-live="polite">
      {icon === 'empty' ? <UsersRound size={30} /> : <Trophy className={icon === 'loading' ? 'loading' : undefined} size={30} />}
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </section>
  )
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'JU'
}

export default LeaderboardPage
