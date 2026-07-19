import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Image as ImageIcon,
  LoaderCircle,
  MapPin,
  Play,
  ShieldCheck,
  Trophy,
  X,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/useAuth'
import { externalRatingSourceLabel, hasExternalRating } from '../lib/externalRating'
import {
  loadTournamentDetail,
  subscribeToTournamentChanges,
  type Member,
  type PublishedBracketMatch,
  type PublishedBracketRound,
  type PublishedBracketSnapshot,
  type Tournament,
  type TournamentGame,
  type TournamentMedia,
} from '../lib/juchess'
import {
  cancelMyRegistration,
  loadMyAttendance,
  loadMyRegistration,
  registerForTournament,
  respondToAttendance,
  type AttendanceStatus,
  type MyAttendanceConfirmation,
  type MyRegistration,
} from '../lib/registrations'
import './TournamentDetailPage.css'

type DetailTab = 'registration' | 'players' | 'rounds' | 'table' | 'media'
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

const bracketTournamentRouteIds = new Set(['single-elimination', 'double-elimination'])

function TournamentDetailPage() {
  const { id } = useParams()
  const [tab, setTab] = useState<DetailTab>('registration')
  const [bracketView, setBracketView] = useState<BracketView>('winners')
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [cloudError, setCloudError] = useState(false)

  useLayoutEffect(() => {
    let alive = true
    setTournament(null)
    setLoading(true)
    setCloudError(false)

    loadTournamentDetail({ slug: id ?? '' }).then((result) => {
      if (!alive) return
      setTournament(result.tournament)
      setCloudError(Boolean(result.error))
      setLoading(false)
    })

    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    setBracketView('winners')
  }, [id])

  useEffect(() => {
    const tournamentId = tournament?.rowId
    if (!tournamentId) return
    let alive = true
    let unsubscribe: (() => void) | undefined
    let refreshing = false
    let queued = false
    let realtimeBurstTimer: number | undefined
    const refreshTournament = async () => {
      if (refreshing) {
        queued = true
        return
      }
      refreshing = true
      do {
        queued = false
        const result = await loadTournamentDetail({ rowId: tournamentId })
        if (!alive) break
        if (!result.error) setTournament(result.tournament)
        setCloudError(Boolean(result.error))
      } while (alive && queued)
      refreshing = false
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshTournament()
    }
    const refreshAfterRealtimeBurst = () => {
      if (!alive || document.visibilityState !== 'visible') return
      if (realtimeBurstTimer !== undefined) window.clearTimeout(realtimeBurstTimer)
      realtimeBurstTimer = window.setTimeout(() => {
        realtimeBurstTimer = undefined
        if (alive && document.visibilityState === 'visible') void refreshTournament()
      }, 250)
    }
    const timer = tournament.status === 'Completed'
      ? undefined
      : window.setInterval(() => {
        if (document.visibilityState === 'visible') void refreshTournament()
      }, 15_000)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    void subscribeToTournamentChanges(tournamentId, refreshAfterRealtimeBurst)
      .then((stop) => {
        if (alive) unsubscribe = stop
        else stop()
      })
      .catch(() => {
        // The periodic refresh remains available when Realtime is blocked.
      })
    return () => {
      alive = false
      if (timer !== undefined) window.clearInterval(timer)
      if (realtimeBurstTimer !== undefined) window.clearTimeout(realtimeBurstTimer)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      unsubscribe?.()
    }
  }, [tournament?.rowId, tournament?.status])

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
  if (tournament.status === 'Completed') tabs.push({ key: 'media', label: 'Photos' })
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
          <PlayersTab players={tournament.registeredPlayers ?? []} />
        ) : null}

        {activeTab === 'rounds' ? (
          <RoundsTab rounds={detail.rounds} tournament={tournament} />
        ) : null}

        {activeTab === 'table' ? (
          <TableTab
            bracketView={bracketView}
            setBracketView={setBracketView}
            tournament={tournament}
            standings={detail.standings}
          />
        ) : null}

        {activeTab === 'media' ? (
          <TournamentMediaTab items={tournament.media ?? []} unavailable={Boolean(tournament.mediaUnavailable)} />
        ) : null}
      </main>
    </div>
  )
}

function TournamentMediaTab({ items, unavailable }: { items: TournamentMedia[]; unavailable: boolean }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const touchStartX = useRef<number | null>(null)
  const activeItem = activeIndex === null ? null : items[activeIndex]
  const moveViewer = useCallback((direction: number) => {
    setActiveIndex((current) => {
      if (current === null || !items.length) return current
      return (current + direction + items.length) % items.length
    })
  }, [items.length])

  useEffect(() => {
    if (activeIndex === null) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveIndex(null)
      if (event.key === 'ArrowLeft') moveViewer(-1)
      if (event.key === 'ArrowRight') moveViewer(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [activeIndex, moveViewer])

  return (
    <section className="detail-tab-panel tournament-media-panel">
      <div className="panel-heading">
        <div>
          <h2>Photos and videos</h2>
          <p>Download memories published by the tournament organizers.</p>
        </div>
        <span>{items.length} {items.length === 1 ? 'file' : 'files'}</span>
      </div>
      {unavailable ? (
        <div className="public-media-empty">
          <ImageIcon size={30} aria-hidden="true" />
          <strong>Photos unavailable</strong>
          <span>Tournament photos could not be loaded. Try again shortly.</span>
        </div>
      ) : items.length ? (
        <div className="public-media-grid">
          {items.map((item, index) => (
            <article className="public-media-card" key={item.id}>
              <button
                className="public-media-preview"
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`View ${item.name}`}
              >
                {item.mimeType.startsWith('video/') ? (
                  <>
                    <video muted preload="metadata" src={item.viewUrl} />
                    <span className="public-media-play"><Play size={22} fill="currentColor" aria-hidden="true" /></span>
                  </>
                ) : (
                  <img src={item.viewUrl} alt={item.name} loading="lazy" />
                )}
              </button>
              <div className="public-media-meta">
                <div>
                  <strong>{item.name}</strong>
                  <span>{formatMediaSize(item.size)}</span>
                  {item.tags.length ? (
                    <span className="public-media-tags">{item.tags.map((tag) => `#${tag}`).join(' ')}</span>
                  ) : null}
                </div>
                <a href={item.downloadUrl} download={item.name} title={`Download ${item.name}`}>
                  <Download size={16} aria-hidden="true" />
                  Download
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="public-media-empty">
          <ImageIcon size={30} aria-hidden="true" />
          <strong>No photos published yet</strong>
          <span>The organizer has not added photos or videos for this tournament.</span>
        </div>
      )}
      {activeItem && activeIndex !== null ? (
        <div className="media-lightbox" role="dialog" aria-modal="true" aria-label={`Viewing ${activeItem.name}`} onClick={() => setActiveIndex(null)}>
          <div className="media-lightbox-toolbar" onClick={(event) => event.stopPropagation()}>
            <div>
              <strong>{activeItem.name}</strong>
              <span>{activeIndex + 1} / {items.length}</span>
            </div>
            <a href={activeItem.downloadUrl} download={activeItem.name} title={`Download ${activeItem.name}`}>
              <Download size={18} aria-hidden="true" />
            </a>
            <button type="button" title="Close viewer" onClick={() => setActiveIndex(null)}>
              <X size={21} aria-hidden="true" />
            </button>
          </div>
          <button className="media-lightbox-nav previous" type="button" title="Previous media" onClick={(event) => { event.stopPropagation(); moveViewer(-1) }}>
            <ChevronLeft size={30} aria-hidden="true" />
          </button>
          <div
            className="media-lightbox-stage"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null }}
            onTouchEnd={(event) => {
              const start = touchStartX.current
              const end = event.changedTouches[0]?.clientX
              touchStartX.current = null
              if (start === null || end === undefined || Math.abs(end - start) < 45) return
              moveViewer(end < start ? 1 : -1)
            }}
          >
            {activeItem.mimeType.startsWith('video/') ? (
              <video key={activeItem.id} controls autoPlay playsInline src={activeItem.viewUrl} />
            ) : (
              <img key={activeItem.id} src={activeItem.viewUrl} alt={activeItem.name} />
            )}
          </div>
          <button className="media-lightbox-nav next" type="button" title="Next media" onClick={(event) => { event.stopPropagation(); moveViewer(1) }}>
            <ChevronRight size={30} aria-hidden="true" />
          </button>
          {activeItem.tags.length ? (
            <div className="media-lightbox-tags" onClick={(event) => event.stopPropagation()}>
              {activeItem.tags.map((tag) => <span key={tag}>#{tag}</span>)}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function formatMediaSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
        <OverviewItem label="Location" value={tournament.location} href={tournament.locationUrl} />
        <OverviewItem label="Leading" value={leader ? `${leader.member.name} · ${leader.points} pts` : 'Not started'} tone="gold" />
      </div>

      <p className="detail-description">{tournament.desc}</p>

      <RegistrationActions tournament={tournament} />
    </section>
  )
}

function RegistrationActions({ tournament }: { tournament: Tournament }) {
  const { loading: authLoading, profile, user } = useAuth()
  const [registration, setRegistration] = useState<MyRegistration | null>(null)
  const [attendance, setAttendance] = useState<MyAttendanceConfirmation | null>(null)
  const [registrationLoading, setRegistrationLoading] = useState(false)
  const [registrationUnavailable, setRegistrationUnavailable] = useState(false)
  const [resolvedRegistrationKey, setResolvedRegistrationKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [attendanceBusy, setAttendanceBusy] = useState<AttendanceStatus | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const registrationLockRef = useRef(false)
  const registrationLoadGenerationRef = useRef(0)

  const tournamentRowId = tournament.rowId
  const profileId = profile?.$id
  const registrationKey = tournamentRowId && profileId ? `${tournamentRowId}:${profileId}` : null
  const registrationOpen = tournament.status === 'Upcoming'
  const closedTitle = tournament.status === 'Active' ? 'Tournament is live' : 'Registration closed'
  const closedMessage = tournament.status === 'Active'
    ? 'This tournament has started. New registrations are no longer accepted.'
    : 'This tournament is completed. Registration is no longer available.'

  const refreshRegistration = useCallback(async () => {
    const generation = ++registrationLoadGenerationRef.current
    if (!tournamentRowId || !profileId) {
      setRegistration(null)
      setAttendance(null)
      setResolvedRegistrationKey(null)
      setRegistrationUnavailable(false)
      return
    }

    setRegistrationLoading(true)
    try {
      const [nextRegistration, nextAttendance] = await Promise.all([
        loadMyRegistration(tournamentRowId, profileId),
        loadMyAttendance(tournamentRowId, profileId),
      ])
      if (generation !== registrationLoadGenerationRef.current) return
      setRegistration(nextRegistration)
      setAttendance(nextAttendance)
      setResolvedRegistrationKey(`${tournamentRowId}:${profileId}`)
      setRegistrationUnavailable(false)
    } catch {
      if (generation !== registrationLoadGenerationRef.current) return
      setRegistrationUnavailable(true)
    } finally {
      if (generation === registrationLoadGenerationRef.current) setRegistrationLoading(false)
    }
  }, [profileId, tournamentRowId])

  useEffect(() => {
    void refreshRegistration()
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshRegistration()
    }
    const timer = window.setInterval(refreshWhenVisible, 60_000)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      registrationLoadGenerationRef.current += 1
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refreshRegistration])

  if (authLoading) {
    return <div className="register-card muted">Checking your club account...</div>
  }

  if (!registrationOpen && !user) {
    return (
      <div className="register-card muted">
        <div className="register-icon">
          <ShieldCheck size={24} aria-hidden="true" />
        </div>
        <div>
          <h2>{closedTitle}</h2>
          <p>{closedMessage}</p>
        </div>
      </div>
    )
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

  if (!profileId) {
    return (
      <div className="register-card">
        <div className="register-icon">
          <ShieldCheck size={24} aria-hidden="true" />
        </div>
        <div>
          <h2>Complete your player profile</h2>
          <p>Your JuChess profile is created only after you submit all required information.</p>
        </div>
        <div className="register-actions">
          <Link to="/complete-profile" className="primary-action">Complete profile</Link>
        </div>
      </div>
    )
  }

  if (!tournamentRowId) {
    return <div className="register-card muted">Registration opens when this event is published.</div>
  }

  async function handleRegister() {
    if (
      !tournamentRowId
      || !user
      || !registrationOpen
      || registrationLockRef.current
      || registrationUnavailable
      || resolvedRegistrationKey !== registrationKey
    ) return
    registrationLockRef.current = true
    setBusy(true)
    setMessage(null)
    try {
      if (!profileId) throw new Error('Complete your player profile before registering.')

      setRegistration(await registerForTournament(tournamentRowId))
      setMessage('Registration received. The organizers will review your spot.')
    } catch (error) {
      setMessage(error instanceof Error && error.message
        ? error.message
        : 'Could not register right now. Please try again.')
    } finally {
      registrationLockRef.current = false
      setBusy(false)
    }
  }

  async function handleCancel() {
    if (!registration || registrationUnavailable) return
    setBusy(true)
    setMessage(null)
    try {
      setRegistration(await cancelMyRegistration(registration.$id))
      setAttendance(null)
      setMessage('Your registration was cancelled.')
    } catch {
      setMessage('Could not cancel right now. Ask an organizer for help at the venue.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAttendance(status: Exclude<AttendanceStatus, 'pending'>) {
    if (!registration || attendanceBusy || registrationUnavailable) return
    setAttendanceBusy(status)
    setMessage(null)
    try {
      setAttendance(await respondToAttendance(registration.$id, status))
      setMessage(status === 'confirmed'
        ? 'Attendance confirmed. We will see you at the tournament.'
        : 'Attendance declined. The organizer has been notified in the admin panel.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Your attendance answer could not be saved.')
    } finally {
      setAttendanceBusy(null)
    }
  }

  const status = registration?.status
  const isRegistered = Boolean(registration) && status !== 'cancelled'
  const registrationChecking = registrationLoading || resolvedRegistrationKey !== registrationKey

  const registrationSucceeded = message?.startsWith('Registration received') ?? false

  return (
    <div className={`register-card signed-in${registrationSucceeded ? ' registration-success' : ''}`}>
      <div className="register-icon">
        {registrationSucceeded ? <Check size={24} aria-hidden="true" /> : <ShieldCheck size={24} aria-hidden="true" />}
      </div>
      <div className="register-body">
        {registrationUnavailable ? (
          <>
            <h2>Registration status unavailable</h2>
            <p>JuChess could not safely confirm your current registration. Actions are paused until the canonical status reloads.</p>
          </>
        ) : registrationChecking ? (
          <p>Loading your registration...</p>
        ) : !registrationOpen && !isRegistered ? (
          <>
            <h2>{closedTitle}</h2>
            <p>{closedMessage}</p>
          </>
        ) : !isRegistered ? (
          <>
            <h2>Play in this tournament</h2>
            <p>One tap to request a spot. An organizer approves registrations before the event.</p>
          </>
        ) : status === 'pending' ? (
          <>
            <h2>Registration pending</h2>
            <p>Your spot is waiting for organizer approval. You will see an accepted status here after the admin reviews it.</p>
          </>
        ) : status === 'waitlisted' ? (
          <>
            <h2>You are on the waitlist</h2>
            <p>The organizers will move you in if a spot opens up.</p>
          </>
        ) : (
          <>
            <h2>Registration accepted</h2>
            <AttendancePrompt
              attendance={attendance}
              busy={attendanceBusy}
              onAnswer={handleAttendance}
              startsAt={tournament.startsAt}
              tournamentName={tournament.name}
            />
          </>
        )}
        {message ? <p className="register-message" role="status">{message}</p> : null}
      </div>
      <div className="register-actions">
        {registrationUnavailable ? (
          <button type="button" className="secondary-action" disabled={registrationLoading} onClick={() => void refreshRegistration()}>
            {registrationLoading ? 'Checking...' : 'Retry'}
          </button>
        ) : !registrationOpen ? null : !isRegistered ? (
          <button
            type="button"
            className="primary-action registration-submit"
            disabled={busy || registrationChecking}
            aria-busy={busy}
            onClick={handleRegister}
          >
            {busy || registrationChecking ? <LoaderCircle className="registration-spinner" size={16} aria-hidden="true" /> : null}
            {registrationChecking ? 'Checking...' : busy ? 'Registering...' : 'Register'}
          </button>
        ) : (
          <button type="button" className="secondary-action" disabled={busy} onClick={handleCancel}>
            {busy ? 'Cancelling...' : 'Cancel registration'}
          </button>
        )}
      </div>
    </div>
  )
}

function AttendancePrompt({
  attendance,
  busy,
  onAnswer,
  startsAt,
  tournamentName,
}: {
  attendance: MyAttendanceConfirmation | null
  busy: AttendanceStatus | null
  onAnswer: (status: Exclude<AttendanceStatus, 'pending'>) => Promise<void>
  startsAt?: string
  tournamentName: string
}) {
  const startsAtMs = Date.parse(startsAt ?? '')
  const nowMs = Date.now()
  const scheduled = Number.isFinite(startsAtMs)
  const started = scheduled && nowMs >= startsAtMs
  const promptOpen = Boolean(attendance?.reminderSentAt)
    || (scheduled && nowMs >= startsAtMs - 60 * 60 * 1000 && !started)

  if (!scheduled) {
    return <p className="attendance-note">The admin accepted you. Attendance confirmation will open after the tournament start time is scheduled.</p>
  }
  if (started && attendance?.status !== 'confirmed') {
    return <p className="attendance-status missed">Attendance was not confirmed before the tournament started.</p>
  }
  if (!promptOpen) {
    return (
      <p className="attendance-note">
        One hour before {tournamentName}, JuChess will ask you to confirm attendance here and will try your available email and app notification channels.
      </p>
    )
  }

  return (
    <div className="attendance-prompt">
      <strong>Do you confirm your attendance?</strong>
      <p>
        {attendance?.status === 'confirmed'
          ? 'Your current answer is Yes.'
          : attendance?.status === 'declined'
            ? 'Your current answer is No.'
            : 'Please answer before the tournament begins.'}
      </p>
      <div className="attendance-prompt-actions">
        <button
          type="button"
          className={attendance?.status === 'confirmed' ? 'selected' : ''}
          disabled={Boolean(busy)}
          onClick={() => void onAnswer('confirmed')}
        >
          {busy === 'confirmed' ? 'Saving…' : 'Yes, I will attend'}
        </button>
        <button
          type="button"
          className={attendance?.status === 'declined' ? 'selected decline' : 'decline'}
          disabled={Boolean(busy)}
          onClick={() => void onAnswer('declined')}
        >
          {busy === 'declined' ? 'Saving…' : 'No, I cannot attend'}
        </button>
      </div>
    </div>
  )
}

function PlayersTab({ players }: { players: Member[] }) {
  const showRatings = players.some((player) => hasExternalRating(player.rating, player.ratingSource))
  return (
    <section className="detail-tab-panel">
      <div className="players-panel">
        <div className="panel-heading">
          <h2>Players</h2>
          <span>{players.length} registered</span>
        </div>
        {players.length ? (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                {showRatings ? <th>External rating</th> : null}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => (
                <tr key={player.id}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{player.name}</strong>
                    <small>{player.university || 'University not listed'}</small>
                  </td>
                  {showRatings ? (
                    <td>
                      {hasExternalRating(player.rating, player.ratingSource) ? (
                        <span title={externalRatingSourceLabel(player.ratingSource)}>{player.rating}</span>
                      ) : null}
                    </td>
                  ) : null}
                  <td><span className="table-status registered">Registered</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <UnpublishedPanel title="No confirmed players" body="Confirmed registrations will appear here." />
        )}
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

  const chronologicalRounds = isMultiStage ? buildStageRoundGroups(rounds, stageTab) : rounds
  const visibleRounds = [...chronologicalRounds].reverse()

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
        <span>{game.white.name}{hasExternalRating(game.white.rating, game.white.ratingSource) ? <small title={externalRatingSourceLabel(game.white.ratingSource)}>{game.white.rating}</small> : null}</span>
      </strong>
      <em>vs</em>
      <strong className="round-color-player black-player">
        <span className="tournament-color-chip black">B</span>
        <span>{game.black.name}{hasExternalRating(game.black.rating, game.black.ratingSource) ? <small title={externalRatingSourceLabel(game.black.ratingSource)}>{game.black.rating}</small> : null}</span>
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
  const bracketConfig = tournament.bracketSnapshot
    ? bracketConfigFromPublishedSnapshot(tournament.bracketSnapshot)
    : null

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

  if (!standings.length) {
    return (
      <section className="detail-tab-panel">
        <UnpublishedPanel title="Standings not published" body="Standings will appear after the organizer publishes canonical results." />
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
                  {hasExternalRating(row.member.rating, row.member.ratingSource) ? <small title={externalRatingSourceLabel(row.member.ratingSource)}>{row.member.rating}</small> : null}
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
      path.setAttribute('stroke', decided ? '#7A2431' : live ? '#A98A3F' : 'rgba(17, 17, 17,.22)')
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

function UnpublishedPanel({ body, title }: { body: string; title: string }) {
  return (
    <div className="unpublished-panel">
      <Trophy size={24} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  )
}

function OverviewItem({
  href,
  label,
  tone,
  value,
}: {
  href?: string
  label: string
  value: string
  tone?: 'accent' | 'gold'
}) {
  return (
    <div className={href ? 'overview-item overview-location' : 'overview-item'}>
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      {href ? (
        <a
          className="overview-location-link"
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${value} location in a new tab`}
        >
          <MapPin size={14} aria-hidden="true" />
          Open location
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      ) : null}
    </div>
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
  const membersById = new Map(selectedMembers.map((member) => [member.id, member]))
  const standings = (tournament.standings ?? []).flatMap((saved): StandingRow[] => {
    const member = membersById.get(saved.profileId)
    if (!member) return []
    return [{
      member,
      rank: saved.rank,
      points: saved.points,
      wins: saved.wins,
      draws: saved.draws,
      losses: saved.losses,
      tieBreak: saved.tieBreak,
      status: saved.played > 0 ? 'Finished' : 'Registered',
    }]
  })

  return {
    standings,
    rounds: buildRoundGroups(tournament, publishedGames),
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
  return bracketTournamentRouteIds.has(tournament.id) || /knockout|elimination/i.test(tournament.format)
}

export default TournamentDetailPage
