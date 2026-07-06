import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Ban,
  CalendarDays,
  ListChecks,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react'
import './App.css'
import { appwriteReady } from './lib/appwrite'
import {
  createTournament,
  blockIdentity,
  blockIp,
  createAdminProfile,
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

type AdminTab = 'participants' | 'rounds' | 'procedure' | 'standings'

const tabs: AdminTab[] = ['participants', 'rounds', 'procedure', 'standings']

function App() {
  const [session, setSession] = useState<AdminSession | null>(null)
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

    const result = await loadBlockLists()
    setBlocks(result)
  }

  async function refreshAdminProfiles(currentSession = session) {
    if (currentSession?.profile?.role !== 'superAdmin') {
      setAdminProfiles({ admins: [] })
      return
    }

    const result = await loadAdminProfiles()
    setAdminProfiles(result)
  }

  async function handleSignOut() {
    await signOutAdmin()
    setSession(null)
    setBlocks({ identityBlocks: [], ipBlocks: [] })
    setAdminProfiles({ admins: [] })
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
            void refreshBlocks(nextSession)
            void refreshAdminProfiles(nextSession)
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
          onSignOut={handleSignOut}
        />
      </AdminChrome>
    )
  }

  return (
    <AdminChrome
      session={session}
      onSignOut={handleSignOut}
    >
      <AdminDashboard
        message={message}
        session={session}
        blocks={blocks}
        adminProfiles={adminProfiles}
        tournaments={tournaments}
        source={dataSource}
        onCreated={refreshTournaments}
        onBlocksChanged={refreshBlocks}
        onAdminsChanged={refreshAdminProfiles}
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
        <p>Use an Appwrite account registered in the separate admin access table.</p>
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
          {session.profile?.displayName || session.user.email} is signed in, but this account is not active in
          the separate admin access table.
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
  adminProfiles,
  blocks,
  message,
  onAdminsChanged,
  onBlocksChanged,
  onCreated,
  session,
  source,
  tournaments,
}: {
  adminProfiles: AdminProfileLoadResult
  blocks: BlockListLoadResult
  message: string | null
  onAdminsChanged: () => Promise<void>
  onBlocksChanged: () => Promise<void>
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
  const activeBlocks = blocks.identityBlocks.filter((item) => item.status === 'active').length
    + blocks.ipBlocks.filter((item) => item.status === 'active').length

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
          <Kpi icon={Ban} label="Blocks" value={activeBlocks} />
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
      {session.profile?.role === 'superAdmin' ? (
        <AdminAccessManagement admins={adminProfiles} session={session} onChanged={onAdminsChanged} />
      ) : null}
      <BlockManagement blocks={blocks} session={session} onChanged={onBlocksChanged} />
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
  const [message, setMessage] = useState<string | null>(
    admins.error ? 'Admin profiles could not be loaded from Appwrite.' : null,
  )

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
    <section className="admin-panel admin-access-management">
      <div className="panel-title-row">
        <h2>Admin access</h2>
        <span>Super admin only</span>
      </div>
      <div className="admin-note">
        Admin access is separate from player profiles. This panel creates rows in admin_profiles and assigns
        accounts to the admin-only Appwrite teams.
      </div>

      <div className="block-grid">
        <form className="admin-form block-form" onSubmit={handleSubmit}>
          <div className="panel-title-row compact">
            <h3>Create admin</h3>
            <UserPlus size={18} aria-hidden="true" />
          </div>
          <div className="admin-form-row">
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="admin@ju.edu.jo"
                required
              />
            </label>
            <label>
              Display name
              <input
                value={form.displayName}
                onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="Admin name"
                required
              />
            </label>
          </div>
          <div className="admin-form-row">
            <label>
              Role
              <select
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AdminRole }))}
              >
                <option value="admin">Admin</option>
                <option value="organizer">Organizer</option>
                <option value="superAdmin">Super admin</option>
              </select>
            </label>
            <label>
              Appwrite user ID
              <input
                value={form.accountId}
                onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}
                placeholder="Optional if email exists"
              />
            </label>
          </div>
          <label>
            Notes
            <input
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Optional internal note"
            />
          </label>
          <button type="submit" disabled={submitting}>Create admin access</button>
        </form>

        <div className="block-list">
          <h3>Admin list</h3>
          {admins.admins.length === 0 ? <div className="block-empty">No admin profiles yet.</div> : null}
          {admins.admins.map((admin) => (
            <div className="block-row" key={admin.$id}>
              <div>
                <strong>{admin.displayName}</strong>
                <span className={`admin-status ${admin.status}`}>{admin.status}</span>
                <small>{admin.email} · {adminRoleLabel(admin.role)}</small>
                <small>{admin.accountId}</small>
              </div>
              {admin.status === 'active' ? (
                <button
                  type="button"
                  className="admin-ghost"
                  disabled={submitting || admin.accountId === session.user.$id}
                  onClick={() => void handleStatus(admin, 'suspended')}
                >
                  Suspend
                </button>
              ) : (
                <button
                  type="button"
                  className="admin-ghost"
                  disabled={submitting}
                  onClick={() => void handleStatus(admin, 'active')}
                >
                  Activate
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {message ? <div className="admin-inline-note" role="status">{message}</div> : null}
    </section>
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
  const blockLoadMessage = blocks.error ? 'Block lists could not be loaded from Appwrite.' : null

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
      await blockIp({
        ipRange: ipForm.ipRange.trim(),
        reason: ipForm.reason.trim(),
        actorProfileId,
      })
      setIpForm({ ipRange: '', reason: '' })
      setMessage('IP block added.')
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUnblockIdentity(block: IdentityBlock) {
    setSubmitting(true)
    setMessage(null)

    try {
      await unblockIdentity(block.$id, actorProfileId)
      setMessage('Identity block lifted.')
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUnblockIp(block: IpBlock) {
    setSubmitting(true)
    setMessage(null)

    try {
      await unblockIp(block.$id, actorProfileId)
      setMessage('IP block lifted.')
      await onChanged()
    } catch (error) {
      setMessage(formatAdminError(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="admin-panel block-management">
      <div className="panel-title-row">
        <h2>Blocked players</h2>
        <span>Admin only</span>
      </div>
      <div className="admin-note">
        Identity blocks stop matching email, University ID, or Jordan phone numbers. IP blocks stop requests
        from a specific IP or IPv4 CIDR range.
      </div>

      <div className="block-grid">
        <form className="admin-form block-form" onSubmit={handleIdentityBlock}>
          <div className="panel-title-row compact">
            <h3>Identity block</h3>
            <Ban size={18} aria-hidden="true" />
          </div>
          <div className="admin-form-row">
            <label>
              Type
              <select
                value={identityForm.type}
                onChange={(event) => setIdentityForm((current) => ({
                  ...current,
                  type: event.target.value as IdentityBlockType,
                }))}
              >
                <option value="email">Email</option>
                <option value="universityId">University ID</option>
                <option value="phone">Phone</option>
              </select>
            </label>
            <label>
              Value
              <input
                value={identityForm.value}
                onChange={(event) => setIdentityForm((current) => ({ ...current, value: event.target.value }))}
                placeholder={identityForm.type === 'phone' ? '0791234567' : 'player@ju.edu.jo'}
                required
              />
            </label>
          </div>
          <label>
            Reason
            <input
              value={identityForm.reason}
              onChange={(event) => setIdentityForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Optional admin note"
            />
          </label>
          <div className="admin-form-row">
            <label>
              Appwrite user ID
              <input
                value={identityForm.targetUserId}
                onChange={(event) => setIdentityForm((current) => ({ ...current, targetUserId: event.target.value }))}
                placeholder="Optional"
              />
            </label>
            <label>
              Profile row ID
              <input
                value={identityForm.targetProfileId}
                onChange={(event) => setIdentityForm((current) => ({
                  ...current,
                  targetProfileId: event.target.value,
                }))}
                placeholder="Optional"
              />
            </label>
          </div>
          <button type="submit" disabled={submitting}>Block identity</button>
        </form>

        <form className="admin-form block-form" onSubmit={handleIpBlock}>
          <div className="panel-title-row compact">
            <h3>IP block</h3>
            <Ban size={18} aria-hidden="true" />
          </div>
          <label>
            IP or CIDR
            <input
              value={ipForm.ipRange}
              onChange={(event) => setIpForm((current) => ({ ...current, ipRange: event.target.value }))}
              placeholder="203.0.113.10 or 203.0.113.0/24"
              required
            />
          </label>
          <label>
            Reason
            <input
              value={ipForm.reason}
              onChange={(event) => setIpForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Optional admin note"
            />
          </label>
          <button type="submit" disabled={submitting}>Block IP</button>
        </form>
      </div>

      {blockLoadMessage ? <div className="admin-inline-note" role="status">{blockLoadMessage}</div> : null}
      {message ? <div className="admin-inline-note" role="status">{message}</div> : null}

      <div className="block-lists">
        <BlockList
          title="Identity block list"
          empty="No identity blocks yet."
          rows={blocks.identityBlocks}
          renderValue={(block) => `${identityLabel(block.type)} · ${block.value}`}
          onUnblock={handleUnblockIdentity}
          disabled={submitting}
        />
        <BlockList
          title="IP block list"
          empty="No IP blocks yet."
          rows={blocks.ipBlocks}
          renderValue={(block) => block.ipRange}
          onUnblock={handleUnblockIp}
          disabled={submitting}
        />
      </div>
    </section>
  )
}

function BlockList<T extends IdentityBlock | IpBlock>({
  disabled,
  empty,
  onUnblock,
  renderValue,
  rows,
  title,
}: {
  disabled: boolean
  empty: string
  onUnblock: (row: T) => Promise<void>
  renderValue: (row: T) => string
  rows: T[]
  title: string
}) {
  return (
    <div className="block-list">
      <h3>{title}</h3>
      {rows.length === 0 ? <div className="block-empty">{empty}</div> : null}
      {rows.map((row) => (
        <div className="block-row" key={row.$id}>
          <div>
            <strong>{renderValue(row)}</strong>
            <span className={`admin-status ${row.status}`}>{row.status}</span>
            {row.reason ? <small>{row.reason}</small> : null}
            <small>{formatBlockDate(row.createdAt || row.$createdAt)}</small>
          </div>
          {row.status === 'active' ? (
            <button type="button" className="admin-ghost" disabled={disabled} onClick={() => void onUnblock(row)}>
              <RotateCcw size={15} aria-hidden="true" />
              Unblock
            </button>
          ) : null}
        </div>
      ))}
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

function formatBlockDate(value?: string) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
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
