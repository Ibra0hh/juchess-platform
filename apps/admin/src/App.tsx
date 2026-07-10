import { memo, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import './App.css'
import { JuChessBoard, type JuChessBoardChange } from './components/JuChessBoard'
import { buildChessGame, deriveResult, parseChessPgn, pgnFromMoves } from './components/JuChessRules'
import { appwriteReady } from './lib/appwrite'
import {
  advanceTournamentRound,
  blockIdentity,
  blockIp,
  createAdminProfile,
  createTournament,
  formatAdminError,
  getAdminSession,
  loadAdminProfiles,
  countPendingRegistrations,
  configureTournamentProcedure,
  loadClubPlayers,
  loadTournamentCheckIns,
  loadTournamentRegistrations,
  loadBlockLists,
  loadAdminTournaments,
  publishTournamentPairings,
  signInAdmin,
  signOutAdmin,
  submitTournamentGameResult,
  startTournamentGame,
  unblockIdentity,
  unblockIp,
  updateAdminStatus,
  updateRegistrationStatus,
  updateTournament,
  updateTournamentGamePgn,
  unpublishTournamentPairings,
  type AdminRegistration,
  type AdminRegistrationStatus,
  type AdminGame,
  type AdminProfile,
  type AdminProfileLoadResult,
  type AdminRole,
  type AdminSession,
  type AdminStatus,
  type AdminTournament,
  type BlockListLoadResult,
  type IdentityBlock,
  type IdentityBlockType,
  type IpBlock,
  type PairingPublishInput,
  type TournamentInput,
} from './lib/adminData'
import { type TournamentStatus } from './lib/juchess'

type Screen = 'dashboard' | 'windows' | 'tournaments' | 'players' | 'news' | 'announcements' | 'adminAccess'
type TournamentTab = TournamentStatus
type TournamentDataSource = 'cloud' | 'unavailable'
type WindowKey = 'home' | 'tournaments' | 'games' | 'tools' | 'profile' | 'auth'
type DeviceKey = 'ios' | 'android' | 'tablet' | 'web'

type Player = {
  id: string
  profileId?: string
  name: string
  initials: string
  universityId: string
  email: string
  phone: string
  rating: number
  record: string
  avatarColor: string
  tournaments: number
  blocked?: boolean
}

const avatarPalette = ['#7d2434', '#21304e', '#2E7D5B', '#8a6f28', '#5f1b26', '#3d5a80']

function playerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

/** Stable per-profile colour so a player keeps the same avatar between loads. */
function avatarColorFor(profileId: string) {
  let hash = 0
  for (let index = 0; index < profileId.length; index += 1) {
    hash = (hash * 31 + profileId.charCodeAt(index)) >>> 0
  }
  return avatarPalette[hash % avatarPalette.length]
}

type AdminBracketSide = 'white' | 'black'

type Pairing = {
  round?: number
  board: number
  matchNumber?: number
  white: string
  whiteProfileId?: string
  whiteRating: number | string
  black: string
  blackProfileId?: string
  blackRating: number | string
  next?: number
  targetSlot?: AdminBracketSide
}

type LiveBoardOption = {
  boardKey: string
  boardLabel: string
  black: string
  board?: number
  gameId?: string
  completed?: boolean
  pgn?: string
  result?: string
  round?: number
  status?: string
  white: string
}

type PlayableBoard = Pairing & {
  boardKey: string
  boardLabel: string
  gameId?: string
  pgn?: string
  result?: string
  status?: string
}

type AdminBracketMatch = Pairing & {
  whiteScore?: string
  blackScore?: string
  winner?: AdminBracketSide
  live?: boolean
  pending?: boolean
}

type AdminBracketRoundRole = 'minor' | 'major' | 'final'

type AdminBracketRound = {
  name: string
  matches: AdminBracketMatch[]
  note?: string
  role?: AdminBracketRoundRole
}

type AdminBracketView = 'winners' | 'losers' | 'final'

type AdminBracketConfig =
  | {
      type: 'single'
      title: string
      rounds: AdminBracketRound[]
    }
  | {
      type: 'double'
      title: string
      brackets: Record<AdminBracketView, AdminBracketRound[]>
    }

type AdminBracketPhase = 'setup' | 'active' | 'completed'

const EMPTY_ADMIN_BRACKET_ROUNDS: AdminBracketRound[] = []

type LiveBoardState = {
  moves: string[]
  result: string
}

type ProcedureMatch = {
  black: string
  board?: number
  boardLabel: string
  boardKey: string
  bye?: boolean
  completed?: boolean
  gameId?: string
  live?: boolean
  matchNumber: number
  playable: boolean
  pgn?: string
  physicalBoard?: number
  procedureWave?: number
  queuePosition?: number
  result?: string
  round?: number
  roundLabel: string
  status: string
  white: string
}

type ProcedureTable = {
  tableNumber: number
  match?: ProcedureMatch
  startNow: boolean
}

type ProcedureQueue = {
  tables: ProcedureTable[]
  waiting: ProcedureMatch[]
  finished: ProcedureMatch[]
  byes: ProcedureMatch[]
  currentRoundFinished: number
  currentRoundTotal: number
  waves: Array<{ number: number; round: number; roundLabel: string; matches: ProcedureMatch[] }>
}

type BracketEntrant = {
  isBye?: boolean
  name: string
  profileId?: string
  rating: number | string
}

const bracketByeEntrant: BracketEntrant = { isBye: true, name: 'Bye', rating: '' }
const EMPTY_LIVE_BOARD_STATE: LiveBoardState = { moves: [], result: 'Live' }
const adminBracketViews: Array<[AdminBracketView, string]> = [
  ['winners', 'Winners'],
  ['losers', 'Losers'],
  ['final', 'Final'],
]

const navItems: Array<{ key: Screen; label: string; icon: string }> = [
  { key: 'dashboard', label: 'Dashboard', icon: '▤' },
  { key: 'windows', label: 'App Windows', icon: '▧' },
  { key: 'tournaments', label: 'Tournaments', icon: '♞' },
  { key: 'players', label: 'Players', icon: '◍' },
  { key: 'news', label: 'News', icon: '◫' },
  { key: 'announcements', label: 'Announcements', icon: '◈' },
  { key: 'adminAccess', label: 'Admin access', icon: '▣' },
]

const tournamentTabs: TournamentTab[] = ['draft', 'upcoming', 'active', 'completed', 'archived']
const createSteps = ['Basic information', 'Tournament format'] as const
const formatOptions = [
  { value: 'Swiss', icon: '♟', layout: 'Standings + current pairings' },
  { value: 'Round robin', icon: '◍', layout: 'Standings + schedule' },
  { value: 'Double round robin', icon: '◎', layout: 'Double cycle standings' },
  { value: 'Single elimination', icon: '▲', layout: 'Bracket only' },
  { value: 'Double elimination', icon: '⧗', layout: 'Winners / Losers / Final' },
  { value: 'Multi-stage', icon: '⬒', layout: 'Stage tabs + finals bracket' },
  { value: 'Team', icon: '⚑', layout: 'Team boards + match points' },
  { value: 'Arena', icon: '⚡', layout: 'Leaderboard + streaks' },
] as const
const timeOptions = [
  { label: 'Classical', minutes: '90', increment: '30' },
  { label: 'Rapid', minutes: '15', increment: '10' },
  { label: 'Blitz', minutes: '5', increment: '3' },
  { label: 'Bullet', minutes: '1', increment: '0' },
  { label: 'Custom', minutes: '15', increment: '10' },
] as const

function createInitialTournamentForm(): TournamentInput {
  return {
    slug: '',
    name: '',
    status: 'draft',
    format: 'Swiss',
    timeControl: '15+10 Rapid',
    capacity: 16,
    location: '',
  }
}

const pageText: Record<Screen, { title: string; sub: string }> = {
  dashboard: { title: 'Dashboard', sub: 'Live overview of your club operations' },
  windows: { title: 'App Windows', sub: 'Control every screen and section players see' },
  tournaments: { title: 'Tournament Control Center', sub: 'Create, publish and run every event' },
  players: { title: 'Player Management', sub: 'Roster, ratings and player records' },
  news: { title: 'News', sub: 'Public posts shown on the app & website' },
  announcements: { title: 'Announcements', sub: 'Broadcast to players and members' },
  adminAccess: { title: 'Admin access', sub: 'Manage admin-only accounts and permissions' },
}

const demoPlayers: Player[] = [
  {
    id: 'p1',
    name: 'Ibrahim Ahmad',
    initials: 'IA',
    universityId: '0249115',
    email: 'ibrahim.ahmad@ju.edu.jo',
    phone: '0791201102',
    rating: 1810,
    record: '18-4-7',
    avatarColor: '#7d2434',
    tournaments: 7,
  },
  {
    id: 'p2',
    name: 'Omar Saleh',
    initials: 'OS',
    universityId: '0221840',
    email: 'omar.saleh@ju.edu.jo',
    phone: '0788894411',
    rating: 1740,
    record: '15-5-8',
    avatarColor: '#21304e',
    tournaments: 5,
  },
  {
    id: 'p3',
    name: 'Leen Haddad',
    initials: 'LH',
    universityId: '0231088',
    email: 'leen.haddad@ju.edu.jo',
    phone: '0775500139',
    rating: 1685,
    record: '12-7-8',
    avatarColor: '#2E7D5B',
    tournaments: 6,
  },
  {
    id: 'p4',
    name: 'Yazan Khaled',
    initials: 'YK',
    universityId: '0217742',
    email: 'yazan.khaled@ju.edu.jo',
    phone: '0792214770',
    rating: 1602,
    record: '11-3-12',
    avatarColor: '#8a6f28',
    tournaments: 4,
  },
  {
    id: 'p5',
    name: 'Sara Nasser',
    initials: 'SN',
    universityId: '0234109',
    email: 'sara.nasser@ju.edu.jo',
    phone: '0784401277',
    rating: 1558,
    record: '9-4-10',
    avatarColor: '#5E60CE',
    tournaments: 3,
  },
  {
    id: 'p6',
    name: 'Kareem Mansour',
    initials: 'KM',
    universityId: '0209971',
    email: 'kareem.mansour@ju.edu.jo',
    phone: '0771012020',
    rating: 1498,
    record: '8-2-14',
    avatarColor: '#B23A3A',
    tournaments: 4,
    blocked: true,
  },
]

const windowModel: Array<{ key: WindowKey; label: string; icon: string; sections: string[] }> = [
  { key: 'home', label: 'Home', icon: '⌂', sections: ['Header', 'Featured tournament', 'Quick tools', 'Club leaderboard', 'News'] },
  { key: 'tournaments', label: 'Tournaments', icon: '♞', sections: ['Tabs', 'Tournament cards', 'Detail hero', 'Registration'] },
  { key: 'games', label: 'Games', icon: '♟', sections: ['Review games', 'Analysis board', 'PGN upload'] },
  { key: 'tools', label: 'Tools', icon: '◫', sections: ['Chess clock', 'Saved analyses', 'Move quality'] },
  { key: 'profile', label: 'Profile', icon: '◍', sections: ['Stats', 'Recent games', 'Account details'] },
  { key: 'auth', label: 'Auth', icon: '◇', sections: ['Sign in', 'Sign up', 'Forgot password', 'Guest browsing'] },
]

const previewRoutes: Record<WindowKey, string> = {
  home: '/home',
  tournaments: '/tournaments',
  games: '/games',
  tools: '/tools',
  profile: '/profile',
  auth: '/sign-in',
}

const mobilePreviewBase = import.meta.env.VITE_MOBILE_PREVIEW_BASE_URL as string | undefined
const webPreviewBase = import.meta.env.VITE_WEB_PREVIEW_BASE_URL as string | undefined
const appPreviewBase = import.meta.env.VITE_APP_PREVIEW_BASE_URL as string | undefined
const defaultPreviewEmail = 'student.preview@ju.edu.jo'

function App() {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [tournaments, setTournaments] = useState<AdminTournament[]>([])
  const [blocks, setBlocks] = useState<BlockListLoadResult>({ identityBlocks: [], ipBlocks: [] })
  const [adminProfiles, setAdminProfiles] = useState<AdminProfileLoadResult>({ admins: [] })
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<TournamentDataSource>('unavailable')
  const [message, setMessage] = useState<string | null>(null)

  async function refreshTournaments() {
    const result = await loadAdminTournaments()
    setTournaments(result.tournaments)
    setDataSource(result.source)
    setMessage(result.error ? 'Cloud tournaments are unavailable right now.' : null)
  }

  async function refreshBlocks(currentSession = session) {
    if (!currentSession?.allowed) {
      setBlocks({ identityBlocks: [], ipBlocks: [] })
      return
    }

    setBlocks(await loadBlockLists())
  }

  async function refreshAdminProfiles(currentSession = session) {
    if (currentSession?.profile?.role !== 'superAdmin') {
      setAdminProfiles({ admins: [] })
      return
    }

    setAdminProfiles(await loadAdminProfiles())
  }

  async function handleSignOut() {
    await signOutAdmin()
    setSession(null)
    setBlocks({ identityBlocks: [], ipBlocks: [] })
    setAdminProfiles({ admins: [] })
    setScreen('dashboard')
  }

  useEffect(() => {
    let alive = true

    async function boot() {
      const [loadedSession, tournamentResult] = await Promise.all([
        getAdminSession(),
        loadAdminTournaments(),
      ])
      const [blockResult, adminProfileResult] = loadedSession?.allowed
        ? await Promise.all([
            loadBlockLists(),
            loadedSession.profile?.role === 'superAdmin'
              ? loadAdminProfiles()
              : Promise.resolve({ admins: [] }),
          ])
        : [
            { identityBlocks: [], ipBlocks: [] },
            { admins: [] },
          ]

      if (!alive) return
      setSession(loadedSession)
      setTournaments(tournamentResult.tournaments)
      setBlocks(blockResult)
      setAdminProfiles(adminProfileResult)
      setDataSource(tournamentResult.source)
      setMessage(tournamentResult.error ? 'Cloud tournaments are unavailable right now.' : null)
      setLoading(false)
    }

    void boot()

    return () => {
      alive = false
    }
  }, [])

  if (loading) return <PrototypeLoading />

  if (!appwriteReady) {
    return (
      <AdminAppShell
        screen="dashboard"
        setScreen={() => undefined}
        session={null}
        onSignOut={handleSignOut}
      >
        <ConfigNotice tournaments={tournaments} />
      </AdminAppShell>
    )
  }

  if (!session) {
    return (
      <LoginScreen
        onLogin={(nextSession) => {
          setSession(nextSession)
          void refreshTournaments()
          void refreshBlocks(nextSession)
          void refreshAdminProfiles(nextSession)
        }}
      />
    )
  }

  if (!session.allowed) {
    return <AccessDenied session={session} onSignOut={handleSignOut} />
  }

  return (
    <AdminAppShell screen={screen} setScreen={setScreen} session={session} onSignOut={handleSignOut}>
      {message ? <div className="prototype-note" role="status">{message}</div> : null}
      {screen === 'dashboard' ? (
        <DashboardScreen
          tournaments={tournaments}
          blocks={blocks}
          goTournaments={() => setScreen('tournaments')}
          goPlayers={() => setScreen('players')}
          goNews={() => setScreen('news')}
        />
      ) : null}
      {screen === 'windows' ? <WindowsScreen /> : null}
      {screen === 'tournaments' ? (
        <TournamentsScreen
          dataSource={dataSource}
          tournaments={tournaments}
          session={session}
          onChanged={refreshTournaments}
        />
      ) : null}
      {screen === 'players' ? (
        <PlayersScreen blocks={blocks} session={session} onBlocksChanged={refreshBlocks} />
      ) : null}
      {screen === 'news' ? <NewsScreen /> : null}
      {screen === 'announcements' ? <AnnouncementsScreen tournaments={tournaments} /> : null}
      {screen === 'adminAccess' ? (
        <AdminAccessScreen
          adminProfiles={adminProfiles}
          session={session}
          onAdminsChanged={refreshAdminProfiles}
        />
      ) : null}
    </AdminAppShell>
  )
}

function LoginScreen({ onLogin }: { onLogin: (session: AdminSession) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const nextSession = await signInAdmin(email.trim(), password)
      if (nextSession) onLogin(nextSession)
    } catch (caught) {
      setError(formatAdminError(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="prototype-login">
      <section className="prototype-login-card" aria-labelledby="admin-login-title">
        <div className="login-brand">
          <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="JuChess" />
          <strong>JuChess</strong>
          <span>University of Jordan Chess Club</span>
        </div>
        <h1 id="admin-login-title">Sign in</h1>
        <p>Admin control console.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="organizer@ju.edu.jo"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>
          {error ? <div className="auth-error" role="alert">{error}</div> : null}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Checking...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}

function AccessDenied({ onSignOut, session }: { onSignOut: () => Promise<void>; session: AdminSession }) {
  return (
    <main className="prototype-login">
      <section className="prototype-login-card" aria-labelledby="admin-denied-title">
        <div className="login-brand">
          <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="JuChess" />
          <strong>JuChess</strong>
          <span>University of Jordan Chess Club</span>
        </div>
        <h1 id="admin-denied-title">No admin access</h1>
        <p>{session.profile?.displayName || session.user.email} is not active in the admin access table.</p>
        <button type="button" onClick={() => void onSignOut()}>Sign out</button>
      </section>
    </main>
  )
}

function PrototypeLoading() {
  return (
    <main className="prototype-login">
      <section className="prototype-login-card compact-card">
        <div className="login-brand">
          <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="JuChess" />
          <strong>JuChess</strong>
          <span>Control Center</span>
        </div>
        <p>Loading admin panel...</p>
      </section>
    </main>
  )
}

function AdminAppShell({
  children,
  onSignOut,
  screen,
  session,
  setScreen,
}: {
  children: ReactNode
  onSignOut: () => Promise<void>
  screen: Screen
  session: AdminSession | null
  setScreen: (screen: Screen) => void
}) {
  const page = pageText[screen]
  const displayName = session?.profile?.displayName || session?.user.name || 'Amina Osei'
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AO'

  return (
    <div className="prototype-admin">
      <aside className="prototype-sidebar">
        <div className="sidebar-brand">
          <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="JuChess" />
          <span>
            <strong>JuChess</strong>
            <small>Control Center</small>
          </span>
        </div>
        <nav className="sidebar-nav" aria-label="Admin navigation">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={screen === item.key ? 'active' : undefined}
              onClick={() => setScreen(item.key)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="user-row">
            <span className="avatar">{initials}</span>
            <span>
              <strong>{displayName}</strong>
              <small>{session?.profile?.role === 'superAdmin' ? 'Super Admin' : 'Head Organizer'}</small>
            </span>
          </div>
          {session ? (
            <button type="button" className="sidebar-signout" onClick={() => void onSignOut()}>
              <span>⎋</span> Sign out
            </button>
          ) : null}
        </div>
      </aside>

      <div className="prototype-main-shell">
        <header className="prototype-topbar">
          <div>
            <h1>{page.title}</h1>
            <p>{page.sub}</p>
          </div>
          <div className="topbar-tools">
            <label className="topbar-search">
              <span>⌕</span>
              <input placeholder="Search players, events..." />
            </label>
            <button type="button" className="bell-button" aria-label="Notifications">
              🔔
              <span />
            </button>
          </div>
        </header>
        <main className={`prototype-content ${screen === 'windows' ? 'windows-content' : ''}`}>{children}</main>
      </div>
    </div>
  )
}

function ConfigNotice({ tournaments }: { tournaments: AdminTournament[] }) {
  return (
    <section className="panel-card">
      <div className="panel-head">
        <strong>Cloud configuration required</strong>
        <span>Admin setup</span>
      </div>
      <p className="muted">
        Add the cloud endpoint, project, database and admin function environment values to enable real admin control.
      </p>
      <TournamentMiniTable tournaments={tournaments} />
    </section>
  )
}

function DashboardScreen({
  blocks,
  goNews,
  goPlayers,
  goTournaments,
  tournaments,
}: {
  blocks: BlockListLoadResult
  goNews: () => void
  goPlayers: () => void
  goTournaments: () => void
  tournaments: AdminTournament[]
}) {
  const activeCount = tournaments.filter((item) => item.status === 'active').length
  const upcomingCount = tournaments.filter((item) => item.status === 'upcoming').length
  const activeBlocks = blocks.identityBlocks.filter((item) => item.status === 'active').length
    + blocks.ipBlocks.filter((item) => item.status === 'active').length

  const [playerCount, setPlayerCount] = useState<number | null>(null)
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const [{ players }, pending] = await Promise.all([
        loadClubPlayers(),
        countPendingRegistrations(),
      ])
      if (!alive) return
      setPlayerCount(players.length)
      setPendingCount(pending)
    })()
    return () => {
      alive = false
    }
  }, [])

  const statCards = [
    { label: 'Total players', value: playerCount === null ? '-' : String(playerCount), icon: '◍', tint: '#F3E4E6', delta: 'Registered club profiles', color: '#8B8577' },
    { label: 'Active tournaments', value: String(activeCount), icon: '♞', tint: '#EAF0FA', delta: `${activeCount} live now`, color: '#8B8577' },
    { label: 'Upcoming tournaments', value: String(upcomingCount), icon: '⚔', tint: '#EAF6F0', delta: `${tournaments.length} total events`, color: '#8B8577' },
    { label: 'Pending registrations', value: pendingCount === null ? '-' : String(pendingCount), icon: '⏳', tint: '#FBF1E2', delta: pendingCount ? 'Needs review' : 'All reviewed', color: pendingCount ? '#C77D0A' : '#8B8577' },
  ]

  // Derived from real tournament rows. Nothing here is invented: an empty club
  // shows an empty feed rather than a plausible-looking fiction.
  const recentActivity = tournaments
    .toSorted((a, b) => String(b.startsAt ?? '').localeCompare(String(a.startsAt ?? '')))
    .slice(0, 5)
    .map((item) => ({
      icon: item.status === 'active' ? '♞' : item.status === 'completed' ? '✓' : '⚔',
      tint: item.status === 'active' ? '#F3E4E6' : item.status === 'completed' ? '#EAF6F0' : '#EAF0FA',
      title: item.name,
      meta: `${item.format} · ${item.status}${item.currentRound ? ` · round ${item.currentRound}` : ''}`,
      time: item.startsAt ? new Date(item.startsAt).toLocaleDateString() : 'Date not set',
    }))

  return (
    <div className="dashboard-screen">
      <div className="stat-grid">
        {statCards.map((card) => (
          <article className="stat-card" key={card.label}>
            <div>
              <span>{card.label}</span>
              <i style={{ background: card.tint }}>{card.icon}</i>
            </div>
            <strong>{card.value}</strong>
            <small style={{ color: card.color }}>{card.delta}</small>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="panel-card activity-card">
          <div className="panel-head">
            <strong>Recent tournament activity</strong>
            <button type="button" onClick={goTournaments}>View all →</button>
          </div>
          {recentActivity.map((item) => (
            <div className="activity-row" key={item.title}>
              <i style={{ background: item.tint }}>{item.icon}</i>
              <span>
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
              </span>
              <time>{item.time}</time>
            </div>
          ))}
        </section>

        <section className="panel-card dispute-card">
          <div className="panel-head">
            <strong>Registrations awaiting review</strong>
            {pendingCount ? <span className="pill danger">{pendingCount} open</span> : null}
          </div>
          {pendingCount === null ? (
            <div className="empty-row">Loading registrations...</div>
          ) : pendingCount === 0 ? (
            <div className="empty-row">Every registration has been reviewed.</div>
          ) : (
            <div className="dispute-row">
              <div>
                <strong>{pendingCount} player{pendingCount === 1 ? '' : 's'} waiting for approval</strong>
                <small>Approve them in a tournament&apos;s registration queue to issue check-in codes.</small>
              </div>
              <button type="button" className="mini-button" onClick={goTournaments}>Review</button>
            </div>
          )}
        </section>
      </div>

      <div className="dashboard-grid two">
        <section className="panel-card">
          <div className="panel-title">Tournament status</div>
          <TournamentMiniTable tournaments={tournaments} />
        </section>
        <section className="panel-card">
          <div className="panel-title">Operational queues</div>
          <QueueRow icon="⏳" tint="#FBF1E2" label="Pending registrations" count={pendingCount ?? 0} action="Review" onClick={goTournaments} />
          <QueueRow icon="⚑" tint="#FBEAEA" label="Disputed results" count={3} action="Resolve" onClick={goTournaments} />
          <QueueRow icon="✉" tint="#EAF0FA" label="Message drafts" count={5} action="Open" onClick={goNews} />
          <QueueRow icon="⛔" tint="#FBEAEA" label="Active blocks" count={activeBlocks} action="Open" onClick={goPlayers} />
        </section>
      </div>
    </div>
  )
}

function QueueRow({
  action,
  count,
  icon,
  label,
  onClick,
  tint,
}: {
  action: string
  count: number
  icon: string
  label: string
  onClick: () => void
  tint: string
}) {
  return (
    <div className="queue-row">
      <i style={{ background: tint }}>{icon}</i>
      <span>{label}</span>
      <strong>{count}</strong>
      <button type="button" onClick={onClick}>{action}</button>
    </div>
  )
}

function WindowsScreen() {
  const [selected, setSelected] = useState<WindowKey>('home')
  const [device, setDevice] = useState<DeviceKey>('ios')
  const [guestMode, setGuestMode] = useState(false)
  const current = windowModel.find((item) => item.key === selected) ?? windowModel[0]
  const previewUrl = buildPreviewUrl(selected, device, guestMode, defaultPreviewEmail)
  const previewAccount = guestMode ? 'Guest preview' : defaultPreviewEmail

  return (
    <div className={`windows-screen ${device === 'web' ? 'web-preview-layout' : 'mobile-preview-layout'}`}>
      <div className="device-switchbar" aria-label="Preview device">
        <div className="device-tabs">
          {(['ios', 'android', 'tablet', 'web'] as DeviceKey[]).map((item) => (
            <button
              key={item}
              type="button"
              className={device === item ? 'active' : undefined}
              onClick={() => setDevice(item)}
            >
              {item === 'ios' ? 'iOS' : item === 'web' ? 'Web' : item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <section className="window-control">
        <div className="window-toolbar">
          <button type="button" className={guestMode ? 'solid-green' : ''} onClick={() => setGuestMode((value) => !value)}>
            {guestMode ? 'Guest mode: ON' : 'Guest mode: OFF'}
          </button>
          <span>0 items hidden from players</span>
          <button type="button">↺ Reset to defaults</button>
        </div>
        <div className="preview-email-field preview-member-card">
          <span>Preview member</span>
          <strong>{defaultPreviewEmail}</strong>
          <small>Used by the live cloud preview session</small>
        </div>
        <div className="panel-card window-list">
          <div className="panel-title">Windows</div>
          {windowModel.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === selected ? 'selected' : undefined}
              onClick={() => setSelected(item.key)}
            >
              <i>{item.icon}</i>
              <span>
                <strong>{item.label}</strong>
                <small>{item.sections.length} sections shown</small>
              </span>
              <em>Visible</em>
              <b>●</b>
              <b>🔓</b>
            </button>
          ))}
        </div>
        <div className="panel-card window-list section-list">
          <div className="panel-title">{current.label} · sections</div>
          {current.sections.map((section) => (
            <button key={section} type="button">
              <i />
              <span><strong>{section}</strong></span>
              <em>Shown</em>
              <b>●</b>
              <b>🔓</b>
              <b>✎</b>
              <b>↑</b>
              <b>↓</b>
            </button>
          ))}
        </div>
      </section>

      <section className="device-preview">
        <div className="preview-panel">
          <div className="preview-stage">
            <div className={`device-frame ${device}`}>
              <div className="device-screen">
                <div className="device-status">
                  <span>{device === 'web' ? 'Live web' : '9:41'}</span>
                  <b>{device === 'web' ? previewHostLabel(previewUrl) : 'JuChess'}</b>
                  <span>{device === 'web' ? 'Desktop' : '▰▰'}</span>
                </div>
                <iframe
                  key={`${device}-${selected}-${guestMode ? 'guest' : 'member'}-${previewAccount}`}
                  className="live-app-frame"
                  src={previewUrl}
                  title={`Live ${current.label} app preview`}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function TournamentsScreen({
  dataSource,
  onChanged,
  session,
  tournaments,
}: {
  dataSource: TournamentDataSource
  onChanged: () => Promise<void>
  session: AdminSession
  tournaments: AdminTournament[]
}) {
  const [tab, setTab] = useState<TournamentTab>('upcoming')
  const [showCreate, setShowCreate] = useState(false)
  const [createStep, setCreateStep] = useState(0)
  const [editingTournament, setEditingTournament] = useState<AdminTournament | null>(null)
  const [manageTournamentKey, setManageTournamentKey] = useState('')
  const [form, setForm] = useState<TournamentInput>(() => createInitialTournamentForm())
  const [timeCategory, setTimeCategory] = useState('Rapid')
  const [timeMinutes, setTimeMinutes] = useState('15')
  const [timeIncrement, setTimeIncrement] = useState('10')
  const [timeDelay, setTimeDelay] = useState('0')
  const [gamesPerMatch, setGamesPerMatch] = useState('1')
  const [selectedTournamentKey, setSelectedTournamentKey] = useState('')
  const [registrations, setRegistrations] = useState<AdminRegistration[]>([])
  const [registrationsLoading, setRegistrationsLoading] = useState(false)
  const [registrationActionId, setRegistrationActionId] = useState<string | null>(null)
  const [managedRegistrations, setManagedRegistrations] = useState<AdminRegistration[]>([])
  const [managedRegistrationsLoading, setManagedRegistrationsLoading] = useState(false)
  const [shuffleSeeds, setShuffleSeeds] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const counts: Record<TournamentTab, number> = {
    draft: tournaments.filter((item) => item.status === 'draft').length,
    upcoming: tournaments.filter((item) => item.status === 'upcoming').length,
    active: tournaments.filter((item) => item.status === 'active').length,
    completed: tournaments.filter((item) => item.status === 'completed').length,
    archived: tournaments.filter((item) => item.status === 'archived').length,
  }
  const filtered = tournaments.filter((item) => item.status === tab)
  const selectedTournament = filtered.find((item) => tournamentKey(item) === selectedTournamentKey) ?? filtered[0] ?? null
  const managedTournament = tournaments.find((item) => tournamentKey(item) === manageTournamentKey) ?? null
  const createEnabled = tab === 'draft'
  const canSaveDraft = Boolean(form.name.trim() && form.format.trim()) && !submitting
  const isEditing = Boolean(editingTournament)
  const showRegistrationQueue = tab !== 'completed' && tab !== 'archived' && !managedTournament
  const selectedTournamentRowId = showRegistrationQueue ? selectedTournament?.rowId : undefined

  useEffect(() => {
    if (!filtered.length) {
      if (selectedTournamentKey) setSelectedTournamentKey('')
      return
    }

    if (!filtered.some((item) => tournamentKey(item) === selectedTournamentKey)) {
      setSelectedTournamentKey(tournamentKey(filtered[0]))
    }
  }, [filtered, selectedTournamentKey])

  useEffect(() => {
    if (tab !== 'draft' && showCreate) {
      if (!isEditing) {
        setShowCreate(false)
        setCreateStep(0)
      }
    }
  }, [isEditing, showCreate, tab])

  useEffect(() => {
    setManageTournamentKey('')
  }, [tab])

  useEffect(() => {
    let alive = true

    async function loadQueue() {
      if (!selectedTournamentRowId) {
        setRegistrations([])
        setRegistrationsLoading(false)
        return
      }

      setRegistrationsLoading(true)
      const result = await loadTournamentRegistrations(selectedTournamentRowId)
      if (!alive) return
      setRegistrations(result.registrations)
      if (result.error) setMessage('Registration queue is unavailable right now.')
      setRegistrationsLoading(false)
    }

    void loadQueue()

    return () => {
      alive = false
    }
  }, [selectedTournamentRowId])

  useEffect(() => {
    let alive = true

    async function loadManagedRegistrations() {
      if (!managedTournament?.rowId) {
        setManagedRegistrations([])
        setManagedRegistrationsLoading(false)
        return
      }

      setManagedRegistrationsLoading(true)
      const [result, checkIns] = await Promise.all([
        loadTournamentRegistrations(managedTournament.rowId),
        loadTournamentCheckIns(managedTournament.rowId),
      ])
      if (!alive) return

      // Codes are stored outside the registration row, so join them back on.
      const codeByProfile = new Map(checkIns.map((entry) => [entry.profileId, entry]))
      setManagedRegistrations(result.registrations
        .filter((item) => item.status !== 'cancelled')
        .map((item) => {
          const entry = codeByProfile.get(item.profileId)
          return entry ? { ...item, checkInCode: entry.code, checkedIn: entry.checkedIn } : item
        }))
      if (result.error) setMessage('Tournament participants are unavailable right now.')
      setManagedRegistrationsLoading(false)
    }

    void loadManagedRegistrations()

    return () => {
      alive = false
    }
  }, [managedTournament?.rowId])

  function update<K extends keyof TournamentInput>(key: K, value: TournamentInput[K]) {
    setForm((current) => {
      if (key === 'format' && typeof value === 'string') {
        return { ...current, format: value }
      }

      return { ...current, [key]: value }
    })
  }

  function resetCreateForm() {
    setEditingTournament(null)
    setCreateStep(0)
    setForm(createInitialTournamentForm())
    setTimeCategory('Rapid')
    setTimeMinutes('15')
    setTimeIncrement('10')
    setTimeDelay('0')
    setGamesPerMatch('1')
  }

  function openCreatePanel() {
    if (!createEnabled) {
      setMessage('Create tournament is available only in Draft.')
      return
    }

    resetCreateForm()
    setShowCreate(true)
    setMessage(null)
  }

  function openEditPanel(item: AdminTournament) {
    setEditingTournament(item)
    setCreateStep(0)
    setForm(tournamentToEditForm(item))
    syncTimeStateFromControl(item.timeControl)
    setShowCreate(true)
    setMessage(null)
  }

  function closeCreatePanel() {
    setShowCreate(false)
    setCreateStep(0)
    setEditingTournament(null)
  }

  function syncTimeStateFromControl(value: string) {
    const match = value.match(/^(\d+)\+(\d+)\s*(.*)$/)
    if (!match) {
      setTimeCategory(value || 'Rapid')
      setTimeMinutes('15')
      setTimeIncrement('10')
      setTimeDelay('0')
      setGamesPerMatch('1')
      return
    }

    setTimeMinutes(match[1])
    setTimeIncrement(match[2])
    setTimeCategory(match[3] || 'Rapid')
    setTimeDelay('0')
    setGamesPerMatch('1')
  }

  function setTimeSelection(next: Partial<{ category: string; minutes: string; increment: string; delay: string; games: string }>) {
    const category = next.category ?? timeCategory
    const minutes = next.minutes ?? timeMinutes
    const increment = next.increment ?? timeIncrement
    const delay = next.delay ?? timeDelay
    const games = next.games ?? gamesPerMatch

    setTimeCategory(category)
    setTimeMinutes(minutes)
    setTimeIncrement(increment)
    setTimeDelay(delay)
    setGamesPerMatch(games)
    update('timeControl', `${minutes || '0'}+${increment || '0'} ${category}`)
  }

  async function refreshRegistrationQueue() {
    if (!selectedTournamentRowId) {
      setRegistrations([])
      return
    }

    setRegistrationsLoading(true)
    const result = await loadTournamentRegistrations(selectedTournamentRowId)
    setRegistrations(result.registrations)
    if (result.error) setMessage('Registration queue is unavailable right now.')
    setRegistrationsLoading(false)
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isEditing && !createEnabled) {
      setMessage('Create tournament is available only in Draft.')
      setShowCreate(false)
      return
    }

    const name = form.name.trim()
    const format = form.format.trim()
    if (!name || !format) {
      setMessage('Tournament name and format are required.')
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      const payload: TournamentInput = {
        ...form,
        name,
        format,
        slug: form.slug.trim()
          || buildUniqueTournamentSlugBase(name, tournaments, editingTournament?.rowId),
        status: isEditing ? form.status : 'draft',
        timeControl: `${timeMinutes || '0'}+${timeIncrement || '0'} ${timeCategory}`,
      }

      if (editingTournament?.rowId) {
        await updateTournament(editingTournament.rowId, payload)
        setMessage('Tournament updated.')
      } else {
        await createTournament({
          ...payload,
          createdByProfileId: session.profile?.$id,
        })
        setMessage('Tournament saved as draft.')
      }
      resetCreateForm()
      closeCreatePanel()
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusChange(item: AdminTournament, status: TournamentTab) {
    if (!item.rowId) {
      setMessage('Only cloud tournaments can be updated.')
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      await updateTournament(item.rowId, { status })
      setMessage('Tournament status updated.')
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setSubmitting(false)
    }
  }

  function handlePhotos(item: AdminTournament) {
    setMessage(`${item.name} media tools are not connected yet.`)
  }

  function handleShufflePairings(item: AdminTournament) {
    const key = tournamentKey(item)
    if (item.publishedGames > 0) {
      setMessage(`${item.name} is published. Shuffle is locked.`)
      return
    }

    setShuffleSeeds((current) => ({ ...current, [key]: (current[key] ?? 0) + 1 }))
    setMessage(isKnockoutTournament(item) ? `${item.name} bracket shuffled.` : `${item.name} pairings shuffled.`)
  }

  async function handlePublishPairings(item: AdminTournament, games: PairingPublishInput[], bracketSnapshot?: string) {
    if (!item.rowId) {
      setMessage('Only cloud tournaments can publish pairings.')
      return
    }

    if (usesSwissPublishFlow(item) && item.status !== 'active') {
      setMessage(`${item.name} pairings are published after the tournament is moved to Active.`)
      return
    }

    if (!usesSwissPublishFlow(item) && item.status !== 'upcoming') {
      setMessage(`${item.name} pairings are published from Upcoming management.`)
      return
    }

    if (item.publishedGames > 0) {
      setMessage(`${item.name} is published. Shuffle is locked.`)
      return
    }

    if (!games.length) {
      setMessage('Add at least two registered players before publishing pairings.')
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      await publishTournamentPairings(item.rowId, games, bracketSnapshot)
      setMessage(isKnockoutTournament(item) ? `${item.name} bracket published. Shuffle is locked.` : `${item.name} pairings published. Shuffle is locked.`)
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUnpublishPairings(item: AdminTournament) {
    if (!item.rowId) {
      setMessage('Only cloud tournaments can unpublish pairings.')
      return
    }

    if (item.publishedGames <= 0) {
      setMessage(`${item.name} is not published.`)
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      const deleted = await unpublishTournamentPairings(item.rowId)
      setMessage(`${item.name} unpublished. ${deleted} games removed and shuffle is unlocked.`)
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setSubmitting(false)
    }
  }

  function openManagePanel(item: AdminTournament) {
    setManageTournamentKey(tournamentKey(item))
    setMessage(null)
  }

  async function handleRegistrationStatus(item: AdminRegistration, status: AdminRegistrationStatus) {
    setRegistrationActionId(item.rowId)
    setMessage(null)

    try {
      await updateRegistrationStatus(item.rowId, { status })
      setMessage('Registration updated.')
      await refreshRegistrationQueue()
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setRegistrationActionId(null)
    }
  }

  async function handleRegistrationCheckIn(item: AdminRegistration, checkedIn: boolean) {
    setRegistrationActionId(item.rowId)
    setMessage(null)

    try {
      await updateRegistrationStatus(item.rowId, { checkedIn })
      setMessage(checkedIn ? 'Player checked in.' : 'Check-in cleared.')
      await refreshRegistrationQueue()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setRegistrationActionId(null)
    }
  }

  async function handleGameResult(input: {
    gameId?: string
    tournamentId?: string
    round?: number
    board?: number
    result: '1-0' | '0-1' | '1/2-1/2' | '*'
    status?: 'live' | 'completed'
    pgn?: string
  }) {
    setSubmitting(true)
    setMessage(null)

    try {
      await submitTournamentGameResult(input)
      setMessage(input.status === 'completed' ? 'Result saved and standings updated.' : 'Live game saved.')
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleProcedureConfigure(item: AdminTournament, physicalBoards: number) {
    if (!item.rowId) {
      setMessage('Only cloud tournaments can save a procedure plan.')
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      const outcome = await configureTournamentProcedure(item.rowId, physicalBoards)
      setMessage(`${outcome.physicalBoards} physical boards saved. ${outcome.updatedGames} game assignments updated.`)
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGameStart(gameId: string, physicalBoard: number) {
    setSubmitting(true)
    setMessage(null)
    try {
      await startTournamentGame(gameId, physicalBoard)
      setMessage(`Game started on physical board ${physicalBoard}.`)
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
      throw error
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGamePgn(gameId: string, pgn: string) {
    setSubmitting(true)
    setMessage(null)
    try {
      await updateTournamentGamePgn(gameId, pgn)
      setMessage('PGN saved. The recorded result was not changed.')
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
      throw error
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAdvanceRound(item: AdminTournament) {
    if (!item.rowId) {
      setMessage('Only cloud tournaments can advance rounds.')
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      const outcome = await advanceTournamentRound(item.rowId)
      setMessage(
        outcome.completed
          ? `${item.name} is complete.`
          : outcome.stageTwo
          ? `Stage two bracket is ready. Round ${outcome.currentRound} pairings are live.`
          : outcome.advanced
          ? `Round ${outcome.currentRound} pairings are live.`
          : outcome.reason ?? 'The round is not ready to advance yet.',
      )
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setSubmitting(false)
    }
  }

  if (managedTournament) {
    return (
      <div className="tournament-screen">
        <TournamentManageView
          disabled={submitting}
          onAdvanceRound={handleAdvanceRound}
          onBack={() => setManageTournamentKey('')}
          onComplete={(item) => {
            void handleStatusChange(item, 'completed')
            setManageTournamentKey('')
          }}
          onMessage={setMessage}
          onGameResult={handleGameResult}
          onGamePgn={handleGamePgn}
          onGameStart={handleGameStart}
          onPublish={handlePublishPairings}
          onProcedureConfigure={handleProcedureConfigure}
          onShuffle={handleShufflePairings}
          onUnpublish={handleUnpublishPairings}
          participants={managedRegistrations}
          participantsLoading={managedRegistrationsLoading}
          published={managedTournament.publishedGames > 0}
          shuffleSeed={shuffleSeeds[tournamentKey(managedTournament)] ?? 0}
          tournament={managedTournament}
        />
        {message ? <div className="prototype-note" role="status">{message}</div> : null}
      </div>
    )
  }

  return (
    <div className="tournament-screen">
      <div className="center-tabs">
        {tournamentTabs.map((item) => (
          <button key={item} type="button" className={tab === item ? 'active' : undefined} onClick={() => setTab(item)}>
            {capitalize(item)} <span>{counts[item]}</span>
          </button>
        ))}
      </div>
      <div className="table-toolbar">
        <span>{tabDescription(tab)} · {dataSource === 'cloud' ? 'Live cloud' : 'Cloud unavailable'}</span>
        <button
          type="button"
          className="primary-button"
          disabled={!createEnabled}
          onClick={openCreatePanel}
          title={createEnabled ? 'Create a draft tournament' : 'Switch to Draft to create a tournament'}
        >
          <span>+</span> Create tournament
        </button>
      </div>
      {showCreate ? (
        <div className="create-modal-backdrop" onClick={closeCreatePanel}>
          <form className="create-modal" onClick={(event) => event.stopPropagation()} onSubmit={handleCreate}>
            <header className="create-modal-head">
              <div>
                <strong>{isEditing ? 'Edit tournament' : 'Create tournament'}</strong>
                <span>{isEditing ? 'Tournament setup' : 'Draft setup wizard'}</span>
              </div>
              <button type="button" aria-label="Close create tournament" onClick={closeCreatePanel}>×</button>
            </header>
            <nav className="create-step-tabs" aria-label="Create tournament steps">
              {createSteps.map((step, index) => (
                <button
                  key={step}
                  type="button"
                  className={createStep === index ? 'active' : undefined}
                  onClick={() => setCreateStep(index)}
                >
                  {step}
                </button>
              ))}
            </nav>
            <div className="create-step-body">
              {createStep === 0 ? (
                <div className="create-grid">
                  <label className="wide">
                    Tournament name
                    <input
                      value={form.name}
                      onChange={(event) => update('name', event.target.value)}
                      placeholder="Spring Rapid Open"
                      required
                    />
                  </label>
                  <label className="wide">Description<textarea value={form.description ?? ''} onChange={(event) => update('description', event.target.value)} placeholder="Short description..." rows={3} /></label>
                  <label>Number of players<input type="number" min={2} value={form.capacity ?? ''} onChange={(event) => update('capacity', Number(event.target.value))} /></label>
                  <label>
                    Location / platform
                    <input
                      value={form.location ?? ''}
                      onChange={(event) => update('location', event.target.value)}
                      placeholder="Type venue / platform..."
                    />
                  </label>
                  <label>Start date / time<input type="datetime-local" value={toDateTimeLocalValue(form.startsAt)} onChange={(event) => update('startsAt', fromDateTimeLocalValue(event.target.value))} /></label>
                  <label>Registration deadline<input type="datetime-local" /></label>
                  <div className="create-upload wide">
                    <span>Tournament design image</span>
                    <strong>Attach design later from tournament media</strong>
                  </div>
                </div>
              ) : null}
              {createStep === 1 ? (
                <div className="format-time-window">
                  <div>
                    <div className="create-section-label">Choose a tournament format</div>
                    <div className="format-card-grid">
                      {formatOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={form.format === option.value ? 'active' : undefined}
                          onClick={() => update('format', option.value)}
                        >
                          <span>{option.icon}</span>
                          <strong>{option.value}</strong>
                          <small>{option.layout}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="format-time-panel">
                    <div className="create-section-label">Time control</div>
                    <div className="create-grid compact-time-grid">
                      <div className="create-field wide">
                        <span>Time control category</span>
                        <div className="create-chip-row">
                          {timeOptions.map((option) => (
                            <button
                              key={option.label}
                              type="button"
                              className={timeCategory === option.label ? 'active' : undefined}
                              onClick={() => setTimeSelection({ category: option.label, minutes: option.minutes, increment: option.increment })}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <label>Initial minutes<input value={timeMinutes} onChange={(event) => setTimeSelection({ minutes: event.target.value })} placeholder="15" /></label>
                      <label>Increment (seconds)<input value={timeIncrement} onChange={(event) => setTimeSelection({ increment: event.target.value })} placeholder="10" /></label>
                      <label>Delay (seconds)<input value={timeDelay} onChange={(event) => setTimeSelection({ delay: event.target.value })} placeholder="0" /></label>
                      <label>Games per match<input value={gamesPerMatch} onChange={(event) => setTimeSelection({ games: event.target.value })} placeholder="1" /></label>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <footer className="create-modal-actions">
              <button
                type="button"
                className="secondary-action"
                disabled={createStep === 0}
                onClick={() => setCreateStep((step) => Math.max(0, step - 1))}
              >
                ← Back
              </button>
              <div>
                {createStep < createSteps.length - 1 ? (
                  <button type="button" className="dark-action" onClick={() => setCreateStep((step) => Math.min(createSteps.length - 1, step + 1))}>
                    Next →
                  </button>
                ) : (
                  <button type="submit" className="primary-action" disabled={!canSaveDraft}>
                    {submitting ? 'Saving...' : isEditing ? 'Save changes' : 'Save Draft'}
                  </button>
                )}
              </div>
            </footer>
          </form>
        </div>
      ) : null}
      {message ? <div className="prototype-note" role="status">{message}</div> : null}
      <section className="panel-card table-card">
        {filtered.length ? (
          <TournamentTable
            disabled={submitting}
            onEdit={openEditPanel}
            onManage={openManagePanel}
            onPhotos={handlePhotos}
            onStatusChange={handleStatusChange}
            rows={filtered}
          />
        ) : (
          <EmptyState title={emptyTitle(tab)} body="Create one to get started." />
        )}
      </section>
      {showRegistrationQueue ? (
        <RegistrationQueue
          actionId={registrationActionId}
          loading={registrationsLoading}
          onCheckInChange={handleRegistrationCheckIn}
          onSelectedChange={setSelectedTournamentKey}
          onStatusChange={handleRegistrationStatus}
          registrations={registrations}
          selectedTournament={selectedTournament}
          selectedTournamentKey={selectedTournament ? tournamentKey(selectedTournament) : ''}
          tournaments={filtered}
        />
      ) : null}
    </div>
  )
}

function TournamentTable({
  disabled,
  onEdit,
  onManage,
  onPhotos,
  onStatusChange,
  rows,
}: {
  disabled: boolean
  onEdit: (item: AdminTournament) => void
  onManage: (item: AdminTournament) => void
  onPhotos: (item: AdminTournament) => void
  onStatusChange: (item: AdminTournament, status: TournamentTab) => Promise<void>
  rows: AdminTournament[]
}) {
  return (
    <div className="table-scroll">
      <table className="prototype-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Location</th>
            <th>Format</th>
            <th>Time control</th>
            <th>Players</th>
            <th>Status</th>
            <th>Start date</th>
            <th className="right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={tournamentKey(item)}>
              <td><strong>{item.name}</strong></td>
              <td>{item.location || 'Not set'}</td>
              <td><span className="tag">{item.format}</span></td>
              <td><b>{item.timeControl}</b></td>
              <td className="mono center">{item.players}/{item.capacity || 'open'}</td>
              <td><StatusPill status={item.status} /></td>
              <td><strong>{formatDate(item.startsAt)}</strong><small>{formatTime(item.startsAt)}</small></td>
              <td className="right">
                <div className="tournament-action-row">
                  <TournamentActionButtons
                    disabled={disabled || !item.rowId}
                    item={item}
                    onEdit={onEdit}
                    onManage={onManage}
                    onPhotos={onPhotos}
                    onStatusChange={onStatusChange}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TournamentActionButtons({
  disabled,
  item,
  onEdit,
  onManage,
  onPhotos,
  onStatusChange,
}: {
  disabled: boolean
  item: AdminTournament
  onEdit: (item: AdminTournament) => void
  onManage: (item: AdminTournament) => void
  onPhotos: (item: AdminTournament) => void
  onStatusChange: (item: AdminTournament, status: TournamentTab) => Promise<void>
}) {
  if (item.status === 'draft') {
    return (
      <>
        <button type="button" className="mini-button ghost" disabled={disabled} onClick={() => onEdit(item)}>Edit</button>
        <button type="button" className="mini-button" disabled={disabled} onClick={() => void onStatusChange(item, 'upcoming')}>Publish</button>
      </>
    )
  }

  if (item.status === 'upcoming') {
    return (
      <>
        <button type="button" className="mini-button dark" disabled={disabled} onClick={() => onManage(item)}>Manage</button>
        <button type="button" className="mini-button ghost" disabled={disabled} onClick={() => onEdit(item)}>Edit</button>
        <button type="button" className="mini-button ghost" disabled={disabled} onClick={() => void onStatusChange(item, 'draft')}>Draft</button>
        <button type="button" className="mini-button" disabled={disabled} onClick={() => void onStatusChange(item, 'active')}>Active</button>
      </>
    )
  }

  if (item.status === 'active') {
    return (
      <>
        <button type="button" className="mini-button dark" disabled={disabled} onClick={() => onManage(item)}>Manage</button>
        <button type="button" className="mini-button ghost" disabled={disabled} onClick={() => onEdit(item)}>Edit</button>
        <button type="button" className="mini-button ghost" disabled={disabled} onClick={() => void onStatusChange(item, 'upcoming')}>Upcoming</button>
        <button type="button" className="mini-button ghost" disabled={disabled} onClick={() => void onStatusChange(item, 'completed')}>Complete</button>
      </>
    )
  }

  if (item.status === 'completed') {
    return (
      <>
        <button type="button" className="mini-button dark" disabled={disabled} onClick={() => onManage(item)}>Manage</button>
        <button type="button" className="mini-button ghost" disabled={disabled} onClick={() => onEdit(item)}>Edit</button>
        <button type="button" className="mini-button" disabled={disabled} onClick={() => onPhotos(item)}>Photos</button>
        <button type="button" className="mini-button warn" disabled={disabled} onClick={() => void onStatusChange(item, 'archived')}>Archive</button>
      </>
    )
  }

  return (
    <button type="button" className="mini-button ghost" disabled={disabled} onClick={() => void onStatusChange(item, 'completed')}>
      Completed
    </button>
  )
}

function TournamentManageView({
  disabled,
  onAdvanceRound,
  onBack,
  onComplete,
  onGamePgn,
  onGameResult,
  onGameStart,
  onMessage,
  onPublish,
  onProcedureConfigure,
  onShuffle,
  onUnpublish,
  participants,
  participantsLoading,
  published,
  shuffleSeed,
  tournament,
}: {
  disabled: boolean
  onAdvanceRound: (item: AdminTournament) => Promise<void>
  onBack: () => void
  onComplete: (item: AdminTournament) => void
  onGamePgn: (gameId: string, pgn: string) => Promise<void>
  onGameResult: (input: {
    gameId?: string
    tournamentId?: string
    round?: number
    board?: number
    result: '1-0' | '0-1' | '1/2-1/2' | '*'
    status?: 'live' | 'completed'
    pgn?: string
  }) => Promise<void>
  onGameStart: (gameId: string, physicalBoard: number) => Promise<void>
  onMessage: (message: string) => void
  onPublish: (item: AdminTournament, games: PairingPublishInput[], bracketSnapshot?: string) => void
  onProcedureConfigure: (item: AdminTournament, physicalBoards: number) => Promise<void>
  onShuffle: (item: AdminTournament) => void
  onUnpublish: (item: AdminTournament) => void
  participants: AdminRegistration[]
  participantsLoading: boolean
  published: boolean
  shuffleSeed: number
  tournament: AdminTournament
}) {
  const knockout = isKnockoutTournament(tournament)
  const multiStage = isMultiStageTournament(tournament)
  const swissFlow = usesSwissPublishFlow(tournament)
  const roundRobin = isRoundRobinTournament(tournament)
  const playStage = knockout ? 'bracket' : 'rounds'
  const manageStages = multiStage
    ? [
        { key: 'participants', label: 'Participants' },
        { key: 'rounds', label: 'Phase One' },
        { key: 'bracket', label: 'Phase Two' },
        { key: 'procedure', label: 'Procedure' },
        { key: 'standings', label: 'Standings' },
      ]
    : knockout
    ? [
        { key: 'participants', label: 'Participants' },
        { key: playStage, label: capitalize(playStage) },
        { key: 'procedure', label: 'Procedure' },
      ]
    : [
        { key: 'participants', label: 'Participants' },
        { key: playStage, label: capitalize(playStage) },
        { key: 'procedure', label: 'Procedure' },
        { key: 'standings', label: 'Standings' },
      ]
  const [stage, setStage] = useState(playStage)
  const [bracketView, setBracketView] = useState<AdminBracketView>('winners')
  const [selectedBoardKey, setSelectedBoardKey] = useState('')
  const [physicalBoards, setPhysicalBoards] = useState(tournament.physicalBoards || 3)
  const liveBoardRef = useRef<HTMLElement | null>(null)
  const bracketPhase = getBracketPhase(tournament)
  const tournamentPlayers = useMemo(() => buildTournamentPlayers(tournament, shuffleSeed, participants), [participants, shuffleSeed, tournament])
  const pairings = useMemo(() => buildTournamentPairingSchedule(tournament, tournamentPlayers, shuffleSeed), [shuffleSeed, tournament, tournamentPlayers])
  const currentRoundPairings = useMemo(() => currentRoundPairingsForTournament(tournament, pairings), [pairings, tournament])
  const pairingRounds = useMemo(() => groupPairingsByRound(pairings), [pairings])
  const savedBracketConfig = useMemo(() => (
    published ? parsePublishedAdminBracketSnapshot(tournament.bracketSnapshot) : null
  ), [published, tournament.bracketSnapshot])
  const generatedBracketConfig = useMemo(() => (
    knockout
      ? buildAdminBracketConfig(tournament, tournamentPlayers, bracketPhase, shuffleSeed)
      : multiStage
      ? buildAdminMultiStageBracketConfig(tournament, tournamentPlayers, bracketPhase, shuffleSeed)
      : null
  ), [bracketPhase, knockout, multiStage, shuffleSeed, tournament, tournamentPlayers])
  const bracketConfig = savedBracketConfig ?? generatedBracketConfig
  const activeBracketRounds = bracketConfig?.type === 'double'
    ? bracketConfig.brackets[bracketView]
    : bracketConfig?.rounds ?? []
  const allBracketRounds = useMemo(() => (
    bracketConfig ? getAllAdminBracketRounds(bracketConfig) : []
  ), [bracketConfig])
  const liveBoardRounds = tournament.status === 'active' ? allBracketRounds : EMPTY_ADMIN_BRACKET_ROUNDS
  const cloudGameBoards = useMemo(
    () => buildPlayableBoardsFromAdminGames(tournament.publishedGameRows),
    [tournament],
  )
  const hasPublishedGames = tournament.publishedGameRows.length > 0
  const playableBoards = useMemo(() => (knockout || (multiStage && stage === 'bracket')
    ? hasPublishedGames
      ? cloudGameBoards
      : buildPlayableBracketBoards(liveBoardRounds)
    : hasPublishedGames
      ? cloudGameBoards
      : buildPlayableBoardsFromPairings(currentRoundPairings)
  ), [cloudGameBoards, currentRoundPairings, hasPublishedGames, liveBoardRounds, knockout, multiStage, stage])
  const procedureMatches = useMemo(() => (
    stage !== 'procedure'
      ? []
      : tournament.publishedGameRows.length
      ? buildProcedureMatchesFromAdminGames(tournament, tournament.publishedGameRows, roundRobin || tournament.status === 'completed')
      : knockout || (multiStage && isMultiStagePhaseTwo(tournament))
      ? buildProcedureMatchesFromBracket(allBracketRounds)
      : buildProcedureMatchesFromPairings(
        roundRobin ? pairings : currentRoundPairings,
        tournament,
      )
  ), [allBracketRounds, currentRoundPairings, knockout, multiStage, pairings, roundRobin, stage, tournament])
  const procedureQueue = useMemo(() => (
    stage === 'procedure'
      ? buildProcedureQueue(procedureMatches, physicalBoards)
      : { tables: [], waiting: [], finished: [], byes: [], currentRoundFinished: 0, currentRoundTotal: 0, waves: [] }
  ), [physicalBoards, procedureMatches, stage])
  const procedurePlanMissing = tournament.publishedGameRows.some((game) => (
    game.blackProfileId !== 'system_bye' && (!game.procedureWave || !game.physicalBoard || !game.queuePosition)
  ))
  const liveBoardOptions: LiveBoardOption[] = useMemo(() => (
    stage === 'procedure'
      ? buildPlayableBoardsFromProcedureMatches(procedureMatches)
      : playableBoards
  ), [playableBoards, procedureMatches, stage])
  const publishableGames = useMemo(() => buildPublishableGames(
    knockout ? firstBracketRoundPairings(allBracketRounds) : pairings,
    'scheduled',
  ), [allBracketRounds, knockout, pairings])
  const hasStartedGames = allBracketRounds.some((round) => (
    round.matches.some((match) => match.live || match.winner)
  ))
  const canPublishPairings = tournament.status === 'upcoming' ? !swissFlow : tournament.status === 'active' && swissFlow
  const canShufflePairings = tournament.status === 'upcoming' || (tournament.status === 'active' && swissFlow)
  const shuffleLocked = disabled || participantsLoading || published || !canShufflePairings
  const publishLocked = disabled || participantsLoading || published || !publishableGames.length || !canPublishPairings

  function publishPairings() {
    const bracketSnapshot = knockout && generatedBracketConfig
      ? buildPublishedAdminBracketSnapshot(generatedBracketConfig, tournament, tournamentPlayers.length)
      : undefined
    onPublish(tournament, publishableGames, bracketSnapshot)
  }

  useEffect(() => {
    setStage(playStage)
    setBracketView('winners')
    setPhysicalBoards(tournament.physicalBoards || 3)
  }, [playStage, tournament.physicalBoards, tournament.rowId, tournament.id])

  useEffect(() => {
    if (!liveBoardOptions.length) {
      if (selectedBoardKey) setSelectedBoardKey('')
      return
    }

    if (!liveBoardOptions.some((board) => board.boardKey === selectedBoardKey)) {
      setSelectedBoardKey(liveBoardOptions[0].boardKey)
    }
  }, [liveBoardOptions, selectedBoardKey])

  function selectLiveBoard(boardKey: string) {
    const board = liveBoardOptions.find((item) => item.boardKey === boardKey)
    if (!board) return

    setSelectedBoardKey(board.boardKey)
    onMessage(`${board.boardLabel} selected for move entry.`)
    window.setTimeout(() => {
      liveBoardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  async function saveLiveBoardResult(board: LiveBoardOption, state: LiveBoardState) {
    const result = normalizeAdminBoardResult(state.result)
    const pgn = state.moves.length ? pgnFromMoves(state.moves) : undefined

    if (board.completed) {
      if (!board.gameId || !pgn) {
        onMessage('Enter or import moves before saving PGN for this finished game.')
        return
      }
      await onGamePgn(board.gameId, pgn)
      return
    }

    if (!board.gameId && (!tournament.rowId || !board.round || !board.board)) {
      onMessage('This board is not published as a game yet.')
      return
    }

    await onGameResult({
      gameId: board.gameId,
      tournamentId: tournament.rowId,
      round: board.round,
      board: board.board,
      result,
      status: result === '*' ? 'live' : 'completed',
      pgn,
    })
  }

  async function startProcedureMatch(match: ProcedureMatch, physicalBoard: number) {
    if (!match.gameId) {
      onMessage('Save the procedure plan before starting this game.')
      return
    }
    try {
      await onGameStart(match.gameId, physicalBoard)
      setSelectedBoardKey(match.boardKey)
      window.setTimeout(() => {
        liveBoardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 0)
    } catch {
      // The parent already surfaces the server error in the management notice.
    }
  }

  const manageMode = tournament.status === 'upcoming'
    ? 'Prepare Tournament'
    : tournament.status === 'completed'
    ? 'Review Tournament'
    : 'Live Tournament'
  const publishState = published
    ? 'Published - shuffle locked'
    : swissFlow && tournament.status === 'upcoming'
    ? `${tournament.format} pairings publish after moving to Active`
    : roundRobin
    ? `${pairingRounds.length} rounds ready`
    : 'Draft pairings'

  return (
    <div className="tournament-manage-view">
      <button type="button" className="manage-back-button" onClick={onBack}>← Back to tournaments</button>
      <div className="manage-hero">
        <div>
          <div className="manage-title-row">
            <h2>{tournament.name}</h2>
            <StatusPill status={tournament.status} />
          </div>
          <span className="manage-mode">{manageMode}</span>
          <p>{tournament.format} · {tournament.capacity || 'open'} players · {tournament.timeControl}</p>
        </div>
        <div className="manage-controls">
          {tournament.status === 'upcoming' || (tournament.status === 'active' && swissFlow) ? (
            <>
              <button type="button" className="mini-button ghost" disabled={shuffleLocked} onClick={() => onShuffle(tournament)}>
                Shuffle
              </button>
              {canPublishPairings ? (
                <button type="button" className="mini-button dark" disabled={publishLocked} onClick={publishPairings}>
                  {published ? 'Published' : 'Publish'}
                </button>
              ) : (
                <button type="button" className="mini-button dark" disabled>
                  Publish in Active
                </button>
              )}
              {published ? (
                <button type="button" className="mini-button warn" disabled={disabled} onClick={() => onUnpublish(tournament)}>
                  Unpublish
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button type="button" className="mini-button" disabled={disabled} onClick={() => void onAdvanceRound(tournament)}>Advance round</button>
              <button type="button" className="mini-button dark" disabled={disabled} onClick={() => onComplete(tournament)}>Complete tournament</button>
            </>
          )}
        </div>
      </div>

      <div className="manage-nav">
        {manageStages.map((item) => (
          <button key={item.key} type="button" className={stage === item.key ? 'active' : undefined} onClick={() => setStage(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      <section className={`manage-panel ${stage === 'bracket' ? 'website-bracket-host' : ''}`}>
        {stage === 'participants' ? (
          <>
            <div className="manage-panel-head">Participants</div>
            {participantsLoading ? (
              <div className="empty-row">Loading participants...</div>
            ) : tournamentPlayers.length ? tournamentPlayers.map((player, index) => (
              <div key={player.id} className="manage-row">
                <strong>{index + 1}. {player.name}</strong>
                <span>{player.rating}</span>
              </div>
            )) : (
              <EmptyState title="No registered players" body="Players must register before pairings can be published." />
            )}
          </>
        ) : null}
        {stage === 'rounds' ? (
          <>
            <div className="manage-panel-head">
              <strong>{multiStage ? 'Phase One - Swiss rounds' : roundRobin ? 'Full round schedule' : tournament.status === 'upcoming' ? 'Round 1 pairings' : 'Live — current round'}</strong>
              <span>{publishState}</span>
            </div>
            {participantsLoading ? (
              <div className="empty-row">Loading pairings...</div>
            ) : pairingRounds.length ? pairingRounds.map((round) => (
              <div className="pairing-round-block" key={round.round}>
                <div className="pairing-round-title">{pairingRoundLabel(tournament, round.round)}</div>
                {round.pairings.map((pairing) => (
                  <div key={`${pairing.round ?? 1}-${pairing.board}`} className="pairing-row">
                    <span>#{pairing.board}</span>
                    <strong className="pairing-player white-side">
                      <span className="chess-color-chip white">W</span>
                      <span>{pairing.white}<small>{pairing.whiteRating}</small></span>
                    </strong>
                    <em>vs</em>
                    <strong className="pairing-player black-side">
                      <span className="chess-color-chip black">B</span>
                      <span>{pairing.black}<small>{pairing.blackRating}</small></span>
                    </strong>
                  </div>
                ))}
              </div>
            )) : (
              <EmptyState title="No pairings yet" body="Add at least two registered players before publishing pairings." />
            )}
            {tournament.status === 'active' && playableBoards.length ? (
              <LiveTournamentBoard
                boards={playableBoards}
                onBoardSelect={selectLiveBoard}
                onMessage={onMessage}
                onSaveGame={saveLiveBoardResult}
                panelRef={liveBoardRef}
                selectedBoardKey={selectedBoardKey}
              />
            ) : null}
          </>
        ) : null}
        {stage === 'bracket' ? (
          <>
            {multiStage ? (
              <div className="manage-panel-head">
                <strong>Phase Two - Knockout bracket</strong>
                <span>Top qualifiers advance from Phase One</span>
              </div>
            ) : null}
            <AdminBracketPreview
              bracketView={bracketConfig?.type === 'double' ? bracketView : undefined}
              onBracketViewChange={bracketConfig?.type === 'double' ? setBracketView : undefined}
              onSelectMatch={tournament.status === 'active' ? selectLiveBoard : undefined}
              rounds={activeBracketRounds}
              selectedBoardKey={selectedBoardKey}
              title={bracketConfig?.title ?? `${tournament.format} bracket`}
            />
            {tournament.status === 'active' && playableBoards.length ? (
              <LiveTournamentBoard
                boards={playableBoards}
                onBoardSelect={selectLiveBoard}
                onMessage={onMessage}
                onSaveGame={saveLiveBoardResult}
                panelRef={liveBoardRef}
                selectedBoardKey={selectedBoardKey}
              />
            ) : null}
          </>
        ) : null}
        {stage === 'procedure' ? (
          <>
            <ProcedurePlanner
              active={tournament.status === 'active'}
              advanceDisabled={disabled}
              configuredTables={tournament.physicalBoards || 3}
              disabled={disabled}
              onAdvanceRound={() => void onAdvanceRound(tournament)}
              onConfigure={() => void onProcedureConfigure(tournament, physicalBoards)}
              onMatchSelect={tournament.status === 'active' || tournament.status === 'completed' ? selectLiveBoard : undefined}
              onStartMatch={(match, physicalBoard) => void startProcedureMatch(match, physicalBoard)}
              onTablesChange={setPhysicalBoards}
              planMissing={procedurePlanMissing}
              queue={procedureQueue}
              roundLabel={procedureMatches[0]?.roundLabel ?? `Round ${currentRoundNumber(tournament)}`}
              selectedBoardKey={selectedBoardKey}
              tables={physicalBoards}
              totalMatches={procedureMatches.length}
            />
            {(tournament.status === 'active' || tournament.status === 'completed') && liveBoardOptions.length ? (
              <LiveTournamentBoard
                boards={liveBoardOptions}
                onBoardSelect={selectLiveBoard}
                onMessage={onMessage}
                onSaveGame={saveLiveBoardResult}
                panelRef={liveBoardRef}
                selectedBoardKey={selectedBoardKey}
              />
            ) : null}
          </>
        ) : null}
        {stage === 'standings' ? (
          <>
            <div className="manage-panel-head">
              <strong>Live standings</strong>
              <span>{hasStartedGames ? 'Results in progress' : 'No results recorded yet'}</span>
            </div>
            {tournamentPlayers.length ? tournamentPlayers.map((player, index) => (
              <div key={player.id} className="manage-row standings-row">
                <strong>{index + 1}. {player.name}</strong>
                <span>0 pts</span>
              </div>
            )) : (
              <EmptyState title="No standings yet" body="Standings will update after real game results are saved." />
            )}
          </>
        ) : null}
      </section>
    </div>
  )
}

function ProcedurePlanner({
  active,
  advanceDisabled,
  configuredTables,
  disabled,
  onAdvanceRound,
  onConfigure,
  onMatchSelect,
  onStartMatch,
  onTablesChange,
  planMissing,
  queue,
  roundLabel,
  selectedBoardKey,
  tables,
  totalMatches,
}: {
  active: boolean
  advanceDisabled: boolean
  configuredTables: number
  disabled: boolean
  onAdvanceRound: () => void
  onConfigure: () => void
  onMatchSelect?: (boardKey: string) => void
  onStartMatch: (match: ProcedureMatch, physicalBoard: number) => void
  onTablesChange: (tables: number) => void
  planMissing: boolean
  queue: ProcedureQueue
  roundLabel: string
  selectedBoardKey: string
  tables: number
  totalMatches: number
}) {
  const tableCount = Math.max(1, Math.min(64, Math.floor(tables) || 1))
  const currentRoundTotal = queue.currentRoundTotal || totalMatches
  const finishedCount = queue.currentRoundFinished
  const roundDone = currentRoundTotal > 0 && finishedCount >= currentRoundTotal
  const planDirty = tableCount !== configuredTables || planMissing

  return (
    <div className="procedure-planner">
      <div className="manage-panel-head procedure-head">
        <div>
          <strong>Tournament procedure</strong>
          <span>Venue board control and game queue</span>
        </div>
        <div className="procedure-configure">
          <label>
            Physical boards
            <input
              type="number"
              min={1}
              max={64}
              value={tableCount}
              onChange={(event) => onTablesChange(Math.max(1, Math.min(64, Math.floor(Number(event.target.value) || 1))))}
            />
          </label>
          <button type="button" className="mini-button dark" disabled={disabled || !planDirty} onClick={onConfigure}>
            {planDirty ? 'Save board plan' : 'Plan saved'}
          </button>
        </div>
      </div>
      <div className="procedure-summary">
        <span>{roundLabel}</span>
        <span>{tableCount} physical boards</span>
        <span>{queue.waves.length} wave{queue.waves.length === 1 ? '' : 's'}</span>
        <span>{finishedCount} of {currentRoundTotal} current games finished</span>
        <span>{queue.waiting.length} queued</span>
      </div>
      <div className="procedure-status-note">
        {active
          ? 'Start only the game shown on each free board. Saving the final result automatically prepares the next round.'
          : 'This is the planned venue order. Games become startable when the tournament is active.'}
      </div>

      <section className="pairing-round-block procedure-wave-block">
        <div className="pairing-round-title procedure-wave-title">
          Physical boards
          <span>{queue.tables.filter((table) => table.match?.live).length} live</span>
        </div>
        {queue.tables.map((table) => (
          <ProcedureTableRow
            active={active}
            disabled={disabled}
            key={`table-${table.tableNumber}`}
            onMatchSelect={onMatchSelect}
            onStartMatch={onStartMatch}
            selectedBoardKey={selectedBoardKey}
            table={table}
          />
        ))}
      </section>

      <div className="procedure-schedule-head">
        <strong>Round schedule</strong>
        <span>Grouped by wave and assigned venue board</span>
      </div>
      {queue.waves.map((wave) => (
        <section className="pairing-round-block procedure-wave-block" key={`${wave.round}-${wave.number}`}>
          <div className="pairing-round-title procedure-wave-title">
            {wave.roundLabel} · Wave {wave.number}
            <span>{wave.matches.length} game{wave.matches.length === 1 ? '' : 's'}</span>
          </div>
          {wave.matches.map((match) => (
            <div className={`pairing-row procedure-wave-row ${match.live ? 'live' : match.completed ? 'done' : 'queued'}`} key={match.boardKey}>
              <span>B{match.physicalBoard}</span>
              <strong>
                {match.white}
                <small>{match.roundLabel} · Match {match.matchNumber}</small>
              </strong>
              <em>vs</em>
              <strong>
                {match.black}
                <small>{match.status}</small>
              </strong>
            </div>
          ))}
        </section>
      ))}

      {queue.byes.length ? (
        <div className="procedure-byes">
          {queue.byes.map((match) => (
            <span key={match.boardKey}>{match.white} has a full-point bye this round.</span>
          ))}
        </div>
      ) : null}

      {queue.finished.length ? (
        <section className="pairing-round-block procedure-wave-block finished">
          <div className="pairing-round-title procedure-wave-title">
            Completed games and PGN
            <span>Select a game to add moves later</span>
          </div>
          {queue.finished.map((match) => (
            <button
              type="button"
              className={`pairing-row procedure-wave-row done ${selectedBoardKey === match.boardKey ? 'selected-board' : ''}`}
              disabled={!match.gameId || !onMatchSelect}
              onClick={() => onMatchSelect?.(match.boardKey)}
              key={match.boardKey}
            >
              <span>✓</span>
              <strong>{match.white}<small>{match.roundLabel} · Match {match.matchNumber}</small></strong>
              <em>vs</em>
              <strong>{match.black}<small>{match.pgn ? 'PGN saved · open to edit' : 'Add PGN later'}</small></strong>
            </button>
          ))}
        </section>
      ) : null}

      {active ? (
        <div className="procedure-advance">
          <span>
            {roundDone
              ? 'All games are finished. The next round should appear automatically — use this if it has not.'
              : 'Rounds advance automatically when the last result is saved.'}
          </span>
          <button type="button" className="mini-button dark" disabled={advanceDisabled || !roundDone} onClick={onAdvanceRound}>
            Advance round
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ProcedureTableRow({
  active,
  disabled,
  onMatchSelect,
  onStartMatch,
  selectedBoardKey,
  table,
}: {
  active: boolean
  disabled: boolean
  onMatchSelect?: (boardKey: string) => void
  onStartMatch: (match: ProcedureMatch, physicalBoard: number) => void
  selectedBoardKey: string
  table: ProcedureTable
}) {
  const match = table.match
  const selectable = Boolean(active && match?.live && onMatchSelect)
  const canStart = Boolean(active && match && table.startNow && match.gameId)
  const selected = Boolean(match && selectedBoardKey === match.boardKey)
  const className = [
    'pairing-row',
    'procedure-wave-row',
    selectable ? 'selectable' : '',
    selected ? 'selected-board' : '',
    match ? '' : 'idle',
    match?.live ? 'live' : '',
  ].filter(Boolean).join(' ')
  const content = match ? (
    <>
      <span>B{table.tableNumber}</span>
      <strong>
        {match.white}
        <small>Wave {match.procedureWave} · Match {match.matchNumber}</small>
      </strong>
      <em>vs</em>
      <strong>
        {match.black}
        <small>{match.live ? 'Live now' : active ? 'Ready to start' : 'Planned'}</small>
      </strong>
      {canStart ? (
        <button type="button" className="mini-button dark procedure-row-action" disabled={disabled} onClick={() => onStartMatch(match, table.tableNumber)}>
          Start
        </button>
      ) : match?.live ? <span className="status-pill active procedure-row-action">Live</span> : null}
    </>
  ) : (
    <>
      <span>B{table.tableNumber}</span>
      <strong>
        Board free
        <small>No game assigned</small>
      </strong>
      <em>-</em>
      <strong>
        Waiting
        <small>No queued game right now</small>
      </strong>
    </>
  )

  if (selectable && match && !canStart) {
    return (
      <button type="button" className={className} onClick={() => onMatchSelect?.(match.boardKey)}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}

function AdminBracketPreview({
  bracketView,
  onBracketViewChange,
  onSelectMatch,
  rounds,
  selectedBoardKey,
  title,
}: {
  bracketView?: AdminBracketView
  onBracketViewChange?: (view: AdminBracketView) => void
  onSelectMatch?: (boardKey: string) => void
  rounds: AdminBracketRound[]
  selectedBoardKey: string
  title: string
}) {
  const [activeRound, setActiveRound] = useState(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const roundKey = useMemo(() => buildBracketRoundKey(rounds), [rounds])
  const panelClassName = [
    'bracket-panel',
    'rich-bracket-panel',
    bracketView ? `bracket-view-${bracketView}` : 'bracket-view-single',
  ].join(' ')

  useEffect(() => {
    setActiveRound(0)
    if (scrollRef.current) scrollRef.current.scrollLeft = 0
  }, [roundKey])

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
  }, [roundKey])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    let frame = 0
    let timeout = 0
    const draw = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => drawBracketLines(track))
    }

    timeout = window.setTimeout(draw, 0)

    const resizeObserver = new ResizeObserver(draw)
    resizeObserver.observe(track)
    window.addEventListener('resize', draw)

    return () => {
      window.clearTimeout(timeout)
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener('resize', draw)
    }
  }, [roundKey])

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
    <div className={panelClassName}>
      <div className="bracket-heading">
        <h2>{title}</h2>
        {bracketView && onBracketViewChange ? (
          <div className="bracket-switch" aria-label="Double elimination bracket view">
            {adminBracketViews.map(([view, label]) => (
              <button
                type="button"
                className={bracketView === view ? 'active' : undefined}
                onClick={() => onBracketViewChange(view)}
                key={view}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <nav className="bracket-round-nav" aria-label="Bracket rounds">
        {rounds.map((round, roundIndex) => (
          <button
            type="button"
            className={activeRound === roundIndex ? 'active' : undefined}
            aria-current={activeRound === roundIndex ? 'true' : undefined}
            onClick={() => jumpToRound(roundIndex)}
            key={round.name}
          >
            {round.name}
          </button>
        ))}
      </nav>

      <div className="bracket-scroll" aria-label={title} ref={scrollRef}>
        <div className="bracket-track" ref={trackRef}>
          <svg className="bracket-lines" data-brk-svg aria-hidden="true" />
          {rounds.map((round, roundIndex) => (
            <div
              className={['bracket-column', round.role ? `bracket-column-${round.role}` : ''].filter(Boolean).join(' ')}
              data-round-index={roundIndex}
              key={round.name}
            >
              <h3>
                <span>{round.name}</span>
                {round.note ? <em>{round.note}</em> : null}
              </h3>
              <div className="bracket-column-body">
                {round.matches.map((match, matchIndex) => (
                  <AdminBracketMatchCard
                    boardKey={bracketBoardKey(round.name, matchIndex)}
                    isLastRound={roundIndex === rounds.length - 1}
                    key={`${round.name}-${match.white}-${match.black}-${matchIndex}`}
                    match={match}
                    matchIndex={matchIndex}
                    onSelect={onSelectMatch}
                    roundIndex={roundIndex}
                    selectedBoardKey={selectedBoardKey}
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

const AdminBracketMatchCard = memo(function AdminBracketMatchCard({
  boardKey,
  isLastRound,
  match,
  matchIndex,
  onSelect,
  roundIndex,
  selectedBoardKey,
}: {
  boardKey: string
  isLastRound: boolean
  match: AdminBracketMatch
  matchIndex: number
  onSelect?: (boardKey: string) => void
  roundIndex: number
  selectedBoardKey: string
}) {
  const stateClass = match.live ? 'live' : match.pending ? 'pending' : match.winner ? 'complete' : 'open'
  const lineState = match.winner === 'white' ? 'a' : match.winner === 'black' ? 'b' : match.live ? 'live' : ''
  const selectable = Boolean(onSelect && isPlayableMatch(match))
  const selected = selectable && selectedBoardKey === boardKey
  const className = [
    'bracket-match rich',
    stateClass,
    selectable ? 'selectable' : '',
    selected ? 'selected-board' : '',
    isLastRound ? 'last-round' : '',
  ].filter(Boolean).join(' ')
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
        name={match.white}
        score={match.live ? '•' : match.whiteScore ?? ''}
        side="white"
        state={bracketPlayerState(match, 'white')}
      />
      <BracketPlayerRow
        name={match.black}
        score={match.live ? '•' : match.blackScore ?? ''}
        side="black"
        state={bracketPlayerState(match, 'black')}
      />
    </>
  )

  if (selectable) {
    return (
      <button
        type="button"
        className={className}
        data-brk-card={`${roundIndex}-${matchIndex}`}
        data-target={match.next ?? ''}
        data-target-slot={match.targetSlot ?? ''}
        data-win={lineState}
        onClick={() => onSelect?.(boardKey)}
      >
        {content}
      </button>
    )
  }

  return (
    <div
      className={className}
      data-brk-card={`${roundIndex}-${matchIndex}`}
      data-target={match.next ?? ''}
      data-target-slot={match.targetSlot ?? ''}
      data-win={lineState}
    >
      {content}
    </div>
  )
})

function drawBracketLines(track: HTMLDivElement) {
  const svg = track.querySelector<SVGSVGElement>('[data-brk-svg]')
  if (!svg) return

  const cards = Array.from(track.querySelectorAll<HTMLElement>('[data-brk-card]'))
  const cardsByRound = new Map<number, Array<{ element: HTMLElement; index: number; targetSlot: string | null; win: string | null }>>()

  cards.forEach((element) => {
    const [round, index] = (element.dataset.brkCard || '').split('-').map(Number)
    if (!Number.isFinite(round) || !Number.isFinite(index)) return
    const entries = cardsByRound.get(round) || []
    entries.push({
      element,
      index,
      targetSlot: element.dataset.targetSlot || null,
      win: element.dataset.win || null,
    })
    cardsByRound.set(round, entries)
  })

  const base = track.getBoundingClientRect()
  svg.setAttribute('width', String(track.scrollWidth))
  svg.setAttribute('height', String(track.clientHeight))
  svg.replaceChildren()

  const namespace = 'http://www.w3.org/2000/svg'
  const roundIndexes = Array.from(cardsByRound.keys()).sort((a, b) => a - b)

  roundIndexes.forEach((round) => {
    const currentRound = cardsByRound.get(round) || []
    const nextRound = cardsByRound.get(round + 1) || []
    if (!nextRound.length) return

    currentRound.forEach((match) => {
      const targetData = match.element.dataset.target
      const parsedTarget = targetData ? Number(targetData) : Number.NaN
      const targetIndex = Number.isFinite(parsedTarget) ? parsedTarget : Math.floor(match.index / 2)
      const target = nextRound.find((candidate) => candidate.index === targetIndex)
      if (!target) return

      const fromAnchor = bracketSourceAnchor(match.element, match.win)
      const targetSlot = match.targetSlot || (match.index % 2 === 0 ? 'white' : 'black')
      const toAnchor = bracketTargetAnchor(target.element, targetSlot)
      const from = fromAnchor.getBoundingClientRect()
      const to = toAnchor.getBoundingClientRect()
      const fromCard = match.element.getBoundingClientRect()
      const toCard = target.element.getBoundingClientRect()
      const x1 = fromCard.right - base.left
      const y1 = from.top - base.top + from.height / 2
      const x2 = toCard.left - base.left
      const y2 = to.top - base.top + to.height / 2
      const midX = Math.round((x1 + x2) / 2)
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

function bracketSourceAnchor(element: HTMLElement, win: string | null) {
  if (win === 'a') {
    return element.querySelector<HTMLElement>('[data-brk-player="white"]') ?? element
  }
  if (win === 'b') {
    return element.querySelector<HTMLElement>('[data-brk-player="black"]') ?? element
  }
  return element
}

function bracketTargetAnchor(element: HTMLElement, slot: string | null) {
  if (slot === 'white') {
    return element.querySelector<HTMLElement>('[data-brk-player="white"]') ?? element
  }
  if (slot === 'black') {
    return element.querySelector<HTMLElement>('[data-brk-player="black"]') ?? element
  }
  return element
}

function BracketPlayerRow({
  name,
  score,
  side,
  state,
}: {
  name: string
  score: string
  side: AdminBracketSide
  state: 'neutral' | 'winner' | 'muted'
}) {
  return (
    <div className={`bracket-player ${state}`} data-brk-player={side}>
      <span className={`chess-color-chip ${side}`}>{side === 'white' ? 'W' : 'B'}</span>
      <span>{name}</span>
      <strong>{score}</strong>
    </div>
  )
}

function LiveTournamentBoard({
  boards,
  onBoardSelect,
  onMessage,
  onSaveGame,
  panelRef,
  selectedBoardKey,
}: {
  boards: LiveBoardOption[]
  onBoardSelect: (boardKey: string) => void
  onMessage: (message: string) => void
  onSaveGame: (board: LiveBoardOption, state: LiveBoardState) => Promise<void>
  panelRef: RefObject<HTMLElement | null>
  selectedBoardKey: string
}) {
  const [boardStates, setBoardStates] = useState<Record<string, LiveBoardState>>({})
  const [pgnDrafts, setPgnDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const pairing = boards.find((board) => board.boardKey === selectedBoardKey) ?? boards[0]
  const boardState = pairing ? boardStates[pairing.boardKey] ?? initialLiveBoardState(pairing) : EMPTY_LIVE_BOARD_STATE
  const pgnDraft = pairing ? pgnDrafts[pairing.boardKey] ?? pairing.pgn ?? '' : ''
  const movePairs = buildMovePairs(boardState.moves)

  function updateCurrentBoard(nextState: LiveBoardState) {
    if (!pairing) return
    setBoardStates((current) => ({
      ...current,
      [pairing.boardKey]: nextState,
    }))
  }

  function handleBoardChange(state: JuChessBoardChange) {
    updateCurrentBoard({
      moves: state.moves,
      result: pairing?.completed ? pairing.result ?? state.result : state.result,
    })
    if (pairing) {
      setPgnDrafts((current) => ({ ...current, [pairing.boardKey]: state.pgn }))
    }
  }

  function undoMove() {
    if (!pairing || !boardState.moves.length) return
    const moves = boardState.moves.slice(0, -1)
    const next = buildChessGame(undefined, moves)
    updateCurrentBoard({
      moves,
      result: deriveResult(next),
    })
  }

  function resetGame() {
    updateCurrentBoard({ moves: [], result: pairing?.completed ? pairing.result ?? 'Live' : 'Live' })
    if (pairing) setPgnDrafts((current) => ({ ...current, [pairing.boardKey]: '' }))
  }

  function recordResult(value: string) {
    if (!pairing || pairing.completed) return
    updateCurrentBoard({
      moves: boardState.moves,
      result: value,
    })
    onMessage(`${pairing.white} vs ${pairing.black} result set to ${value}.`)
  }

  async function saveBoard() {
    if (!pairing) return
    setSaving(true)
    try {
      await onSaveGame(pairing, boardState)
    } catch {
      // The parent already surfaces the server error in the management notice.
    } finally {
      setSaving(false)
    }
  }

  function updatePgnDraft(value: string) {
    if (!pairing) return
    setPgnDrafts((current) => ({ ...current, [pairing.boardKey]: value }))
  }

  function importPgn() {
    if (!pairing) return
    try {
      const parsed = parseChessPgn(pgnDraft)
      updateCurrentBoard({
        moves: parsed.moves,
        result: pairing.completed ? pairing.result ?? parsed.result : parsed.result,
      })
      onMessage(`${pairing.boardLabel} PGN imported. Review the moves, then save.`)
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'The PGN could not be imported.')
    }
  }

  return (
    <section className="live-board-panel" ref={panelRef}>
      <div className="manage-panel-head">
        <strong>Digital board and result entry</strong>
        <span>{pairing ? pairing.boardLabel : 'No board selected'}</span>
      </div>
      <div className="live-board-layout">
        <div className="live-board-area">
          <div className="live-board-top">
            <label>
              Board
              <select value={pairing?.boardKey ?? ''} onChange={(event) => onBoardSelect(event.target.value)} disabled={!boards.length}>
                {boards.map((item) => (
                  <option key={item.boardKey} value={item.boardKey}>
                    {item.boardLabel} - {item.white} vs {item.black}
                  </option>
                ))}
              </select>
            </label>
            <span className="live-turn">{pairing?.completed ? `Recorded ${pairing.result}` : boardState.moves.length % 2 === 0 ? 'White to move' : 'Black to move'}</span>
          </div>
          <BoardPlayerBar color="black" name={pairing?.black ?? 'Black player'} />
          <JuChessBoard moves={boardState.moves} onChange={handleBoardChange} />
          <BoardPlayerBar color="white" name={pairing?.white ?? 'White player'} />
        </div>
        <aside className="live-game-side">
          <div className="live-match-card">
            <span>Current match</span>
            <BoardPlayerBar color="white" name={pairing?.white ?? 'No active board'} compact />
            <BoardPlayerBar color="black" name={pairing?.black ?? 'Select a live match'} compact />
          </div>
          <div className="result-control">
            <span>Result</span>
            <div>
              {[
                { label: 'Live', value: 'Live' },
                { label: '1-0 White', value: '1-0' },
                { label: '0-1 Black', value: '0-1' },
                { label: 'Draw', value: '1/2-1/2' },
              ].map(({ label, value }) => (
                <button
                  type="button"
                  className={boardState.result === value ? 'active' : undefined}
                  disabled={!pairing || pairing.completed}
                  onClick={() => recordResult(value)}
                  key={value}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="move-list-card">
            <div className="move-list-head">
              <strong>Live moves</strong>
              <span>{boardState.moves.length} moves</span>
            </div>
            <div className="move-list-scroll">
              {movePairs.length ? movePairs.map((row) => (
                <div className="admin-move-row" key={row.number}>
                  <span>{row.number}.</span>
                  <strong>{row.white}</strong>
                  <strong>{row.black}</strong>
                </div>
              )) : <div className="empty-row">Play on the board to record moves.</div>}
            </div>
          </div>
          <div className="pgn-entry-card">
            <div className="move-list-head">
              <strong>PGN</strong>
              <span>Optional now · editable later</span>
            </div>
            <textarea
              aria-label="PGN moves"
              placeholder="Paste PGN here, or enter moves on the board"
              value={pgnDraft}
              onChange={(event) => updatePgnDraft(event.target.value)}
            />
            <button type="button" className="mini-button ghost" disabled={!pairing || !pgnDraft.trim()} onClick={importPgn}>Import PGN</button>
          </div>
          <div className="live-board-actions">
            <button type="button" className="mini-button ghost" onClick={undoMove} disabled={!boardState.moves.length}>Undo</button>
            <button type="button" className="mini-button ghost" onClick={resetGame} disabled={!pairing}>Reset</button>
            <button type="button" className="mini-button dark" disabled={!pairing || saving} onClick={saveBoard}>
              {saving ? 'Saving...' : pairing?.completed ? 'Save PGN' : boardState.moves.length ? 'Save result + PGN' : 'Save result without PGN'}
            </button>
          </div>
        </aside>
      </div>
    </section>
  )
}

function BoardPlayerBar({
  color,
  compact = false,
  name,
}: {
  color: 'black' | 'white'
  compact?: boolean
  name: string
}) {
  return (
    <div className={`board-player-bar ${compact ? 'compact' : ''}`}>
      <span className={`chess-color-chip ${color}`}>{color === 'white' ? 'W' : 'B'}</span>
      <div>
        <small>{color}</small>
        <strong>{name}</strong>
      </div>
    </div>
  )
}

function initialLiveBoardState(board: LiveBoardOption): LiveBoardState {
  const result = board.completed ? board.result ?? 'Live' : board.result && board.result !== '*' ? board.result : 'Live'
  if (!board.pgn || board.pgn === 'bye') return { moves: [], result }
  try {
    return { moves: parseChessPgn(board.pgn).moves, result }
  } catch {
    return { moves: [], result }
  }
}

function RegistrationQueue({
  actionId,
  loading,
  onCheckInChange,
  onSelectedChange,
  onStatusChange,
  registrations,
  selectedTournament,
  selectedTournamentKey,
  tournaments,
}: {
  actionId: string | null
  loading: boolean
  onCheckInChange: (item: AdminRegistration, checkedIn: boolean) => Promise<void>
  onSelectedChange: (key: string) => void
  onStatusChange: (item: AdminRegistration, status: AdminRegistrationStatus) => Promise<void>
  registrations: AdminRegistration[]
  selectedTournament: AdminTournament | null
  selectedTournamentKey: string
  tournaments: AdminTournament[]
}) {
  return (
    <section className="panel-card table-card registration-panel">
      <div className="panel-head">
        <strong>Registration queue</strong>
        <span>{selectedTournament ? selectedTournament.name : 'No tournament selected'}</span>
      </div>
      <div className="registration-toolbar">
        <label>
          Tournament
          <select
            value={selectedTournamentKey}
            onChange={(event) => onSelectedChange(event.target.value)}
            disabled={!tournaments.length}
          >
            {tournaments.map((item) => (
              <option key={tournamentKey(item)} value={tournamentKey(item)}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <span>
          {registrations.length} registration{registrations.length === 1 ? '' : 's'}
        </span>
      </div>
      {!selectedTournament ? (
        <EmptyState title="No tournament selected" body="Choose a tournament tab with events to review registrations." />
      ) : !selectedTournament.rowId ? (
        <EmptyState title="Cloud tournament required" body="Only cloud-backed tournaments can show registration rows." />
      ) : loading ? (
        <div className="empty-row">Loading registrations...</div>
      ) : registrations.length ? (
        <div className="table-scroll">
          <table className="prototype-table registration-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>University ID</th>
                <th>Rating</th>
                <th>Status</th>
                <th>Seed</th>
                <th>Check-in</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((item) => {
                const busy = actionId === item.rowId
                return (
                  <tr key={item.rowId} className={item.status === 'cancelled' ? 'muted-row' : undefined}>
                    <td>
                      <strong>{item.playerName}</strong>
                      <small>{item.email || item.profileId}</small>
                    </td>
                    <td>{item.universityId || 'Not set'}</td>
                    <td className="mono center">{item.rating ?? '-'}</td>
                    <td><StatusPill status={item.status} /></td>
                    <td className="mono center">{item.seed ?? '-'}</td>
                    <td>
                      {item.checkedIn ? 'Checked in' : 'Not checked in'}
                      {item.status === 'confirmed' && item.checkInCode ? (
                        <small className="checkin-code">{item.checkInCode}</small>
                      ) : null}
                    </td>
                    <td className="right">
                      <select
                        aria-label={`Update ${item.playerName} registration status`}
                        className="mini-select"
                        disabled={busy}
                        value={item.status}
                        onChange={(event) => void onStatusChange(item, event.target.value as AdminRegistrationStatus)}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="waitlisted">Waitlisted</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <button
                        type="button"
                        className="mini-button ghost"
                        disabled={busy || item.status === 'cancelled'}
                        onClick={() => void onCheckInChange(item, !item.checkedIn)}
                      >
                        {item.checkedIn ? 'Undo check-in' : 'Check in'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No registrations yet" body="Players will appear here after they register." />
      )}
    </section>
  )
}

function TournamentMiniTable({ tournaments }: { tournaments: AdminTournament[] }) {
  const rows = tournaments.slice(0, 5)
  return (
    <table className="mini-table">
      <tbody>
        {rows.map((item) => (
          <tr key={item.rowId ?? item.id}>
            <td>{item.name}</td>
            <td>{item.format}</td>
            <td><StatusPill status={item.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PlayersScreen({
  blocks,
  onBlocksChanged,
  session,
}: {
  blocks: BlockListLoadResult
  onBlocksChanged: () => Promise<void>
  session: AdminSession
}) {
  const [players, setPlayers] = useState<Player[]>([])
  const [playersLoading, setPlayersLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [editPlayer, setEditPlayer] = useState<Player | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const { players: clubPlayers } = await loadClubPlayers()
      if (!alive) return
      setPlayers(clubPlayers.map((player) => ({
        id: player.id,
        profileId: player.id,
        name: player.name,
        initials: playerInitials(player.name),
        universityId: player.universityId,
        email: player.email,
        phone: player.phone || 'Not set',
        rating: player.rating,
        // Per-player win/loss records are not computed yet; show nothing
        // rather than a fabricated record.
        record: '-',
        avatarColor: avatarColorFor(player.id),
        tournaments: 0,
        blocked: player.status === 'suspended',
      })))
      setPlayersLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [])
  const visiblePlayers = players.filter((player) => {
    const needle = search.trim().toLowerCase()
    return !needle || player.name.toLowerCase().includes(needle) || player.universityId.toLowerCase().includes(needle)
  })
  const selectedCount = Object.values(selected).filter(Boolean).length

  function togglePlayer(playerId: string) {
    setSelected((current) => ({ ...current, [playerId]: !current[playerId] }))
  }

  return (
    <div className="players-screen">
      <div className="table-toolbar">
        <div className="filter-row">
          <label className="inline-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter by name or ID..." /></label>
          <select><option>All players</option><option>Swiss</option><option>Single elimination</option></select>
          <span>
            {playersLoading
              ? 'Loading players...'
              : `${visiblePlayers.length} of ${players.length} player${players.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <button type="button" className="primary-button"><span>+</span> Add player</button>
      </div>

      {selectedCount ? (
        <div className="selection-bar">
          <strong>{selectedCount} selected</strong>
          <button type="button">✉ Message selected</button>
          <button type="button">🗑 Remove selected</button>
          <button type="button" onClick={() => setSelected({})}>Clear</button>
        </div>
      ) : null}

      <section className="panel-card table-card">
        <div className="table-scroll">
          <table className="prototype-table players-table">
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>University ID</th>
                <th>Rating</th>
                <th>Record</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visiblePlayers.map((player) => (
                <tr key={player.id} className={player.blocked ? 'muted-row' : undefined}>
                  <td>
                    <button
                      type="button"
                      className={selected[player.id] ? 'check on' : 'check'}
                      onClick={() => togglePlayer(player.id)}
                      aria-label={`Select ${player.name}`}
                    >
                      {selected[player.id] ? '✓' : ''}
                    </button>
                  </td>
                  <td>
                    <div className="player-name">
                      <span style={{ background: player.avatarColor }}>{player.initials}</span>
                      <strong>{player.name}</strong>
                      {player.blocked ? <em>BLOCKED</em> : null}
                    </div>
                  </td>
                  <td className="mono">{player.universityId}</td>
                  <td className="mono"><strong>{player.rating}</strong></td>
                  <td className="mono">{player.record}</td>
                  <td className="right"><button type="button" className="mini-button ghost" onClick={() => setEditPlayer(player)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <BlockManagement blocks={blocks} session={session} onChanged={onBlocksChanged} />

      {editPlayer ? (
        <PlayerModal
          player={editPlayer}
          onClose={() => setEditPlayer(null)}
          onToggleBlock={() => {
            setPlayers((current) => current.map((player) => (
              player.id === editPlayer.id ? { ...player, blocked: !player.blocked } : player
            )))
            setEditPlayer((current) => current ? { ...current, blocked: !current.blocked } : current)
          }}
        />
      ) : null}
    </div>
  )
}

function PlayerModal({
  onClose,
  onToggleBlock,
  player,
}: {
  onClose: () => void
  onToggleBlock: () => void
  player: Player
}) {
  const fields = [
    ['Name', player.name],
    ['University ID', player.universityId],
    ['Email', player.email],
    ['Phone number', player.phone],
    ['Rating', String(player.rating)],
    ['Record (W-D-L)', player.record],
    ['Tournaments joined', String(player.tournaments)],
  ]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="player-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <strong>{player.name}</strong>
          <button type="button" onClick={onClose}>×</button>
        </div>
        <div className="field-grid">
          {fields.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button">✉ Message</button>
          <button type="button" className="danger-button" onClick={onToggleBlock}>
            {player.blocked ? 'Unblock player' : 'Block player'}
          </button>
        </div>
      </section>
    </div>
  )
}

function BlockManagement({
  blocks,
  onChanged,
  session,
}: {
  blocks: BlockListLoadResult
  onChanged: () => Promise<void>
  session: AdminSession
}) {
  const [identityForm, setIdentityForm] = useState({
    type: 'email' as IdentityBlockType,
    value: '',
    reason: '',
    targetUserId: '',
    targetProfileId: '',
  })
  const [ipForm, setIpForm] = useState({ ipRange: '', reason: '' })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const actorProfileId = session.profile?.$id

  async function handleIdentityBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    try {
      await blockIdentity({
        ...identityForm,
        value: identityForm.value.trim(),
        reason: identityForm.reason.trim(),
        targetUserId: identityForm.targetUserId.trim(),
        targetProfileId: identityForm.targetProfileId.trim(),
        actorProfileId,
      })
      setIdentityForm((current) => ({ ...current, value: '', reason: '', targetUserId: '', targetProfileId: '' }))
      setMessage('Identity block added.')
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleIpBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    try {
      await blockIp({ ipRange: ipForm.ipRange.trim(), reason: ipForm.reason.trim(), actorProfileId })
      setIpForm({ ipRange: '', reason: '' })
      setMessage('IP block added.')
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="panel-card access-panel">
      <div className="panel-head">
        <strong>Blocked players</strong>
        <span>Admin only</span>
      </div>
      <p className="muted">Identity blocks stop matching email, University ID, or Jordan phone numbers. IP blocks stop requests from a specific IP or IPv4 CIDR range.</p>
      <div className="access-grid">
        <form className="prototype-form compact" onSubmit={handleIdentityBlock}>
          <h3>Identity block</h3>
          <label>Type<select value={identityForm.type} onChange={(event) => setIdentityForm((current) => ({ ...current, type: event.target.value as IdentityBlockType }))}><option value="email">Email</option><option value="universityId">University ID</option><option value="phone">Phone</option></select></label>
          <label>Value<input value={identityForm.value} onChange={(event) => setIdentityForm((current) => ({ ...current, value: event.target.value }))} placeholder={identityForm.type === 'phone' ? '0791234567' : 'player@ju.edu.jo'} required /></label>
          <label>Reason<input value={identityForm.reason} onChange={(event) => setIdentityForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Optional admin note" /></label>
          <label>Account ID<input value={identityForm.targetUserId} onChange={(event) => setIdentityForm((current) => ({ ...current, targetUserId: event.target.value }))} placeholder="Optional" /></label>
          <label>Profile row ID<input value={identityForm.targetProfileId} onChange={(event) => setIdentityForm((current) => ({ ...current, targetProfileId: event.target.value }))} placeholder="Optional" /></label>
          <button type="submit" disabled={submitting}>Block identity</button>
        </form>
        <form className="prototype-form compact" onSubmit={handleIpBlock}>
          <h3>IP block</h3>
          <label>IP or CIDR<input value={ipForm.ipRange} onChange={(event) => setIpForm((current) => ({ ...current, ipRange: event.target.value }))} placeholder="203.0.113.10 or 203.0.113.0/24" required /></label>
          <label>Reason<input value={ipForm.reason} onChange={(event) => setIpForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Optional admin note" /></label>
          <button type="submit" disabled={submitting}>Block IP</button>
        </form>
      </div>
      {message ? <div className="prototype-note">{message}</div> : null}
      <div className="block-list-grid">
        <BlockList title="Identity block list" rows={blocks.identityBlocks} empty="No identity blocks yet." renderValue={(row) => `${identityLabel(row.type)} · ${row.value}`} onUnblock={async (row) => { await unblockIdentity(row.$id, actorProfileId); await onChanged() }} />
        <BlockList title="IP block list" rows={blocks.ipBlocks} empty="No IP blocks yet." renderValue={(row) => row.ipRange} onUnblock={async (row) => { await unblockIp(row.$id, actorProfileId); await onChanged() }} />
      </div>
    </section>
  )
}

function BlockList<T extends IdentityBlock | IpBlock>({
  empty,
  onUnblock,
  renderValue,
  rows,
  title,
}: {
  empty: string
  onUnblock: (row: T) => Promise<void>
  renderValue: (row: T) => string
  rows: T[]
  title: string
}) {
  return (
    <div className="block-list">
      <h3>{title}</h3>
      {rows.length === 0 ? <div className="empty-row">{empty}</div> : null}
      {rows.map((row) => (
        <div className="block-row" key={row.$id}>
          <span>
            <strong>{renderValue(row)}</strong>
            <StatusPill status={row.status} />
            {row.reason ? <small>{row.reason}</small> : null}
          </span>
          {row.status === 'active' ? <button type="button" className="mini-button ghost" onClick={() => void onUnblock(row)}>Unblock</button> : null}
        </div>
      ))}
    </div>
  )
}

function NewsScreen() {
  const [posts, setPosts] = useState([
    { id: 'n1', title: 'Summer training camp registration opens July 10', body: 'Members can reserve seats from the app.', date: 'Jul 1, 2026' },
    { id: 'n2', title: 'Club general assembly and board elections', body: 'Voting opens after Swiss.', date: 'Jun 28, 2026' },
  ])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [imageAttached, setImageAttached] = useState(false)

  function publish() {
    if (!title.trim()) return
    setPosts((current) => [{ id: String(Date.now()), title: title.trim(), body: body.trim(), date: 'Jul 6, 2026' }, ...current])
    setTitle('')
    setBody('')
    setImageAttached(false)
  }

  return (
    <div className="news-screen">
      <section className="panel-card">
        <div className="panel-head">
          <strong>Write a post</strong>
          <span>Public</span>
        </div>
        <p className="muted">Published publicly to the ChessJU app and website - no audience targeting.</p>
        <div className="post-form">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. JuChess wins the regional final" />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write the post..." />
          <button type="button" className="upload-box" onClick={() => setImageAttached(true)}>{imageAttached ? '✓ news-cover.png' : 'Upload cover image'}</button>
          <button type="button" className="primary-button" onClick={publish}>Publish to app & website</button>
        </div>
      </section>
      <section className="panel-card">
        <div className="panel-title">Published posts</div>
        {posts.map((post) => (
          <article className="post-row" key={post.id}>
            <span>📰</span>
            <div>
              <strong>{post.title}</strong>
              <p>{post.body}</p>
              <small>{post.date}</small>
            </div>
            <button type="button" className="mini-button ghost" onClick={() => setPosts((current) => current.filter((item) => item.id !== post.id))}>Delete</button>
          </article>
        ))}
      </section>
    </div>
  )
}

const broadcastChannels = [
  { key: 'app', label: 'App', detail: 'In-app notification feed' },
  { key: 'email', label: 'Email', detail: 'Send to registered email addresses' },
  { key: 'sms', label: 'SMS', detail: 'Send to verified phone numbers' },
] as const

type BroadcastChannel = typeof broadcastChannels[number]['key']
type AnnouncementAudienceMode = 'all' | 'tournament'

function AnnouncementsScreen({ tournaments }: { tournaments: AdminTournament[] }) {
  const eligibleTournaments = useMemo(() => (
    tournaments.filter((item) => item.status === 'upcoming' || item.status === 'active')
  ), [tournaments])
  const [audienceMode, setAudienceMode] = useState<AnnouncementAudienceMode>('all')
  const [selectedTournamentKeys, setSelectedTournamentKeys] = useState<string[]>([])
  const [channels, setChannels] = useState<Record<BroadcastChannel, boolean>>({
    app: true,
    email: true,
    sms: false,
  })
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const selectedChannels = broadcastChannels.filter((item) => channels[item.key])
  const selectedTournaments = eligibleTournaments.filter((item) => selectedTournamentKeys.includes(tournamentKey(item)))
  const audienceCount = audienceMode === 'all'
    ? 248
    : selectedTournaments.reduce((total, item) => total + item.players, 0)
  const audienceLabel = audienceMode === 'all'
    ? 'All users'
    : selectedTournaments.length === 1
    ? selectedTournaments[0].name
    : selectedTournaments.length > 1
    ? `${selectedTournaments.length} tournaments`
    : 'Tournament audience'
  const channelLabel = selectedChannels.length
    ? selectedChannels.map((item) => item.label).join(' + ')
    : 'No channel selected'

  useEffect(() => {
    const validKeys = new Set(eligibleTournaments.map((item) => tournamentKey(item)))
    setSelectedTournamentKeys((current) => current.filter((key) => validKeys.has(key)))
  }, [eligibleTournaments])

  function toggleChannel(channel: BroadcastChannel) {
    setChannels((current) => ({
      ...current,
      [channel]: !current[channel],
    }))
  }

  function toggleTournamentAudience(key: string) {
    setSelectedTournamentKeys((current) => (
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    ))
  }

  return (
    <div className="announcements-screen">
      <section className="panel-card announcement-card">
        <div className="panel-head">
          <strong>Broadcast composer</strong>
          <span>{channelLabel}</span>
        </div>
        <div className="audience-choice-row">
          <button type="button" className={audienceMode === 'all' ? 'active' : undefined} onClick={() => setAudienceMode('all')}>
            <strong>All users</strong>
            <small>Send to the full user base</small>
          </button>
          <button type="button" className={audienceMode === 'tournament' ? 'active' : undefined} onClick={() => setAudienceMode('tournament')}>
            <strong>Tournament</strong>
            <small>Pick upcoming or live tournaments</small>
          </button>
        </div>
        {audienceMode === 'tournament' ? (
          <div className="tournament-check-list">
            {eligibleTournaments.length ? eligibleTournaments.map((item) => {
              const key = tournamentKey(item)
              const checked = selectedTournamentKeys.includes(key)
              return (
                <label className={checked ? 'active' : undefined} key={key}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTournamentAudience(key)}
                  />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.status === 'active' ? 'Live' : 'Upcoming'} · {item.players}/{item.capacity || 'open'} players · {item.format}</small>
                  </span>
                </label>
              )
            }) : (
              <div className="empty-row">No upcoming or live tournaments available.</div>
            )}
          </div>
        ) : null}
        <div className="channel-picker" aria-label="Broadcast delivery channels">
          {broadcastChannels.map((item) => (
            <label className={channels[item.key] ? 'active' : undefined} key={item.key}>
              <input
                type="checkbox"
                checked={channels[item.key]}
                onChange={() => toggleChannel(item.key)}
              />
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
            </label>
          ))}
        </div>
        <div className="post-form">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Announcement title" />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write the message..." />
          <button type="button" className="primary-button" disabled={!selectedChannels.length || (audienceMode === 'tournament' && !selectedTournaments.length)}>Send announcement</button>
        </div>
      </section>
      <section className="panel-card">
        <div className="panel-title">Delivery status</div>
        <QueueRow
          icon="◈"
          tint="#EAF0FA"
          label={audienceLabel}
          count={audienceCount}
          action={audienceMode === 'all' ? 'All users' : selectedTournaments.length ? 'Selected' : 'Choose'}
          onClick={() => undefined}
        />
        <QueueRow icon="▣" tint="#FBF1E2" label="Selected channels" count={selectedChannels.length} action={selectedChannels.length ? channelLabel : 'Choose'} onClick={() => undefined} />
        {broadcastChannels.map((item) => (
          <QueueRow
            icon={item.key === 'email' ? '✉' : item.key === 'sms' ? '▣' : '◈'}
            tint={item.key === 'email' ? '#EAF6F0' : item.key === 'sms' ? '#FBF1E2' : '#EAF0FA'}
            label={`${item.label} channel`}
            count={channels[item.key] ? 1 : 0}
            action={channels[item.key] ? 'On' : 'Off'}
            onClick={() => toggleChannel(item.key)}
            key={item.key}
          />
        ))}
      </section>
    </div>
  )
}

function AdminAccessScreen({
  adminProfiles,
  onAdminsChanged,
  session,
}: {
  adminProfiles: AdminProfileLoadResult
  onAdminsChanged: () => Promise<void>
  session: AdminSession
}) {
  if (session.profile?.role !== 'superAdmin') {
    return (
      <div className="admin-access-screen">
        <section className="panel-card">
          <div className="panel-head">
            <strong>Admin access</strong>
            <span>Super admin only</span>
          </div>
          <EmptyState title="Restricted area" body="Only a super admin can create, activate, or suspend admin access." />
        </section>
      </div>
    )
  }

  return (
    <div className="admin-access-screen">
      <AdminAccessManagement admins={adminProfiles} session={session} onChanged={onAdminsChanged} />
    </div>
  )
}

function AdminAccessManagement({
  admins,
  onChanged,
  session,
}: {
  admins: AdminProfileLoadResult
  onChanged: () => Promise<void>
  session: AdminSession
}) {
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    accountId: '',
    role: 'admin' as AdminRole,
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const actorProfileId = session.profile?.$id

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    try {
      await createAdminProfile({
        email: form.email.trim(),
        displayName: form.displayName.trim(),
        accountId: form.accountId.trim(),
        role: form.role,
        notes: form.notes.trim(),
        actorProfileId,
      })
      setForm({ email: '', displayName: '', accountId: '', role: 'admin', notes: '' })
      setMessage('Admin access created.')
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatus(admin: AdminProfile, status: AdminStatus) {
    setSubmitting(true)
    setMessage(null)
    try {
      await updateAdminStatus(admin.$id, status, actorProfileId)
      setMessage(status === 'active' ? 'Admin access activated.' : 'Admin access suspended.')
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="panel-card access-panel">
      <div className="panel-head">
        <strong>Admin access</strong>
        <span>Super admin only</span>
      </div>
      <p className="muted">Admin access is separate from player profiles. Create admin profile rows and assign accounts to admin-only teams.</p>
      <div className="access-grid">
        <form className="prototype-form compact" onSubmit={handleSubmit}>
          <h3>Create admin</h3>
          <label>Email<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="admin@ju.edu.jo" required /></label>
          <label>Display name<input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Admin name" required /></label>
          <label>Role<select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AdminRole }))}><option value="admin">Admin</option><option value="organizer">Organizer</option><option value="superAdmin">Super admin</option></select></label>
          <label>Account ID<input value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))} placeholder="Optional if email exists" /></label>
          <label>Notes<input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional internal note" /></label>
          <button type="submit" disabled={submitting}>Create admin access</button>
        </form>
        <div className="block-list">
          <h3>Admin list</h3>
          {admins.admins.length === 0 ? <div className="empty-row">No admin profiles yet.</div> : null}
          {admins.admins.map((admin) => (
            <div className="block-row" key={admin.$id}>
              <span>
                <strong>{admin.displayName}</strong>
                <StatusPill status={admin.status} />
                <small>{admin.email} · {adminRoleLabel(admin.role)}</small>
              </span>
              <button
                type="button"
                className="mini-button ghost"
                disabled={submitting || admin.accountId === session.user.$id}
                onClick={() => void handleStatus(admin, admin.status === 'active' ? 'suspended' : 'active')}
              >
                {admin.status === 'active' ? 'Suspend' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      </div>
      {message ? <div className="prototype-note">{message}</div> : null}
    </section>
  )
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill ${status}`}>{capitalize(status)}</span>
}

function EmptyState({ body, title }: { body: string; title: string }) {
  return (
    <div className="empty-state">
      <div>♟</div>
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  )
}

function identityLabel(type: IdentityBlockType) {
  if (type === 'universityId') return 'University ID'
  if (type === 'phone') return 'Phone'
  return 'Email'
}

function adminRoleLabel(role: AdminRole) {
  if (role === 'superAdmin') return 'Super admin'
  if (role === 'organizer') return 'Organizer'
  return 'Admin'
}

function initialsForName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'P'
}

function tournamentKey(item: AdminTournament) {
  return item.rowId ?? item.id
}

function isKnockoutTournament(item: AdminTournament) {
  return /knockout|single elimination|double elimination|elimination/i.test(item.format)
}

function isDoubleEliminationTournament(item: AdminTournament) {
  return /double elimination/i.test(item.format)
}

function isSwissTournament(item: AdminTournament) {
  return /^swiss$/i.test(item.format.trim())
}

function isMultiStageTournament(item: AdminTournament) {
  return /multi[-\s]?stage|stage/i.test(item.format.trim())
}

function isMultiStagePhaseTwo(item: AdminTournament) {
  return isMultiStageTournament(item) && /stage\s*(?:2|two)|phase\s*(?:2|two)|knockout|quarter|semi|final/i.test(item.round)
}

function usesSwissPublishFlow(item: AdminTournament) {
  return isSwissTournament(item) || isMultiStageTournament(item)
}

function isRoundRobinTournament(item: AdminTournament) {
  return isSingleRoundRobinTournament(item) || isDoubleRoundRobinTournament(item)
}

function isSingleRoundRobinTournament(item: AdminTournament) {
  return /^round robin$/i.test(item.format.trim())
}

function isDoubleRoundRobinTournament(item: AdminTournament) {
  return /^double round robin$/i.test(item.format.trim())
}

function buildTournamentPlayers(tournament: AdminTournament, seed: number, registrations: AdminRegistration[]) {
  const count = targetAdminPlayerCount(tournament, registrations.length)
  const players = registrations
    .slice(0, count)
    .map((registration, index) => ({
      id: registration.profileId,
      profileId: registration.profileId,
      name: registration.playerName,
      initials: initialsForName(registration.playerName),
      universityId: registration.universityId || registration.profileId,
      email: registration.email || '',
      phone: '',
      rating: registration.rating ?? 1200,
      record: '0-0-0',
      avatarColor: demoPlayers[index % demoPlayers.length]?.avatarColor ?? '#21304e',
      tournaments: 1,
    }))

  if (!seed) return players
  return seededShuffle(players, seed)
}

function targetAdminPlayerCount(tournament: AdminTournament, availablePlayers: number) {
  const declared = tournament.capacity && tournament.capacity > 0
    ? tournament.capacity
    : tournament.players > 0
      ? tournament.players
      : availablePlayers

  return Math.max(0, declared)
}

function seededShuffle<T>(items: T[], seed: number) {
  const result = [...items]
  let state = Math.max(1, seed * 97)

  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state * 9301 + 49297) % 233280
    const target = state % (index + 1)
    const value = result[index]
    result[index] = result[target]
    result[target] = value
  }

  return result
}

function buildTournamentPairingSchedule(tournament: AdminTournament, players: Player[], seed: number): Pairing[] {
  if (isRoundRobinTournament(tournament)) {
    return buildRoundRobinPairings(players, {
      doubleCycle: isDoubleRoundRobinTournament(tournament),
      seed,
    })
  }

  return buildPairings(players, seed, currentRoundNumber(tournament))
}

function buildPairings(players: Player[], seed = 0, round = 1): Pairing[] {
  const half = Math.ceil(players.length / 2)
  const colorCounts = new Map<string, { white: number; black: number }>()

  return players.slice(0, half).map((player, index) => {
    const opponent = players[index + half]
    return buildColorAwarePairing(player, opponent, index + 1, round, seed, colorCounts)
  })
}

function buildRoundRobinPairings(
  players: Player[],
  { doubleCycle, seed }: { doubleCycle: boolean; seed: number },
): Pairing[] {
  if (players.length < 2) return []

  const entrants: Array<Player | null> = players.length % 2 === 0 ? [...players] : [...players, null]
  let rotation = [...entrants]
  const roundCount = entrants.length - 1
  const firstCycle: Pairing[] = []
  const initialColorIsWhite = seededBoolean(seed, 71)

  for (let round = 1; round <= roundCount; round += 1) {
    let board = 1
    for (let index = 0; index < entrants.length / 2; index += 1) {
      const first = rotation[index]
      const second = rotation[rotation.length - 1 - index]
      if (first && second) {
        const firstGetsInitialColor = index === 0 ? round % 2 === 1 : index % 2 === 0
        const firstGetsWhite = initialColorIsWhite ? firstGetsInitialColor : !firstGetsInitialColor
        const white = firstGetsWhite ? first : second
        const black = firstGetsWhite ? second : first
        firstCycle.push({
          round,
          board,
          white: white.name,
          whiteProfileId: white.profileId ?? white.id,
          whiteRating: white.rating,
          black: black.name,
          blackProfileId: black.profileId ?? black.id,
          blackRating: black.rating,
        })
        board += 1
      }
    }

    rotation = [rotation[0], rotation[rotation.length - 1], ...rotation.slice(1, -1)]
  }

  if (!doubleCycle) return firstCycle

  return [
    ...firstCycle,
    ...firstCycle.map((pairing) => ({
      ...pairing,
      round: (pairing.round ?? 1) + roundCount,
      white: pairing.black,
      whiteProfileId: pairing.blackProfileId,
      whiteRating: pairing.blackRating,
      black: pairing.white,
      blackProfileId: pairing.whiteProfileId,
      blackRating: pairing.whiteRating,
    })),
  ]
}

function buildColorAwarePairing(
  first: Player,
  second: Player | undefined,
  board: number,
  round: number,
  seed: number,
  colorCounts: Map<string, { white: number; black: number }>,
): Pairing {
  if (!second) {
    return {
      round,
      board,
      white: first.name,
      whiteProfileId: first.profileId ?? first.id,
      whiteRating: first.rating,
      black: 'TBD',
      blackRating: '-',
    }
  }

  const firstKey = first.profileId ?? first.id
  const secondKey = second.profileId ?? second.id
  const firstColors = colorCounts.get(firstKey) ?? { white: 0, black: 0 }
  const secondColors = colorCounts.get(secondKey) ?? { white: 0, black: 0 }
  const firstWhiteNeed = firstColors.black - firstColors.white
  const secondWhiteNeed = secondColors.black - secondColors.white
  const firstGetsWhite = firstWhiteNeed === secondWhiteNeed
    ? seededBoolean(seed, round * 101 + board * 17)
    : firstWhiteNeed > secondWhiteNeed

  const white = firstGetsWhite ? first : second
  const black = firstGetsWhite ? second : first

  recordPairingColors(colorCounts, white, black)

  return {
    round,
    board,
    white: white.name,
    whiteProfileId: white.profileId ?? white.id,
    whiteRating: white.rating,
    black: black.name,
    blackProfileId: black.profileId ?? black.id,
    blackRating: black.rating,
  }
}

function recordPairingColors(colorCounts: Map<string, { white: number; black: number }>, white: Player, black: Player) {
  const whiteKey = white.profileId ?? white.id
  const blackKey = black.profileId ?? black.id
  const whiteColors = colorCounts.get(whiteKey) ?? { white: 0, black: 0 }
  const blackColors = colorCounts.get(blackKey) ?? { white: 0, black: 0 }
  colorCounts.set(whiteKey, { ...whiteColors, white: whiteColors.white + 1 })
  colorCounts.set(blackKey, { ...blackColors, black: blackColors.black + 1 })
}

function seededBoolean(seed: number, salt: number) {
  let state = Math.max(1, (seed + 1) * 1103515245 + salt * 12345)
  state = (state * 9301 + 49297) % 233280
  return state % 2 === 0
}

function currentRoundNumber(tournament: AdminTournament) {
  if (tournament.currentRound && tournament.currentRound > 0) return tournament.currentRound
  const parsed = /round\s*(\d+)/i.exec(tournament.round)?.[1]
  return parsed ? Number(parsed) : 1
}

function currentRoundPairingsForTournament(tournament: AdminTournament, pairings: Pairing[]) {
  const round = currentRoundNumber(tournament)
  const current = pairings.filter((pairing) => (pairing.round ?? 1) === round)
  return current.length ? current : pairings.filter((pairing) => (pairing.round ?? 1) === 1)
}

function groupPairingsByRound(pairings: Pairing[]) {
  const groups = new Map<number, Pairing[]>()
  pairings.forEach((pairing) => {
    const round = pairing.round ?? 1
    const list = groups.get(round) ?? []
    list.push(pairing)
    groups.set(round, list)
  })

  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([round, roundPairings]) => ({
      round,
      pairings: roundPairings.sort((a, b) => a.board - b.board),
    }))
}

function pairingRoundLabel(tournament: AdminTournament, round: number) {
  if (isMultiStageTournament(tournament)) return `Stage One Swiss Round ${round}`
  if (isSwissTournament(tournament)) return `Swiss Round ${round}`
  return `Round ${round}`
}

function firstBracketRoundPairings(rounds: AdminBracketRound[]): Pairing[] {
  return (rounds[0]?.matches ?? []).map((match, index) => ({
    ...match,
    round: 1,
    board: index + 1,
  }))
}

function buildPublishableGames(pairings: Pairing[], status: 'scheduled' | 'live' = 'scheduled'): PairingPublishInput[] {
  return pairings
    .filter((pairing) => pairing.whiteProfileId && pairing.blackProfileId && pairing.whiteProfileId !== pairing.blackProfileId)
    .map((pairing) => ({
      round: pairing.round ?? 1,
      board: pairing.board,
      whiteProfileId: pairing.whiteProfileId as string,
      blackProfileId: pairing.blackProfileId as string,
      status,
      result: '*',
    }))
}

function buildPlayableBoardsFromPairings(pairings: Pairing[]): PlayableBoard[] {
  return pairings
    .filter(hasKnownPlayers)
    .map((pairing) => ({
      ...pairing,
      boardKey: pairingBoardKey(pairing.round ?? 1, pairing.board),
      boardLabel: (pairing.round ?? 1) > 1 ? `Round ${pairing.round} Board ${pairing.board}` : `Board ${pairing.board}`,
    }))
}

function buildPlayableBoardsFromAdminGames(games: AdminGame[]): PlayableBoard[] {
  return games
    .filter((game) => game.status === 'live')
    .sort((a, b) => a.round - b.round || a.board - b.board)
    .map((game) => ({
      board: game.board,
      black: game.blackName,
      blackProfileId: game.blackProfileId,
      blackRating: game.blackRating,
      boardKey: `game:${game.id}`,
      boardLabel: game.round > 1 ? `Round ${game.round} Board ${game.board}` : `Board ${game.board}`,
      gameId: game.id,
      pgn: game.pgn,
      result: game.result,
      round: game.round,
      status: game.status,
      white: game.whiteName,
      whiteProfileId: game.whiteProfileId,
      whiteRating: game.whiteRating,
    }))
}

function buildPlayableBoardsFromProcedureMatches(matches: ProcedureMatch[]): LiveBoardOption[] {
  return matches
    .filter((match) => Boolean(match.gameId && (match.live || match.completed)))
    .map((match) => ({
      board: match.board,
      boardKey: match.boardKey,
      boardLabel: match.boardLabel,
      black: match.black,
      completed: match.completed,
      gameId: match.gameId,
      pgn: match.pgn,
      result: match.result,
      round: match.round,
      status: match.completed ? 'completed' : match.live ? 'live' : match.status,
      white: match.white,
    }))
}

function buildPlayableBracketBoards(rounds: AdminBracketRound[]): PlayableBoard[] {
  return rounds.flatMap((round) => (
    round.matches.flatMap((match, matchIndex) => (
      isPlayableMatch(match)
        ? [{
          ...match,
          board: matchIndex + 1,
          boardKey: bracketBoardKey(round.name, matchIndex),
          boardLabel: `${round.name} Board ${matchIndex + 1}`,
        }]
        : []
    ))
  ))
}

function buildProcedureMatchesFromPairings(pairings: Pairing[], tournament: AdminTournament): ProcedureMatch[] {
  return pairings.map((pairing) => {
    const playable = hasKnownPlayers(pairing)
    const bye = pairing.black === 'Bye'
    return {
      black: pairing.black,
      board: pairing.board,
      boardLabel: `${pairingRoundLabel(tournament, pairing.round ?? 1)} Board ${pairing.board}`,
      boardKey: pairingBoardKey(pairing.round ?? 1, pairing.board),
      bye,
      completed: bye,
      matchNumber: pairing.board,
      playable,
      round: pairing.round ?? 1,
      roundLabel: pairingRoundLabel(tournament, pairing.round ?? 1),
      status: bye ? 'Full-point bye' : playable ? 'Ready' : 'Waiting for player',
      white: pairing.white,
    }
  }).filter((match) => match.playable || match.bye)
}

function buildProcedureMatchesFromBracket(rounds: AdminBracketRound[]): ProcedureMatch[] {
  const targetRound = rounds.find((round) => round.matches.some((match) => match.live)) ?? rounds.find((round) => (
    round.matches.some((match) => !match.winner && !match.live)
  )) ?? rounds[0]

  if (!targetRound) return []

  return targetRound.matches.map((match, index) => {
    const playable = isPlayableMatch(match)
    const matchNumber = match.matchNumber ?? index + 1
    return {
      black: match.black,
      board: index + 1,
      boardLabel: `${targetRound.name} Match ${matchNumber}`,
      boardKey: bracketBoardKey(targetRound.name, index),
      completed: Boolean(match.winner),
      live: Boolean(match.live),
      matchNumber,
      playable,
      round: undefined,
      roundLabel: targetRound.name,
      status: match.live ? 'Live now' : match.winner ? 'Complete' : playable ? 'Ready' : 'Waiting for player',
      white: match.white,
    }
  }).filter(isProcedureMatchPlayable)
}

function buildProcedureMatchesFromAdminGames(tournament: AdminTournament, games: AdminGame[], includeAllRounds = false): ProcedureMatch[] {
  const currentRound = currentRoundNumber(tournament)
  const source = includeAllRounds ? games : games.filter((game) => (
    game.status === 'live' || game.round === currentRound
  ))

  return source
    .sort((a, b) => a.round - b.round || a.board - b.board)
    .map((game) => {
      const bye = game.blackName === 'Bye' || game.blackProfileId === 'system_bye'
      const completed = game.status === 'completed' || game.status === 'forfeit'
      return {
        black: game.blackName,
        board: game.board,
        boardLabel: `${pairingRoundLabel(tournament, game.round)} Board ${game.board}`,
        boardKey: `game:${game.id}`,
        bye,
        completed,
        gameId: game.id,
        live: game.status === 'live',
        matchNumber: game.board,
        playable: !completed && !bye,
        pgn: game.pgn,
        physicalBoard: game.physicalBoard,
        procedureWave: game.procedureWave,
        queuePosition: game.queuePosition,
        result: game.result,
        round: game.round,
        roundLabel: pairingRoundLabel(tournament, game.round),
        status: bye ? 'Full-point bye' : completed ? `Finished ${game.result}` : game.status === 'live' ? 'Live now' : 'Ready',
        white: game.whiteName,
      }
    })
}

function isProcedureMatchPlayable(match: ProcedureMatch) {
  return match.playable
}

function pairingBoardKey(round: number, board: number) {
  return `pairing:${round}:${board}`
}

function normalizeAdminBoardResult(value: string): '1-0' | '0-1' | '1/2-1/2' | '*' {
  return value === '1-0' || value === '0-1' || value === '1/2-1/2' ? value : '*'
}

function buildProcedureQueue(matches: ProcedureMatch[], tableCount: number): ProcedureQueue {
  const tables = Math.max(1, Math.min(64, Math.floor(tableCount) || 1))
  const normalized = matches.map((match) => ({ ...match }))
  const roundGroups = new Map<number, ProcedureMatch[]>()
  normalized.filter((match) => !match.bye).forEach((match) => {
    const round = match.round ?? 1
    const group = roundGroups.get(round) ?? []
    group.push(match)
    roundGroups.set(round, group)
  })
  for (const group of roundGroups.values()) {
    group.sort((a, b) => (a.queuePosition ?? a.matchNumber) - (b.queuePosition ?? b.matchNumber))
    group.forEach((match, index) => {
      match.queuePosition ??= index + 1
      match.procedureWave ??= Math.floor(index / tables) + 1
      match.physicalBoard ??= (index % tables) + 1
    })
  }

  const byes = normalized.filter((match) => match.bye)
  const finished = normalized.filter((match) => match.completed && !match.bye)
  const live = normalized.filter((match) => match.live && !match.completed)
  const ready = normalized.filter((match) => match.playable && !match.live)
  const operationalRound = live[0]?.round
    ?? ready.map((match) => match.round ?? 1).sort((a, b) => a - b)[0]
    ?? Math.max(1, ...normalized.map((match) => match.round ?? 1))
  const operationalReady = ready.filter((match) => (match.round ?? 1) === operationalRound)
  const assigned: ProcedureTable[] = []
  const visibleKeys = new Set<string>()
  for (let tableNumber = 1; tableNumber <= tables; tableNumber += 1) {
    const liveMatch = live.find((match) => match.physicalBoard === tableNumber)
    if (liveMatch) {
      assigned.push({ tableNumber, match: liveMatch, startNow: false })
      visibleKeys.add(liveMatch.boardKey)
      continue
    }
    const nextReady = operationalReady
      .filter((match) => match.physicalBoard === tableNumber)
      .sort((a, b) => (a.queuePosition ?? a.matchNumber) - (b.queuePosition ?? b.matchNumber))[0]
    if (nextReady) {
      assigned.push({ tableNumber, match: nextReady, startNow: true })
      visibleKeys.add(nextReady.boardKey)
      continue
    }
    assigned.push({ tableNumber, startNow: false })
  }

  const waves = Array.from(roundGroups.entries()).flatMap(([round, group]) => {
    const waveGroups = new Map<number, ProcedureMatch[]>()
    group.forEach((match) => {
      const wave = match.procedureWave ?? 1
      const waveMatches = waveGroups.get(wave) ?? []
      waveMatches.push(match)
      waveGroups.set(wave, waveMatches)
    })
    return Array.from(waveGroups.entries()).map(([number, waveMatches]) => ({
      number,
      round,
      roundLabel: waveMatches[0]?.roundLabel ?? `Round ${round}`,
      matches: waveMatches,
    }))
  }).sort((a, b) => a.round - b.round || a.number - b.number)

  return {
    tables: assigned,
    waiting: operationalReady.filter((match) => !visibleKeys.has(match.boardKey)),
    finished,
    byes,
    currentRoundFinished: normalized.filter((match) => (
      (match.round ?? 1) === operationalRound && (match.completed || match.bye)
    )).length,
    currentRoundTotal: normalized.filter((match) => (match.round ?? 1) === operationalRound).length,
    waves,
  }
}

function getBracketPhase(tournament: AdminTournament): AdminBracketPhase {
  if (tournament.status === 'active') return 'active'
  if (tournament.status === 'completed') return 'completed'
  return 'setup'
}

function buildAdminBracketConfig(
  tournament: AdminTournament,
  players: Player[],
  phase: AdminBracketPhase,
  colorSeed = 0,
): AdminBracketConfig {
  if (isDoubleEliminationTournament(tournament)) {
    return {
      type: 'double',
      title: 'Double elimination bracket',
      brackets: buildAdminDoubleEliminationBrackets(tournament, players, phase, colorSeed),
    }
  }

  return {
    type: 'single',
    title: `${tournament.format} bracket`,
    rounds: buildAdminSingleEliminationRounds(tournament, players, phase, { colorSeed }),
  }
}

function buildAdminMultiStageBracketConfig(
  tournament: AdminTournament,
  players: Player[],
  phase: AdminBracketPhase,
  colorSeed = 0,
): AdminBracketConfig {
  const phaseTwoPlayers = players.slice(0, Math.min(8, Math.max(2, players.length)))
  const phaseTwoPhase = isMultiStagePhaseTwo(tournament) ? phase : 'setup'

  return {
    type: 'single',
    title: 'Phase Two knockout bracket',
    rounds: buildAdminSingleEliminationRounds(
      { ...tournament, format: 'Single elimination' },
      phaseTwoPlayers,
      phaseTwoPhase,
      { colorSeed },
    ),
  }
}

function getAllAdminBracketRounds(config: AdminBracketConfig) {
  if (config.type === 'single') return config.rounds
  return [
    ...config.brackets.winners,
    ...config.brackets.losers,
    ...config.brackets.final,
  ]
}

function buildPublishedAdminBracketSnapshot(
  config: AdminBracketConfig,
  tournament: AdminTournament,
  playerCount: number,
) {
  return JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    format: tournament.format,
    playerCount,
    ...config,
  })
}

function parsePublishedAdminBracketSnapshot(value?: string): AdminBracketConfig | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<AdminBracketConfig>
    if (parsed.type === 'single' && Array.isArray(parsed.rounds)) {
      return {
        type: 'single',
        title: typeof parsed.title === 'string' ? parsed.title : 'Single elimination bracket',
        rounds: sanitizeAdminBracketRounds(parsed.rounds),
      }
    }

    if (parsed.type === 'double' && parsed.brackets && typeof parsed.brackets === 'object') {
      const brackets = parsed.brackets as Partial<Record<AdminBracketView, unknown>>
      const winners = sanitizeAdminBracketRounds(brackets.winners)
      return {
        type: 'double',
        title: typeof parsed.title === 'string' ? parsed.title : 'Double elimination bracket',
        brackets: {
          winners,
          losers: normalizeAdminLowerBracketRounds(
            sanitizeAdminBracketRounds(brackets.losers),
            buildLowerBracketRoundLabelsFromWinnerRounds(winners.map((round) => round.name)),
            winners[0]?.name ? bracketRoundCodeFromName(winners[0].name) : undefined,
          ),
          final: sanitizeAdminBracketRounds(brackets.final),
        },
      }
    }
  } catch {
    return null
  }

  return null
}

function sanitizeAdminBracketRounds(value: unknown): AdminBracketRound[] {
  if (!Array.isArray(value)) return []

  return value
    .map((round): AdminBracketRound | null => {
      if (!round || typeof round !== 'object') return null
      const row = round as { name?: unknown; matches?: unknown; note?: unknown; role?: unknown }
      if (typeof row.name !== 'string' || !Array.isArray(row.matches)) return null
      return {
        name: row.name,
        ...(typeof row.note === 'string' ? { note: row.note } : {}),
        ...(isAdminBracketRoundRole(row.role) ? { role: row.role } : {}),
        matches: row.matches
          .map((match) => sanitizeAdminBracketMatch(match))
          .filter((match): match is AdminBracketMatch => Boolean(match)),
      }
    })
    .filter((round): round is AdminBracketRound => Boolean(round))
}

function isAdminBracketRoundRole(value: unknown): value is AdminBracketRoundRole {
  return value === 'minor' || value === 'major' || value === 'final'
}

function sanitizeAdminBracketMatch(value: unknown): AdminBracketMatch | null {
  if (!value || typeof value !== 'object') return null
  const match = value as Record<string, unknown>
  if (typeof match.white !== 'string' || typeof match.black !== 'string') return null

  const winner = match.winner === 'white' || match.winner === 'black' ? match.winner : undefined
  const targetSlot = match.targetSlot === 'white' || match.targetSlot === 'black' ? match.targetSlot : undefined
  return {
    board: typeof match.board === 'number' ? match.board : Number(match.board) || 1,
    matchNumber: typeof match.matchNumber === 'number' ? match.matchNumber : undefined,
    white: match.white,
    whiteProfileId: typeof match.whiteProfileId === 'string' ? match.whiteProfileId : undefined,
    whiteRating: typeof match.whiteRating === 'number' || typeof match.whiteRating === 'string' ? match.whiteRating : '',
    black: match.black,
    blackProfileId: typeof match.blackProfileId === 'string' ? match.blackProfileId : undefined,
    blackRating: typeof match.blackRating === 'number' || typeof match.blackRating === 'string' ? match.blackRating : '',
    blackScore: typeof match.blackScore === 'string' ? match.blackScore : undefined,
    live: Boolean(match.live),
    next: typeof match.next === 'number' ? match.next : undefined,
    pending: Boolean(match.pending),
    targetSlot,
    whiteScore: typeof match.whiteScore === 'string' ? match.whiteScore : undefined,
    winner,
  }
}

function buildAdminDoubleEliminationBrackets(
  tournament: AdminTournament,
  players: Player[],
  phase: AdminBracketPhase,
  colorSeed = 0,
): Record<AdminBracketView, AdminBracketRound[]> {
  const winnerMatchCounts = bracketRoundCounts(players.length).map((count) => Math.max(1, count / 2))
  const matchNumbers = buildDoubleEliminationMatchNumbering(winnerMatchCounts)
  const winnersPhase = phase === 'active' && !/winner|w-/i.test(tournament.round)
    ? 'completed'
    : phase
  const winnersForceRound = phase === 'active' && !/winner|w-/i.test(tournament.round)
    ? Number.POSITIVE_INFINITY
    : undefined
  const winners = buildAdminSingleEliminationRounds(tournament, players, winnersPhase, {
    forceActiveRound: winnersForceRound,
    matchNumbers: matchNumbers.winners,
    prefix: 'W-',
    colorSeed,
  })
  const firstLoserPool = adminLosersFromRound(winners[0], winners[0]?.name ?? 'W-Round')
  const incomingLosers = winners
    .slice(1, -1)
    .map((round) => {
      const losers = adminLosersFromRound(round, round.name)
      return losers.length > 2 ? [...losers].reverse() : losers
    })
  const loserRounds = buildAdminLoserRounds(
    firstLoserPool,
    incomingLosers,
    phase,
    matchNumbers.losers,
  )
  const winnersFinal = winners[winners.length - 1]
  const winnersFinalMatch = winnersFinal?.matches[0]
  const loserFinalOpponent = loserRounds.length
    ? adminWinnerName(loserRounds[loserRounds.length - 1].matches[0], loserRounds[loserRounds.length - 1].name, 1)
    : firstLoserPool[0] ?? 'Lower bracket survivor'
  const loserFinalPairing = makeBracketPairing(
    adminLoserName(winnersFinalMatch, winnersFinal?.name ?? 'W-Final', 1),
    loserFinalOpponent,
    1,
    undefined,
    '',
    '',
    undefined,
    undefined,
    undefined,
    matchNumbers.lowerFinal,
  )
  const loserFinal = buildBracketMatchForPhase(
    loserFinalPairing,
    phase === 'active' || phase === 'completed' ? phase : 'setup',
    'white',
    phase === 'active' && !/grand|reset/i.test(tournament.round),
  )
  const grandFinal = buildBracketMatchForPhase(
    makeBracketPairing(
      adminWinnerName(winnersFinalMatch, winnersFinal?.name ?? 'W-Final', 1),
      adminWinnerName(loserFinal, 'Lower Final', 1),
      1,
      undefined,
      '',
      '',
      undefined,
      undefined,
      undefined,
      matchNumbers.grandFinal,
    ),
    phase === 'completed' || (phase === 'active' && /grand/i.test(tournament.round)) ? phase : 'setup',
    'white',
    phase === 'active' && /grand/i.test(tournament.round),
  )

  return {
    winners,
    losers: [
      ...loserRounds,
      {
        name: 'Lower Final',
        role: 'major',
        matches: [loserFinal],
      },
    ],
    final: [
      { name: 'Grand Final', role: 'final', matches: [grandFinal] },
      { name: 'Reset if needed', role: 'final', matches: [buildOpenMatch(makeBracketPairing(`Winner of ${matchNumbers.grandFinal}`, 'Reset only if needed', 1, undefined, '', '', undefined, undefined, undefined, matchNumbers.resetFinal))] },
    ],
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

function buildAdminSingleEliminationRounds(
  tournament: AdminTournament,
  players: Player[],
  phase: AdminBracketPhase,
  options: { colorSeed?: number; forceActiveRound?: number; matchNumbers?: number[][]; prefix?: string } = {},
): AdminBracketRound[] {
  const entrants: BracketEntrant[] = players.map((player) => ({ name: player.name, profileId: player.profileId ?? player.id, rating: player.rating }))
  const counts = bracketRoundCounts(entrants.length)
  const bracketSize = nextPowerOfTwo(entrants.length)
  const labels = counts.map((count) => `${options.prefix ?? ''}${bracketRoundName(count)}`)
  const activeRound = options.forceActiveRound ?? activeAdminBracketRoundIndex(labels, tournament, phase)
  let current = openingBracketSlots(entrants, bracketSize)

  return labels.map((name, roundIndex) => {
    const complete = phase === 'completed' || (phase === 'active' && roundIndex < activeRound)
    const live = phase === 'active' && roundIndex === activeRound
    const matches = pairEntrants(current).map(([first, second], matchIndex) => {
      const firstGetsWhite = seededBoolean(options.colorSeed ?? 0, (roundIndex + 1) * 101 + (matchIndex + 1) * 17)
      const white = firstGetsWhite ? first : second
      const black = firstGetsWhite ? second : first
      const hasTarget = roundIndex < labels.length - 1
      const matchNumber = options.matchNumbers?.[roundIndex]?.[matchIndex]
      return buildBracketMatchForPhase(
        makeBracketPairing(
          white.name,
          black.name,
          matchIndex + 1,
          hasTarget ? Math.floor(matchIndex / 2) : undefined,
          white.rating,
          black.rating,
          white.profileId,
          black.profileId,
          hasTarget ? (matchIndex % 2 === 0 ? 'white' : 'black') : undefined,
          matchNumber,
        ),
        complete ? 'completed' : live ? 'active' : 'setup',
        matchIndex % 2 === 0 ? 'white' : 'black',
        live,
      )
    })
    const winners: BracketEntrant[] = matches.map((match, index) => ({
      name: adminWinnerName(match, name, index + 1),
      rating: '',
    }))
    current = winners

    return { name, matches }
  })
}

function bracketRoundCounts(playerCount: number) {
  const bracketSize = nextPowerOfTwo(playerCount)
  const counts = [bracketSize]
  let next = counts[counts.length - 1] / 2
  while (next >= 2) {
    counts.push(next)
    next /= 2
  }
  return counts
}

function nextPowerOfTwo(value: number) {
  let result = 1
  while (result < value) result *= 2
  return Math.max(2, result)
}

function openingBracketSlots(entrants: BracketEntrant[], bracketSize: number) {
  const slots: BracketEntrant[] = []
  const firstRoundMatches = Math.max(1, bracketSize / 2)
  const byeCount = Math.max(0, bracketSize - entrants.length)
  let playerIndex = 0

  for (let matchIndex = 0; matchIndex < firstRoundMatches; matchIndex += 1) {
    const white = entrants[playerIndex++] ?? bracketByeEntrant
    const black = matchIndex >= firstRoundMatches - byeCount
      ? bracketByeEntrant
      : entrants[playerIndex++] ?? bracketByeEntrant
    slots.push(white, black)
  }

  return slots
}

function pairEntrants<T>(entrants: T[]) {
  const pairs: Array<[T, T]> = []
  for (let index = 0; index < entrants.length - 1; index += 2) {
    pairs.push([entrants[index], entrants[index + 1]])
  }
  return pairs
}

function activeAdminBracketRoundIndex(
  labels: string[],
  tournament: AdminTournament,
  phase: AdminBracketPhase,
) {
  if (phase === 'completed') return labels.length
  if (phase !== 'active') return 0

  if (tournament.currentRound && tournament.currentRound > 0) {
    return Math.max(0, Math.min(labels.length - 1, tournament.currentRound - 1))
  }

  const current = tournament.round.toLowerCase()
  const parsed = labels.findIndex((label) => {
    const lower = label.toLowerCase()
    if (current.includes('final') && lower.includes('final') && !lower.includes('semi')) return true
    if (current.includes('semi') && lower.includes('semi')) return true
    if (current.includes('quarter') && lower.includes('quarter')) return true
    const count = /round of\s*(\d+)/i.exec(lower)?.[1]
    return Boolean(count && current.includes(count))
  })

  if (parsed >= 0) return parsed
  return Math.max(0, Math.min(labels.length - 1, labels.length - 2))
}

function adminLosersFromRound(round: AdminBracketRound | undefined, sourceLabel: string) {
  return (round?.matches ?? [])
    .map((match, index) => adminLoserName(match, sourceLabel, index + 1))
    .filter((name) => !isByeName(name))
}

function buildAdminLoserRounds(
  firstPool: string[],
  incomingPools: string[][],
  phase: AdminBracketPhase,
  matchNumbers: number[][],
): AdminBracketRound[] {
  const rounds: AdminBracketRound[] = []
  let pool = [...firstPool]
  const complete = phase === 'active' || phase === 'completed'

  const buildLoserMatch = (
    white: string,
    black: string,
    index: number,
    next: number,
    targetSlot: AdminBracketSide,
    matchNumber?: number,
  ) => buildBracketMatchForPhase(
    makeBracketPairing(white, black, index + 1, next, '', '', undefined, undefined, targetSlot, matchNumber),
    complete ? 'completed' : 'setup',
    index % 2 === 0 ? 'white' : 'black',
  )

  const pushRound = (
    role: AdminBracketRoundRole,
    matches: AdminBracketMatch[],
  ) => {
    rounds.push({
      name: `Lower Round ${rounds.length + 1}`,
      role,
      matches,
    })
  }

  const reducePool = (feedsDropIn = false) => {
    if (pool.length < 2) return
    const pairable = pool.length % 2 === 0 ? pool : pool.slice(0, -1)
    const carry = pool.length % 2 === 0 ? [] : [pool[pool.length - 1]]
    const roundNumber = rounds.length + 1
    const roundMatchNumbers = matchNumbers[rounds.length] ?? []
    const matches = pairEntrants(pairable).map(([white, black], index) => buildLoserMatch(
      white,
      black,
      index,
      feedsDropIn ? index : Math.floor(index / 2),
      feedsDropIn ? 'white' : index % 2 === 0 ? 'white' : 'black',
      roundMatchNumbers[index],
    ))
    const winners = matches.map((match, index) => (
      adminWinnerName(match, `L${roundNumber}`, index + 1)
    ))
    pushRound('minor', matches)
    pool = [...winners, ...carry]
  }

  const pairDropIns = (incoming: string[]) => {
    if (!incoming.length) return
    if (!pool.length) {
      pool = [...incoming]
      return
    }

    const pairCount = Math.min(pool.length, incoming.length)
    const roundNumber = rounds.length + 1
    const roundMatchNumbers = matchNumbers[rounds.length] ?? []
    const matches = Array.from({ length: pairCount }, (_, index) => buildLoserMatch(
      pool[index],
      incoming[index],
      index,
      Math.floor(index / 2),
      index % 2 === 0 ? 'white' : 'black',
      roundMatchNumbers[index],
    ))
    const winners = matches.map((match, index) => (
      adminWinnerName(match, `L${roundNumber}`, index + 1)
    ))
    pushRound('major', matches)
    pool = [
      ...winners,
      ...pool.slice(pairCount),
      ...incoming.slice(pairCount),
    ]
  }

  incomingPools.forEach((incoming) => {
    reducePool(incoming.length > 0)
    pairDropIns(incoming)
  })

  while (pool.length > 1) {
    reducePool()
  }

  return normalizeAdminLowerBracketRounds(rounds, rounds.map((round) => round.name))
}

function normalizeAdminLowerBracketRounds(
  rounds: AdminBracketRound[],
  preferredLabels: string[] = [],
  firstWinnerRoundCode?: string,
): AdminBracketRound[] {
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
  const lastRoundIndex = rounds.length - 1

  return rounds.map((round, index) => {
    const finalFeed = index === lastRoundIndex
    return {
      ...round,
      matches: round.matches.map((match) => ({
        ...rewriteAdminLowerBracketPlaceholders(match, rawToLabel, firstWinnerRoundCode, index, labels, codeToIndex),
        ...(finalFeed ? { next: 0, targetSlot: 'black' as AdminBracketSide } : {}),
      })),
      name: labels[index] ?? round.name,
    }
  })
}

function buildLowerBracketCodeIndex(labels: string[]) {
  const entries: Array<[string, number]> = []
  labels.forEach((label, index) => {
    entries.push([bracketRoundCodeFromName(label).toUpperCase(), index])
    lowerBracketLegacyCodes(index).forEach((code) => entries.push([code, index]))
    const unprefixed = label.replace(/\b(?:minor|major)\s+/i, '')
    if (/minor/i.test(label)) {
      entries.push([bracketRoundCodeFromName(`${unprefixed} survivor`).toUpperCase(), index])
      entries.push([bracketRoundCodeFromName(`${unprefixed} Qualifier`).toUpperCase(), index])
      if (index === 0 && /quarterfinal/i.test(label)) {
        entries.push([bracketRoundCodeFromName('Round of 16 survivor').toUpperCase(), index])
        entries.push([bracketRoundCodeFromName('Round of 16 Qualifier').toUpperCase(), index])
      }
    }
    if (/major/i.test(label)) {
      entries.push([bracketRoundCodeFromName(unprefixed).toUpperCase(), index])
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

function rewriteAdminLowerBracketPlaceholders(
  match: AdminBracketMatch,
  rawToLabel: Map<string, string>,
  firstWinnerRoundCode?: string,
  roundIndex?: number,
  labels?: string[],
  codeToIndex?: Map<string, number>,
): AdminBracketMatch {
  return {
    ...match,
    black: rewriteLowerBracketPlaceholder(match.black, rawToLabel, firstWinnerRoundCode, roundIndex, labels, codeToIndex),
    white: rewriteLowerBracketPlaceholder(match.white, rawToLabel, firstWinnerRoundCode, roundIndex, labels, codeToIndex),
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
    rewritten = label ? `Winner ${bracketRoundCodeFromName(label)}-${winner[2]}` : value
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
  if (!pointsToFutureStage) {
    return rewritten
  }
  return `Winner ${bracketRoundCodeFromName(labels[roundIndex - 1])}-${stageWinner[2]}`
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

function adminWinnerName(match: AdminBracketMatch | undefined, sourceLabel: string, matchNumber: number) {
  if (!match) return `Winner ${bracketRoundCodeFromName(sourceLabel)}-${matchNumber}`
  if (match.winner === 'white') return match.white
  if (match.winner === 'black') return match.black
  if (match.matchNumber) return `Winner of ${match.matchNumber}`
  return `Winner ${bracketRoundCodeFromName(sourceLabel)}-${matchNumber}`
}

function adminLoserName(match: AdminBracketMatch | undefined, sourceLabel: string, matchNumber: number) {
  if (!match) return `Loser ${bracketRoundCodeFromName(sourceLabel)}-${matchNumber}`
  if (match.winner === 'white') return match.black
  if (match.winner === 'black') return match.white
  if (match.matchNumber) return `Loser of ${match.matchNumber}`
  return `Loser ${bracketRoundCodeFromName(sourceLabel)}-${matchNumber}`
}

function buildBracketMatchForPhase(
  pairing: Pairing,
  phase: AdminBracketPhase,
  winner: AdminBracketSide,
  live = false,
) {
  const byeWinner = bracketByeWinner(pairing)
  if (byeWinner) return buildByeMatch(pairing, byeWinner)
  if (!hasKnownPlayers(pairing) || phase === 'setup') return buildOpenMatch(pairing)
  if (live) return buildLiveMatch(pairing)
  return buildCompletedMatch(pairing, winner)
}

function makeBracketPairing(
  white: string,
  black: string,
  board: number,
  next?: number,
  whiteRating: number | string = '',
  blackRating: number | string = '',
  whiteProfileId?: string,
  blackProfileId?: string,
  targetSlot?: AdminBracketSide,
  matchNumber?: number,
): Pairing {
  const pairing: Pairing = {
    black,
    blackProfileId,
    blackRating,
    board,
    white,
    whiteProfileId,
    whiteRating,
  }
  if (matchNumber) pairing.matchNumber = matchNumber
  if (next !== undefined) pairing.next = next
  if (targetSlot) pairing.targetSlot = targetSlot
  return pairing
}

function buildOpenMatch(pairing: Pairing): AdminBracketMatch {
  return {
    ...pairing,
    blackScore: '',
    pending: !hasKnownPlayers(pairing),
    whiteScore: '',
  }
}

function buildCompletedMatch(pairing: Pairing, winner: AdminBracketSide): AdminBracketMatch {
  return {
    ...pairing,
    blackScore: winner === 'black' ? '1' : '0',
    pending: false,
    whiteScore: winner === 'white' ? '1' : '0',
    winner,
  }
}

function buildByeMatch(pairing: Pairing, winner: AdminBracketSide): AdminBracketMatch {
  return {
    ...pairing,
    blackScore: '',
    pending: false,
    whiteScore: '',
    winner,
  }
}

function buildLiveMatch(pairing: Pairing): AdminBracketMatch {
  return {
    ...pairing,
    blackScore: '',
    live: true,
    pending: false,
    whiteScore: '',
  }
}

function bracketByeWinner(pairing: Pairing): AdminBracketSide | null {
  const whiteBye = isByeName(pairing.white)
  const blackBye = isByeName(pairing.black)
  if (whiteBye && !blackBye) return 'black'
  if (blackBye && !whiteBye) return 'white'
  return null
}

function hasKnownPlayers(pairing: Pairing) {
  return isKnownBracketPlayer(pairing.white) && isKnownBracketPlayer(pairing.black)
}

function isPlayableMatch(match: AdminBracketMatch) {
  return hasKnownPlayers(match) && !match.pending && !match.winner
}

function isKnownBracketPlayer(name: string) {
  return (
    name !== 'TBD'
    && !isByeName(name)
    && !name.startsWith('Winner ')
    && !name.startsWith('Loser ')
    && !name.startsWith('Reset ')
  )
}

function isByeName(name: string) {
  return name === 'Bye'
}

function bracketBoardKey(roundName: string, matchIndex: number) {
  return `bracket:${roundName}:${matchIndex}`
}

function bracketRoundName(playersInRound: number) {
  if (playersInRound === 2) return 'Final'
  if (playersInRound === 4) return 'Semifinal'
  if (playersInRound === 8) return 'Quarterfinal'
  return `Round of ${playersInRound}`
}

function bracketRoundCodeFromName(label: string) {
  const survivor = /surviv(?:or|al)/i.test(label)
  const qualifier = /qualifier/i.test(label)
  const suffix = survivor ? 'S' : qualifier ? 'Q' : ''
  const prefix = /minor/i.test(label) ? 'MN' : /major/i.test(label) ? 'MJ' : ''
  if (/play[-\s]?in/i.test(label)) return 'PI'
  if (/quarterfinal/i.test(label)) return `${prefix}QF${suffix}`
  if (/semifinal/i.test(label)) return `${prefix}SF${suffix}`
  if (/final/i.test(label)) return `${prefix}F${suffix}`
  const count = /round of\s*(\d+)/i.exec(label)?.[1]
  if (count) return `${prefix}R${count}${suffix}`
  const lowerRound = /lower round\s*(\d+)/i.exec(label)?.[1]
  if (lowerRound) return `LR${lowerRound}`
  const loserRound = /l-round\s*(\d+)/i.exec(label)?.[1]
  if (loserRound) return `L${loserRound}`
  return label.replace(/[^A-Za-z0-9]+/g, '').slice(0, 6) || 'R'
}

function buildBracketRoundKey(rounds: AdminBracketRound[]) {
  return rounds
    .map((round) => `${round.name}:${round.matches.map((match) => `${match.white}-${match.black}-${match.winner ?? ''}-${match.live ? 'live' : ''}`).join(',')}`)
    .join('|')
}

function bracketPlayerState(match: AdminBracketMatch, side: AdminBracketSide) {
  if (!match.winner) return 'neutral'
  return match.winner === side ? 'winner' : 'muted'
}

function buildMovePairs(moves: string[]) {
  const rows: Array<{ number: number; white: string; black: string }> = []
  for (let index = 0; index < moves.length; index += 2) {
    rows.push({
      number: index / 2 + 1,
      white: moves[index] ?? '',
      black: moves[index + 1] ?? '',
    })
  }
  return rows
}

function tournamentToEditForm(item: AdminTournament): TournamentInput {
  return {
    slug: item.slug || buildTournamentSlugBase(item.name || item.format),
    name: item.name,
    status: item.status,
    format: item.format,
    timeControl: item.timeControl,
    capacity: item.capacity || undefined,
    location: item.location ?? '',
    description: item.description ?? '',
    startsAt: item.startsAt,
  }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function tabDescription(tab: TournamentTab) {
  if (tab === 'draft') return 'Unpublished tournaments being prepared'
  if (tab === 'active') return 'Tournaments currently being run'
  if (tab === 'completed') return 'Finished tournaments and media'
  if (tab === 'archived') return 'Hidden or retired tournament records'
  return 'Prepare registrations, pairings and publishing'
}

function emptyTitle(tab: TournamentTab) {
  if (tab === 'draft') return 'No draft tournaments'
  if (tab === 'active') return 'Nothing live'
  if (tab === 'completed') return 'No completed events'
  if (tab === 'archived') return 'No archived tournaments'
  return 'No upcoming tournaments'
}

function buildTournamentSlugBase(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || 'draft-tournament'
}

function buildUniqueTournamentSlugBase(name: string, tournaments: AdminTournament[], currentRowId?: string) {
  const base = buildTournamentSlugBase(name)
  const existing = new Set(
    tournaments
      .filter((tournament) => tournament.rowId !== currentRowId)
      .map((tournament) => tournament.slug),
  )
  let slug = base
  let suffix = 2
  while (existing.has(slug)) {
    slug = `${base}-${suffix}`
    suffix += 1
  }
  return slug
}

function formatDate(value?: string) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

function formatTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
}

function toDateTimeLocalValue(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function fromDateTimeLocalValue(value: string) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function buildPreviewUrl(windowKey: WindowKey, device: DeviceKey, guestMode: boolean, previewEmail: string) {
  const target = previewTargetForDevice(device)
  const url = new URL(target.routeMode === 'query' ? '/' : previewRoutes[windowKey], withTrailingSlash(target.base))
  url.searchParams.set('adminPreview', '1')
  url.searchParams.set('screen', windowKey)
  url.searchParams.set('device', device)
  url.searchParams.set('mode', guestMode ? 'guest' : 'member')
  url.searchParams.set('previewEmail', previewEmail.trim() || defaultPreviewEmail)
  return url.toString()
}

function previewTargetForDevice(device: DeviceKey): { base: string; routeMode: 'path' | 'query' } {
  if (device === 'web' && isUsablePreviewBase(webPreviewBase)) return { base: webPreviewBase, routeMode: 'path' }
  if (device !== 'web' && isUsablePreviewBase(mobilePreviewBase)) return { base: mobilePreviewBase, routeMode: 'query' }
  if (isUsablePreviewBase(appPreviewBase)) return { base: appPreviewBase, routeMode: 'path' }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const port = device === 'web' ? '8062' : '8063'
    return { base: `${window.location.protocol}//${window.location.hostname}:${port}`, routeMode: device === 'web' ? 'path' : 'query' }
  }

  return { base: window.location.origin, routeMode: 'path' }
}

function isUsablePreviewBase(value?: string): value is string {
  if (!value?.trim()) return false

  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function withTrailingSlash(value: string) {
  return value.endsWith('/') ? value : `${value}/`
}

function previewHostLabel(value: string) {
  try {
    const url = new URL(value)
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}`
  } catch {
    return 'Live app'
  }
}

export default App
