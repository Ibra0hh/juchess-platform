import { useEffect, useState } from 'react'
import { CheckCircle2, LoaderCircle, XCircle } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import {
  resolveAttendanceInvitation,
  respondToAttendanceInvitation,
  type AttendanceInvitation,
} from '../lib/attendance'
import type { AttendanceStatus } from '../lib/registrations'
import './AttendanceConfirmPage.css'

export default function AttendanceConfirmPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''
  const [invitation, setInvitation] = useState<AttendanceInvitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [answering, setAnswering] = useState<AttendanceStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!token) {
      setError('This attendance link is missing its secure token.')
      setLoading(false)
      return () => { active = false }
    }

    void resolveAttendanceInvitation(token)
      .then((next) => {
        if (active) setInvitation(next)
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : 'This attendance link is invalid.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [token])

  async function answer(status: Exclude<AttendanceStatus, 'pending'>) {
    if (!token || answering) return
    setAnswering(status)
    setError(null)
    try {
      setInvitation(await respondToAttendanceInvitation(token, status))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your answer could not be saved.')
    } finally {
      setAnswering(null)
    }
  }

  const tournament = invitation?.tournament
  const tournamentUrl = tournament ? `/tournament/${encodeURIComponent(tournament.slug)}` : '/tournaments'

  return (
    <div className="attendance-page-shell">
      <SiteHeader active="tournaments" />
      <main className="attendance-page">
        <section className="attendance-card" aria-live="polite">
          <img src={`${import.meta.env.BASE_URL}juchess-logo.png`} alt="JuChess" />
          {loading ? (
            <>
              <LoaderCircle className="attendance-loader" size={34} aria-hidden="true" />
              <h1>Checking your invitation</h1>
              <p>Please wait while JuChess verifies this secure attendance link.</p>
            </>
          ) : error && !invitation ? (
            <>
              <XCircle size={38} aria-hidden="true" />
              <h1>Link unavailable</h1>
              <p>{error}</p>
              <Link className="attendance-secondary" to="/tournaments">View tournaments</Link>
            </>
          ) : invitation?.expired ? (
            <>
              <XCircle size={38} aria-hidden="true" />
              <h1>Attendance confirmation closed</h1>
              <p>This link expired when {tournament?.name ?? 'the tournament'} started. The admin panel will show that no current confirmation was received.</p>
              <Link className="attendance-secondary" to={tournamentUrl}>Open tournament</Link>
            </>
          ) : invitation ? (
            <>
              {invitation.status === 'confirmed' ? <CheckCircle2 size={38} aria-hidden="true" /> : null}
              {invitation.status === 'declined' ? <XCircle size={38} aria-hidden="true" /> : null}
              <span className="attendance-eyebrow">{tournament?.name ?? 'JuChess tournament'}</span>
              <h1>Do you confirm your attendance?</h1>
              <p>
                {invitation.status === 'confirmed'
                  ? 'Your current answer is Yes. You can change it before the tournament begins.'
                  : invitation.status === 'declined'
                    ? 'Your current answer is No. You can change it before the tournament begins.'
                    : 'Please answer before the tournament starts. No response will be shown to the organizer as not confirmed.'}
              </p>
              {error ? <p className="attendance-error" role="alert">{error}</p> : null}
              <div className="attendance-buttons">
                <button
                  type="button"
                  className="attendance-yes"
                  disabled={Boolean(answering)}
                  onClick={() => void answer('confirmed')}
                >
                  {answering === 'confirmed' ? 'Saving…' : 'Yes, I will attend'}
                </button>
                <button
                  type="button"
                  className="attendance-no"
                  disabled={Boolean(answering)}
                  onClick={() => void answer('declined')}
                >
                  {answering === 'declined' ? 'Saving…' : 'No, I cannot attend'}
                </button>
              </div>
              <Link className="attendance-secondary" to={tournamentUrl}>Open tournament details</Link>
            </>
          ) : null}
        </section>
      </main>
    </div>
  )
}
