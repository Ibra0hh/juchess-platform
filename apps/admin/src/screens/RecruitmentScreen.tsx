import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BriefcaseBusiness, CalendarClock, ChevronDown, Download, ExternalLink, Mail, Search, UserCheck, UsersRound, X } from 'lucide-react'
import BrandedEmailPreview from '../components/BrandedEmailPreview'
import {
  formatAdminError,
  loadRecruitmentApplications,
  loadRecruitmentSettings,
  previewRecruitmentEmail,
  profileMediaUrl,
  sendRecruitmentEmail,
  updateRecruitmentApplication,
  updateRecruitmentSettings,
  type RecruitmentApplication,
  type RecruitmentEmailPreview,
  type RecruitmentReviewInput,
  type RecruitmentStatus,
} from '../lib/adminData'
import { csvCell } from '../lib/csv'
import { externalRatingText, hasExternalRating } from '../lib/externalRating'
import './RecruitmentScreen.css'

const statusOptions: Array<{ value: RecruitmentStatus; label: string }> = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'reviewing', label: 'Under review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interview', label: 'Interview' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
]

const interestLabels: Record<string, string> = {
  design: 'Design', software: 'Software', events: 'Events', media: 'Media & content', hr: 'People & HR',
  partnerships: 'Partnerships', finance: 'Finance', management: 'Management',
}

export default function RecruitmentScreen() {
  const [applications, setApplications] = useState<RecruitmentApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<RecruitmentStatus | 'all'>('all')
  const [interest, setInterest] = useState('all')
  const [track, setTrack] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const result = await loadRecruitmentApplications()
    setApplications(result.applications)
    setError(result.error || '')
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const visibleApplications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return applications.filter((application) => {
      const applicant = application.applicant
      const matchesQuery = !normalizedQuery || [
        applicant?.displayName,
        applicant?.email,
        applicant?.universityId,
        ...applicationAnswers(application).map(({ answer }) => answer),
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery))
      return matchesQuery
        && (status === 'all' || application.status === status)
        && (track === 'all' || applicationTrack(application) === track)
        && (interest === 'all' || application.interests.includes(interest))
    })
  }, [applications, interest, query, status, track])

  const selected = applications.find((application) => application.$id === selectedId) || null
  const counts = useMemo(() => ({
    new: applications.filter((item) => item.status === 'submitted').length,
    review: applications.filter((item) => ['reviewing', 'shortlisted'].includes(item.status)).length,
    interviews: applications.filter((item) => item.status === 'interview').length,
    accepted: applications.filter((item) => item.status === 'accepted').length,
  }), [applications])

  return (
    <section className="recruitment-admin" aria-label="Recruitment applications">
      <div className="recruitment-kpis">
        <RecruitmentKpi icon={<BriefcaseBusiness />} label="New applications" value={counts.new} />
        <RecruitmentKpi icon={<UsersRound />} label="In review" value={counts.review} />
        <RecruitmentKpi icon={<CalendarClock />} label="Interviews" value={counts.interviews} />
        <RecruitmentKpi icon={<UserCheck />} label="Accepted" value={counts.accepted} />
      </div>

      <RecruitmentControls />

      <div className="recruitment-admin-panel">
        <header className="recruitment-admin-toolbar">
          <div>
            <strong>Candidate pipeline</strong>
            <span>{visibleApplications.length} of {applications.length} applications</span>
          </div>
          <div className="recruitment-admin-filters">
            <label className="recruitment-search">
              <Search size={16} />
              <input aria-label="Search applications" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or answers..." />
            </label>
            <select aria-label="Filter by application type" value={track} onChange={(event) => setTrack(event.target.value)}>
              <option value="all">All application types</option>
              <option value="member">Team Member</option>
              <option value="leader">Team Leader</option>
            </select>
            <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value as RecruitmentStatus | 'all')}>
              <option value="all">All statuses</option>
              {statusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
            <select aria-label="Filter by interest" value={interest} onChange={(event) => setInterest(event.target.value)}>
              <option value="all">All interests</option>
              {Object.entries(interestLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
            <button type="button" onClick={() => exportApplicationsCsv(visibleApplications)} disabled={!visibleApplications.length}>
              <Download size={15} /> Export CSV
            </button>
          </div>
        </header>

        {error ? <div className="recruitment-admin-error" role="alert">{error} <button type="button" onClick={() => void refresh()}>Retry</button></div> : null}

        <div className="recruitment-table-wrap">
          <table className="recruitment-table">
            <thead><tr><th>Applicant</th><th>Application type</th><th>Interests</th><th>Availability</th><th>Submitted</th><th>Status</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {loading ? <RecruitmentTableLoading /> : null}
              {!loading && !visibleApplications.length ? (
                <tr><td colSpan={7}><div className="recruitment-empty"><BriefcaseBusiness /><strong>No matching applications</strong><span>New applications will appear here automatically.</span></div></td></tr>
              ) : null}
              {!loading ? visibleApplications.map((application) => {
                const expanded = expandedId === application.$id
                const answersId = 'pipeline-answers-' + application.$id
                return (
                  <Fragment key={application.$id}>
                    <tr>
                      <td>
                        <ApplicantCell application={application} />
                        <button type="button" className="pipeline-answers-button" aria-expanded={expanded} aria-controls={expanded ? answersId : undefined} onClick={() => setExpandedId(expanded ? null : application.$id)}>
                          {expanded ? 'Hide answers' : 'View answers'} <ChevronDown size={14} aria-hidden="true" />
                        </button>
                      </td>
                      <td>{applicationTrackLabel(application)}</td>
                      <td><div className="recruitment-interest-list">{application.interests.map((item) => <span key={item}>{interestLabels[item] || item}</span>)}</div></td>
                      <td>{application.availability}</td>
                      <td>{formatAdminDate(application.submittedAt)}</td>
                      <td><StatusBadge status={application.status} /></td>
                      <td><button type="button" className="review-row-button" onClick={() => setSelectedId(application.$id)}>Review</button></td>
                    </tr>
                    {expanded ? (
                      <tr className="pipeline-answers-row">
                        <td colSpan={7}>
                          <section id={answersId} aria-label="Application answers">
                            <h3>Application answers</h3>
                            <ApplicationAnswers application={application} />
                          </section>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              }) : null}
            </tbody>
          </table>
        </div>
      </div>

      {selected ? (
        <ReviewModal
          key={selected.$id}
          application={selected}
          onClose={() => setSelectedId(null)}
          onSaved={(row, review) => {
            setApplications((current) => current.map((application) => application.$id === row.$id ? { ...application, ...row, review } : application))
          }}
        />
      ) : null}
    </section>
  )
}

function RecruitmentControls() {
  const [leaderOpen, setLeaderOpen] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  const loadSettings = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const settings = await loadRecruitmentSettings()
      setLeaderOpen(settings.leaderOpen)
    } catch (cause) {
      setError(formatAdminError(cause))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => { void loadSettings() }, [loadSettings])

  async function toggle() {
    if (busy || leaderOpen === null) return
    setBusy(true)
    setError('')
    try {
      const settings = await updateRecruitmentSettings(!leaderOpen)
      setLeaderOpen(settings.leaderOpen)
    } catch (cause) {
      setError(formatAdminError(cause))
      setLeaderOpen(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="recruitment-admin-panel" aria-label="Recruitment controls">
      <div className="recruitment-admin-toolbar">
        <div>
          <strong>Team Leader applications</strong>
          <span role="status">{leaderOpen === null ? busy ? 'Checking status…' : 'Status unavailable' : leaderOpen ? 'Open' : 'Closed'}</span>
        </div>
        <div className="recruitment-admin-filters">
          {leaderOpen !== null ? (
            <button type="button" role="switch" aria-label="Team Leader applications" aria-checked={leaderOpen} disabled={busy} onClick={() => void toggle()}>
              {busy ? 'Saving…' : leaderOpen ? 'Close applications' : 'Open applications'}
            </button>
          ) : error ? <button type="button" disabled={busy} onClick={() => void loadSettings()}>Retry</button> : null}
        </div>
      </div>
      {error ? <p className="recruitment-admin-error" role="alert">{error}</p> : null}
    </section>
  )
}

function RecruitmentKpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <article><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></article>
}

function applicationTrack(application: RecruitmentApplication) {
  return application.track === 'leader' ? 'leader' : 'member'
}

function applicationTrackLabel(application: RecruitmentApplication) {
  return applicationTrack(application) === 'leader' ? 'Team Leader' : 'Team Member'
}

function applicationAnswers(application: RecruitmentApplication) {
  const leader = applicationTrack(application) === 'leader'
  return [
    { question: 'Application type', answer: applicationTrackLabel(application) },
    { question: 'Areas of interest', answer: application.interests.map((item) => interestLabels[item] || item).join(', ') },
    { question: 'Weekly availability', answer: application.availability },
    { question: leader ? 'Your leadership experience' : 'Your skills and experience', answer: application.skills },
    ...(!leader || application.contribution ? [{
      question: leader ? 'Leadership plan' : 'How would you contribute to JuChess?',
      answer: application.contribution,
    }] : []),
    { question: 'What do you want to improve?', answer: application.developmentGoals },
    ...(leader ? [{ question: 'Anything else you\u2019d like us to know?', answer: application.additionalNotes }] : []),
    { question: 'Portfolio or profile link', answer: application.portfolioUrl, link: true },
  ]
}

function ApplicationAnswers({ application }: { application: RecruitmentApplication }) {
  return (
    <dl className="recruitment-answer-list">
      {applicationAnswers(application).map(({ question, answer, link }) => (
        <div key={question}>
          <dt>{question}</dt>
          <dd>{link && answer && /^https?:\/\//i.test(answer) ? (
            <a className="review-portfolio" href={answer} target="_blank" rel="noreferrer">Open portfolio <ExternalLink size={14} aria-hidden="true" /></a>
          ) : (answer || 'Not provided.')}</dd>
        </div>
      ))}
    </dl>
  )
}

function ApplicantCell({ application }: { application: RecruitmentApplication }) {
  const applicant = application.applicant
  const name = applicant?.displayName || 'Profile unavailable'
  const avatarUrl = profileMediaUrl(applicant?.avatarFileId)
  return (
    <div className="recruitment-applicant-cell">
      <span>{avatarUrl ? <img src={avatarUrl} alt="" /> : getInitials(name)}</span>
      <div><strong>{name}</strong><small>{applicant?.email || application.profileId}</small></div>
    </div>
  )
}

function ReviewModal({ application, onClose, onSaved }: {
  application: RecruitmentApplication
  onClose: () => void
  onSaved: (row: RecruitmentApplication, review: RecruitmentApplication['review']) => void
}) {
  const applicant = application.applicant
  const avatarUrl = profileMediaUrl(applicant?.avatarFileId)
  const coverUrl = profileMediaUrl(applicant?.coverFileId)
  const [form, setForm] = useState<RecruitmentReviewInput>({
    status: application.status,
    internalNotes: application.review?.internalNotes || '',
    assignedTo: application.review?.assignedTo || '',
    interviewAt: toDatetimeLocal(application.review?.interviewAt),
  })
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const rating = hasExternalRating(applicant?.rating, applicant?.ratingSource)
    ? externalRatingText(applicant?.rating, applicant?.ratingSource)
    : ''

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFeedback('')
    try {
      const result = await updateRecruitmentApplication(application.$id, {
        ...form,
        interviewAt: form.interviewAt ? new Date(form.interviewAt).toISOString() : '',
      })
      onSaved(result.row, result.review)
      setFeedback('Application review saved.')
    } catch (error) {
      setFeedback(formatAdminError(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="recruitment-review-backdrop" role="presentation">
      <section className="recruitment-review-modal" role="dialog" aria-modal="true" aria-labelledby="recruitment-review-title">
        <header className="review-profile-cover" style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}>
          <button type="button" aria-label="Close application review" disabled={saving || sending} onClick={onClose}><X /></button>
        </header>
        <div className="review-profile-heading">
          <span className="review-profile-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : getInitials(applicant?.displayName || 'Member')}</span>
          <div><small>Candidate profile</small><h2 id="recruitment-review-title">{applicant?.displayName || 'Profile unavailable'}</h2><p>{applicant?.email} · {applicant?.universityId || 'No university ID'}{rating ? ` · ${rating}` : ''}</p></div>
          <StatusBadge status={application.status} />
        </div>

        <div className="review-modal-grid">
          <form className="review-decision-form" onSubmit={(event) => void handleSave(event)}>
            <h3>HR review</h3>
            <label><span>Status</span><select disabled={saving || sending} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as RecruitmentStatus })}>{statusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
            <label><span>Assigned to</span><input maxLength={128} value={form.assignedTo} onChange={(event) => setForm({ ...form, assignedTo: event.target.value })} placeholder="HR lead or interviewer" /></label>
            <label><span>Interview date (your local time)</span><input type="datetime-local" disabled={saving || sending} value={form.interviewAt} onChange={(event) => setForm({ ...form, interviewAt: event.target.value })} /></label>
            <label><span>Private HR notes</span><textarea maxLength={4000} rows={4} value={form.internalNotes} onChange={(event) => setForm({ ...form, internalNotes: event.target.value })} placeholder="Interview notes, fit, follow-up questions..." /></label>
            <p className="review-security-note">These notes are never visible to the applicant.</p>
            {feedback ? <div className="review-feedback" role="status">{feedback}</div> : null}
            <div className="review-decision-actions"><button type="button" disabled={saving || sending} onClick={onClose}>Close</button><button type="submit" disabled={saving || sending}>{saving ? 'Saving...' : 'Save review'}</button></div>
          </form>
          <RecruitmentDecisionEmail
            application={application}
            status={form.status}
            interviewAt={form.interviewAt}
            saving={saving}
            sending={sending}
            setSending={setSending}
          />
          <section className="review-application-copy" aria-labelledby="review-answers-title">
            <h3 id="review-answers-title">Application answers</h3>
            <ApplicationAnswers application={application} />
          </section>
        </div>
      </section>
    </div>
  )
}

function RecruitmentDecisionEmail({ application, status, interviewAt, saving, sending, setSending }: {
  application: RecruitmentApplication
  status: RecruitmentStatus
  interviewAt: string
  saving: boolean
  sending: boolean
  setSending: (value: boolean) => void
}) {
  const applicationId = application.$id
  const interview = status === 'interview'
  const available = interview || status === 'accepted' || status === 'rejected'
  const selectedDate = Date.parse(interviewAt)
  const dateIso = interview && Number.isFinite(selectedDate) ? new Date(selectedDate).toISOString() : ''
  const draftKey = available && (!interview || dateIso) ? status + ':' + dateIso : ''
  const saved = application.status === status
    && (!interview || Date.parse(application.review?.interviewAt || '') === selectedDate)
  const [draft, setDraft] = useState<{ key: string; value?: RecruitmentEmailPreview; error?: string }>()
  const [confirmed, setConfirmed] = useState('')
  const [notice, setNotice] = useState<{ id: string; text: string; sent: boolean }>()
  const [attempt, setAttempt] = useState(0)
  const preview = draftKey && draft?.key === draftKey ? draft.value : undefined
  const error = draftKey && draft?.key === draftKey ? draft.error : undefined
  const sent = Boolean(preview && notice?.id === preview.previewId && notice.sent)
  const canSend = Boolean(preview && saved && !saving && !sending && !sent && (!interview || selectedDate > Date.now()))

  useEffect(() => {
    if (!draftKey) return
    let active = true
    const timer = window.setTimeout(() => {
      void previewRecruitmentEmail(applicationId, status, dateIso)
        .then((value) => { if (active) setDraft({ key: draftKey, value }) })
        .catch((cause) => { if (active) setDraft({ key: draftKey, error: formatAdminError(cause) }) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [applicationId, application.$updatedAt, attempt, dateIso, draftKey, status])

  async function handleSend() {
    if (!preview || !canSend || confirmed !== preview.previewId) return
    setSending(true)
    try {
      const result = await sendRecruitmentEmail(applicationId, status, preview.previewId)
      setNotice({ id: preview.previewId, text: 'Submitted to Appwrite for delivery (' + result.deliveryStatus + ').', sent: true })
    } catch (cause) {
      setNotice({ id: preview.previewId, text: formatAdminError(cause), sent: false })
    } finally {
      setConfirmed('')
      setSending(false)
    }
  }

  return (
    <section className="recruitment-decision-email" aria-label="Applicant email">
      <h3>Applicant email</h3>
      {!available ? <p>Select Interview, Accepted, or Rejected to preview the email.</p> : null}
      {interview && !draftKey ? <p role="status">Choose an interview date and time to preview the invitation.</p> : null}
      {error ? (
        <div className="review-feedback" role="status">
          {error} <button type="button" onClick={() => { setDraft(undefined); setAttempt(attempt + 1) }}>Retry preview</button>
        </div>
      ) : null}
      {draftKey && !preview && !error ? <p role="status">Loading email preview...</p> : null}
      {preview ? (
        <>
          <p className="decision-email-recipient"><strong>To:</strong> {preview.to}</p>
          <BrandedEmailPreview subject={preview.subject} message={preview.message} link={preview.link} />
          {!saved ? <p role="status">Save the review before sending this email.</p> : null}
          {interview && selectedDate <= Date.now() ? <p role="status">Choose a future date to send the invitation.</p> : null}
          {notice?.id === preview.previewId ? <div className="review-feedback" role="status">{notice.text}</div> : null}
          {confirmed === preview.previewId && !sent ? (
            <div className="review-decision-actions">
              <button type="button" disabled={sending} onClick={() => setConfirmed('')}>Cancel</button>
              <button type="button" disabled={!canSend} onClick={() => void handleSend()}>{sending ? 'Sending...' : 'Confirm send'}</button>
            </div>
          ) : (
            <div className="review-decision-actions">
              <button type="button" disabled={!canSend} onClick={() => setConfirmed(preview.previewId)}><Mail size={15} aria-hidden="true" /> Send email</button>
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}

function StatusBadge({ status }: { status: RecruitmentStatus }) {
  const label = statusOptions.find((option) => option.value === status)?.label || status
  return <span className={`recruitment-admin-status ${status}`}>{label}</span>
}

function RecruitmentTableLoading() {
  return <>{[0, 1, 2].map((row) => <tr className="recruitment-loading-row" key={row}><td colSpan={7}><span /></td></tr>)}</>
}

function exportApplicationsCsv(applications: RecruitmentApplication[]) {
  const rows = applications.map((application) => ({
    Name: application.applicant?.displayName || '',
    Email: application.applicant?.email || '',
    Phone: application.applicant?.phone || '',
    UniversityId: application.applicant?.universityId || '',
    ApplicationType: applicationTrackLabel(application),
    Interests: application.interests.map((item) => interestLabels[item] || item).join('; '),
    Availability: application.availability,
    Status: application.status,
    SubmittedAt: application.submittedAt,
    AssignedTo: application.review?.assignedTo || '',
    InterviewAt: application.review?.interviewAt || '',
  }))
  const headers = Object.keys(rows[0] || {})
  const csv = [headers, ...rows.map((row) => headers.map((header) => String(row[header as keyof typeof row] ?? '')))]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `juchess-recruitment-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

function getInitials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'JU' }
function formatAdminDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) }
function toDatetimeLocal(value?: string) { if (!value) return ''; const date = new Date(value); if (Number.isNaN(date.getTime())) return ''; const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16) }
