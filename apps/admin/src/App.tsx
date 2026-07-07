import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Chess, type Square } from 'chess.js'
import './App.css'
import { appwriteReady } from './lib/appwrite'
import {
  blockIdentity,
  blockIp,
  createAdminProfile,
  createTournament,
  formatAdminError,
  getAdminSession,
  loadAdminProfiles,
  loadTournamentRegistrations,
  loadBlockLists,
  loadAdminTournaments,
  signInAdmin,
  signOutAdmin,
  unblockIdentity,
  unblockIp,
  updateAdminStatus,
  updateRegistrationStatus,
  updateTournament,
  type AdminRegistration,
  type AdminRegistrationStatus,
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
  type TournamentInput,
} from './lib/adminData'
import { adminQueues, type TournamentStatus } from './lib/juchess'

type Screen = 'dashboard' | 'windows' | 'tournaments' | 'players' | 'news' | 'announcements'
type TournamentTab = TournamentStatus
type TournamentDataSource = 'cloud' | 'unavailable'
type WindowKey = 'home' | 'tournaments' | 'games' | 'tools' | 'profile' | 'auth'
type DeviceKey = 'ios' | 'android' | 'tablet' | 'web'

type Player = {
  id: string
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

type Pairing = {
  board: number
  white: string
  whiteRating: number | string
  black: string
  blackRating: number | string
}

type AdminBracketSide = 'white' | 'black'

type AdminBracketMatch = Pairing & {
  whiteScore?: string
  blackScore?: string
  winner?: AdminBracketSide
  live?: boolean
  pending?: boolean
}

type AdminBracketRound = {
  name: string
  matches: AdminBracketMatch[]
}

const navItems: Array<{ key: Screen; label: string; icon: string }> = [
  { key: 'dashboard', label: 'Dashboard', icon: '▤' },
  { key: 'windows', label: 'App Windows', icon: '▧' },
  { key: 'tournaments', label: 'Tournaments', icon: '♞' },
  { key: 'players', label: 'Players', icon: '◍' },
  { key: 'news', label: 'News', icon: '◫' },
  { key: 'announcements', label: 'Announcements', icon: '◈' },
]

const tournamentTabs: TournamentTab[] = ['draft', 'upcoming', 'active', 'completed', 'archived']
const createSteps = ['Basic information', 'Tournament format'] as const
const formatOptions = [
  { value: 'Swiss', icon: '♟', layout: 'Standings + current pairings' },
  { value: 'Round robin', icon: '◍', layout: 'Standings + schedule' },
  { value: 'Double round robin', icon: '◎', layout: 'Double cycle standings' },
  { value: 'Single elimination', icon: '▲', layout: 'Bracket only' },
  { value: 'Double elimination', icon: '⧗', layout: 'Winners + losers bracket' },
  { value: 'League', icon: '▤', layout: 'League table + fixtures' },
  { value: 'Team', icon: '⚑', layout: 'Team boards + match points' },
  { value: 'Arena', icon: '⚡', layout: 'Leaderboard + streaks' },
  { value: 'Multi-stage', icon: '⬒', layout: 'Stage tabs + finals bracket' },
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
      {screen === 'announcements' ? (
        <AnnouncementsScreen
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

  const statCards = [
    { label: 'Total players', value: '248', icon: '◍', tint: '#F3E4E6', delta: '+12 this month', color: '#2E7D5B' },
    { label: 'Active tournaments', value: String(activeCount), icon: '♞', tint: '#EAF0FA', delta: `${activeCount} live now`, color: '#8B8577' },
    { label: 'Upcoming tournaments', value: String(upcomingCount), icon: '⚔', tint: '#EAF6F0', delta: `${tournaments.length} total events`, color: '#8B8577' },
    { label: 'Pending registrations', value: String(adminQueues.pendingRegistrations), icon: '⏳', tint: '#FBF1E2', delta: 'Needs review', color: '#C77D0A' },
  ]

  const recentActivity = [
    { icon: '♞', tint: '#F3E4E6', title: 'Autumn Open - Round 3 pairings generated', meta: 'By Amina Osei · Swiss', time: '12m ago' },
    { icon: '✓', tint: '#EAF6F0', title: 'JU Grand Circuit published to public site', meta: 'Visibility: Public', time: '1h ago' },
    { icon: '⚑', tint: '#FBEAEA', title: 'Result disputed on Board 4', meta: 'Knight\'s Gambit Cup', time: '2h ago' },
    { icon: '+', tint: '#EAF0FA', title: '6 new registrations approved', meta: 'Semester League', time: '4h ago' },
    { icon: '▦', tint: '#FBF1E2', title: 'Winner photos uploaded', meta: 'Spring Invitational', time: 'Yesterday' },
  ]

  const disputes = [
    { match: 'Board 4 · Rahimi vs Carter', event: 'Knight\'s Gambit Cup', reason: 'Illegal move claim', severity: 'HIGH', tint: '#FBEAEA', color: '#B23A3A' },
    { match: 'Board 2 · Tan vs Nair', event: 'Autumn Open', reason: 'Clock dispute', severity: 'MED', tint: '#FBF1E2', color: '#C77D0A' },
    { match: 'Board 7 · Rossi vs Bianchi', event: 'Semester League', reason: 'Score mismatch', severity: 'LOW', tint: '#F0EBE1', color: '#8B8577' },
  ]

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
            <strong>Disputed results</strong>
            <span className="pill danger">3 open</span>
          </div>
          {disputes.map((item) => (
            <div className="dispute-row" key={item.match}>
              <div>
                <strong>{item.match}</strong>
                <small>{item.event} · {item.reason}</small>
              </div>
              <span style={{ color: item.color, background: item.tint }}>{item.severity}</span>
            </div>
          ))}
        </section>
      </div>

      <div className="dashboard-grid two">
        <section className="panel-card">
          <div className="panel-title">Tournament status</div>
          <TournamentMiniTable tournaments={tournaments} />
        </section>
        <section className="panel-card">
          <div className="panel-title">Operational queues</div>
          <QueueRow icon="⏳" tint="#FBF1E2" label="Pending registrations" count={adminQueues.pendingRegistrations} action="Review" onClick={goTournaments} />
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
  const [tab, setTab] = useState<TournamentTab>('draft')
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
  const [publishedPairings, setPublishedPairings] = useState<Record<string, boolean>>({})
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
  const canSaveDraft = Boolean(form.name.trim()) && !submitting
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

  function update<K extends keyof TournamentInput>(key: K, value: TournamentInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
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

    setSubmitting(true)
    setMessage(null)

    try {
      const payload: TournamentInput = {
        ...form,
        slug: isEditing ? form.slug : buildTournamentSlug(form.name),
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
    if (publishedPairings[key]) {
      setMessage(`${item.name} is published. Shuffle is locked.`)
      return
    }

    setShuffleSeeds((current) => ({ ...current, [key]: (current[key] ?? 0) + 1 }))
    setMessage(isKnockoutTournament(item) ? `${item.name} bracket shuffled.` : `${item.name} pairings shuffled.`)
  }

  function handlePublishPairings(item: AdminTournament) {
    const key = tournamentKey(item)
    setPublishedPairings((current) => ({ ...current, [key]: true }))
    setMessage(isKnockoutTournament(item) ? `${item.name} bracket published. Shuffle is locked.` : `${item.name} pairings published. Shuffle is locked.`)
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

  if (managedTournament) {
    return (
      <div className="tournament-screen">
        <TournamentManageView
          disabled={submitting}
          onBack={() => setManageTournamentKey('')}
          onComplete={(item) => {
            void handleStatusChange(item, 'completed')
            setManageTournamentKey('')
          }}
          onMessage={setMessage}
          onPublish={handlePublishPairings}
          onShuffle={handleShufflePairings}
          published={Boolean(publishedPairings[tournamentKey(managedTournament)])}
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
                  <label className="wide">Tournament name<input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Spring Championship" required /></label>
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
  onBack,
  onComplete,
  onMessage,
  onPublish,
  onShuffle,
  published,
  shuffleSeed,
  tournament,
}: {
  disabled: boolean
  onBack: () => void
  onComplete: (item: AdminTournament) => void
  onMessage: (message: string) => void
  onPublish: (item: AdminTournament) => void
  onShuffle: (item: AdminTournament) => void
  published: boolean
  shuffleSeed: number
  tournament: AdminTournament
}) {
  const knockout = isKnockoutTournament(tournament)
  const playStage = knockout ? 'bracket' : 'rounds'
  const [stage, setStage] = useState(playStage)
  const tournamentPlayers = buildTournamentPlayers(shuffleSeed)
  const pairings = buildPairings(tournamentPlayers)
  const bracketRounds = buildAdminBracketRounds(pairings, published || tournament.status !== 'upcoming', tournament.status === 'active')
  const shuffleLocked = disabled || published
  const publishLocked = disabled || published

  useEffect(() => {
    setStage(playStage)
  }, [playStage, tournament.rowId, tournament.id])

  const manageMode = tournament.status === 'upcoming' ? 'Prepare Tournament' : 'Live Tournament'
  const publishState = published ? 'Published - shuffle locked' : 'Draft pairings'

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
          {tournament.status === 'upcoming' ? (
            <>
              <button type="button" className="mini-button ghost" disabled={shuffleLocked} onClick={() => onShuffle(tournament)}>
                Shuffle
              </button>
              <button type="button" className="mini-button dark" disabled={publishLocked} onClick={() => onPublish(tournament)}>
                {published ? 'Published' : 'Publish'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="mini-button" disabled={disabled} onClick={() => onMessage('Round closed.')}>End current round</button>
              <button type="button" className="mini-button dark" disabled={disabled} onClick={() => onComplete(tournament)}>Complete tournament</button>
            </>
          )}
        </div>
      </div>

      <div className="manage-nav">
        {['participants', playStage, 'procedure', 'standings'].map((item) => (
          <button key={item} type="button" className={stage === item ? 'active' : undefined} onClick={() => setStage(item)}>
            {capitalize(item)}
          </button>
        ))}
      </div>

      <section className={`manage-panel ${stage === 'bracket' ? 'website-bracket-host' : ''}`}>
        {stage === 'participants' ? (
          <>
            <div className="manage-panel-head">Participants</div>
            {tournamentPlayers.map((player, index) => (
              <div key={player.id} className="manage-row">
                <strong>{index + 1}. {player.name}</strong>
                <span>{player.rating}</span>
              </div>
            ))}
          </>
        ) : null}
        {stage === 'rounds' ? (
          <>
            <div className="manage-panel-head">
              <strong>{tournament.status === 'upcoming' ? 'Round 1 pairings' : 'Live — current round'}</strong>
              <span>{publishState}</span>
            </div>
            {pairings.map((pairing) => (
              <div key={pairing.board} className="pairing-row">
                <span>#{pairing.board}</span>
                <strong>{pairing.white}<small>{pairing.whiteRating}</small></strong>
                <em>vs</em>
                <strong>{pairing.black}<small>{pairing.blackRating}</small></strong>
              </div>
            ))}
          </>
        ) : null}
        {stage === 'bracket' ? (
          <AdminBracketPreview rounds={bracketRounds} title={`${tournament.format} bracket`} />
        ) : null}
        {stage === 'procedure' ? (
          <>
            <div className="manage-panel-head">Tournament procedure</div>
            {[
              'Verify all boards are ready before starting the clock.',
              'Confirm both players present; apply default win after 10 min absence.',
              'Record results as they finish; resolve disputes before next round.',
              'Publish standings after every completed round.',
            ].map((row) => <div key={row} className="manage-row">{row}</div>)}
          </>
        ) : null}
        {stage === 'standings' ? (
          <>
            <div className="manage-panel-head">Live standings</div>
            {demoPlayers.slice(0, 8).map((player, index) => (
              <div key={player.id} className="manage-row standings-row">
                <strong>{index + 1}. {player.name}</strong>
                <span>{(7 - index * 0.5).toFixed(1)} pts</span>
              </div>
            ))}
          </>
        ) : null}
      </section>
      {tournament.status === 'active' ? (
        <LiveTournamentBoard onMessage={onMessage} pairings={pairings} />
      ) : null}
    </div>
  )
}

function AdminBracketPreview({ rounds, title }: { rounds: AdminBracketRound[]; title: string }) {
  const [activeRound, setActiveRound] = useState(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setActiveRound(0)
    if (scrollRef.current) scrollRef.current.scrollLeft = 0
  }, [rounds])

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
  }, [rounds])

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
  }, [rounds])

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
        <h2>{title}</h2>
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
            <div className="bracket-column" data-round-index={roundIndex} key={round.name}>
              <h3>{round.name}</h3>
              <div className="bracket-column-body">
                {round.matches.map((match, matchIndex) => (
                  <AdminBracketMatchCard
                    isLastRound={roundIndex === rounds.length - 1}
                    key={`${round.name}-${match.white}-${match.black}-${matchIndex}`}
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

function AdminBracketMatchCard({
  isLastRound,
  match,
  matchIndex,
  roundIndex,
}: {
  isLastRound: boolean
  match: AdminBracketMatch
  matchIndex: number
  roundIndex: number
}) {
  const stateClass = match.live ? 'live' : match.pending ? 'pending' : match.winner ? 'complete' : 'open'
  const lineState = match.winner === 'white' ? 'a' : match.winner === 'black' ? 'b' : match.live ? 'live' : ''

  return (
    <div
      className={`bracket-match rich ${stateClass} ${isLastRound ? 'last-round' : ''}`}
      data-brk-card={`${roundIndex}-${matchIndex}`}
      data-win={lineState}
    >
      {match.live ? (
        <div className="bracket-live-tag">
          <span aria-hidden="true" />
          Live
        </div>
      ) : null}
      <BracketPlayerRow
        name={match.white}
        score={match.live ? '•' : match.whiteScore ?? ''}
        state={bracketPlayerState(match, 'white')}
      />
      <BracketPlayerRow
        name={match.black}
        score={match.live ? '•' : match.blackScore ?? ''}
        state={bracketPlayerState(match, 'black')}
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
  const roundIndexes = Array.from(cardsByRound.keys()).sort((a, b) => a - b)

  roundIndexes.forEach((round) => {
    const currentRound = cardsByRound.get(round) || []
    const nextRound = cardsByRound.get(round + 1) || []
    if (!nextRound.length) return

    currentRound.forEach((match) => {
      const target = nextRound.find((candidate) => candidate.index === Math.floor(match.index / 2))
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

function LiveTournamentBoard({
  onMessage,
  pairings,
}: {
  onMessage: (message: string) => void
  pairings: Pairing[]
}) {
  const [boardIndex, setBoardIndex] = useState(0)
  const [game, setGame] = useState(() => new Chess())
  const [selected, setSelected] = useState<Square | null>(null)
  const [result, setResult] = useState('Live')
  const pairing = pairings[boardIndex] ?? pairings[0]
  const pairingKey = pairing ? `${pairing.white}-${pairing.black}` : 'empty'
  const selectedTargets = selected
    ? new Set(game.moves({ square: selected, verbose: true }).map((move) => move.to))
    : new Set<string>()
  const movePairs = buildMovePairs(game.history())

  useEffect(() => {
    if (boardIndex >= pairings.length) setBoardIndex(0)
  }, [boardIndex, pairings.length])

  useEffect(() => {
    setGame(new Chess())
    setSelected(null)
    setResult('Live')
  }, [pairingKey])

  function handleSquareClick(square: Square) {
    const piece = game.get(square)

    if (!selected) {
      if (piece && piece.color === game.turn()) setSelected(square)
      return
    }

    if (selected === square) {
      setSelected(null)
      return
    }

    const next = new Chess(game.fen())

    try {
      const move = next.move({ from: selected, to: square, promotion: 'q' })
      if (move) {
        setGame(next)
        setSelected(null)
        setResult(deriveChessResult(next))
        return
      }
    } catch {
      // Illegal moves are ignored; selecting another own piece below still works.
    }

    if (piece && piece.color === game.turn()) {
      setSelected(square)
      return
    }

    setSelected(null)
  }

  function undoMove() {
    const next = new Chess(game.fen())
    next.undo()
    setGame(next)
    setSelected(null)
    setResult(deriveChessResult(next))
  }

  function resetGame() {
    setGame(new Chess())
    setSelected(null)
    setResult('Live')
  }

  function recordResult(value: string) {
    setResult(value)
    onMessage(`${pairing.white} vs ${pairing.black} result set to ${value}.`)
  }

  return (
    <section className="live-board-panel">
      <div className="manage-panel-head">
        <strong>Digital board and result entry</strong>
        <span>{pairing ? `Board ${pairing.board}` : 'No board selected'}</span>
      </div>
      <div className="live-board-layout">
        <div className="live-board-area">
          <div className="live-board-top">
            <label>
              Board
              <select value={boardIndex} onChange={(event) => setBoardIndex(Number(event.target.value))}>
                {pairings.map((item, index) => (
                  <option key={item.board} value={index}>
                    Board {item.board} - {item.white} vs {item.black}
                  </option>
                ))}
              </select>
            </label>
            <span className="live-turn">{game.turn() === 'w' ? 'White to move' : 'Black to move'}</span>
          </div>
          <div className="digital-board" aria-label="Digital chess board">
            {game.board().map((rank, rankIndex) => rank.map((piece, fileIndex) => {
              const square = `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}` as Square
              return (
                <button
                  type="button"
                  className={boardSquareClass(square, rankIndex, fileIndex, selected, selectedTargets)}
                  onClick={() => handleSquareClick(square)}
                  key={square}
                >
                  {piece ? chessPieceLabel(piece.color, piece.type) : ''}
                </button>
              )
            }))}
          </div>
        </div>
        <aside className="live-game-side">
          <div className="live-match-card">
            <span>Current match</span>
            <strong>{pairing.white}</strong>
            <em>vs</em>
            <strong>{pairing.black}</strong>
          </div>
          <div className="result-control">
            <span>Result</span>
            <div>
              {['Live', '1-0', '0-1', '1/2-1/2'].map((value) => (
                <button
                  type="button"
                  className={result === value ? 'active' : undefined}
                  onClick={() => recordResult(value)}
                  key={value}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="move-list-card">
            <div className="move-list-head">
              <strong>Live moves</strong>
              <span>{game.history().length} moves</span>
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
          <div className="live-board-actions">
            <button type="button" className="mini-button ghost" onClick={undoMove} disabled={!game.history().length}>Undo</button>
            <button type="button" className="mini-button ghost" onClick={resetGame}>Reset</button>
            <button type="button" className="mini-button dark" onClick={() => onMessage(`Board ${pairing.board} saved with result ${result}.`)}>
              Save board
            </button>
          </div>
        </aside>
      </div>
    </section>
  )
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
                    <td>{item.checkedIn ? 'Checked in' : 'Not checked in'}</td>
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
  const [players, setPlayers] = useState<Player[]>(demoPlayers)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [editPlayer, setEditPlayer] = useState<Player | null>(null)
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
          <select><option>All players</option><option>Rapid Championship</option><option>Blitz Cup</option></select>
          <span>{visiblePlayers.length} of 248 players</span>
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
    { id: 'n2', title: 'Club general assembly and board elections', body: 'Voting opens after the rapid championship.', date: 'Jun 28, 2026' },
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

function AnnouncementsScreen({
  adminProfiles,
  onAdminsChanged,
  session,
}: {
  adminProfiles: AdminProfileLoadResult
  onAdminsChanged: () => Promise<void>
  session: AdminSession
}) {
  const [audience, setAudience] = useState('All users')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  return (
    <div className="announcements-screen">
      <section className="panel-card announcement-card">
        <div className="panel-head">
          <strong>Broadcast composer</strong>
          <span>App · Email · SMS</span>
        </div>
        <div className="audience-tabs">
          {['All users', 'Tournament participants', 'Club members', 'Specific players'].map((item) => (
            <button key={item} type="button" className={audience === item ? 'active' : undefined} onClick={() => setAudience(item)}>{item}</button>
          ))}
        </div>
        <div className="post-form">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Announcement title" />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write the message..." />
          <button type="button" className="primary-button">Send announcement</button>
        </div>
      </section>
      {session.profile?.role === 'superAdmin' ? (
        <AdminAccessManagement admins={adminProfiles} session={session} onChanged={onAdminsChanged} />
      ) : (
        <section className="panel-card">
          <div className="panel-title">Delivery status</div>
          <QueueRow icon="◈" tint="#EAF0FA" label="Audience" count={audience === 'All users' ? 248 : 32} action="Ready" onClick={() => undefined} />
          <QueueRow icon="✉" tint="#EAF6F0" label="Email channel" count={1} action="On" onClick={() => undefined} />
          <QueueRow icon="▣" tint="#FBF1E2" label="SMS channel" count={1} action="On" onClick={() => undefined} />
        </section>
      )}
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

function tournamentKey(item: AdminTournament) {
  return item.rowId ?? item.id
}

function isKnockoutTournament(item: AdminTournament) {
  return /knockout|single elimination|double elimination|elimination/i.test(item.format)
}

function buildTournamentPlayers(seed: number) {
  const players = demoPlayers.slice(0, 16)
  if (!seed) return players
  return seededShuffle(players, seed)
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

function buildPairings(players: Player[]): Pairing[] {
  const half = Math.ceil(players.length / 2)
  return players.slice(0, half).map((player, index) => {
    const opponent = players[index + half]
    return {
      board: index + 1,
      white: player.name,
      whiteRating: player.rating,
      black: opponent?.name ?? 'TBD',
      blackRating: opponent?.rating ?? '-',
    }
  })
}

function buildAdminBracketRounds(pairings: Pairing[], published: boolean, active: boolean): AdminBracketRound[] {
  const firstRound: AdminBracketMatch[] = pairings.map((pairing, index) => ({
    ...pairing,
    live: active && index < 2,
    whiteScore: active && index >= 2 ? '1' : '',
    blackScore: active && index >= 2 ? '0' : '',
    winner: active && index >= 2 ? 'white' : undefined,
  }))
  const quarterfinals = buildDerivedBracketMatches(firstRound, published, active, 4)
  const semifinals = buildDerivedBracketMatches(quarterfinals, published, active, 2)
  const final = buildDerivedBracketMatches(semifinals, published, false, 1)

  return [
    { name: 'Round of 16', matches: firstRound },
    { name: 'Quarterfinal', matches: quarterfinals },
    { name: 'Semifinal', matches: semifinals },
    { name: 'Final', matches: final },
  ]
}

function buildDerivedBracketMatches(
  source: AdminBracketMatch[],
  published: boolean,
  active: boolean,
  count: number,
): AdminBracketMatch[] {
  return Array.from({ length: count }, (_, index) => {
    const a = source[index * 2]
    const b = source[index * 2 + 1]
    const white = published ? winnerName(a) : 'TBD'
    const black = published ? winnerName(b) : 'TBD'

    return {
      board: index + 1,
      white,
      whiteRating: '',
      black,
      blackRating: '',
      live: active && index === 0 && white !== 'TBD' && black !== 'TBD',
      pending: white === 'TBD' || black === 'TBD',
      whiteScore: '',
      blackScore: '',
      winner: undefined,
    }
  }).map((match, index) => ({
    ...match,
    board: index + 1,
    white: match.white === 'TBD' ? `Winner ${index * 2 + 1}` : match.white,
    black: match.black === 'TBD' ? `Winner ${index * 2 + 2}` : match.black,
  }))
}

function winnerName(match?: AdminBracketMatch) {
  if (!match) return 'TBD'
  if (match.winner === 'white') return match.white
  if (match.winner === 'black') return match.black
  return 'TBD'
}

function bracketPlayerState(match: AdminBracketMatch, side: AdminBracketSide) {
  if (!match.winner) return 'neutral'
  return match.winner === side ? 'winner' : 'muted'
}

function deriveChessResult(game: Chess) {
  if (game.isCheckmate()) return game.turn() === 'w' ? '0-1' : '1-0'
  if (game.isDraw()) return '1/2-1/2'
  return 'Live'
}

function chessPieceLabel(color: string, type: string) {
  const pieces: Record<string, string> = {
    bk: '♚',
    bq: '♛',
    br: '♜',
    bb: '♝',
    bn: '♞',
    bp: '♟',
    wk: '♔',
    wq: '♕',
    wr: '♖',
    wb: '♗',
    wn: '♘',
    wp: '♙',
  }
  return pieces[`${color}${type}`] ?? ''
}

function boardSquareClass(
  square: Square,
  rankIndex: number,
  fileIndex: number,
  selected: Square | null,
  targets: Set<string>,
) {
  return [
    'digital-square',
    (rankIndex + fileIndex) % 2 ? 'dark' : 'light',
    selected === square ? 'selected' : '',
    targets.has(square) ? 'target' : '',
  ].filter(Boolean).join(' ')
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
    slug: item.slug,
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

function buildTournamentSlug(name: string) {
  return `${buildTournamentSlugBase(name)}-${Date.now().toString(36)}`
}

function buildTournamentSlugBase(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || 'draft-tournament'
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
