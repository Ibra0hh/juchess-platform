import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  CalendarDays,
  ListChecks,
  LogOut,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react'
import './App.css'
import { appwriteReady } from './lib/appwrite'
import {
  createTournament,
  formatAdminError,
  getAdminSession,
  loadAdminTournaments,
  signInAdmin,
  signOutAdmin,
  type AdminSession,
  type AdminTournament,
  type TournamentInput,
} from './lib/adminData'
import { adminQueues } from './lib/juchess'

type AdminTab = 'participants' | 'rounds' | 'procedure' | 'standings'

const tabs: AdminTab[] = ['participants', 'rounds', 'procedure', 'standings']

function App() {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [tournaments, setTournaments] = useState<AdminTournament[]>([])
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<'appwrite' | 'prototype'>('prototype')
  const [message, setMessage] = useState<string | null>(null)

  async function refreshTournaments() {
    const result = await loadAdminTournaments()
    setTournaments(result.tournaments)
    setDataSource(result.source)
    setMessage(result.error ? 'Appwrite data is unavailable. Showing prototype tournament data.' : null)
  }

  useEffect(() => {
    let alive = true

    async function boot() {
      const [loadedSession, tournamentResult] = await Promise.all([
        getAdminSession(),
        loadAdminTournaments(),
      ])

      if (!alive) return
      setSession(loadedSession)
      setTournaments(tournamentResult.tournaments)
      setDataSource(tournamentResult.source)
      setMessage(tournamentResult.error ? 'Appwrite data is unavailable. Showing prototype tournament data.' : null)
      setLoading(false)
    }

    void boot()

    return () => {
      alive = false
    }
  }, [])

  if (loading) {
    return <AdminChrome><div className="admin-loading">Loading admin panel...</div></AdminChrome>
  }

  if (!appwriteReady) {
    return (
      <AdminChrome>
        <ConfigPanel tournaments={tournaments} />
      </AdminChrome>
    )
  }

  if (!session) {
    return (
      <AdminChrome>
        <LoginPanel
          onLogin={(nextSession) => {
            setSession(nextSession)
            void refreshTournaments()
          }}
        />
      </AdminChrome>
    )
  }

  if (!session.allowed) {
    return (
      <AdminChrome>
        <AccessDenied
          session={session}
          onSignOut={async () => {
            await signOutAdmin()
            setSession(null)
          }}
        />
      </AdminChrome>
    )
  }

  return (
    <AdminChrome
      session={session}
      onSignOut={async () => {
        await signOutAdmin()
        setSession(null)
      }}
    >
      <AdminDashboard
        message={message}
        session={session}
        tournaments={tournaments}
        source={dataSource}
        onCreated={refreshTournaments}
      />
    </AdminChrome>
  )
}

function AdminChrome({
  children,
  onSignOut,
  session,
}: {
  children: ReactNode
  onSignOut?: () => Promise<void>
  session?: AdminSession | null
}) {
  return (
    <div className="admin-screen">
      <header className="admin-topbar">
        <a href="/admin" className="admin-brand">
          <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="Chess Club JU logo" />
          <span>
            <strong>ChessJU Admin</strong>
            <small>Tournament control</small>
          </span>
        </a>
        {session && onSignOut ? (
          <button type="button" className="admin-ghost" onClick={() => void onSignOut()}>
            <LogOut size={15} aria-hidden="true" />
            Sign out
          </button>
        ) : null}
      </header>
      {children}
    </div>
  )
}

function LoginPanel({ onLogin }: { onLogin: (session: AdminSession) => void }) {
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
    <main className="admin-auth">
      <section className="admin-auth-card" aria-labelledby="admin-login-title">
        <ShieldCheck size={34} aria-hidden="true" />
        <h1 id="admin-login-title">Admin sign in</h1>
        <p>Use an Appwrite account with an admin or organizer profile role.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="current-password"
            />
          </label>
          {error ? <div className="admin-error" role="alert">{error}</div> : null}
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
    <main className="admin-auth">
      <section className="admin-auth-card" aria-labelledby="admin-denied-title">
        <ShieldCheck size={34} aria-hidden="true" />
        <h1 id="admin-denied-title">No admin access</h1>
        <p>
          {session.profile?.displayName || session.user.email} is signed in, but this profile is not an
          admin or organizer.
        </p>
        <button type="button" onClick={() => void onSignOut()}>
          Sign out
        </button>
      </section>
    </main>
  )
}

function ConfigPanel({ tournaments }: { tournaments: AdminTournament[] }) {
  return (
    <main className="admin-main">
      <div className="admin-note">
        Appwrite is not configured yet. Add VITE_APPWRITE_ENDPOINT, VITE_APPWRITE_PROJECT_ID,
        VITE_APPWRITE_DATABASE_ID and VITE_APPWRITE_ADMIN_FUNCTION_ID for real admin control.
      </div>
      <TournamentTable tournaments={tournaments} source="prototype" />
    </main>
  )
}

function AdminDashboard({
  message,
  onCreated,
  session,
  source,
  tournaments,
}: {
  message: string | null
  onCreated: () => Promise<void>
  session: AdminSession
  source: 'appwrite' | 'prototype'
  tournaments: AdminTournament[]
}) {
  const stats = useMemo(() => {
    const active = tournaments.filter((item) => item.status === 'active').length
    const players = tournaments.reduce((sum, item) => sum + item.players, 0)
    return { active, players, total: tournaments.length }
  }, [tournaments])

  return (
    <main className="admin-main">
      <section className="admin-hero">
        <div>
          <span>Signed in as {session.profile?.displayName || session.user.email}</span>
          <h1>Tournament Management</h1>
          <p>Participants, rounds, procedure and standings are controlled from this panel.</p>
        </div>
        <div className="admin-kpis" aria-label="Admin status">
          <Kpi icon={Trophy} label="Tournaments" value={stats.total} />
          <Kpi icon={CalendarDays} label="Active" value={stats.active} />
          <Kpi icon={Users} label="Players" value={stats.players} />
          <Kpi icon={ListChecks} label="Queues" value={adminQueues.pendingRegistrations} />
        </div>
      </section>

      {message ? <div className="admin-note" role="status">{message}</div> : null}

      <div className="admin-grid">
        <TournamentEditor session={session} onCreated={onCreated} />
        <section className="admin-panel">
          <div className="panel-title-row">
            <h2>Workflow</h2>
            <span>{source === 'appwrite' ? 'Live Appwrite' : 'Prototype data'}</span>
          </div>
          <WorkflowTabs />
        </section>
      </div>

      <TournamentTable tournaments={tournaments} source={source} />
    </main>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy
  label: string
  value: number
}) {
  return (
    <div className="admin-kpi">
      <Icon size={18} aria-hidden="true" />
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function TournamentEditor({
  onCreated,
  session,
}: {
  onCreated: () => Promise<void>
  session: AdminSession
}) {
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

  function update<K extends keyof TournamentInput>(key: K, value: TournamentInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)

    try {
      await createTournament({
        ...form,
        createdByProfileId: session.profile?.$id,
      })
      setMessage('Tournament created.')
      setForm((current) => ({ ...current, slug: '', name: '', description: '' }))
      await onCreated()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="admin-panel">
      <div className="panel-title-row">
        <h2>Create tournament</h2>
        <span>Function write</span>
      </div>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          Name
          <input
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            required
            placeholder="JU Rapid Championship"
          />
        </label>
        <label>
          Slug
          <input
            value={form.slug}
            onChange={(event) => update('slug', event.target.value)}
            required
            placeholder="ju-rapid-2026"
          />
        </label>
        <div className="admin-form-row">
          <label>
            Status
            <select
              value={form.status}
              onChange={(event) => update('status', event.target.value as TournamentInput['status'])}
            >
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label>
            Capacity
            <input
              type="number"
              min={2}
              value={form.capacity ?? ''}
              onChange={(event) => update('capacity', Number(event.target.value))}
            />
          </label>
        </div>
        <div className="admin-form-row">
          <label>
            Format
            <input value={form.format} onChange={(event) => update('format', event.target.value)} required />
          </label>
          <label>
            Time control
            <input
              value={form.timeControl}
              onChange={(event) => update('timeControl', event.target.value)}
              required
            />
          </label>
        </div>
        <label>
          Location
          <input value={form.location ?? ''} onChange={(event) => update('location', event.target.value)} />
        </label>
        <label>
          Description
          <textarea
            value={form.description ?? ''}
            onChange={(event) => update('description', event.target.value)}
            rows={3}
          />
        </label>
        {message ? <div className="admin-inline-note" role="status">{message}</div> : null}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create tournament'}
        </button>
      </form>
    </section>
  )
}

function WorkflowTabs() {
  const [active, setActive] = useState<AdminTab>('participants')
  return (
    <div>
      <div className="workflow-tabs" role="tablist" aria-label="Tournament management workflow">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={active === tab ? 'active' : undefined}
            onClick={() => setActive(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="workflow-body">
        <strong>{workflowTitle(active)}</strong>
        <p>{workflowCopy(active)}</p>
      </div>
    </div>
  )
}

function TournamentTable({
  source,
  tournaments,
}: {
  source: 'appwrite' | 'prototype'
  tournaments: AdminTournament[]
}) {
  return (
    <section className="admin-panel tournament-management">
      <div className="panel-title-row">
        <h2>Tournaments</h2>
        <span>{source === 'appwrite' ? 'Live' : 'Fallback'}</span>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Players</th>
              <th>Format</th>
              <th>Round</th>
            </tr>
          </thead>
          <tbody>
            {tournaments.map((tournament) => (
              <tr key={tournament.rowId ?? tournament.id}>
                <td>
                  <strong>{tournament.name}</strong>
                  <small>{tournament.slug}</small>
                </td>
                <td>
                  <span className={`admin-status ${tournament.status}`}>{tournament.status}</span>
                </td>
                <td>
                  {tournament.players}/{tournament.capacity || 'open'}
                </td>
                <td>{tournament.format}</td>
                <td>{tournament.round}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function workflowTitle(tab: AdminTab) {
  if (tab === 'participants') return 'Participants before rounds'
  if (tab === 'rounds') return 'Round setup'
  if (tab === 'procedure') return 'Procedure and pairings'
  return 'Standings publication'
}

function workflowCopy(tab: AdminTab) {
  if (tab === 'participants') return 'Review registrations, confirm players, seed entrants and check attendance.'
  if (tab === 'rounds') return 'Create rounds, assign boards and publish pairings when the field is ready.'
  if (tab === 'procedure') return 'Manage arbiter notes, result approval and special tournament rules.'
  return 'Publish ranks, points, tie-breaks and final results to the public web app.'
}

export default App
