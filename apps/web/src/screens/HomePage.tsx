import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ArrowRight, CalendarDays, MapPin, Newspaper, Trophy, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { loadTournaments, type Tournament } from '../lib/juchess'
import './HomePage.css'

const crestUrl = `${import.meta.env.BASE_URL}prototype/assets/crest.png`
const crestBackground = { '--home-crest-url': `url(${crestUrl})` } as CSSProperties

function HomePage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [cloudError, setCloudError] = useState(false)

  useEffect(() => {
    let alive = true

    loadTournaments().then((result) => {
      if (!alive) return
      setTournaments(result.tournaments)
      setCloudError(Boolean(result.error))
      setLoading(false)
    })

    return () => {
      alive = false
    }
  }, [])

  const featured = useMemo(() => {
    const active = tournaments.find((item) => item.status === 'Active')
    const upcoming = tournaments.find((item) => item.status === 'Upcoming')
    return active ?? upcoming ?? tournaments[0] ?? null
  }, [tournaments])

  const stats = useMemo(() => ({
    active: tournaments.filter((item) => item.status === 'Active').length,
    upcoming: tournaments.filter((item) => item.status === 'Upcoming').length,
    completed: tournaments.filter((item) => item.status === 'Completed').length,
  }), [tournaments])

  const newsItems = useMemo(() => tournaments.slice(0, 3), [tournaments])

  return (
    <div className="home-screen" data-screen-label="Home">
      <SiteHeader active="home" />
      <main>
        <section className="home-hero" aria-labelledby="home-title">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span />
              <strong>Est. University of Jordan · Amman</strong>
            </div>
            <div className="hero-title-row">
              <img src={crestUrl} alt="Chess Club JU crest" />
              <h1 id="home-title">
                <span>Ju</span>
                <span>Chess</span>
              </h1>
            </div>
            <p className="hero-tagline">The University of Jordan Chess Club.</p>
            <p className="hero-description">
              A student-run club for campus tournaments, weekly meetups, and better chess across the board.
            </p>
            <div className="hero-actions">
              <Link to="/sign-up" className="primary-action">
                Join the Club
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link to="/tournaments" className="secondary-action">Open tournaments</Link>
            </div>
          </div>

          <FeaturedTournament tournament={featured} loading={loading} cloudError={cloudError} />
        </section>

        <section className="home-strip" aria-label="Tournament counts">
          <StatTile label="Active" value={stats.active} />
          <StatTile label="Upcoming" value={stats.upcoming} />
          <StatTile label="Completed" value={stats.completed} />
        </section>

        <section className="home-section" aria-labelledby="home-news-title">
          <div className="home-section-head">
            <span>
              <Newspaper size={16} aria-hidden="true" />
              <h2 id="home-news-title">News</h2>
            </span>
            <Link to="/tournaments">View all</Link>
          </div>
          <div className="news-grid">
            {loading ? (
              [0, 1, 2].map((item) => <div className="news-card skeleton" key={item} />)
            ) : newsItems.length ? (
              newsItems.map((item) => <NewsCard tournament={item} key={item.id} />)
            ) : (
              <div className="home-empty">No tournament news published yet.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

function FeaturedTournament({
  cloudError,
  loading,
  tournament,
}: {
  cloudError: boolean
  loading: boolean
  tournament: Tournament | null
}) {
  if (loading) {
    return <div className="home-feature-card skeleton" style={crestBackground} aria-label="Loading featured tournament" />
  }

  if (!tournament) {
    return (
      <div className="home-feature-card empty-feature" style={crestBackground}>
        <div className="feature-eyebrow">
          <span>{cloudError ? 'Cloud unavailable' : 'Not published yet'}</span>
          <strong>Featured tournament</strong>
        </div>
        <h2>{cloudError ? 'Tournaments will return shortly' : 'No tournament published yet'}</h2>
        <p>{cloudError ? 'The club cloud could not be reached.' : 'Create a tournament in the control center to publish it here.'}</p>
      </div>
    )
  }

  return (
    <Link to={`/tournament/${tournament.id}`} className="home-feature-card" style={crestBackground}>
      <div className="feature-eyebrow">
        <span className={tournament.status === 'Active' ? 'live' : undefined}>
          {tournament.status === 'Active' ? 'Live now' : tournament.status}
        </span>
        <strong>Featured tournament</strong>
      </div>
      <h2>{tournament.name}</h2>
      <p>{tournament.format} · {tournament.timeControl}</p>
      <div className="feature-pills">
        <span><CalendarDays size={14} aria-hidden="true" />{tournament.date}</span>
        <span><MapPin size={14} aria-hidden="true" />{tournament.location}</span>
        <span><Users size={14} aria-hidden="true" />{playerLabel(tournament)}</span>
      </div>
      <div className="feature-footer">
        <span>
          <small>Current</small>
          <strong>{tournament.round}</strong>
        </span>
        <span className="feature-cta">View tournament <ArrowRight size={16} aria-hidden="true" /></span>
      </div>
    </Link>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-tile">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function NewsCard({ tournament }: { tournament: Tournament }) {
  return (
    <Link to={`/tournament/${tournament.id}`} className="news-card">
      <Trophy size={18} aria-hidden="true" />
      <span>
        <strong>{tournament.name}</strong>
        <small>{tournament.status} · {tournament.round}</small>
      </span>
    </Link>
  )
}

function playerLabel(tournament: Tournament) {
  if (tournament.capacity && tournament.capacity > 0) {
    return `${tournament.participants}/${tournament.capacity} players`
  }

  return `${tournament.participants} players`
}

export default HomePage
