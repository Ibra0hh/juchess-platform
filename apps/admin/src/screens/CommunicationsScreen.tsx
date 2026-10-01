import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Mail, MonitorSmartphone, Send, Trash2 } from 'lucide-react'
import {
  createAnnouncementBroadcast,
  deleteAnnouncement,
  formatAdminError,
  loadAnnouncementCenter,
  type AdminAnnouncement,
  type AdminTournament,
  type AnnouncementAudience,
  type AnnouncementBroadcastInput,
  type AnnouncementCapabilities,
  type AnnouncementChannel,
} from '../lib/adminData'

const unavailableCapabilities: AnnouncementCapabilities = {
  app: { ready: false, reason: 'Publishing status has not loaded yet.' },
  email: { ready: false, reason: 'Email status has not loaded yet.' },
  sms: { ready: false, reason: 'SMS status has not loaded yet.' },
}

type CenterState = {
  announcements: AdminAnnouncement[]
  capabilities: AnnouncementCapabilities
  loading: boolean
  error?: unknown
}

function useAnnouncementCenter() {
  const [state, setState] = useState<CenterState>({
    announcements: [],
    capabilities: unavailableCapabilities,
    loading: true,
  })

  async function refresh() {
    setState((current) => ({ ...current, loading: true }))
    const result = await loadAnnouncementCenter()
    setState({
      announcements: result.announcements,
      capabilities: result.capabilities,
      loading: false,
      error: result.error,
    })
  }

  useEffect(() => {
    let alive = true
    void loadAnnouncementCenter().then((result) => {
      if (!alive) return
      setState({
        announcements: result.announcements,
        capabilities: result.capabilities,
        loading: false,
        error: result.error,
      })
    })
    return () => {
      alive = false
    }
  }, [])

  return { ...state, refresh }
}

function announcementDate(value?: string) {
  if (!value) return 'Not published'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Amman',
  }).format(date)
}

function PublishedAnnouncementList({
  announcements,
  deleting,
  onDelete,
}: {
  announcements: AdminAnnouncement[]
  deleting: string | null
  onDelete: (announcement: AdminAnnouncement) => void
}) {
  const published = announcements.filter((item) => item.status === 'published' && item.audience === 'public')
  if (!published.length) {
    return <div className="empty-row">No public announcements have been published yet.</div>
  }

  return (
    <div className="communication-history-list">
      {published.map((item) => (
        <article className="communication-history-row" key={item.$id}>
          <div>
            <small>Website · {announcementDate(item.publishedAt)}</small>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </div>
          <button
            type="button"
            className="mini-button ghost danger"
            disabled={Boolean(deleting)}
            onClick={() => onDelete(item)}
          >
            <Trash2 size={15} aria-hidden="true" /> Delete
          </button>
        </article>
      ))}
    </div>
  )
}

function DeleteAnnouncementDialog({
  announcement,
  deleting,
  onCancel,
  onConfirm,
}: {
  announcement: AdminAnnouncement | null
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!announcement) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !deleting) onCancel()
    }}>
      <section className="delete-tournament-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-announcement-title">
        <h2 id="delete-announcement-title">Delete public announcement?</h2>
        <p><strong>{announcement.title}</strong> will disappear from the JuChess public feed. Sent emails cannot be recalled.</p>
        <div className="delete-tournament-actions">
          <button type="button" className="secondary-action" disabled={deleting} onClick={onCancel}>Cancel</button>
          <button type="button" className="delete-action" disabled={deleting} onClick={onConfirm}>
            {deleting ? 'Deleting…' : 'Delete announcement'}
          </button>
        </div>
      </section>
    </div>
  )
}

export function NewsScreen() {
  const center = useAnnouncementCenter()
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminAnnouncement | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const canPublish = center.capabilities.app.ready && title.trim() && message.trim() && !submitting && !center.error

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canPublish) return
    setSubmitting(true)
    setNotice(null)
    try {
      await createAnnouncementBroadcast({
        title: title.trim(),
        message: message.trim(),
        audience: 'allUsers',
        channels: ['app'],
      })
      setTitle('')
      setMessage('')
      setNotice('News published to the JuChess website feed.')
      await center.refresh()
    } catch (error) {
      setNotice(formatAdminError(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(deleteTarget.$id)
    setNotice(null)
    try {
      await deleteAnnouncement(deleteTarget.$id)
      setDeleteTarget(null)
      setNotice('Announcement deleted from the public feed.')
      await center.refresh()
    } catch (error) {
      setNotice(formatAdminError(error))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="news-screen communication-screen">
      <section className="panel-card communication-card">
        <div className="panel-head">
          <strong>Publish club news</strong>
          <span>{center.capabilities.app.ready ? 'Connected' : 'Unavailable'}</span>
        </div>
        <p className="muted">Publish a real item to the public JuChess home feed. Use Announcements when you also need email delivery.</p>
        <form className="prototype-form communication-form" onSubmit={handleSubmit}>
          <label>
            Title
            <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Swiss final results" required />
          </label>
          <label>
            Message
            <textarea value={message} maxLength={5000} rows={6} onChange={(event) => setMessage(event.target.value)} placeholder="Write the public update…" required />
          </label>
          {!center.capabilities.app.ready ? <div className="prototype-note">{center.capabilities.app.reason}</div> : null}
          <button type="submit" className="primary-button" disabled={!canPublish}>
            <Send size={16} aria-hidden="true" /> {submitting ? 'Publishing…' : 'Publish news'}
          </button>
        </form>
      </section>

      <section className="panel-card communication-card">
        <div className="panel-head"><strong>Public feed</strong><span>{center.loading ? 'Loading…' : `${center.announcements.length} records`}</span></div>
        {center.error ? <div className="prototype-note">The announcement history could not be loaded. Publishing is disabled until the connection recovers.</div> : null}
        <PublishedAnnouncementList announcements={center.announcements} deleting={deleting} onDelete={setDeleteTarget} />
      </section>
      {notice ? <div className="prototype-note" role="status">{notice}</div> : null}
      <DeleteAnnouncementDialog announcement={deleteTarget} deleting={Boolean(deleting)} onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} />
    </div>
  )
}

export function AnnouncementsScreen({ tournaments }: { tournaments: AdminTournament[] }) {
  const center = useAnnouncementCenter()
  const eligibleTournaments = useMemo(
    () => tournaments.filter((item) => item.status === 'upcoming' || item.status === 'active'),
    [tournaments],
  )
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState<AnnouncementAudience>('allUsers')
  const [tournamentId, setTournamentId] = useState('')
  const [channels, setChannels] = useState<AnnouncementChannel[]>(['app'])
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingInput, setPendingInput] = useState<AnnouncementBroadcastInput | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminAnnouncement | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  function selectAudience(next: AnnouncementAudience) {
    setAudience(next)
    setNotice(null)
    if (next === 'tournamentParticipants') {
      setChannels((current) => current.filter((channel) => channel !== 'app'))
    }
  }

  function toggleChannel(channel: AnnouncementChannel) {
    const capability = center.capabilities[channel]
    if (!capability.ready || (channel === 'app' && audience === 'tournamentParticipants')) return
    setChannels((current) => current.includes(channel)
      ? current.filter((item) => item !== channel)
      : [...current, channel])
  }

  const ready = Boolean(
    title.trim()
    && message.trim()
    && channels.length
    && (audience !== 'tournamentParticipants' || tournamentId),
  ) && !submitting && !center.error

  function requestSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready) return
    setPendingInput({
      title: title.trim(),
      message: message.trim(),
      audience,
      tournamentId: audience === 'tournamentParticipants' ? tournamentId : undefined,
      channels,
    })
  }

  async function confirmSend() {
    if (!pendingInput) return
    setSubmitting(true)
    setNotice(null)
    try {
      const result = await createAnnouncementBroadcast(pendingInput)
      const outcomes = []
      if (result.announcement) outcomes.push('published to the website')
      if (result.email) outcomes.push(`queued by email for ${result.email.recipientCount} player${result.email.recipientCount === 1 ? '' : 's'}`)
      setNotice(`Announcement ${outcomes.join(' and ')}.`)
      setTitle('')
      setMessage('')
      setPendingInput(null)
      setAudience('allUsers')
      setTournamentId('')
      setChannels(['app'])
      await center.refresh()
    } catch (error) {
      setNotice(formatAdminError(error))
      setPendingInput(null)
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(deleteTarget.$id)
    setNotice(null)
    try {
      await deleteAnnouncement(deleteTarget.$id)
      setDeleteTarget(null)
      setNotice('Announcement deleted from the public feed.')
      await center.refresh()
    } catch (error) {
      setNotice(formatAdminError(error))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="announcements-screen communication-screen">
      <section className="panel-card communication-card">
        <div className="panel-head"><strong>Create announcement</strong><span>Live delivery</span></div>
        <p className="muted">Choose the real audience and channels. Website publishes to the public JuChess feed; email uses the configured JuChess Resend provider.</p>
        <form className="prototype-form communication-form" onSubmit={requestSend}>
          <label>Title<input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Registration closes tonight" required /></label>
          <label>Message<textarea value={message} maxLength={5000} rows={6} onChange={(event) => setMessage(event.target.value)} placeholder="Write your announcement…" required /></label>

          <fieldset className="communication-options">
            <legend>Audience</legend>
            <div className="communication-choice-row">
              <button type="button" className={audience === 'allUsers' ? 'selected' : undefined} onClick={() => selectAudience('allUsers')}>All users</button>
              <button type="button" className={audience === 'tournamentParticipants' ? 'selected' : undefined} onClick={() => selectAudience('tournamentParticipants')}>Tournament participants</button>
            </div>
          </fieldset>

          {audience === 'tournamentParticipants' ? (
            <label>
              Tournament
              <select value={tournamentId} onChange={(event) => setTournamentId(event.target.value)} required>
                <option value="">Select an upcoming or active tournament</option>
                {eligibleTournaments.map((tournament) => <option key={tournament.rowId} value={tournament.rowId}>{tournament.name} · {tournament.status}</option>)}
              </select>
              {!eligibleTournaments.length ? <small>No upcoming or active tournament is available.</small> : null}
            </label>
          ) : null}

          <fieldset className="communication-options">
            <legend>Channels</legend>
            <div className="communication-channel-grid">
              <button
                type="button"
                className={channels.includes('app') ? 'selected' : undefined}
                disabled={!center.capabilities.app.ready || audience === 'tournamentParticipants'}
                onClick={() => toggleChannel('app')}
              >
                <MonitorSmartphone size={18} aria-hidden="true" />
                <span><strong>Website</strong><small>{audience === 'tournamentParticipants' ? 'Targeted website delivery is not configured' : 'Public JuChess feed'}</small></span>
              </button>
              <button
                type="button"
                className={channels.includes('email') ? 'selected' : undefined}
                disabled={!center.capabilities.email.ready}
                onClick={() => toggleChannel('email')}
              >
                <Mail size={18} aria-hidden="true" />
                <span><strong>Email</strong><small>{center.capabilities.email.ready ? center.capabilities.email.provider || 'Configured' : center.capabilities.email.reason}</small></span>
              </button>
              <button type="button" disabled title={center.capabilities.sms.reason}>
                <span className="communication-sms-icon">SMS</span>
                <span><strong>SMS</strong><small>{center.capabilities.sms.reason || 'Unavailable'}</small></span>
              </button>
            </div>
          </fieldset>

          {!channels.length ? <div className="prototype-note">Select at least one available channel.</div> : null}
          <button type="submit" className="primary-button" disabled={!ready}>
            <Send size={16} aria-hidden="true" /> Review and send
          </button>
        </form>
      </section>

      <section className="panel-card communication-card">
        <div className="panel-head"><strong>Public announcement history</strong><span>{center.loading ? 'Loading…' : 'Website'}</span></div>
        {center.error ? <div className="prototype-note">Announcement delivery status is unavailable. Sending is disabled until the connection recovers.</div> : null}
        <PublishedAnnouncementList announcements={center.announcements} deleting={deleting} onDelete={setDeleteTarget} />
      </section>
      {notice ? <div className="prototype-note" role="status">{notice}</div> : null}

      {pendingInput ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !submitting) setPendingInput(null)
        }}>
          <section className="delete-tournament-dialog communication-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="send-announcement-title">
            <h2 id="send-announcement-title">Send this announcement?</h2>
            <p><strong>{pendingInput.title}</strong></p>
            <p>This will {pendingInput.channels.includes('app') ? 'publish immediately to the public feed' : ''}{pendingInput.channels.includes('app') && pendingInput.channels.includes('email') ? ' and ' : ''}{pendingInput.channels.includes('email') ? 'queue a real email to the selected audience' : ''}.</p>
            <div className="delete-tournament-actions">
              <button type="button" className="secondary-action" disabled={submitting} onClick={() => setPendingInput(null)}>Cancel</button>
              <button type="button" className="primary-action" disabled={submitting} onClick={() => void confirmSend()}>{submitting ? 'Sending…' : 'Send announcement'}</button>
            </div>
          </section>
        </div>
      ) : null}

      <DeleteAnnouncementDialog announcement={deleteTarget} deleting={Boolean(deleting)} onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} />
    </div>
  )
}
