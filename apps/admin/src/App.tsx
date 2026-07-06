import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
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
  loadBlockLists,
  loadAdminTournaments,
  signInAdmin,
  signOutAdmin,
  unblockIdentity,
  unblockIp,
  updateAdminStatus,
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
import { adminQueues } from './lib/juchess'

type Screen = 'dashboard' | 'windows' | 'tournaments' | 'players' | 'news' | 'announcements'
type TournamentTab = 'upcoming' | 'active' | 'completed'
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

const navItems: Array<{ key: Screen; label: string; icon: string }> = [
  { key: 'dashboard', label: 'Dashboard', icon: '▤' },
  { key: 'windows', label: 'App Windows', icon: '▧' },
  { key: 'tournaments', label: 'Tournaments', icon: '♞' },
  { key: 'players', label: 'Players', icon: '◍' },
  { key: 'news', label: 'News', icon: '◫' },
  { key: 'announcements', label: 'Announcements', icon: '◈' },
]

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
  const [dataSource, setDataSource] = useState<'appwrite' | 'prototype'>('prototype')
  const [message, setMessage] = useState<string | null>(null)

  async function refreshTournaments() {
    const result = await loadAdminTournaments()
    setTournaments(result.tournaments)
    setDataSource(result.source)
    setMessage(result.error ? 'Appwrite data is unavailable. Showing prototype tournament data.' : null)
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
      setMessage(tournamentResult.error ? 'Appwrite data is unavailable. Showing prototype tournament data.' : null)
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
        <main className="prototype-content">{children}</main>
      </div>
    </div>
  )
}

function ConfigNotice({ tournaments }: { tournaments: AdminTournament[] }) {
  return (
    <section className="panel-card">
      <div className="panel-head">
        <strong>Appwrite configuration required</strong>
        <span>Prototype data</span>
      </div>
      <p className="muted">
        Add VITE_APPWRITE_ENDPOINT, VITE_APPWRITE_PROJECT_ID, VITE_APPWRITE_DATABASE_ID and
        VITE_APPWRITE_ADMIN_FUNCTION_ID to enable real admin control.
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
  const activeBlocks = blocks.identityBlocks.filter((item) => item.status === 'active').length
    + blocks.ipBlocks.filter((item) => item.status === 'active').length

  const statCards = [
    { label: 'Total players', value: '248', icon: '◍', tint: '#F3E4E6', delta: '+12 this month', color: '#2E7D5B' },
    { label: 'Active tournaments', value: String(activeCount || 4), icon: '♞', tint: '#EAF0FA', delta: '2 live now', color: '#8B8577' },
    { label: 'Upcoming matches', value: '32', icon: '⚔', tint: '#EAF6F0', delta: 'Next in 2 days', color: '#8B8577' },
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
          <small>Used by the live Appwrite preview session</small>
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
  dataSource: 'appwrite' | 'prototype'
  onChanged: () => Promise<void>
  session: AdminSession
  tournaments: AdminTournament[]
}) {
  const [tab, setTab] = useState<TournamentTab>('upcoming')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<TournamentInput>({
    slug: '',
    name: '',
    status: 'upcoming',
    format: 'Swiss',
    timeControl: '15+10 Rapid',
    capacity: 16,
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const counts = {
    upcoming: tournaments.filter((item) => item.status === 'upcoming').length,
    active: tournaments.filter((item) => item.status === 'active').length,
    completed: tournaments.filter((item) => item.status === 'completed').length,
  }
  const filtered = tournaments.filter((item) => item.status === tab)

  function update<K extends keyof TournamentInput>(key: K, value: TournamentInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)

    try {
      await createTournament({ ...form, createdByProfileId: session.profile?.$id })
      setMessage('Tournament created.')
      setForm((current) => ({ ...current, slug: '', name: '', description: '' }))
      setShowCreate(false)
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="tournament-screen">
      <div className="center-tabs">
        {(['upcoming', 'active', 'completed'] as TournamentTab[]).map((item) => (
          <button key={item} type="button" className={tab === item ? 'active' : undefined} onClick={() => setTab(item)}>
            {capitalize(item)} <span>{counts[item]}</span>
          </button>
        ))}
      </div>
      <div className="table-toolbar">
        <span>{tabDescription(tab)} · {dataSource === 'appwrite' ? 'Live Appwrite' : 'Prototype fallback'}</span>
        <button type="button" className="primary-button" onClick={() => setShowCreate((value) => !value)}>
          <span>+</span> Create tournament
        </button>
      </div>
      {showCreate ? (
        <section className="panel-card create-panel">
          <div className="panel-head">
            <strong>Create tournament</strong>
            <span>Function write</span>
          </div>
          <form className="prototype-form" onSubmit={handleCreate}>
            <label>Name<input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="JU Rapid Championship" required /></label>
            <label>Slug<input value={form.slug} onChange={(event) => update('slug', event.target.value)} placeholder="ju-rapid-2026" required /></label>
            <label>Status<select value={form.status} onChange={(event) => update('status', event.target.value as TournamentInput['status'])}><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option></select></label>
            <label>Capacity<input type="number" min={2} value={form.capacity ?? ''} onChange={(event) => update('capacity', Number(event.target.value))} /></label>
            <label>Format<input value={form.format} onChange={(event) => update('format', event.target.value)} required /></label>
            <label>Time control<input value={form.timeControl} onChange={(event) => update('timeControl', event.target.value)} required /></label>
            <label>Location<input value={form.location ?? ''} onChange={(event) => update('location', event.target.value)} /></label>
            <label className="wide">Description<textarea value={form.description ?? ''} onChange={(event) => update('description', event.target.value)} rows={3} /></label>
            <button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Save tournament'}</button>
          </form>
        </section>
      ) : null}
      {message ? <div className="prototype-note" role="status">{message}</div> : null}
      <section className="panel-card table-card">
        {filtered.length ? <TournamentTable rows={filtered} /> : <EmptyState title={emptyTitle(tab)} body="Create one to get started." />}
      </section>
    </div>
  )
}

function TournamentTable({ rows }: { rows: AdminTournament[] }) {
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
            <tr key={item.rowId ?? item.id}>
              <td><strong>{item.name}</strong></td>
              <td>{item.location || 'Main Campus'}</td>
              <td><span className="tag">{item.format}</span></td>
              <td><b>{item.timeControl}</b></td>
              <td className="mono center">{item.players}/{item.capacity || 'open'}</td>
              <td><StatusPill status={item.status} /></td>
              <td><strong>{formatDate(item.startsAt)}</strong><small>{formatTime(item.startsAt)}</small></td>
              <td className="right">
                <button type="button" className="mini-button">{item.status === 'active' ? 'Run' : item.status === 'completed' ? 'Media' : 'Prepare'}</button>
                <button type="button" className="mini-button ghost">Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
          <label>Appwrite user ID<input value={identityForm.targetUserId} onChange={(event) => setIdentityForm((current) => ({ ...current, targetUserId: event.target.value }))} placeholder="Optional" /></label>
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
      <p className="muted">Admin access is separate from player profiles. Create rows in admin_profiles and assign accounts to admin-only Appwrite teams.</p>
      <div className="access-grid">
        <form className="prototype-form compact" onSubmit={handleSubmit}>
          <h3>Create admin</h3>
          <label>Email<input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="admin@ju.edu.jo" required /></label>
          <label>Display name<input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Admin name" required /></label>
          <label>Role<select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AdminRole }))}><option value="admin">Admin</option><option value="organizer">Organizer</option><option value="superAdmin">Super admin</option></select></label>
          <label>Appwrite user ID<input value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))} placeholder="Optional if email exists" /></label>
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

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function tabDescription(tab: TournamentTab) {
  if (tab === 'active') return 'Tournaments currently being run'
  if (tab === 'completed') return 'Finished tournaments and media'
  return 'Prepare registrations, pairings and publishing'
}

function emptyTitle(tab: TournamentTab) {
  if (tab === 'active') return 'Nothing live'
  if (tab === 'completed') return 'No completed events'
  return 'No upcoming tournaments'
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
  if (device === 'web' && webPreviewBase) return { base: webPreviewBase, routeMode: 'path' }
  if (device !== 'web' && mobilePreviewBase) return { base: mobilePreviewBase, routeMode: 'query' }
  if (appPreviewBase) return { base: appPreviewBase, routeMode: 'path' }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const port = device === 'web' ? '8062' : '8063'
    return { base: `${window.location.protocol}//${window.location.hostname}:${port}`, routeMode: device === 'web' ? 'path' : 'query' }
  }

  return { base: window.location.origin, routeMode: 'path' }
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
