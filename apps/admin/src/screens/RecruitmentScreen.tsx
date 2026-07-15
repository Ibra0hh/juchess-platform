import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BriefcaseBusiness, CalendarClock, Download, ExternalLink, Search, UserCheck, UsersRound, X } from 'lucide-react'
import {
  formatAdminError,
  loadRecruitmentApplications,
  profileMediaUrl,
  updateRecruitmentApplication,
  type RecruitmentApplication,
  type RecruitmentReviewInput,
  type RecruitmentStatus,
} from '../lib/adminData'
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
  design: 'Design', software: 'Software', events: 'Events', media: 'Media', hr: 'People & HR',
  partnerships: 'Partnerships', finance: 'Finance', management: 'Management',
}

export default function RecruitmentScreen() {
  const [applications, setApplications] = useState<RecruitmentApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<RecruitmentStatus | 'all'>('all')
  const [interest, setInterest] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

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
        application.skills,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery))
      return matchesQuery
        && (status === 'all' || application.status === status)
        && (interest === 'all' || application.interests.includes(interest))
    })
  }, [applications, interest, query, status])

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

      <div className="recruitment-admin-panel">
        <header className="recruitment-admin-toolbar">
          <div>
            <strong>Candidate pipeline</strong>
            <span>{visibleApplications.length} of {applications.length} applications</span>
          </div>
          <div className="recruitment-admin-filters">
            <label className="recruitment-search">
              <Search size={16} />
              <input aria-label="Search applications" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, skills..." />
            </label>
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
            <thead><tr><th>Applicant</th><th>Interests</th><th>Availability</th><th>Submitted</th><th>Status</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {loading ? <RecruitmentTableLoading /> : null}
              {!loading && !visibleApplications.length ? (
                <tr><td colSpan={6}><div className="recruitment-empty"><BriefcaseBusiness /><strong>No matching applications</strong><span>New member applications will appear here automatically.</span></div></td></tr>
              ) : null}
              {!loading ? visibleApplications.map((application) => (
                <tr key={application.$id}>
                  <td><ApplicantCell application={application} /></td>
                  <td><div className="recruitment-interest-list">{application.interests.slice(0, 3).map((item) => <span key={item}>{interestLabels[item] || item}</span>)}{application.interests.length > 3 ? <em>+{application.interests.length - 3}</em> : null}</div></td>
                  <td>{application.availability}</td>
                  <td>{formatAdminDate(application.submittedAt)}</td>
                  <td><StatusBadge status={application.status} /></td>
                  <td><button type="button" className="review-row-button" onClick={() => setSelectedId(application.$id)}>Review</button></td>
                </tr>
              )) : null}
            </tbody>
          </table>
        </div>
      </div>

      {selected ? (
        <ReviewModal
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

function RecruitmentKpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <article><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></article>
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
  const [feedback, setFeedback] = useState('')

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
          <button type="button" aria-label="Close application review" onClick={onClose}><X /></button>
        </header>
        <div className="review-profile-heading">
          <span className="review-profile-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : getInitials(applicant?.displayName || 'Member')}</span>
          <div><small>Candidate profile</small><h2 id="recruitment-review-title">{applicant?.displayName || 'Profile unavailable'}</h2><p>{applicant?.email} · {applicant?.universityId || 'No university ID'} · Rating {applicant?.rating ?? 1200}</p></div>
          <StatusBadge status={application.status} />
        </div>

        <div className="review-modal-grid">
          <div className="review-application-copy">
            <ReviewSection title="Interests"><div className="recruitment-interest-list large">{application.interests.map((item) => <span key={item}>{interestLabels[item] || item}</span>)}</div></ReviewSection>
            <ReviewSection title="Skills and experience"><p>{application.skills}</p></ReviewSection>
            <ReviewSection title="How they would contribute"><p>{application.contribution}</p></ReviewSection>
            <ReviewSection title="Development goals"><p>{application.developmentGoals || 'Not provided.'}</p></ReviewSection>
            <ReviewSection title="Availability"><p>{application.availability}</p></ReviewSection>
            {application.portfolioUrl ? <a className="review-portfolio" href={application.portfolioUrl} target="_blank" rel="noreferrer">Open portfolio <ExternalLink size={14} /></a> : null}
          </div>

          <form className="review-decision-form" onSubmit={(event) => void handleSave(event)}>
            <h3>HR review</h3>
            <label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as RecruitmentStatus })}>{statusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
            <label><span>Assigned to</span><input maxLength={128} value={form.assignedTo} onChange={(event) => setForm({ ...form, assignedTo: event.target.value })} placeholder="HR lead or interviewer" /></label>
            <label><span>Interview date</span><input type="datetime-local" value={form.interviewAt} onChange={(event) => setForm({ ...form, interviewAt: event.target.value })} /></label>
            <label><span>Private HR notes</span><textarea maxLength={4000} rows={8} value={form.internalNotes} onChange={(event) => setForm({ ...form, internalNotes: event.target.value })} placeholder="Interview notes, fit, follow-up questions..." /></label>
            <p className="review-security-note">These notes are never visible to the applicant.</p>
            {feedback ? <div className="review-feedback" role="status">{feedback}</div> : null}
            <div className="review-decision-actions"><button type="button" onClick={onClose}>Close</button><button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save review'}</button></div>
          </form>
        </div>
      </section>
    </div>
  )
}

function ReviewSection({ children, title }: { children: React.ReactNode; title: string }) {
  return <section><h3>{title}</h3>{children}</section>
}

function StatusBadge({ status }: { status: RecruitmentStatus }) {
  const label = statusOptions.find((option) => option.value === status)?.label || status
  return <span className={`recruitment-admin-status ${status}`}>{label}</span>
}

function RecruitmentTableLoading() {
  return <>{[0, 1, 2].map((row) => <tr className="recruitment-loading-row" key={row}><td colSpan={6}><span /></td></tr>)}</>
}

function exportApplicationsCsv(applications: RecruitmentApplication[]) {
  const rows = applications.map((application) => ({
    Name: application.applicant?.displayName || '',
    Email: application.applicant?.email || '',
    Phone: application.applicant?.phone || '',
    UniversityId: application.applicant?.universityId || '',
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

function csvCell(value: string) { return `"${value.replace(/"/g, '""')}"` }
function getInitials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'JU' }
function formatAdminDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) }
function toDatetimeLocal(value?: string) { if (!value) return ''; const date = new Date(value); if (Number.isNaN(date.getTime())) return ''; const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16) }
