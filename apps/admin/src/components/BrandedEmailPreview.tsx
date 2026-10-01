import { compactCrestUrl } from '../lib/brand'
import type { PlayerEmailLink } from '../lib/playerEmail'

type Props = {
  subject: string
  message: string
  link?: PlayerEmailLink | null
  linkPending?: boolean
  className?: string
}

export default function BrandedEmailPreview({
  subject,
  message,
  link,
  linkPending = false,
  className,
}: Props) {
  const previewClassName = ['player-email-preview', className].filter(Boolean).join(' ')

  return (
    <aside className={previewClassName} aria-label="Email preview">
      <span>Email preview</span>
      <div className="player-email-preview-card">
        <div className="player-email-preview-accent" />
        <div className="player-email-preview-brand">
          <img src={compactCrestUrl} alt="JuChess" />
          <strong>JuChess</strong>
          <small>University of Jordan Chess Club</small>
        </div>
        <div className="player-email-preview-copy">
          <h3>{subject.trim() || 'Your email subject'}</h3>
          <p>{message.trim() || 'Your message will appear here in the JuChess club email theme.'}</p>
          {link ? (
            <span className="player-email-preview-link" aria-label={`Link button preview: ${link.text}`}>
              {link.text}
            </span>
          ) : linkPending ? (
            <span className="player-email-preview-link-placeholder">Complete the link button details</span>
          ) : null}
          <div>This message was sent by the JuChess administration team. Reply to this email to contact the club.</div>
        </div>
        <footer>JuChess · University of Jordan Chess Club</footer>
      </div>
    </aside>
  )
}
