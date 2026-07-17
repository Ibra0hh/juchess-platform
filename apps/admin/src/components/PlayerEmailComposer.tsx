import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Mail, Send, X } from 'lucide-react'
import { compactCrestUrl } from '../lib/brand'
import {
  formatAdminError,
  loadPlayerEmailStatus,
  sendPlayerEmail,
  type PlayerEmailSendResult,
  type PlayerEmailStatus,
} from '../lib/adminData'

export type PlayerEmailRecipient = {
  id: string
  name: string
  email: string
}

type Props = {
  recipients: PlayerEmailRecipient[]
  onClose: () => void
  onSent: (result: PlayerEmailSendResult) => void
}

export default function PlayerEmailComposer({ recipients, onClose, onSent }: Props) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [provider, setProvider] = useState<PlayerEmailStatus | null>(null)
  const [providerError, setProviderError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const subjectRef = useRef<HTMLInputElement>(null)
  const sendingRef = useRef(false)
  const onCloseRef = useRef(onClose)
  const recipientLabel = useMemo(() => (
    recipients.length === 1 ? recipients[0].name : `${recipients.length} selected players`
  ), [recipients])

  useEffect(() => {
    sendingRef.current = sending
  }, [sending])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    subjectRef.current?.focus()

    let alive = true
    void loadPlayerEmailStatus()
      .then((status) => {
        if (alive) setProvider(status)
      })
      .catch(() => {
        if (alive) setProviderError('Email delivery status could not be loaded.')
      })

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !sendingRef.current) onCloseRef.current()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      alive = false
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!provider?.ready || sending) return

    setSending(true)
    setSendError(null)
    try {
      const result = await sendPlayerEmail({
        profileIds: recipients.map((recipient) => recipient.id),
        subject,
        message,
      })
      onSent(result)
    } catch (error) {
      setSendError(formatAdminError(error))
      setSending(false)
    }
  }

  const readyToSend = Boolean(provider?.ready && subject.trim() && message.trim() && !sending)

  return (
    <div className="modal-backdrop player-email-backdrop" onClick={() => { if (!sending) onClose() }}>
      <section
        aria-labelledby="player-email-title"
        aria-modal="true"
        className="player-email-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="player-email-head">
          <span className="player-email-icon"><Mail size={20} aria-hidden="true" /></span>
          <div>
            <span>Player email</span>
            <h2 id="player-email-title">Message {recipientLabel}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={sending} aria-label="Close email composer">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="player-email-layout">
          <form className="player-email-form" onSubmit={(event) => void handleSubmit(event)}>
            <div className="player-email-delivery-row">
              <div><span>From</span><strong>JuChess &lt;no-reply@juchess.page&gt;</strong></div>
              <div><span>Replies</span><strong>Juchess180@gmail.com</strong></div>
            </div>

            <div className="player-email-recipients">
              <span>Recipients</span>
              <div>
                {recipients.map((recipient) => (
                  <span title={recipient.email} key={recipient.id}>{recipient.name}</span>
                ))}
              </div>
              <small>Addresses are delivered privately and are never shown to other players.</small>
            </div>

            <label>
              Subject
              <input
                ref={subjectRef}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Tournament update"
                maxLength={120}
                required
              />
              <small>{subject.length}/120</small>
            </label>

            <label>
              Message
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Write your message to the selected players..."
                maxLength={5000}
                required
              />
              <small>{message.length}/5000</small>
            </label>

            <div className={provider?.ready ? 'player-email-provider ready' : 'player-email-provider'} role="status">
              {provider?.ready
                ? `Email delivery ready${provider.provider ? ` · ${provider.provider}` : ''}`
                : providerError
                  ? providerError
                  : provider
                    ? 'Email delivery provider is not configured.'
                    : 'Checking email delivery...'}
            </div>
            {sendError ? <div className="auth-error" role="alert">{sendError}</div> : null}

            <div className="player-email-actions">
              <button type="button" className="secondary-action" onClick={onClose} disabled={sending}>Cancel</button>
              <button type="submit" className="primary-button" disabled={!readyToSend}>
                <Send size={16} aria-hidden="true" />
                {sending ? 'Queuing email...' : `Send to ${recipients.length} player${recipients.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </form>

          <aside className="player-email-preview" aria-label="Email preview">
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
                <div>This message was sent by the JuChess administration team. Reply to this email to contact the club.</div>
              </div>
              <footer>JuChess · University of Jordan Chess Club</footer>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
