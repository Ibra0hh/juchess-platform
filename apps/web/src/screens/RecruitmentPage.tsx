import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, BriefcaseBusiness, Check, Clock3, ExternalLink, Send, ShieldCheck, UserRoundCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/useAuth'
import { profileMediaUrl } from '../lib/auth'
import {
  loadMyRecruitmentApplication,
  recruitmentInterestOptions,
  recruitmentStatusLabels,
  submitRecruitmentApplication,
  withdrawRecruitmentApplication,
  type RecruitmentApplication,
  type RecruitmentApplicationInput,
  type RecruitmentInterest,
  type RecruitmentStatus,
} from '../lib/recruitment'
import './ClubScreens.css'
import './RecruitmentPage.css'

const emptyForm: RecruitmentApplicationInput = {
  interests: [],
  skills: '',
  contribution: '',
  developmentGoals: '',
  availability: '',
  portfolioUrl: '',
}

const statusSteps: RecruitmentStatus[] = ['submitted', 'reviewing', 'shortlisted', 'interview', 'accepted']

function RecruitmentPage() {
  const { loading: authLoading, profile, user } = useAuth()
  const [application, setApplication] = useState<RecruitmentApplication | null>(null)
  const [form, setForm] = useState<RecruitmentApplicationInput>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const previewMode = Boolean(profile?.$id.startsWith('preview-'))

  useEffect(() => {
    if (!profile || previewMode) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    void loadMyRecruitmentApplication()
      .then((row) => {
        if (!active) return
        setApplication(row)
        if (row) setForm(formFromApplication(row))
      })
      .catch((error: unknown) => {
        if (active) setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load your application.' })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [previewMode, profile])

  const editable = !application || ['submitted', 'withdrawn', 'rejected'].includes(application.status)
  const withdrawable = Boolean(application && ['submitted', 'reviewing', 'shortlisted', 'interview'].includes(application.status))
  const displayName = profile?.displayName || user?.name || 'Club member'
  const avatarUrl = profileMediaUrl(profile?.avatarFileId)
  const initials = getInitials(displayName)

  const selectedLabels = useMemo(() => form.interests.map((interest) => (
    recruitmentInterestOptions.find((option) => option.value === interest)?.label || interest
  )), [form.interests])

  function toggleInterest(interest: RecruitmentInterest) {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest].slice(0, 5),
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)
    try {
      const row = previewMode
        ? createPreviewApplication(profile?.$id || 'preview-profile', user?.$id || 'preview-user', form)
        : await submitRecruitmentApplication(form)
      setApplication(row)
      setForm(formFromApplication(row))
      setFeedback({ tone: 'success', text: 'Your application was submitted to the JuChess HR team.' })
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Could not submit your application.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleWithdraw() {
    if (!application) return
    setSaving(true)
    setFeedback(null)
    try {
      const row = previewMode
        ? { ...application, status: 'withdrawn' as const, updatedAt: new Date().toISOString() }
        : await withdrawRecruitmentApplication()
      setApplication(row)
      setFeedback({ tone: 'success', text: 'Your application was withdrawn. You can update and resubmit it later.' })
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Could not withdraw your application.' })
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return <RecruitmentShell><RecruitmentLoading /></RecruitmentShell>
  }

  if (!user || !profile) {
    return (
      <RecruitmentShell>
        <section className="recruitment-guest">
          <BriefcaseBusiness aria-hidden="true" />
          <h1>Bring your skills to JuChess</h1>
          <p>Sign in with your club account to apply for the student team behind our tournaments, media, partnerships, and platform.</p>
          <div>
            <Link to="/sign-in">Sign in to apply <ArrowRight size={16} /></Link>
            <Link to="/sign-up">Create account</Link>
          </div>
        </section>
      </RecruitmentShell>
    )
  }

  return (
    <RecruitmentShell profilePreview={{ avatarUrl, displayName, initials }}>
      <section className="recruitment-intro">
        <div>
          <span>Join the working team</span>
          <h1>Build the club with us.</h1>
          <p>Tell the HR team what you enjoy, what you can contribute, and where you want to grow. Your chess rating does not affect the application.</p>
        </div>
        <div className="recruitment-intro-mark" aria-hidden="true">♞</div>
      </section>

      {feedback ? <div className={`recruitment-feedback ${feedback.tone}`} role="status">{feedback.text}</div> : null}

      <div className="recruitment-layout">
        <form className="recruitment-form" onSubmit={(event) => void handleSubmit(event)}>
          <header>
            <div>
              <span>Application</span>
              <h2>{application ? 'Your contribution profile' : 'Tell us about yourself'}</h2>
            </div>
            {application ? <StatusPill status={application.status} /> : null}
          </header>

          {loading ? <RecruitmentFormSkeleton /> : (
            <>
              <fieldset disabled={!editable || saving}>
                <legend>Where would you like to help?</legend>
                <p>Choose up to five areas. The HR team can discuss a different fit with you later.</p>
                <div className="interest-grid">
                  {recruitmentInterestOptions.map((option) => {
                    const selected = form.interests.includes(option.value)
                    return (
                      <button
                        type="button"
                        key={option.value}
                        className={selected ? 'selected' : undefined}
                        aria-pressed={selected}
                        onClick={() => toggleInterest(option.value)}
                      >
                        <span>{selected ? <Check size={15} /> : null}</span>
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <label>
                <span>Your skills and experience</span>
                <small>Courses, projects, tools, volunteering, or practical experience all count.</small>
                <textarea required minLength={20} maxLength={4000} rows={5} disabled={!editable || saving} value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} placeholder="Example: I design social posts in Figma and helped organize two student events..." />
              </label>

              <label>
                <span>How would you contribute to JuChess?</span>
                <small>Describe a problem you could help solve or a responsibility you would enjoy owning.</small>
                <textarea required minLength={20} maxLength={4000} rows={5} disabled={!editable || saving} value={form.contribution} onChange={(event) => setForm({ ...form, contribution: event.target.value })} placeholder="I can help the club by..." />
              </label>

              <div className="recruitment-form-row">
                <label>
                  <span>What do you want to improve?</span>
                  <textarea maxLength={2000} rows={4} disabled={!editable || saving} value={form.developmentGoals} onChange={(event) => setForm({ ...form, developmentGoals: event.target.value })} placeholder="Skills you want to develop with the team" />
                </label>
                <label>
                  <span>Weekly availability</span>
                  <select required disabled={!editable || saving} value={form.availability} onChange={(event) => setForm({ ...form, availability: event.target.value })}>
                    <option value="">Choose availability</option>
                    <option>1-2 hours per week</option>
                    <option>3-5 hours per week</option>
                    <option>6-8 hours per week</option>
                    <option>More than 8 hours per week</option>
                    <option>Project-based / flexible</option>
                  </select>
                  <span className="portfolio-label">Portfolio or profile link <em>Optional</em></span>
                  <input type="url" maxLength={1024} disabled={!editable || saving} value={form.portfolioUrl} onChange={(event) => setForm({ ...form, portfolioUrl: event.target.value })} placeholder="https://github.com/you" />
                </label>
              </div>

              <div className="recruitment-form-actions">
                <p><ShieldCheck size={17} /> Your private application is visible only to authorized club administrators.</p>
                <div>
                  {withdrawable ? <button type="button" className="secondary" disabled={saving} onClick={() => void handleWithdraw()}>Withdraw</button> : null}
                  {editable ? <button type="submit" disabled={saving || !form.interests.length}><Send size={16} /> {saving ? 'Submitting...' : application ? 'Save & resubmit' : 'Submit application'}</button> : null}
                </div>
              </div>
            </>
          )}
        </form>

        <aside className="recruitment-aside">
          <section className="applicant-summary">
            <div className="applicant-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : initials}</div>
            <div>
              <span>Applying as</span>
              <strong>{displayName}</strong>
              <small>{profile.email || user.email}</small>
            </div>
            <Link to="/profile">Edit profile</Link>
          </section>

          <section className="application-progress">
            <div className="aside-heading"><Clock3 size={17} /><h2>Application progress</h2></div>
            {application ? <StatusTimeline status={application.status} /> : <p className="aside-empty">Your progress will appear here after you submit.</p>}
            {application ? <small>Last updated {formatDate(application.updatedAt)}</small> : null}
          </section>

          <section className="application-summary">
            <div className="aside-heading"><UserRoundCheck size={17} /><h2>What HR receives</h2></div>
            <ul>
              <li>Your profile contact details</li>
              <li>{selectedLabels.length ? selectedLabels.join(', ') : 'Your selected interests'}</li>
              <li>Your skills, contribution, and availability</li>
              <li>Your optional portfolio link</li>
            </ul>
            {form.portfolioUrl ? <a href={form.portfolioUrl} target="_blank" rel="noreferrer">Open portfolio <ExternalLink size={14} /></a> : null}
          </section>
        </aside>
      </div>
    </RecruitmentShell>
  )
}

function RecruitmentShell({ children, profilePreview }: { children: React.ReactNode; profilePreview?: { avatarUrl?: string; displayName: string; initials: string } }) {
  return (
    <div className="club-screen recruitment-screen" data-screen-label="Join the team">
      <SiteHeader profilePreview={profilePreview} />
      <main className="recruitment-main">{children}</main>
    </div>
  )
}

function StatusPill({ status }: { status: RecruitmentStatus }) {
  return <span className={`recruitment-status ${status}`}>{recruitmentStatusLabels[status]}</span>
}

function StatusTimeline({ status }: { status: RecruitmentStatus }) {
  if (status === 'rejected' || status === 'withdrawn') {
    return (
      <div className="status-terminal">
        <StatusPill status={status} />
        <p>{status === 'withdrawn' ? 'You can update and resubmit this application.' : 'You can improve your application and submit it again.'}</p>
      </div>
    )
  }
  const activeIndex = statusSteps.indexOf(status)
  return (
    <ol className="status-timeline">
      {statusSteps.map((step, index) => (
        <li key={step} className={index < activeIndex ? 'done' : index === activeIndex ? 'active' : undefined}>
          <span>{index <= activeIndex ? <Check size={13} /> : index + 1}</span>
          <strong>{recruitmentStatusLabels[step]}</strong>
        </li>
      ))}
    </ol>
  )
}

function RecruitmentLoading() {
  return <div className="recruitment-page-skeleton" aria-label="Loading recruitment page"><span /><span /><span /></div>
}

function RecruitmentFormSkeleton() {
  return <div className="recruitment-form-skeleton" aria-label="Loading application"><span /><span /><span /></div>
}

function formFromApplication(application: RecruitmentApplication): RecruitmentApplicationInput {
  return {
    interests: application.interests || [],
    skills: application.skills || '',
    contribution: application.contribution || '',
    developmentGoals: application.developmentGoals || '',
    availability: application.availability || '',
    portfolioUrl: application.portfolioUrl || '',
  }
}

function createPreviewApplication(profileId: string, accountId: string, input: RecruitmentApplicationInput): RecruitmentApplication {
  const now = new Date().toISOString()
  return {
    $id: 'preview-crew-application',
    $createdAt: now,
    $updatedAt: now,
    $permissions: [],
    $sequence: '0',
    $databaseId: 'juchess',
    $tableId: 'crew_applications',
    profileId,
    accountId,
    ...input,
    status: 'submitted',
    submittedAt: now,
    updatedAt: now,
  } as RecruitmentApplication
}

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'JU'
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'recently' : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default RecruitmentPage
