import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  LayoutGrid,
  List,
  ShieldCheck,
  Trophy,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { demoTournaments, loadTournaments, members, type Member, type Tournament } from '../lib/juchess'
import './TournamentDetailPage.css'

type DetailTab = 'home' | 'games' | 'table'
type GameView = 'grid' | 'list'
type BracketView = 'winners' | 'losers' | 'final'

type StandingRow = {
  member: Member
  rank: number
  points: number
  wins: number
  draws: number
  losses: number
  tieBreak: number
  status: 'Playing' | 'Finished' | 'Qualified' | 'Final'
}

type GameCard = {
  id: string
  board: number
  round: string
  white: Member
  black: Member
  result: 'LIVE' | '1-0' | '0-1' | '1/2-1/2'
}

type ScheduleRow = {
  when: string
  what: string
  where: string
  state: 'done' | 'now' | 'next'
}

type BracketMatch = {
  a: string
  b: string
  sa?: number
  sb?: number
  w?: 'a' | 'b'
  live?: boolean
}

type BracketDefinition = {
  rounds: string[]
  matches: BracketMatch[][]
}

type BracketConfig =
  | {
      type: 'single'
      title: string
      bracket: BracketDefinition
    }
  | {
      type: 'double'
      title: string
      brackets: Record<BracketView, BracketDefinition>
    }

const boardPieces = ['♜', '♞', '', '♛', '', '♜', '♚', '', '♟', '♟', '', '', '♟', '♟', '♟', '', '', '', '♝', '', '', '♞', '', '', '', '', '', '♙', '♗', '', '', '', '', '', '♘', '', '♙', '', '', '', '', '', '', '', '', '♘', '♙', '', '♙', '♙', '♙', '', '', '♙', '♙', '♙', '♖', '', '♗', '♕', '', '♖', '♔', '']

const bracketConfigs: Record<string, BracketConfig> = {
  'knockout-cup': {
    type: 'single',
    title: 'Single elimination bracket',
    bracket: {
      rounds: ['Round of 16', 'Quarterfinal', 'Semifinal', 'Final'],
      matches: [
        [
          { a: 'Ibrahim Ahmad', b: 'Zaid Hamdan', sa: 1, sb: 0, w: 'a' },
          { a: 'Hasan Qasem', b: 'Sara Nasser', sa: 0, sb: 1, w: 'b' },
          { a: 'Leen Haddad', b: 'Noor Barakat', sa: 1, sb: 0, w: 'a' },
          { a: 'Khaled Mansour', b: 'Yazan Khaled', sa: 0, sb: 1, w: 'b' },
          { a: 'Omar Saleh', b: 'Tala Suleiman', sa: 1, sb: 0, w: 'a' },
          { a: 'Rania Odeh', b: 'Mohammad Al-Khatib', sa: 0, sb: 1, w: 'b' },
          { a: 'Amr Zaidan', b: 'Lina Shami', sa: 1, sb: 0, w: 'a' },
          { a: 'Fadi Rimawi', b: 'Dana Aqel', sa: 0, sb: 1, w: 'b' },
        ],
        [
          { a: 'Ibrahim Ahmad', b: 'Sara Nasser', sa: 1, sb: 0, w: 'a' },
          { a: 'Leen Haddad', b: 'Yazan Khaled', sa: 1, sb: 0, w: 'a' },
          { a: 'Omar Saleh', b: 'Mohammad Al-Khatib', sa: 1, sb: 0, w: 'a' },
          { a: 'Amr Zaidan', b: 'Dana Aqel', sa: 0, sb: 1, w: 'b' },
        ],
        [
          { a: 'Ibrahim Ahmad', b: 'Leen Haddad', live: true },
          { a: 'Omar Saleh', b: 'Dana Aqel', live: true },
        ],
        [{ a: 'TBD', b: 'TBD' }],
      ],
    },
  },
  'blitz-de': {
    type: 'double',
    title: 'Double elimination bracket',
    brackets: {
      winners: {
        rounds: ['Round 1', 'Round 2', 'Semifinal', 'W-Final'],
        matches: [
          [
            { a: 'Sara Nasser', b: 'Zaid Hamdan', sa: 1, sb: 0, w: 'a' },
            { a: 'Yazan Khaled', b: 'Noor Barakat', sa: 1, sb: 0, w: 'a' },
            { a: 'Mohammad Al-Khatib', b: 'Tala Suleiman', sa: 1, sb: 0, w: 'a' },
            { a: 'Rania Odeh', b: 'Hasan Qasem', sa: 0, sb: 1, w: 'b' },
          ],
          [
            { a: 'Ibrahim Ahmad', b: 'Sara Nasser', sa: 1, sb: 0, w: 'a' },
            { a: 'Omar Saleh', b: 'Yazan Khaled', sa: 1, sb: 0, w: 'a' },
            { a: 'Leen Haddad', b: 'Mohammad Al-Khatib', sa: 1, sb: 0, w: 'a' },
            { a: 'Khaled Mansour', b: 'Hasan Qasem', sa: 1, sb: 0, w: 'a' },
          ],
          [
            { a: 'Ibrahim Ahmad', b: 'Omar Saleh', sa: 1, sb: 0, w: 'a' },
            { a: 'Leen Haddad', b: 'Khaled Mansour', sa: 1, sb: 0, w: 'a' },
          ],
          [{ a: 'Ibrahim Ahmad', b: 'Leen Haddad', live: true }],
        ],
      },
      losers: {
        rounds: ['L-Round 1', 'L-Round 2', 'L-Round 3', 'L-Final'],
        matches: [
          [
            { a: 'Zaid Hamdan', b: 'Noor Barakat', sa: 0, sb: 1, w: 'b' },
            { a: 'Tala Suleiman', b: 'Rania Odeh', sa: 1, sb: 0, w: 'a' },
          ],
          [
            { a: 'Sara Nasser', b: 'Noor Barakat', sa: 1, sb: 0, w: 'a' },
            { a: 'Yazan Khaled', b: 'Tala Suleiman', sa: 1, sb: 0, w: 'a' },
            { a: 'Mohammad Al-Khatib', b: 'Hasan Qasem', sa: 1, sb: 0, w: 'a' },
          ],
          [
            { a: 'Omar Saleh', b: 'Sara Nasser', live: true },
            { a: 'Khaled Mansour', b: 'Yazan Khaled', live: true },
            { a: 'Mohammad Al-Khatib', b: 'bye', sa: 1, sb: 0, w: 'a' },
          ],
          [{ a: 'TBD', b: 'TBD' }],
        ],
      },
      final: {
        rounds: ['Grand Final'],
        matches: [[{ a: 'Winners champion', b: 'Losers champion' }]],
      },
    },
  },
}

function TournamentDetailPage() {
  const { id } = useParams()
  const [tab, setTab] = useState<DetailTab>('home')
  const [gameView, setGameView] = useState<GameView>('grid')
  const [bracketView, setBracketView] = useState<BracketView>('winners')
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

  useEffect(() => {
    setBracketView('winners')
  }, [id])

  const tournament = useMemo(
    () => tournaments.find((item) => item.id === id) || demoTournaments.find((item) => item.id === id) || null,
    [id, tournaments],
  )

  const detail = useMemo(() => (tournament ? buildDetail(tournament) : null), [tournament])

  if (loading) {
    return (
      <div className="detail-screen">
        <SiteHeader active="tournaments" />
        <main className="detail-main">
          <div className="detail-loading">Loading tournament...</div>
        </main>
      </div>
    )
  }

  if (!tournament || !detail) {
    return (
      <div className="detail-screen">
        <SiteHeader active="tournaments" />
        <main className="detail-main">
          <Link to="/tournaments" className="detail-back">
            <ArrowLeft size={16} aria-hidden="true" />
            All tournaments
          </Link>
          <div className="detail-empty">
            <Trophy size={36} aria-hidden="true" />
            <h1>{cloudError ? 'Tournament cloud unavailable' : 'Tournament not found'}</h1>
            <p>{cloudError ? 'Try again shortly.' : 'The event may have moved or is not published yet.'}</p>
          </div>
        </main>
      </div>
    )
  }

  const tableLabel = isBracketTournament(tournament) ? 'Bracket' : 'Standings'

  return (
    <div className="detail-screen" data-screen-label="Tournament Detail">
      <SiteHeader active="tournaments" />
      <main className="detail-main">
        <Link to="/tournaments" className="detail-back">
          <ArrowLeft size={16} aria-hidden="true" />
          All tournaments
        </Link>

        <section className="detail-hero">
          <div>
            <div className="detail-title-line">
              <h1>{tournament.name}</h1>
              <StatusBadge status={tournament.status} />
            </div>
            <p>
              {tournament.format} · {tournament.timeControl} · {tournament.date} · {tournament.location} ·{' '}
              {tournament.participants} players
            </p>
          </div>
          <span className="detail-round">{tournament.round}</span>
        </section>

        {cloudError ? (
          <div className="detail-note" role="status">
            Cloud tournaments are unavailable right now.
          </div>
        ) : null}

        <div className="detail-tabs" role="tablist" aria-label="Tournament sections">
          <button type="button" role="tab" className={tab === 'home' ? 'active' : undefined} onClick={() => setTab('home')}>
            Home
          </button>
          <button type="button" role="tab" className={tab === 'games' ? 'active' : undefined} onClick={() => setTab('games')}>
            Games
          </button>
          <button type="button" role="tab" className={tab === 'table' ? 'active' : undefined} onClick={() => setTab('table')}>
            {tableLabel}
          </button>
        </div>

        {tab === 'home' ? (
          <HomeTab tournament={tournament} detail={detail} setTab={setTab} />
        ) : null}

        {tab === 'games' ? (
          <GamesTab games={detail.games} view={gameView} setView={setGameView} />
        ) : null}

        {tab === 'table' ? (
          <TableTab
            bracketView={bracketView}
            setBracketView={setBracketView}
            tournament={tournament}
            standings={detail.standings}
          />
        ) : null}
      </main>
    </div>
  )
}

function HomeTab({
  tournament,
  detail,
  setTab,
}: {
  tournament: Tournament
  detail: ReturnType<typeof buildDetail>
  setTab: (tab: DetailTab) => void
}) {
  const leader = detail.standings[0]

  return (
    <section className="detail-tab-panel">
      <div className="overview-grid">
        <OverviewItem label="Format" value={tournament.format} />
        <OverviewItem label="Time control" value={tournament.timeControl} />
        <OverviewItem label="Stage" value={tournament.round} tone="accent" />
        <OverviewItem label="Venue" value={tournament.location} />
        <OverviewItem label="Leading" value={`${leader.member.name} · ${leader.points} pts`} tone="gold" />
      </div>

      <p className="detail-description">{tournament.desc}</p>

      <div className="register-card">
        <div className="register-icon">
          <ShieldCheck size={24} aria-hidden="true" />
        </div>
        <div>
          <h2>Play in this tournament</h2>
          <p>Sign in to your player club account to register for {tournament.name}.</p>
        </div>
        <div className="register-actions">
          <Link to="/sign-in" className="primary-action">
            Sign in to register
          </Link>
          <Link to="/sign-up" className="secondary-action">
            Create account
          </Link>
        </div>
      </div>

      <div className="home-section-grid">
        <section className="detail-panel">
          <div className="panel-heading">
            <h2>Live boards</h2>
            <button type="button" onClick={() => setTab('games')}>
              Open games
            </button>
          </div>
          <div className="live-board-list">
            {detail.games.slice(0, 3).map((game) => (
              <GameMini key={game.id} game={game} />
            ))}
          </div>
        </section>

        <section className="detail-panel">
          <div className="panel-heading">
            <h2>Schedule</h2>
          </div>
          <div className="schedule-list">
            {detail.schedule.map((row) => (
              <div className={`schedule-row ${row.state}`} key={`${row.when}-${row.what}`}>
                <span aria-hidden="true" />
                <div>
                  <strong>{row.what}</strong>
                  <small>
                    {row.when} · {row.where}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function GamesTab({
  games,
  view,
  setView,
}: {
  games: GameCard[]
  view: GameView
  setView: (view: GameView) => void
}) {
  return (
    <section className="detail-tab-panel">
      <div className="games-toolbar">
        <div>
          <h2>Games</h2>
          <p>Live boards and recent pairings from the current stage.</p>
        </div>
        <div className="view-toggle" aria-label="Game view">
          <button type="button" className={view === 'grid' ? 'active' : undefined} onClick={() => setView('grid')}>
            <LayoutGrid size={14} aria-hidden="true" />
            Grid
          </button>
          <button type="button" className={view === 'list' ? 'active' : undefined} onClick={() => setView('list')}>
            <List size={14} aria-hidden="true" />
            List
          </button>
        </div>
      </div>

      <div className={`game-card-wrap ${view}`}>
        {games.map((game) => (
          <Link to={`/games?game=${game.id}`} className="game-card" key={game.id}>
            <BoardPreview />
            <div className="game-card-body">
              <div>
                <span>Board {game.board}</span>
                <strong>{game.round}</strong>
              </div>
              <p>
                {game.white.name} vs {game.black.name}
              </p>
              <small>{game.result === 'LIVE' ? 'Watch the game ->' : `Result ${game.result}`}</small>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function TableTab({
  bracketView,
  setBracketView,
  standings,
  tournament,
}: {
  bracketView: BracketView
  setBracketView: (view: BracketView) => void
  standings: StandingRow[]
  tournament: Tournament
}) {
  const bracketConfig = bracketConfigs[tournament.id]

  if (isBracketTournament(tournament)) {
    if (bracketConfig) {
      return (
        <section className="detail-tab-panel">
          <BracketPanel
            bracketConfig={bracketConfig}
            bracketView={bracketView}
            setBracketView={setBracketView}
          />
        </section>
      )
    }

    return (
      <section className="detail-tab-panel">
        <div className="bracket-panel">
          <h2>{tournament.format} bracket</h2>
          <div className="bracket-scroll">
            {['Quarterfinal', 'Semifinal', 'Final'].map((round, roundIndex) => (
              <div className="bracket-column" key={round}>
                <h3>{round}</h3>
                {standings.slice(roundIndex * 2, roundIndex * 2 + (roundIndex === 2 ? 1 : 2)).map((row) => (
                  <div className="bracket-match" key={`${round}-${row.member.id}`}>
                    <span>{row.member.name}</span>
                    <strong>{roundIndex < 2 ? 'LIVE' : 'TBD'}</strong>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="detail-tab-panel">
      <div className="standings-panel">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Pts</th>
              <th>W / D / L</th>
              <th>TB</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr key={row.member.id}>
                <td>{row.rank}</td>
                <td>
                  <strong>{row.member.name}</strong>
                  <small>{row.member.rating}</small>
                </td>
                <td>{row.points}</td>
                <td>
                  {row.wins} / {row.draws} / {row.losses}
                </td>
                <td>{row.tieBreak}</td>
                <td>
                  <span className={`table-status ${row.status.toLowerCase()}`}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function BracketPanel({
  bracketConfig,
  bracketView,
  setBracketView,
}: {
  bracketConfig: BracketConfig
  bracketView: BracketView
  setBracketView: (view: BracketView) => void
}) {
  const activeBracket = bracketConfig.type === 'double'
    ? bracketConfig.brackets[bracketView]
    : bracketConfig.bracket

  return (
    <div className="bracket-panel rich-bracket-panel">
      <div className="bracket-heading">
        <h2>{bracketConfig.title}</h2>
        {bracketConfig.type === 'double' ? (
          <div className="bracket-switch" aria-label="Double elimination bracket view">
            {[
              ['winners', 'Winners Bracket'],
              ['losers', 'Losers Bracket'],
              ['final', 'Final'],
            ].map(([view, label]) => (
              <button
                type="button"
                className={bracketView === view ? 'active' : undefined}
                onClick={() => setBracketView(view as BracketView)}
                key={view}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="bracket-scroll" aria-label={bracketConfig.title}>
        <div className="bracket-track">
          {activeBracket.rounds.map((roundName, roundIndex) => (
            <div className="bracket-column" data-round-index={roundIndex} key={roundName}>
              <h3>{roundName}</h3>
              <div className="bracket-column-body">
                {(activeBracket.matches[roundIndex] || []).map((match, matchIndex) => (
                  <BracketMatchCard
                    isLastRound={roundIndex === activeBracket.rounds.length - 1}
                    key={`${roundName}-${match.a}-${match.b}-${matchIndex}`}
                    match={match}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BracketMatchCard({ isLastRound, match }: { isLastRound: boolean; match: BracketMatch }) {
  const isPending = isPendingMatch(match)
  const stateClass = match.live ? 'live' : isPending ? 'pending' : match.w ? 'complete' : 'open'

  return (
    <div className={`bracket-match rich ${stateClass} ${isLastRound ? 'last-round' : ''}`}>
      {match.live ? (
        <div className="bracket-live-tag">
          <span aria-hidden="true" />
          Live
        </div>
      ) : null}
      <BracketPlayerRow
        name={match.a}
        score={match.live ? '•' : formatBracketScore(match.sa)}
        state={playerState(match, 'a')}
      />
      <BracketPlayerRow
        name={match.b}
        score={match.live ? '•' : formatBracketScore(match.sb)}
        state={playerState(match, 'b')}
      />
    </div>
  )
}

function BracketPlayerRow({
  name,
  score,
  state,
}: {
  name: string
  score: string
  state: 'neutral' | 'winner' | 'muted'
}) {
  return (
    <div className={`bracket-player ${state}`}>
      <span>{name}</span>
      <strong>{score}</strong>
    </div>
  )
}

function playerState(match: BracketMatch, side: 'a' | 'b') {
  if (!match.w) return 'neutral'
  return match.w === side ? 'winner' : 'muted'
}

function formatBracketScore(score?: number) {
  return score === undefined ? '' : String(score)
}

function isPendingMatch(match: BracketMatch) {
  return (
    match.a === 'TBD'
    || match.b === 'TBD'
    || match.a === 'Winners champion'
    || match.b === 'Losers champion'
  )
}

function OverviewItem({ label, value, tone }: { label: string; value: string; tone?: 'accent' | 'gold' }) {
  return (
    <div className="overview-item">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  )
}

function GameMini({ game }: { game: GameCard }) {
  return (
    <Link to={`/games?game=${game.id}`} className="game-mini">
      <BoardPreview />
      <span>
        <strong>
          {game.white.name} vs {game.black.name}
        </strong>
        <small>
          {game.round} · Bd {game.board}
        </small>
      </span>
    </Link>
  )
}

function BoardPreview() {
  return (
    <span className="board-preview" aria-hidden="true">
      {boardPieces.map((piece, index) => (
        <span className={(Math.floor(index / 8) + index) % 2 ? 'dark' : 'light'} key={`${piece}-${index}`}>
          {piece}
        </span>
      ))}
    </span>
  )
}

function StatusBadge({ status }: { status: Tournament['status'] }) {
  if (status === 'Active') {
    return (
      <span className="detail-status live">
        <span aria-hidden="true" />
        Live
      </span>
    )
  }

  return <span className={`detail-status ${status.toLowerCase()}`}>{status}</span>
}

function buildDetail(tournament: Tournament) {
  const rotation = rotationFromId(tournament.id)
  const orderedMembers = [...members.slice(rotation), ...members.slice(0, rotation)]
  const count = Math.min(Math.max(tournament.participants, 4), orderedMembers.length)
  const selectedMembers = orderedMembers.slice(0, count)

  const standings = selectedMembers.map((member, index) => {
    const rank = index + 1
    const points = Math.max(0.5, Number((4 - index * 0.5).toFixed(1)))
    const wins = Math.max(0, Math.floor(points))
    const draws = points % 1 ? 1 : 0
    const losses = Math.max(0, 4 - wins - draws)

    return {
      member,
      rank,
      points,
      wins,
      draws,
      losses,
      tieBreak: Number((10.5 - index * 0.65).toFixed(1)),
      status: tournament.format === 'Multi-stage' && rank <= 8 ? 'Qualified' : rank <= 2 ? 'Playing' : 'Finished',
    } satisfies StandingRow
  })

  const games = selectedMembers.slice(0, 8).reduce<GameCard[]>((acc, member, index, source) => {
    if (index % 2 || !source[index + 1]) return acc
    const board = acc.length + 1
    const isLive = tournament.status === 'Active' && board <= 3
    acc.push({
      id: `${tournament.id}-${board}`,
      board,
      round: tournament.round,
      white: member,
      black: source[index + 1],
      result: isLive ? 'LIVE' : board % 2 ? '1-0' : '1/2-1/2',
    })
    return acc
  }, [])

  return {
    standings,
    games,
    schedule: buildSchedule(tournament),
  }
}

function rotationFromId(id: string) {
  const seed = [...id].reduce((total, letter) => total + letter.charCodeAt(0), 0)
  return seed % members.length
}

function buildSchedule(tournament: Tournament): ScheduleRow[] {
  if (tournament.status === 'Completed') {
    return [
      { when: tournament.date, what: 'Final round', where: tournament.location, state: 'done' },
      { when: 'Published', what: 'Final standings', where: 'Club archive', state: 'done' },
    ]
  }

  return [
    { when: tournament.date, what: 'Opening stage', where: tournament.location, state: 'done' },
    { when: 'Now', what: tournament.round, where: tournament.location, state: 'now' },
    { when: 'Next club session', what: 'Next pairing window', where: tournament.location, state: 'next' },
  ]
}

function isBracketTournament(tournament: Tournament) {
  return Boolean(bracketConfigs[tournament.id]) || /elimination|stage/i.test(tournament.format)
}

export default TournamentDetailPage
