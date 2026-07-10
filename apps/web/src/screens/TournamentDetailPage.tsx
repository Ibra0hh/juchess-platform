import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  LayoutGrid,
  List,
  ShieldCheck,
  Trophy,
} from 'lucide-react'
import QRCode from 'qrcode'
import { Link, useParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { ensureProfileForUser } from '../lib/auth'
import {
  loadTournaments,
  type Member,
  type PublishedBracketMatch,
  type PublishedBracketRound,
  type PublishedBracketSnapshot,
  type Tournament,
  type TournamentGame,
} from '../lib/juchess'
import {
  cancelMyRegistration,
  checkInQrPayload,
  loadMyCheckIn,
  loadMyRegistration,
  registerForTournament,
  type MyCheckIn,
  type MyRegistration,
} from '../lib/registrations'
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
  status: 'Registered' | 'Playing' | 'Finished' | 'Qualified' | 'Final'
}

type GameCard = {
  id: string
  board: number
  round: string
  white: Member
  black: Member
  result: 'LIVE' | '1-0' | '0-1' | '1/2-1/2' | '*'
}

type RoundPairing = {
  id?: string
  board: number
  white: Member
  black: Member
  result: 'LIVE' | '1-0' | '0-1' | '1/2-1/2' | '*'
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
  gameId?: string
  matchNumber?: number
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
const bracketByeName = 'Bye'

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
        rounds: ['Lower Round 1', 'Lower Round 2', 'Lower Round 3', 'Lower Round 4', 'Lower Round 5', 'Lower Final'],
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
          [{ a: 'Ibrahim Ahmad', b: 'Winner Losers Final' }],
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
      ]
    : [
        { key: 'registration', label: 'Registration' },
        { key: 'players', label: 'Players' },
        { key: 'rounds', label: 'Rounds' },
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
  const leader = tournament.status === 'Upcoming'
    ? undefined
    : detail.standings.find((row) => row.points > 0 || row.status === 'Playing')

  return (
    <section className="detail-tab-panel">
      <div className="overview-grid">
        <OverviewItem label="Format" value={tournament.format} />
        <OverviewItem label="Time control" value={tournament.timeControl} />
        <OverviewItem label="Stage" value={tournament.round} tone="accent" />
        <OverviewItem label="Venue" value={tournament.location} />
        <OverviewItem label="Leading" value={leader ? `${leader.member.name} · ${leader.points} pts` : 'Not started'} tone="gold" />
      </div>

      <p className="detail-description">{tournament.desc}</p>

      <RegistrationActions tournament={tournament} />
    </section>
  )
}

function RegistrationActions({ tournament }: { tournament: Tournament }) {
  const { loading: authLoading, profile, refresh, user } = useAuth()
  const [registration, setRegistration] = useState<MyRegistration | null>(null)
  const [checkIn, setCheckIn] = useState<MyCheckIn | null>(null)
  const [registrationLoading, setRegistrationLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const tournamentRowId = tournament.rowId
  const profileId = profile?.$id

  const refreshRegistration = useCallback(async () => {
    if (!tournamentRowId || !profileId) {
      setRegistration(null)
      setCheckIn(null)
      return
    }

    setRegistrationLoading(true)
    try {
      const [nextRegistration, nextCheckIn] = await Promise.all([
        loadMyRegistration(tournamentRowId, profileId),
        loadMyCheckIn(tournamentRowId, profileId),
      ])
      setRegistration(nextRegistration)
      setCheckIn(nextCheckIn)
    } catch {
      setRegistration(null)
      setCheckIn(null)
    } finally {
      setRegistrationLoading(false)
    }
  }, [profileId, tournamentRowId])

  useEffect(() => {
    void refreshRegistration()
  }, [refreshRegistration])

  if (authLoading) {
    return <div className="register-card muted">Checking your club account...</div>
  }

  if (!user) {
    return (
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
    )
  }

  if (!tournamentRowId) {
    return <div className="register-card muted">Registration opens when this event is published.</div>
  }

  async function handleRegister() {
    if (!tournamentRowId || !user) return
    setBusy(true)
    setMessage(null)
    try {
      let resolvedProfileId = profileId
      if (!resolvedProfileId) {
        const resolvedProfile = await ensureProfileForUser(user)
        resolvedProfileId = resolvedProfile?.$id
        await refresh()
      }

      if (!resolvedProfileId) {
        throw new Error('Player profile is not ready yet.')
      }

      setRegistration(await registerForTournament(tournamentRowId))
      setMessage('Registration received. The organizers will review your spot.')
    } catch (error) {
      setMessage(error instanceof Error && error.message
        ? error.message
        : 'Could not register right now. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    if (!registration) return
    setBusy(true)
    setMessage(null)
    try {
      setRegistration(await cancelMyRegistration(registration.$id))
      setCheckIn(null)
      setMessage('Your registration was cancelled.')
    } catch {
      setMessage('Could not cancel right now. Ask an organizer for help at the venue.')
    } finally {
      setBusy(false)
    }
  }

  const status = registration?.status
  const isRegistered = Boolean(registration) && status !== 'cancelled'

  return (
    <div className="register-card signed-in">
      <div className="register-icon">
        <ShieldCheck size={24} aria-hidden="true" />
      </div>
      <div className="register-body">
        {registrationLoading ? (
          <p>Loading your registration...</p>
        ) : !isRegistered ? (
          <>
            <h2>Play in this tournament</h2>
            <p>One tap to request a spot. An organizer approves registrations before the event.</p>
          </>
        ) : status === 'pending' ? (
          <>
            <h2>Registration pending</h2>
            <p>Your spot is waiting for organizer approval. Your check-in code will appear here once you are accepted.</p>
          </>
        ) : status === 'waitlisted' ? (
          <>
            <h2>You are on the waitlist</h2>
            <p>The organizers will move you in if a spot opens up.</p>
          </>
        ) : (
          <>
            <h2>You are in!</h2>
            <p>Show this code at the venue to check in for {tournament.name}.</p>
            <CheckInPass checkIn={checkIn} />
          </>
        )}
        {message ? <p className="register-message" role="status">{message}</p> : null}
      </div>
      <div className="register-actions">
        {!isRegistered ? (
          <button type="button" className="primary-action" disabled={busy} onClick={handleRegister}>
            {busy ? 'Registering...' : 'Register'}
          </button>
        ) : checkIn?.checkedIn || registration?.checkedIn ? (
          <span className="checkin-done">Checked in</span>
        ) : (
          <button type="button" className="secondary-action" disabled={busy} onClick={handleCancel}>
            {busy ? 'Cancelling...' : 'Cancel registration'}
          </button>
        )}
      </div>
    </div>
  )
}

function CheckInPass({ checkIn }: { checkIn: MyCheckIn | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !checkIn) return

    QRCode.toCanvas(canvas, checkInQrPayload(checkIn), {
      width: 148,
      margin: 1,
      color: { dark: '#1E2B45', light: '#FDF8EC' },
    }).catch(() => undefined)
  }, [checkIn])

  if (!checkIn) {
    return <p className="checkin-note">Your check-in code is on its way. Check back before the event.</p>
  }

  return (
    <div className="checkin-pass">
      <canvas ref={canvasRef} aria-label="Check-in QR code" />
      <div>
        <span>Check-in code</span>
        <strong>{checkIn.code}</strong>
        <small>{checkIn.checkedIn ? 'Checked in at the venue' : 'Keep this ready at the venue'}</small>
      </div>
    </div>
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
        {visibleRounds.length ? (
          <div className="round-list">
            {visibleRounds.map((round) => (
              <article className={`round-admin-panel ${round.state}`} key={round.label}>
                <div className="round-admin-head">
                  <strong>{round.label} pairings</strong>
                  <span>{roundAdminStatus(round, tournament)}</span>
                </div>
                {round.games.map((game) => (
                  <RoundPairingLink game={game} key={`${round.label}-${game.board}`} />
                ))}
              </article>
            ))}
          </div>
        ) : (
          <UnpublishedPanel title="Pairings not published" body="Rounds will appear here after the organizer publishes pairings in the admin panel." />
        )}
      </div>
    </section>
  )
}

function RoundPairingLink({ game }: { game: RoundPairing }) {
  const content = (
    <>
      <span>#{game.board}</span>
      <strong className="round-color-player white-player">
        <span className="tournament-color-chip white">W</span>
        <span>{game.white.name}<small>{game.white.rating}</small></span>
      </strong>
      <em>vs</em>
      <strong className="round-color-player black-player">
        <span className="tournament-color-chip black">B</span>
        <span>{game.black.name}<small>{game.black.rating}</small></span>
      </strong>
    </>
  )

  if (game.id) {
    return (
      <Link to={`/games?game=${game.id}`} className="round-admin-pairing clickable-game">
        {content}
      </Link>
    )
  }

  return <div className="round-admin-pairing">{content}</div>
}

function roundAdminStatus(round: RoundGroup, tournament: Tournament) {
  if (tournament.status === 'Upcoming') return 'Published pairings'
  if (round.state === 'live') return 'Live current round'
  if (round.state === 'next') return 'Next round'
  return 'Recorded round'
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

      {games.length ? (
        <div className={`game-card-wrap ${view}`}>
          {games.map((game) => (
            <Link to={`/games?game=${game.id}`} className="game-card" key={game.id}>
              <BoardPreview />
              <div className="game-card-body">
                <div>
                  <span>Board {game.board}</span>
                  <strong>{game.round}</strong>
                </div>
                <div className="game-color-players">
                  <p><span className="tournament-color-chip white">W</span>{game.white.name}</p>
                  <p><span className="tournament-color-chip black">B</span>{game.black.name}</p>
                </div>
                <small>{game.result === 'LIVE' ? 'Watch the game ->' : game.result === '*' ? 'Scheduled' : `Result ${game.result}`}</small>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <UnpublishedPanel title="Games not published" body="Games will appear after the organizer publishes pairings." />
      )}
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
  const publishedGames = tournament.publishedGames ?? []
  const gameBracketConfig = publishedGames.length
    ? buildTournamentBracketConfig(
      tournament,
      standings.map((row) => row.member),
      publishedGames,
    )
    : null
  const savedBracketConfig = tournament.bracketSnapshot
    ? bracketConfigFromPublishedSnapshot(tournament.bracketSnapshot)
    : null
  // The published snapshot is the source of truth — the server regenerates it
  // from real results on every advancement. The game-derived config is only a
  // fallback for brackets published before snapshots existed.
  const bracketConfig = savedBracketConfig ?? gameBracketConfig

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
        <UnpublishedPanel title="Bracket not published" body="The bracket will appear after the organizer publishes it in the admin panel." />
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

function buildTournamentBracketConfig(tournament: Tournament, players: Member[], publishedGames: TournamentGame[]): BracketConfig | null {
  const bracketPlayers = players.slice(0, effectiveBracketPlayerCount(tournament, players.length))
  const firstRoundGames = publishedGames.filter((game) => game.round === 1).sort((a, b) => a.board - b.board)
  if (firstRoundGames.length < 1 || bracketPlayers.length < 2) return null

  if (/double elimination/i.test(tournament.format)) {
    return {
      type: 'double',
      title: 'Double elimination bracket',
      brackets: buildDoubleEliminationBrackets(tournament, bracketPlayers, firstRoundGames),
    }
  }

  if (isBracketTournament(tournament)) {
    return {
      type: 'single',
      title: `${tournament.format} bracket`,
      bracket: buildSingleEliminationBracket(tournament, bracketPlayers, firstRoundGames),
    }
  }

  return null
}

function bracketConfigFromPublishedSnapshot(snapshot: PublishedBracketSnapshot): BracketConfig | null {
  if (snapshot.type === 'single') {
    const bracket = bracketDefinitionFromPublishedRounds(snapshot.rounds)
    if (!bracket) return null
    return {
      type: 'single',
      title: snapshot.title,
      bracket,
    }
  }

  const winners = bracketDefinitionFromPublishedRounds(snapshot.brackets.winners)
  const winnerRoundLabels = snapshot.brackets.winners.map((round) => round.name)
  // Snapshots from version 2+ are generated server-side with authoritative,
  // play-order labels already applied; only legacy snapshots need re-derivation.
  const losersRounds = (snapshot.version ?? 1) >= 2
    ? snapshot.brackets.losers
    : normalizePublishedLowerBracketRounds(snapshot.brackets.losers, winnerRoundLabels)
  const losers = bracketDefinitionFromPublishedRounds(losersRounds)
  const final = bracketDefinitionFromPublishedRounds(snapshot.brackets.final)
  if (!winners && !losers && !final) return null

  return {
    type: 'double',
    title: snapshot.title,
    brackets: {
      winners: winners ?? { rounds: [], matches: [] },
      losers: losers ?? { rounds: [], matches: [] },
      final: final ?? { rounds: [], matches: [] },
    },
  }
}

function bracketDefinitionFromPublishedRounds(rounds: PublishedBracketRound[]): BracketDefinition | null {
  const visibleRounds = rounds.filter((round) => round.matches.length)
  if (!visibleRounds.length) return null

  return {
    rounds: visibleRounds.map((round) => round.name),
    matches: visibleRounds.map((round) => round.matches.map(publishedMatchToBracketMatch)),
  }
}

function publishedMatchToBracketMatch(match: PublishedBracketMatch): BracketMatch {
  const winner = match.winner === 'white' ? 'a' : match.winner === 'black' ? 'b' : undefined
  return {
    a: match.white,
    b: match.black,
    gameId: match.gameId,
    live: match.live,
    matchNumber: match.matchNumber,
    next: match.next,
    sa: bracketScoreValue(match.whiteScore),
    sb: bracketScoreValue(match.blackScore),
    w: winner,
  }
}

function bracketScoreValue(value?: string) {
  if (value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function buildSingleEliminationBracket(
  tournament: Tournament,
  players: Member[],
  publishedGames: TournamentGame[] = [],
  options: { forceActiveRound?: number; matchNumbers?: number[][]; prefix?: string } = {},
): BracketDefinition {
  const publishedNames = publishedGames.flatMap((game) => [game.white.name, game.black.name])
  const names = players.length ? players.map((player) => player.name) : publishedNames
  const counts = bracketRoundCounts(names.length)
  const labels = counts.map((count) => prefixedRoundName(count, options.prefix))
  const activeRound = options.forceActiveRound ?? activeBracketRoundIndex(labels, tournament)
  const bracketSize = nextPowerOfTwo(names.length)
  let current = openingBracketNames(names, bracketSize)
  const gamesByRound = groupTournamentGamesByRound(publishedGames)

  const matches = labels.map((label, roundIndex) => {
    const sourceCode = bracketRoundCode(label)
    const complete = tournament.status === 'Completed' || (tournament.status === 'Active' && roundIndex < activeRound)
    const live = tournament.status === 'Active' && roundIndex === activeRound
    const roundGames = gamesByRound.get(roundIndex + 1) ?? []
    const roundMatches = pairNames(current).map(([a, b], matchIndex) => {
      const publishedGame = roundGames[matchIndex]
      const whiteName = publishedGame?.white.name ?? a
      const blackName = publishedGame?.black.name ?? b
      return makeBracketMatch(whiteName, blackName, {
        complete,
        gameId: publishedGame?.id,
        live,
        matchNumber: options.matchNumbers?.[roundIndex]?.[matchIndex],
        matchIndex,
        result: publishedGame?.result,
        status: publishedGame?.status,
        next: roundIndex < labels.length - 1 ? Math.floor(matchIndex / 2) : undefined,
      })
    })
    const winners = roundMatches.map((match, matchIndex) => (
      match.w || complete ? bracketWinner(match) : winnerNameFromMatch(match, sourceCode, matchIndex + 1)
    ))

    current = winners

    return roundMatches
  })

  return { rounds: labels, matches }
}

function groupTournamentGamesByRound(games: TournamentGame[]) {
  const rows = new Map<number, TournamentGame[]>()
  games.forEach((game) => {
    const list = rows.get(game.round) ?? []
    list.push(game)
    rows.set(game.round, list)
  })

  rows.forEach((roundGames) => roundGames.sort((a, b) => a.board - b.board))
  return rows
}

function buildDoubleEliminationBrackets(
  tournament: Tournament,
  players: Member[],
  publishedGames: TournamentGame[],
): Record<BracketView, BracketDefinition> {
  const publishedNames = publishedGames.flatMap((game) => [game.white.name, game.black.name])
  const playerCount = Math.max(2, players.length || publishedNames.length)
  const matchNumbers = buildDoubleEliminationMatchNumbering(
    bracketRoundCounts(playerCount).map((count) => Math.max(1, count / 2)),
  )
  const winnersTournament = {
    ...tournament,
    round: /winner|w-/i.test(tournament.round) ? tournament.round : 'W-Final',
  }
  const winners = buildSingleEliminationBracket(winnersTournament, players, publishedGames, {
    ...(/winner|w-/i.test(tournament.round) ? {} : { forceActiveRound: Number.POSITIVE_INFINITY }),
    matchNumbers: matchNumbers.winners,
    prefix: 'W-',
  })
  const winnerMatches = winners.matches
  const winnerLabels = winners.rounds
  const firstLoserPool = losersFromBracketRound(winnerMatches[0] || [], winnerLabels[0] || 'W-Round')
  const incomingLosers = winnerMatches
    .slice(1, -1)
    .map((round, index) => {
      const losers = losersFromBracketRound(round, winnerLabels[index + 1] || `W-Round ${index + 2}`)
      return losers.length > 2 ? [...losers].reverse() : losers
    })
  const winnersFinalLoser = loserName(
    winnerMatches[winnerMatches.length - 1]?.[0],
    winnerLabels[winnerLabels.length - 1] || 'W-Final',
    1,
  )
  const loserRounds = buildLoserBracketRounds(
    firstLoserPool,
    incomingLosers,
    tournament,
    buildLowerBracketRoundLabelsFromWinnerRounds(winnerLabels),
    matchNumbers.losers,
  )
  const loserChampion = loserRounds.length
    ? winnerNameFromMatch(
      loserRounds[loserRounds.length - 1].matches[0],
      loserRounds[loserRounds.length - 1].round,
      1,
    )
    : firstLoserPool[0] ?? 'Lower bracket survivor'
  const losersFinalLive = tournament.status === 'Active' && !/grand|reset/i.test(tournament.round)
  const losersFinal = makeBracketMatch(winnersFinalLoser, loserChampion, {
    complete: tournament.status === 'Completed',
    live: losersFinalLive,
    matchNumber: matchNumbers.lowerFinal,
    matchIndex: 0,
  })
  const grandFinal = makeBracketMatch(
    winnerNameFromMatch(winnerMatches[winnerMatches.length - 1]?.[0], 'W-Final', 1),
    winnerNameFromMatch(losersFinal, 'Lower Final', 1),
    {
      complete: tournament.status === 'Completed',
      live: tournament.status === 'Active' && /grand/i.test(tournament.round),
      matchNumber: matchNumbers.grandFinal,
      matchIndex: 0,
    },
  )

  return {
    winners,
    losers: {
      rounds: [...loserRounds.map((round) => round.round), 'Lower Final'],
      matches: [...loserRounds.map((round) => round.matches), [losersFinal]],
    },
    final: {
      rounds: ['Grand Final', 'Reset if needed'],
      matches: [
        [grandFinal],
        [{ a: `Winner of ${matchNumbers.grandFinal}`, b: 'Reset only if needed', matchNumber: matchNumbers.resetFinal }],
      ],
    },
  }
}

function buildDoubleEliminationMatchNumbering(winnerMatchCounts: number[]) {
  const winners: number[][] = winnerMatchCounts.map(() => [])
  const losers: number[][] = []
  let next = 1

  const allocate = (count: number, direction: 'asc' | 'desc' = 'asc') => {
    const numbers = Array.from({ length: count }, (_value, index) => next + index)
    next += count
    return direction === 'desc' ? numbers.reverse() : numbers
  }

  if (winnerMatchCounts.length) {
    winners[0] = allocate(winnerMatchCounts[0])
  }

  let poolCount = winnerMatchCounts[0] ?? 0
  let poolDirection: 'asc' | 'desc' = 'asc'

  for (let winnerRoundIndex = 1; winnerRoundIndex < winnerMatchCounts.length - 1; winnerRoundIndex += 1) {
    if (poolCount >= 2) {
      const matchCount = Math.floor(poolCount / 2)
      const direction: 'asc' | 'desc' = poolDirection === 'desc' ? 'desc' : 'asc'
      losers.push(allocate(matchCount, direction))
      poolCount = matchCount + (poolCount % 2)
      poolDirection = direction
    }

    winners[winnerRoundIndex] = allocate(winnerMatchCounts[winnerRoundIndex])

    const incomingCount = winnerMatchCounts[winnerRoundIndex]
    if (incomingCount > 0) {
      const pairCount = Math.min(poolCount, incomingCount)
      if (pairCount > 0) {
        const direction = incomingCount > 2 ? 'desc' : 'asc'
        losers.push(allocate(pairCount, direction))
        poolDirection = direction
      }
      poolCount = poolCount + incomingCount - pairCount
    }
  }

  while (poolCount > 1) {
    const matchCount = Math.floor(poolCount / 2)
    const direction: 'asc' | 'desc' = poolDirection === 'desc' ? 'desc' : 'asc'
    losers.push(allocate(matchCount, direction))
    poolCount = matchCount + (poolCount % 2)
    poolDirection = direction
  }

  const finalWinnerRoundIndex = winnerMatchCounts.length - 1
  if (finalWinnerRoundIndex > 0) {
    winners[finalWinnerRoundIndex] = allocate(winnerMatchCounts[finalWinnerRoundIndex])
  }

  return {
    grandFinal: next + 1,
    losers,
    lowerFinal: next,
    resetFinal: next + 2,
    winners,
  }
}

function buildLoserBracketRounds(
  firstPool: string[],
  incomingPools: string[][],
  tournament: Tournament,
  lowerRoundLabels: string[],
  matchNumbers: number[][],
) {
  const rawRounds: Array<{ round: string; matches: BracketMatch[] }> = []
  let pool = firstPool
  const complete = tournament.status === 'Completed' || tournament.status === 'Active'

  const buildLoserMatch = (a: string, b: string, matchIndex: number, next: number, matchNumber?: number) => (
    makeBracketMatch(a, b, {
      complete,
      live: false,
      matchNumber,
      matchIndex,
      next,
    })
  )

  const pushReduction = (feedsDropIn = false) => {
    if (pool.length < 2) return
    const pairable = pool.length % 2 === 0 ? pool : pool.slice(0, -1)
    const carry = pool.length % 2 === 0 ? [] : [pool[pool.length - 1]]
    const roundNumber = rawRounds.length + 1
    const roundMatchNumbers = matchNumbers[rawRounds.length] ?? []
    const matches = pairNames(pairable).map(([a, b], matchIndex) => (
      buildLoserMatch(a, b, matchIndex, feedsDropIn ? matchIndex : Math.floor(matchIndex / 2), roundMatchNumbers[matchIndex])
    ))
    const winners = matches.map((match, index) => (
      complete ? bracketWinner(match) : winnerNameFromMatch(match, `L${roundNumber}`, index + 1)
    ))
    rawRounds.push({ round: `L-Round ${roundNumber}`, matches })
    pool = [...winners, ...carry]
  }

  const pairDropIns = (incoming: string[]) => {
    if (!incoming.length) return
    if (!pool.length) {
      pool = [...incoming]
      return
    }

    const pairCount = Math.min(pool.length, incoming.length)
    const roundNumber = rawRounds.length + 1
    const roundMatchNumbers = matchNumbers[rawRounds.length] ?? []
    const matches = Array.from({ length: pairCount }, (_, index) => (
      buildLoserMatch(pool[index], incoming[index], index, Math.floor(index / 2), roundMatchNumbers[index])
    ))
    const winners = matches.map((match, index) => (
      complete ? bracketWinner(match) : winnerNameFromMatch(match, `L${roundNumber}`, index + 1)
    ))
    rawRounds.push({ round: `L-Round ${roundNumber}`, matches })
    pool = [
      ...winners,
      ...pool.slice(pairCount),
      ...incoming.slice(pairCount),
    ]
  }

  incomingPools.forEach((incoming) => {
    pushReduction(incoming.length > 0)
    pairDropIns(incoming)
  })

  while (pool.length > 1) {
    pushReduction(false)
  }

  return normalizeLowerBracketRounds(rawRounds, lowerRoundLabels)
}

function normalizeLowerBracketRounds(
  rounds: Array<{ round: string; matches: BracketMatch[] }>,
  preferredLabels: string[] = [],
) {
  const fallbackLabels = buildLowerBracketRoundLabels(
    rounds.map((round) => round.matches.length),
    isLowerBracketFinalRound(rounds[rounds.length - 1]?.round),
  )
  const includesFinalRound = isLowerBracketFinalRound(rounds[rounds.length - 1]?.round)
  const labels = rounds.map((round, index) => {
    if (includesFinalRound && index === rounds.length - 1) return 'Lower Final'
    return preferredLabels[index] ?? fallbackLabels[index] ?? round.round
  })
  const rawToLabel = new Map(labels.map((label, index) => [`L${index + 1}`, label]))
  const codeToIndex = buildLowerBracketCodeIndex(labels)
  const lastRoundIndex = rounds.length - 1

  return rounds.map((round, index) => ({
    ...round,
    matches: round.matches.map((match) => ({
      ...rewriteLowerBracketPlaceholders(match, rawToLabel, undefined, index, labels, codeToIndex),
      ...(index === lastRoundIndex ? { next: 0 } : {}),
    })),
    round: labels[index] ?? round.round,
  }))
}

function rewriteLowerBracketPlaceholders(
  match: BracketMatch,
  rawToLabel: Map<string, string>,
  firstWinnerRoundCode?: string,
  roundIndex?: number,
  labels?: string[],
  codeToIndex?: Map<string, number>,
): BracketMatch {
  return {
    ...match,
    a: rewriteLowerBracketPlaceholder(match.a, rawToLabel, firstWinnerRoundCode, roundIndex, labels, codeToIndex),
    b: rewriteLowerBracketPlaceholder(match.b, rawToLabel, firstWinnerRoundCode, roundIndex, labels, codeToIndex),
  }
}

function rewriteLowerBracketPlaceholder(
  value: string,
  rawToLabel: Map<string, string>,
  firstWinnerRoundCode?: string,
  roundIndex?: number,
  labels?: string[],
  codeToIndex?: Map<string, number>,
) {
  const winner = /^Winner L(\d+)-(\d+)$/i.exec(value)
  let rewritten = value
  if (winner) {
    const label = rawToLabel.get(`L${winner[1]}`)
    rewritten = label ? `Winner ${bracketRoundCode(label)}-${winner[2]}` : value
  } else {
    const genericWinnerDrop = /^Loser WRound-(\d+)$/i.exec(value)
    if (genericWinnerDrop && firstWinnerRoundCode) {
      rewritten = `Loser ${firstWinnerRoundCode}-${genericWinnerDrop[1]}`
    }
  }

  const stageWinner = /^Winner ([A-Z0-9]+)-(\d+)$/i.exec(rewritten)
  if (!stageWinner || !labels || !codeToIndex || roundIndex === undefined || roundIndex < 1) {
    return rewritten
  }

  const sourceCode = stageWinner[1].toUpperCase()
  const sourceIndex = codeToIndex.get(sourceCode)
  const pointsToFutureStage = sourceIndex === undefined
    ? /^(?:FQ|F)$/.test(sourceCode)
    : sourceIndex >= roundIndex
  if (!pointsToFutureStage) return rewritten

  return `Winner ${bracketRoundCode(labels[roundIndex - 1])}-${stageWinner[2]}`
}

function normalizePublishedLowerBracketRounds(
  rounds: PublishedBracketRound[],
  winnerRoundLabels: string[] = [],
): PublishedBracketRound[] {
  const preferredLabels = buildLowerBracketRoundLabelsFromWinnerRounds(winnerRoundLabels)
  const firstWinnerRoundCode = winnerRoundLabels[0]
    ? bracketRoundCode(winnerRoundLabels[0])
    : undefined
  const fallbackLabels = buildLowerBracketRoundLabels(
    rounds.map((round) => round.matches.length),
    isLowerBracketFinalRound(rounds[rounds.length - 1]?.name),
  )
  const includesFinalRound = isLowerBracketFinalRound(rounds[rounds.length - 1]?.name)
  const labels = rounds.map((round, index) => {
    if (includesFinalRound && index === rounds.length - 1) return 'Lower Final'
    return preferredLabels[index] ?? fallbackLabels[index] ?? round.name
  })
  const rawToLabel = new Map(labels.map((label, index) => [`L${index + 1}`, label]))
  const codeToIndex = buildLowerBracketCodeIndex(labels)

  return rounds.map((round, index) => ({
    ...round,
    matches: round.matches.map((match) => ({
      ...match,
      black: rewritePublishedLowerBracketPlaceholder(match.black, rawToLabel, firstWinnerRoundCode, index, labels, codeToIndex),
      white: rewritePublishedLowerBracketPlaceholder(match.white, rawToLabel, firstWinnerRoundCode, index, labels, codeToIndex),
    })),
    name: labels[index] ?? round.name,
  }))
}

function buildLowerBracketCodeIndex(labels: string[]) {
  const entries: Array<[string, number]> = []
  labels.forEach((label, index) => {
    entries.push([bracketRoundCode(label).toUpperCase(), index])
    lowerBracketLegacyCodes(index).forEach((code) => entries.push([code, index]))
    const unprefixed = label.replace(/\b(?:minor|major)\s+/i, '')
    if (/minor/i.test(label)) {
      entries.push([bracketRoundCode(`${unprefixed} survivor`).toUpperCase(), index])
      entries.push([bracketRoundCode(`${unprefixed} Qualifier`).toUpperCase(), index])
      if (index === 0 && /quarterfinal/i.test(label)) {
        entries.push([bracketRoundCode('Round of 16 survivor').toUpperCase(), index])
        entries.push([bracketRoundCode('Round of 16 Qualifier').toUpperCase(), index])
      }
    }
    if (/major/i.test(label)) {
      entries.push([bracketRoundCode(unprefixed).toUpperCase(), index])
    }
  })
  return new Map(entries)
}

function lowerBracketLegacyCodes(index: number) {
  const aliases = [
    ['MNQF', 'QFQ', 'QFS', 'R16S', 'R16Q'],
    ['MJQF', 'QF'],
    ['MNSF', 'SFQ', 'SFS'],
    ['MJSF', 'SF'],
    ['MNF', 'FQ', 'FS'],
    ['MJF', 'F'],
  ]
  return aliases[index] ?? []
}

function rewritePublishedLowerBracketPlaceholder(
  value: string,
  rawToLabel: Map<string, string>,
  firstWinnerRoundCode: string | undefined,
  roundIndex: number,
  labels: string[],
  codeToIndex: Map<string, number>,
) {
  const rewritten = rewriteLowerBracketPlaceholder(value, rawToLabel, firstWinnerRoundCode)
  const winner = /^Winner ([A-Z0-9]+)-(\d+)$/i.exec(rewritten)
  if (!winner || roundIndex < 1) return rewritten

  const sourceCode = winner[1].toUpperCase()
  const sourceIndex = codeToIndex.get(sourceCode)
  const pointsToFutureStage = sourceIndex === undefined
    ? /^(?:FQ|F)$/.test(sourceCode)
    : sourceIndex >= roundIndex
  if (!pointsToFutureStage) return rewritten

  return `Winner ${bracketRoundCode(labels[roundIndex - 1])}-${winner[2]}`
}

function buildLowerBracketRoundLabels(matchCounts: number[], includesFinalRound = false) {
  return matchCounts.map((_matchCount, index) => {
    if (includesFinalRound && index === matchCounts.length - 1) return 'Lower Final'
    return `Lower Round ${index + 1}`
  })
}

function buildLowerBracketRoundLabelsFromWinnerRounds(winnerRoundLabels: string[]) {
  const count = Math.max(0, (winnerRoundLabels.length - 1) * 2)
  return Array.from({ length: count }, (_value, index) => (
    index === count - 1 ? 'Lower Final' : `Lower Round ${index + 1}`
  ))
}

function isLowerBracketFinalRound(name?: string) {
  return Boolean(name && /^(?:(?:l|lower)[-\s]*)?final$/i.test(name.trim()))
}

function bracketRoundCounts(playerCount: number) {
  const counts: number[] = [nextPowerOfTwo(playerCount)]
  let next = counts[counts.length - 1] / 2
  while (next >= 2) {
    counts.push(next)
    next /= 2
  }
  return counts
}

function effectiveBracketPlayerCount(tournament: Tournament, availablePlayers: number) {
  const declared = tournament.participants > 0
    ? tournament.participants
    : tournament.capacity && tournament.capacity > 0
      ? tournament.capacity
      : availablePlayers

  return Math.max(2, Math.min(availablePlayers, declared))
}

function nextPowerOfTwo(value: number) {
  let result = 1
  while (result < value) result *= 2
  return Math.max(2, result)
}

function pairNames(names: string[]) {
  const pairs: Array<[string, string]> = []
  for (let index = 0; index < names.length - 1; index += 2) {
    pairs.push([names[index], names[index + 1]])
  }
  return pairs
}

function openingBracketNames(names: string[], bracketSize: number) {
  const slots: string[] = []
  const firstRoundMatches = Math.max(1, bracketSize / 2)
  const byeCount = Math.max(0, bracketSize - names.length)
  let playerIndex = 0

  for (let matchIndex = 0; matchIndex < firstRoundMatches; matchIndex += 1) {
    const a = names[playerIndex++] ?? bracketByeName
    const b = matchIndex >= firstRoundMatches - byeCount
      ? bracketByeName
      : names[playerIndex++] ?? bracketByeName
    slots.push(a, b)
  }

  return slots
}

function makeBracketMatch(
  a: string,
  b: string,
  {
    complete,
    gameId,
    live,
    matchNumber,
    matchIndex,
    next,
    result,
    status,
  }: {
    complete: boolean
    gameId?: string
    live: boolean
    matchNumber?: number
    matchIndex: number
    next?: number
    result?: TournamentGame['result']
    status?: TournamentGame['status']
  },
): BracketMatch {
  const base = { a, b, gameId, matchNumber, next }
  const byeWinner = bracketByeWinner(a, b)
  if (byeWinner) return { ...base, w: byeWinner }
  if (status === 'live' || live) return { ...base, live: true }
  if (result && result !== '*') {
    if (result === '1/2-1/2') return { ...base, sa: 0.5, sb: 0.5 }
    const winner = result === '0-1' ? 'b' : 'a'
    return {
      ...base,
      sa: winner === 'a' ? 1 : 0,
      sb: winner === 'b' ? 1 : 0,
      w: winner,
    }
  }
  if (!complete) return base

  const winner = matchIndex % 2 === 0 ? 'a' : 'b'
  return {
    ...base,
    sa: winner === 'a' ? 1 : 0,
    sb: winner === 'b' ? 1 : 0,
    w: winner,
  }
}

function bracketByeWinner(a: string, b: string): 'a' | 'b' | null {
  const aBye = isByeName(a)
  const bBye = isByeName(b)
  if (aBye && !bBye) return 'b'
  if (bBye && !aBye) return 'a'
  return null
}

function bracketWinner(match: BracketMatch) {
  if (match.w === 'b') return match.b
  return match.a
}

function bracketLoser(match: BracketMatch) {
  if (match.w === 'b') return match.a
  return match.b
}

function winnerNameFromMatch(match: BracketMatch | undefined, roundLabel: string, matchNumber: number) {
  if (!match) return `Winner ${bracketRoundCode(roundLabel)}-${matchNumber}`
  if (match.w) return bracketWinner(match)
  if (match.matchNumber) return `Winner of ${match.matchNumber}`
  return `Winner ${bracketRoundCode(roundLabel)}-${matchNumber}`
}

function loserName(match: BracketMatch | undefined, roundLabel: string, matchNumber: number) {
  if (!match) return `Loser ${bracketRoundCode(roundLabel)}-${matchNumber}`
  if (match.w) return bracketLoser(match)
  if (match.matchNumber) return `Loser of ${match.matchNumber}`
  return `Loser ${bracketRoundCode(roundLabel)}-${matchNumber}`
}

function losersFromBracketRound(matches: BracketMatch[], roundLabel: string) {
  return matches
    .map((match, index) => loserName(match, roundLabel, index + 1))
    .filter((name) => !isByeName(name))
}

function prefixedRoundName(playersInRound: number, prefix = '') {
  return `${prefix}${bracketRoundName(playersInRound)}`
}

function bracketRoundName(playersInRound: number) {
  if (playersInRound === 2) return 'Final'
  if (playersInRound === 4) return 'Semifinal'
  if (playersInRound === 8) return 'Quarterfinal'
  return `Round of ${playersInRound}`
}

function bracketRoundCode(label: string) {
  const survivor = /surviv(?:or|al)/i.test(label)
  const qualifier = /qualifier/i.test(label)
  const suffix = survivor ? 'S' : qualifier ? 'Q' : ''
  const prefix = /minor/i.test(label) ? 'MN' : /major/i.test(label) ? 'MJ' : ''
  if (/quarterfinal/i.test(label)) return `${prefix}QF${suffix}`
  if (/semifinal/i.test(label)) return `${prefix}SF${suffix}`
  if (/final/i.test(label)) return `${prefix}F${suffix}`
  const count = /round of\s*(\d+)/i.exec(label)?.[1]
  if (count) return `${prefix}R${count}${suffix}`
  const lowerRound = /lower round\s*(\d+)/i.exec(label)?.[1]
  return lowerRound ? `LR${lowerRound}` : label.replace(/[^A-Za-z0-9]+/g, '').slice(0, 6) || 'R'
}

function activeBracketRoundIndex(labels: string[], tournament: Tournament) {
  if (tournament.status === 'Completed') return labels.length
  if (tournament.status !== 'Active') return 0

  if (tournament.currentRound && tournament.currentRound > 0) {
    return Math.max(0, Math.min(labels.length - 1, tournament.currentRound - 1))
  }

  const round = tournament.round.toLowerCase()
  const parsed = labels.findIndex((label) => {
    const lower = label.toLowerCase()
    if (round.includes('final') && lower.includes('final') && !lower.includes('semi')) return true
    if (round.includes('semi') && lower.includes('semi')) return true
    if (round.includes('quarter') && lower.includes('quarter')) return true
    const count = /round of\s*(\d+)/i.exec(lower)?.[1]
    return Boolean(count && round.includes(count))
  })

  if (parsed >= 0) return parsed
  return Math.max(0, Math.min(labels.length - 1, labels.length - 2))
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
              ['winners', 'Winners'],
              ['losers', 'Losers'],
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
                    roundLabels={activeBracket.rounds}
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
  roundLabels,
}: {
  isLastRound: boolean
  match: BracketMatch
  matchIndex: number
  roundIndex: number
  roundLabels: string[]
}) {
  const displayA = cleanDisplayedBracketPlaceholder(match.a, roundIndex, roundLabels)
  const displayB = cleanDisplayedBracketPlaceholder(match.b, roundIndex, roundLabels)
  const isPending = isPendingMatch(match)
  const stateClass = match.live ? 'live' : isPending ? 'pending' : match.w ? 'complete' : 'open'
  const lineState = match.w || (match.live ? 'live' : '')
  const className = `bracket-match rich ${stateClass} ${isLastRound ? 'last-round' : ''} ${match.gameId ? 'clickable-game' : ''}`
  const content = (
    <>
      {match.matchNumber || match.live ? (
        <div className="bracket-match-head">
          {match.matchNumber ? <span className="bracket-match-number">Match {match.matchNumber}</span> : <span />}
          {match.live ? (
            <span className="bracket-live-tag">
              <span aria-hidden="true" />
              Live
            </span>
          ) : null}
        </div>
      ) : null}
      <BracketPlayerRow
        name={displayA}
        score={match.live ? '•' : formatBracketScore(match.sa)}
        side="white"
        state={playerState(match, 'a')}
      />
      <BracketPlayerRow
        name={displayB}
        score={match.live ? '•' : formatBracketScore(match.sb)}
        side="black"
        state={playerState(match, 'b')}
      />
    </>
  )

  if (match.gameId) {
    return (
      <Link
        to={`/games?game=${match.gameId}`}
        className={className}
        data-brk-card={`${roundIndex}-${matchIndex}`}
        data-target={match.next ?? ''}
        data-win={lineState}
      >
        {content}
      </Link>
    )
  }

  return (
    <div
      className={className}
      data-brk-card={`${roundIndex}-${matchIndex}`}
      data-target={match.next ?? ''}
      data-win={lineState}
    >
      {content}
    </div>
  )
}

function cleanDisplayedBracketPlaceholder(name: string, roundIndex: number, roundLabels: string[]) {
  const winner = /^Winner ([A-Z0-9]+)-(\d+)$/i.exec(name)
  if (!winner || roundIndex < 1) return name

  const labelCodes = new Map(roundLabels.map((label, index) => [bracketRoundCode(label).toUpperCase(), index]))
  const sourceCode = winner[1].toUpperCase()
  const sourceIndex = labelCodes.get(sourceCode)
  const pointsToFutureStage = sourceIndex === undefined
    ? /^(?:FQ|F)$/.test(sourceCode)
    : sourceIndex >= roundIndex

  if (!pointsToFutureStage) return name
  return `Winner ${bracketRoundCode(roundLabels[roundIndex - 1])}-${winner[2]}`
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
  side,
  state,
}: {
  name: string
  score: string
  side: 'black' | 'white'
  state: 'neutral' | 'winner' | 'muted'
}) {
  return (
    <div className={`bracket-player ${state}`}>
      <span className={`tournament-color-chip ${side}`}>{side === 'white' ? 'W' : 'B'}</span>
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

function isByeName(name: string) {
  return name === bracketByeName
}

function UnpublishedPanel({ body, title }: { body: string; title: string }) {
  return (
    <div className="unpublished-panel">
      <Trophy size={24} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
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
  const selectedMembers = tournament.registeredPlayers ?? []
  const publishedGames = tournament.publishedGames ?? []
  const stats = new Map<string, { points: number; wins: number; draws: number; losses: number; playing: boolean }>()

  selectedMembers.forEach((member) => {
    stats.set(member.id, { points: 0, wins: 0, draws: 0, losses: 0, playing: false })
  })

  publishedGames.forEach((game) => {
    const white = stats.get(game.white.id) ?? { points: 0, wins: 0, draws: 0, losses: 0, playing: false }
    const black = stats.get(game.black.id) ?? { points: 0, wins: 0, draws: 0, losses: 0, playing: false }

    if (game.status === 'live') {
      white.playing = true
      black.playing = true
    } else if (game.status === 'completed') {
      if (game.result === '1-0') {
        white.points += 1
        white.wins += 1
        black.losses += 1
      } else if (game.result === '0-1') {
        black.points += 1
        black.wins += 1
        white.losses += 1
      } else if (game.result === '1/2-1/2') {
        white.points += 0.5
        black.points += 0.5
        white.draws += 1
        black.draws += 1
      }
    }

    stats.set(game.white.id, white)
    stats.set(game.black.id, black)
  })

  const standings = selectedMembers.map((member, index) => {
    const row = stats.get(member.id) ?? { points: 0, wins: 0, draws: 0, losses: 0, playing: false }

    return {
      member,
      rank: index + 1,
      points: row.points,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      tieBreak: 0,
      status: row.playing ? 'Playing' : row.wins || row.draws || row.losses ? 'Finished' : 'Registered',
      seedOrder: index,
    } satisfies StandingRow & { seedOrder: number }
  }).sort((a, b) => b.points - a.points || b.wins - a.wins || a.seedOrder - b.seedOrder)
    .map(({ seedOrder: _seedOrder, ...row }, index) => ({ ...row, rank: index + 1 }))

  const games = publishedGames.map(gameToCard)

  return {
    standings,
    games,
    rounds: buildRoundGroups(tournament, publishedGames),
  }
}

function gameToCard(game: TournamentGame): GameCard {
  return {
    id: game.id,
    board: game.board,
    round: `Round ${game.round}`,
    white: game.white,
    black: game.black,
    result: game.status === 'live' ? 'LIVE' : game.result,
  }
}

function buildRoundGroups(_tournament: Tournament, games: TournamentGame[]): RoundGroup[] {
  const groups = new Map<number, TournamentGame[]>()
  games.forEach((game) => {
    const list = groups.get(game.round) ?? []
    list.push(game)
    groups.set(game.round, list)
  })

  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([round, roundGames]) => {
      const hasLive = roundGames.some((game) => game.status === 'live')
      const allDone = roundGames.every((game) => game.status === 'completed')
      return {
        label: `Round ${round}`,
        note: hasLive ? 'Current round pairings' : allDone ? 'Recorded pairings' : 'Published pairings',
        state: hasLive ? 'live' : allDone ? 'done' : 'next',
        games: roundGames
          .sort((a, b) => a.board - b.board)
          .map((game) => ({
            id: game.id,
            board: game.board,
            white: game.white,
            black: game.black,
            result: game.status === 'live' ? 'LIVE' : game.result,
          })),
      } satisfies RoundGroup
    })
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
