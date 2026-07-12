import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Clock3,
  LayoutGrid,
  List,
  MapPin,
  Search,
  Swords,
  Timer,
  Trophy,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { loadTournaments, type Tournament, type TournamentStatus } from '../lib/juchess'
import './TournamentsPage.css'

type ViewMode = 'list' | 'grid'

const filters: TournamentStatus[] = ['Upcoming', 'Active', 'Completed']

function TournamentsPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TournamentStatus>('Upcoming')
  const [view, setView] = useState<ViewMode>('list')
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

  const visibleTournaments = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return tournaments.filter((tournament) => {
      const matchesStatus = tournament.status === filter
      const haystack = [
        tournament.name,
        tournament.format,
        tournament.location,
        tournament.timeControl,
        tournament.round,
      ]
        .join(' ')
        .toLowerCase()

      return matchesStatus && (!needle || haystack.includes(needle))
    })
  }, [filter, query, tournaments])

  return (
    <div className="tournaments-screen" data-screen-label="Tournaments">
      <SiteHeader active="tournaments" />
      <main className="tournaments-main">
        <section className="tournaments-heading" aria-labelledby="tournaments-title">
          <h1 id="tournaments-title">Tournaments</h1>
          <p>Every club event - live boards, standings and brackets as they happen.</p>
        </section>

        <div className="tournament-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tournaments, formats, venues..."
            aria-label="Search tournaments"
          />
        </div>

        <div className="tournament-controls">
          <div className="tournament-filters" aria-label="Tournament status filters">
            {filters.map((label) => (
              <button
                key={label}
                type="button"
                className={filter === label ? 'active' : undefined}
                onClick={() => setFilter(label)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="view-toggle" aria-label="Tournament view">
            <button
              type="button"
              className={view === 'list' ? 'active' : undefined}
              onClick={() => setView('list')}
              aria-label="List view"
              title="List view"
            >
              <List size={14} aria-hidden="true" />
              <span>List</span>
            </button>
            <button
              type="button"
              className={view === 'grid' ? 'active' : undefined}
              onClick={() => setView('grid')}
              aria-label="Grid view"
              title="Grid view"
            >
              <LayoutGrid size={14} aria-hidden="true" />
              <span>Grid</span>
            </button>
          </div>
        </div>

        {cloudError ? (
          <div className="data-note" role="status">
            Cloud tournaments are unavailable right now.
          </div>
        ) : null}

        <section className={`tournament-list ${view}`} aria-live="polite">
          {loading ? (
            <LoadingState />
          ) : visibleTournaments.length ? (
            visibleTournaments.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))
          ) : (
            <EmptyState hasAnyTournaments={tournaments.length > 0} filter={filter} />
          )}
        </section>
      </main>
    </div>
  )
}

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const Icon = getTournamentIcon(tournament)

  return (
    <Link to={`/tournament/${tournament.id}`} className="tournament-card">
      <span className={`tournament-icon ${statusClass(tournament.status)}`}>
        <Icon size={24} aria-hidden="true" />
      </span>

      <span className="tournament-card-main">
        <span className="tournament-title-line">
          <span className="tournament-name">{tournament.name}</span>
          {tournament.playMode === 'online' ? (
            <span className="mode-badge online">
              <Wifi size={11} aria-hidden="true" />
              Online · {onlinePlatformName(tournament)}
            </span>
          ) : null}
          <StatusBadge status={tournament.status} />
        </span>
        <span className="tournament-summary">
          {tournament.format} · {tournament.timeControl} · {tournament.round}
        </span>
      </span>

      <span className="tournament-meta">
        <span>
          <CalendarDays size={13} aria-hidden="true" />
          {tournament.date}
        </span>
        <span>
          <MapPin size={13} aria-hidden="true" />
          {tournament.location} · {playerLabel(tournament)}
        </span>
      </span>
    </Link>
  )
}

function StatusBadge({ status }: { status: TournamentStatus }) {
  if (status === 'Active') {
    return (
      <span className="status-badge live">
        <span aria-hidden="true" />
        Live
      </span>
    )
  }

  return <span className={`status-badge ${statusClass(status)}`}>{status}</span>
}

function LoadingState() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <div className="tournament-card skeleton" key={item}>
          <span className="tournament-icon" />
          <span className="tournament-card-main">
            <span />
            <span />
          </span>
          <span className="tournament-meta">
            <span />
            <span />
          </span>
        </div>
      ))}
    </>
  )
}

function EmptyState({
  filter,
  hasAnyTournaments,
}: {
  filter: TournamentStatus
  hasAnyTournaments: boolean
}) {
  return (
    <div className="empty-state">
      <Trophy size={34} aria-hidden="true" />
      <h2>{hasAnyTournaments ? `No ${filter.toLowerCase()} tournaments match` : 'No tournaments published yet'}</h2>
      <p>{hasAnyTournaments ? 'Try a different search or filter.' : 'Create a tournament in the control center to publish it here.'}</p>
    </div>
  )
}

function getTournamentIcon(tournament: Tournament): LucideIcon {
  if (/bullet|blitz/i.test(tournament.timeControl)) return Zap
  if (/rapid/i.test(tournament.timeControl)) return Timer
  if (/classical/i.test(tournament.timeControl)) return Clock3
  if (/team|elimination|stage/i.test(tournament.format)) return Swords
  if (/arena/i.test(tournament.format)) return Trophy
  return Trophy
}

function statusClass(status: TournamentStatus) {
  return status.toLowerCase()
}

function playerLabel(tournament: Tournament) {
  if (tournament.capacity && tournament.capacity > 0) {
    return `${tournament.participants}/${tournament.capacity} players`
  }

  return `${tournament.participants} players`
}

function onlinePlatformName(tournament: Tournament) {
  if (tournament.onlinePlatform === 'chessCom') return 'Chess.com'
  if (tournament.onlinePlatform === 'lichess') return 'Lichess'
  if (tournament.onlinePlatform === 'juchess') return 'JuChess'
  return 'Online'
}

export default TournamentsPage
