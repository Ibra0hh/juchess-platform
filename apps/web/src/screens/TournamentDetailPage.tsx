import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  LayoutGrid,
  List,
  ShieldCheck,
  Trophy,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { loadTournaments, members, type Member, type Tournament } from '../lib/juchess'
import './TournamentDetailPage.css'

type DetailTab = 'registration' | 'players' | 'rounds' | 'games' | 'table'
type GameView = 'grid' | 'list'
type BracketView = 'winners' | 'losers' | 'final'
type StageRoundTab = 'stage-one' | 'stage-two'

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

type RoundPairing = {
  board: number
  white: Member
  black: Member
  result: 'LIVE' | '1-0' | '0-1' | '1/2-1/2' | 'TBD'
}

type RoundGroup = {
  label: string
  note: string
  state: 'done' | 'live' | 'next'
  games: RoundPairing[]
}

type BracketMatch = {
  a: string
  b: string
  sa?: number
  sb?: number
  w?: 'a' | 'b'
  live?: boolean
  next?: number
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
  'single-elimination': {
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
  'double-elimination': {
    type: 'double',
    title: 'Double elimination bracket',
    brackets: {
      winners: {
        rounds: ['W-Round of 16', 'W-Quarterfinal', 'W-Semifinal', 'W-Final'],
        matches: [
          [
            { a: 'Ibrahim Ahmad', b: 'Zaid Hamdan', sa: 1, sb: 0, w: 'a' },
            { a: 'Sara Nasser', b: 'Hasan Qasem', sa: 1, sb: 0, w: 'a' },
            { a: 'Leen Haddad', b: 'Noor Barakat', sa: 1, sb: 0, w: 'a' },
            { a: 'Yazan Khaled', b: 'Khaled Mansour', sa: 1, sb: 0, w: 'a' },
            { a: 'Omar Saleh', b: 'Tala Suleiman', sa: 1, sb: 0, w: 'a' },
            { a: 'Mohammad Al-Khatib', b: 'Rania Odeh', sa: 1, sb: 0, w: 'a' },
            { a: 'Amr Zaidan', b: 'Lina Shami', sa: 1, sb: 0, w: 'a' },
            { a: 'Dana Aqel', b: 'Fadi Rimawi', sa: 1, sb: 0, w: 'a' },
          ],
          [
            { a: 'Ibrahim Ahmad', b: 'Sara Nasser', sa: 1, sb: 0, w: 'a' },
            { a: 'Leen Haddad', b: 'Yazan Khaled', sa: 1, sb: 0, w: 'a' },
            { a: 'Omar Saleh', b: 'Mohammad Al-Khatib', sa: 1, sb: 0, w: 'a' },
            { a: 'Dana Aqel', b: 'Amr Zaidan', sa: 1, sb: 0, w: 'a' },
          ],
          [
            { a: 'Ibrahim Ahmad', b: 'Leen Haddad', sa: 1, sb: 0, w: 'a' },
            { a: 'Omar Saleh', b: 'Dana Aqel', sa: 1, sb: 0, w: 'a' },
          ],
          [{ a: 'Ibrahim Ahmad', b: 'Omar Saleh', sa: 1, sb: 0, w: 'a' }],
        ],
      },
      losers: {
        rounds: ['L-Round 1', 'L-Round 2', 'L-Round 3', 'L-Round 4', 'L-Semifinal', 'L-Final'],
        matches: [
          [
            { a: 'Zaid Hamdan', b: 'Hasan Qasem', sa: 1, sb: 0, w: 'a', next: 0 },
            { a: 'Noor Barakat', b: 'Khaled Mansour', sa: 1, sb: 0, w: 'a', next: 1 },
            { a: 'Tala Suleiman', b: 'Rania Odeh', sa: 1, sb: 0, w: 'a', next: 2 },
            { a: 'Lina Shami', b: 'Fadi Rimawi', sa: 1, sb: 0, w: 'a', next: 3 },
          ],
          [
            { a: 'Sara Nasser', b: 'Zaid Hamdan', sa: 1, sb: 0, w: 'a' },
            { a: 'Yazan Khaled', b: 'Noor Barakat', sa: 1, sb: 0, w: 'a' },
            { a: 'Mohammad Al-Khatib', b: 'Tala Suleiman', sa: 1, sb: 0, w: 'a' },
            { a: 'Amr Zaidan', b: 'Lina Shami', sa: 1, sb: 0, w: 'a' },
          ],
          [
            { a: 'Sara Nasser', b: 'Yazan Khaled', sa: 1, sb: 0, w: 'a', next: 0 },
            { a: 'Mohammad Al-Khatib', b: 'Amr Zaidan', sa: 1, sb: 0, w: 'a', next: 1 },
          ],
          [
            { a: 'Leen Haddad', b: 'Sara Nasser', sa: 0, sb: 1, w: 'b' },
            { a: 'Dana Aqel', b: 'Mohammad Al-Khatib', sa: 0, sb: 1, w: 'b' },
          ],
          [{ a: 'Sara Nasser', b: 'Mohammad Al-Khatib', sa: 1, sb: 0, w: 'a' }],
          [{ a: 'Omar Saleh', b: 'Sara Nasser', live: true }],
        ],
      },
      final: {
        rounds: ['Grand Final', 'Reset if needed'],
        matches: [
          [{ a: 'Ibrahim Ahmad', b: 'Winner L-Final' }],
          [{ a: 'Winner Grand Final', b: 'Reset only if needed' }],
        ],
      },
    },
  },
}

function TournamentDetailPage() {
  const { id } = useParams()
  const [tab, setTab] = useState<DetailTab>('registration')
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
    () => tournaments.find((item) => item.id === id) || null,
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

  const isBracket = isBracketTournament(tournament)
  const tabs: Array<{ key: DetailTab; label: string }> = isBracket
    ? [
        { key: 'registration', label: 'Registration' },
        { key: 'players', label: 'Players' },
        { key: 'table', label: 'Bracket' },
        { key: 'games', label: 'Games' },
      ]
    : [
        { key: 'registration', label: 'Registration' },
        { key: 'players', label: 'Players' },
        { key: 'rounds', label: 'Rounds' },
        { key: 'games', label: 'Games' },
        { key: 'table', label: 'Standings' },
      ]
  const activeTab = tabs.some((item) => item.key === tab) ? tab : 'registration'

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
          {tabs.map((item) => (
            <button
              type="button"
              role="tab"
              className={activeTab === item.key ? 'active' : undefined}
              onClick={() => setTab(item.key)}
              key={item.key}
            >
              {item.label}
            </button>
          ))}
        </div>

        {activeTab === 'registration' ? (
          <RegistrationTab tournament={tournament} detail={detail} />
        ) : null}

        {activeTab === 'players' ? (
          <PlayersTab standings={detail.standings} />
        ) : null}

        {activeTab === 'rounds' ? (
          <RoundsTab rounds={detail.rounds} tournament={tournament} />
        ) : null}

        {activeTab === 'games' ? (
          <GamesTab games={detail.games} view={gameView} setView={setGameView} />
        ) : null}

        {activeTab === 'table' ? (
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

function RegistrationTab({
  tournament,
  detail,
}: {
  tournament: Tournament
  detail: ReturnType<typeof buildDetail>
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
    </section>
  )
}

function PlayersTab({ standings }: { standings: StandingRow[] }) {
  return (
    <section className="detail-tab-panel">
      <div className="players-panel">
        <div className="panel-heading">
          <h2>Players</h2>
          <span>{standings.length} registered</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Rating</th>
              <th>Pts</th>
              <th>W / D / L</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr key={row.member.id}>
                <td>{row.rank}</td>
                <td>
                  <strong>{row.member.name}</strong>
                  <small>{row.member.universityId}</small>
                </td>
                <td>{row.member.rating}</td>
                <td>{row.points}</td>
                <td>
                  {row.wins} / {row.draws} / {row.losses}
                </td>
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

function RoundsTab({
  rounds,
  tournament,
}: {
  rounds: RoundGroup[]
  tournament: Tournament
}) {
  const isMultiStage = isMultiStageTournament(tournament)
  const [stageTab, setStageTab] = useState<StageRoundTab>(() => initialStageTab(tournament.round))

  useEffect(() => {
    setStageTab(initialStageTab(tournament.round))
  }, [tournament.id, tournament.round])

  const visibleRounds = isMultiStage ? buildStageRoundGroups(rounds, stageTab) : rounds

  return (
    <section className="detail-tab-panel">
      <div className="rounds-panel">
        <div className="panel-heading">
          <h2>Rounds</h2>
          <span>{isMultiStage ? stageLabel(stageTab) : `${visibleRounds.length} shown`}</span>
        </div>
        {isMultiStage ? (
          <div className="stage-round-tabs" role="tablist" aria-label="Tournament stages">
            <button
              type="button"
              role="tab"
              className={stageTab === 'stage-one' ? 'active' : undefined}
              aria-selected={stageTab === 'stage-one'}
              onClick={() => setStageTab('stage-one')}
            >
              Stage One
            </button>
            <button
              type="button"
              role="tab"
              className={stageTab === 'stage-two' ? 'active' : undefined}
              aria-selected={stageTab === 'stage-two'}
              onClick={() => setStageTab('stage-two')}
            >
              Stage Two
            </button>
          </div>
        ) : null}
        <div className="round-list">
          {visibleRounds.map((round) => (
            <article className={`round-card ${round.state}`} key={round.label}>
              <div className="round-card-heading">
                <div>
                  <h3>{round.label}</h3>
                  <small>{round.note}</small>
                </div>
                <span>{round.state === 'live' ? 'Live' : round.state === 'next' ? 'Next' : 'Done'}</span>
              </div>
              <div className="round-pairings">
                {round.games.map((game) => (
                  <div className="round-pairing" key={`${round.label}-${game.board}`}>
                    <span>Board {game.board}</span>
                    <strong>
                      {game.white.name} vs {game.black.name}
                    </strong>
                    <em>{game.result}</em>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
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
  const [activeRound, setActiveRound] = useState(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setActiveRound(0)
    if (scrollRef.current) scrollRef.current.scrollLeft = 0
  }, [activeBracket])

  useEffect(() => {
    const scroll = scrollRef.current
    const track = trackRef.current
    if (!scroll || !track) return

    const updateActiveRound = () => {
      const columns = Array.from(track.querySelectorAll<HTMLElement>('[data-round-index]'))
      const targetLeft = scroll.scrollLeft + 12
      let nearest = 0
      let nearestDistance = Number.POSITIVE_INFINITY

      columns.forEach((column, index) => {
        const distance = Math.abs(column.offsetLeft - targetLeft)
        if (distance < nearestDistance) {
          nearest = index
          nearestDistance = distance
        }
      })

      setActiveRound(nearest)
    }

    updateActiveRound()
    scroll.addEventListener('scroll', updateActiveRound, { passive: true })
    return () => scroll.removeEventListener('scroll', updateActiveRound)
  }, [activeBracket])

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return

    let frame = 0
    const draw = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => drawBracketLines(track))
    }

    draw()

    const resizeObserver = new ResizeObserver(draw)
    resizeObserver.observe(track)
    track.querySelectorAll('.bracket-match.rich').forEach((card) => resizeObserver.observe(card))
    window.addEventListener('resize', draw)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener('resize', draw)
    }
  }, [activeBracket])

  const jumpToRound = (roundIndex: number) => {
    const scroll = scrollRef.current
    const target = trackRef.current?.querySelector<HTMLElement>(`[data-round-index="${roundIndex}"]`)
    if (!scroll || !target) return

    setActiveRound(roundIndex)
    scroll.scrollTo({
      left: Math.max(0, target.offsetLeft - 18),
      behavior: 'smooth',
    })
  }

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

      <nav className="bracket-round-nav" aria-label="Bracket rounds">
        {activeBracket.rounds.map((roundName, roundIndex) => (
          <button
            type="button"
            className={activeRound === roundIndex ? 'active' : undefined}
            aria-current={activeRound === roundIndex ? 'true' : undefined}
            onClick={() => jumpToRound(roundIndex)}
            key={roundName}
          >
            {roundName}
          </button>
        ))}
      </nav>

      <div className="bracket-scroll" aria-label={bracketConfig.title} ref={scrollRef}>
        <div className="bracket-track" ref={trackRef}>
          <svg className="bracket-lines" data-brk-svg aria-hidden="true" />
          {activeBracket.rounds.map((roundName, roundIndex) => (
            <div className="bracket-column" data-round-index={roundIndex} key={roundName}>
              <h3>{roundName}</h3>
              <div className="bracket-column-body">
                {(activeBracket.matches[roundIndex] || []).map((match, matchIndex) => (
                  <BracketMatchCard
                    isLastRound={roundIndex === activeBracket.rounds.length - 1}
                    key={`${roundName}-${match.a}-${match.b}-${matchIndex}`}
                    match={match}
                    matchIndex={matchIndex}
                    roundIndex={roundIndex}
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

function BracketMatchCard({
  isLastRound,
  match,
  matchIndex,
  roundIndex,
}: {
  isLastRound: boolean
  match: BracketMatch
  matchIndex: number
  roundIndex: number
}) {
  const isPending = isPendingMatch(match)
  const stateClass = match.live ? 'live' : isPending ? 'pending' : match.w ? 'complete' : 'open'
  const lineState = match.w || (match.live ? 'live' : '')

  return (
    <div
      className={`bracket-match rich ${stateClass} ${isLastRound ? 'last-round' : ''}`}
      data-brk-card={`${roundIndex}-${matchIndex}`}
      data-target={match.next ?? ''}
      data-win={lineState}
    >
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

function drawBracketLines(track: HTMLDivElement) {
  const svg = track.querySelector<SVGSVGElement>('[data-brk-svg]')
  if (!svg) return

  const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-brk-card]'))
  const cardsByRound = new Map<number, Array<{ element: HTMLElement; index: number; win: string | null }>>()

  cards.forEach((element) => {
    const [round, index] = (element.dataset.brkCard || '').split('-').map(Number)
    if (!Number.isFinite(round) || !Number.isFinite(index)) return
    const entries = cardsByRound.get(round) || []
    entries.push({ element, index, win: element.dataset.win || null })
    cardsByRound.set(round, entries)
  })

  const base = track.getBoundingClientRect()
  svg.setAttribute('width', String(track.scrollWidth))
  svg.setAttribute('height', String(track.clientHeight))
  svg.replaceChildren()

  const namespace = 'http://www.w3.org/2000/svg'
  const rounds = Array.from(cardsByRound.keys()).sort((a, b) => a - b)

  rounds.forEach((round) => {
    const currentRound = cardsByRound.get(round) || []
    const nextRound = cardsByRound.get(round + 1) || []
    if (!nextRound.length) return

    currentRound.forEach((match) => {
      const targetData = match.element.dataset.target
      const parsedTarget = targetData ? Number(targetData) : Number.NaN
      const targetIndex = Number.isFinite(parsedTarget) ? parsedTarget : Math.floor(match.index / 2)
      const target = nextRound.find((candidate) => candidate.index === targetIndex)
      if (!target) return

      const from = match.element.getBoundingClientRect()
      const to = target.element.getBoundingClientRect()
      const x1 = from.right - base.left
      const y1 = from.top - base.top + from.height / 2
      const x2 = to.left - base.left
      const y2 = to.top - base.top + to.height / 2
      const midX = (x1 + x2) / 2
      const decided = match.win === 'a' || match.win === 'b'
      const live = match.win === 'live'
      const path = document.createElementNS(namespace, 'path')

      path.setAttribute('d', `M${x1} ${y1} H${midX} V${y2} H${x2}`)
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', decided ? '#7A2431' : live ? '#A98A3F' : 'rgba(30,43,69,.22)')
      path.setAttribute('stroke-width', decided ? '2.25' : '1.5')
      path.setAttribute('stroke-linejoin', 'round')
      path.setAttribute('stroke-linecap', 'round')
      if (live) path.setAttribute('stroke-dasharray', '5 3')
      svg.appendChild(path)
    })
  })
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
    || match.a.startsWith('Winner ')
    || match.b.startsWith('Winner ')
    || match.a.startsWith('Reset ')
    || match.b.startsWith('Reset ')
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
    rounds: buildRoundGroups(tournament, selectedMembers),
  }
}

function rotationFromId(id: string) {
  const seed = [...id].reduce((total, letter) => total + letter.charCodeAt(0), 0)
  return seed % members.length
}

function buildRoundGroups(tournament: Tournament, players: Member[]): RoundGroup[] {
  const currentRound = extractRoundNumber(tournament.round)
  const totalRounds = extractTotalRounds(tournament.round)
  const completedRound = Math.max(1, currentRound - 1)
  const showPrevious = tournament.status !== 'Upcoming' && currentRound > 1
  const showCurrent = tournament.status !== 'Upcoming'
  const showNext = tournament.status !== 'Completed' && (!totalRounds || currentRound < totalRounds)
  const groups: RoundGroup[] = []

  if (showPrevious) {
    groups.push({
      label: roundLabel(tournament, completedRound),
      note: 'Completed pairings',
      state: 'done',
      games: pairRound(players, completedRound, 'done'),
    })
  }

  if (showCurrent) {
    groups.push({
      label: tournament.round,
      note: tournament.status === 'Active' ? 'Current round pairings' : 'Final recorded round',
      state: tournament.status === 'Active' ? 'live' : 'done',
      games: pairRound(players, currentRound, tournament.status === 'Active' ? 'live' : 'done'),
    })
  }

  if (showNext) {
    const nextRound = tournament.status === 'Upcoming' ? 1 : currentRound + 1
    groups.push({
      label: roundLabel(tournament, nextRound),
      note: tournament.status === 'Upcoming' ? 'First pairings pending' : 'Next pairings window',
      state: 'next',
      games: pairRound(players, nextRound, 'next'),
    })
  }

  return groups.length ? groups : [{
    label: tournament.round,
    note: 'Round pairings',
    state: 'done',
    games: pairRound(players, 1, 'done'),
  }]
}

function buildStageRoundGroups(rounds: RoundGroup[], stageTab: StageRoundTab): RoundGroup[] {
  if (stageTab === 'stage-one') {
    return rounds.map((round, index) => ({
      ...round,
      label: `Stage One - Round ${index + 1}`,
      note: index === 0 ? 'Group stage pairings' : round.note,
      state: round.state === 'next' ? 'done' : round.state,
    }))
  }

  return rounds.map((round, index) => ({
    ...round,
    label: index === 0 ? 'Stage Two - Playoffs' : `Stage Two - Round ${index + 1}`,
    note: index === 0 ? 'Playoff qualification pairings' : 'Placement pairings',
    state: index === 0 ? 'live' : round.state,
  }))
}

function pairRound(players: Member[], roundNumber: number, state: 'done' | 'live' | 'next'): RoundPairing[] {
  const rotated = [...players.slice(roundNumber % players.length), ...players.slice(0, roundNumber % players.length)]
  return rotated.slice(0, 8).reduce<RoundPairing[]>((acc, member, index, source) => {
    if (index % 2 || !source[index + 1]) return acc
    const board = acc.length + 1
    acc.push({
      board,
      white: member,
      black: source[index + 1],
      result: state === 'next' ? 'TBD' : state === 'live' ? 'LIVE' : board % 3 === 0 ? '1/2-1/2' : board % 2 ? '1-0' : '0-1',
    })
    return acc
  }, [])
}

function roundLabel(tournament: Tournament, roundNumber: number) {
  if (/week/i.test(tournament.round)) return `Week ${roundNumber}`
  if (/cycle/i.test(tournament.round)) return `Cycle ${Math.max(1, Math.ceil(roundNumber / 3))} - Round ${roundNumber}`
  if (/final/i.test(tournament.round) && roundNumber > 1) return `Round ${roundNumber}`
  return `Round ${roundNumber}`
}

function extractRoundNumber(value: string) {
  const round = /Round\s*(\d+)/i.exec(value)
  const week = /Week\s*(\d+)/i.exec(value)
  return Number(round?.[1] || week?.[1] || (/\bFinal\b/i.test(value) ? 5 : 1))
}

function extractTotalRounds(value: string) {
  const total = /of\s*(\d+)/i.exec(value)
  const finalRounds = /(\d+)\s*rounds/i.exec(value)
  return total?.[1] ? Number(total[1]) : finalRounds?.[1] ? Number(finalRounds[1]) : null
}

function initialStageTab(round: string): StageRoundTab {
  return /stage\s*2|stage\s*two/i.test(round) ? 'stage-two' : 'stage-one'
}

function stageLabel(stageTab: StageRoundTab) {
  return stageTab === 'stage-one' ? 'Stage One' : 'Stage Two'
}

function isMultiStageTournament(tournament: Tournament) {
  return /multi[-\s]?stage|stage/i.test(tournament.format)
}

function isBracketTournament(tournament: Tournament) {
  return Boolean(bracketConfigs[tournament.id]) || /knockout|elimination/i.test(tournament.format)
}

export default TournamentDetailPage
