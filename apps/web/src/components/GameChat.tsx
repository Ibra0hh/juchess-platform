import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import {
  loadHostedGameMessages,
  sendHostedGameMessage,
  subscribeToHostedGameMessages,
  type GameChatMessage,
} from '../lib/onlineTournament'

const CHAT_PRESETS = ['Good luck!', 'Good game!', 'Connection problem.', 'Please call an arbiter.']

type GameChatProps = {
  canSend: boolean
  currentProfileId: string
  gameId: string
  opponentName: string
  policy: 'full' | 'preset' | 'disabled'
}

export function GameChat({
  canSend,
  currentProfileId,
  gameId,
  opponentName,
  policy,
}: GameChatProps) {
  const [messages, setMessages] = useState<GameChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLSpanElement | null>(null)

  const refresh = useCallback(async () => {
    try {
      const rows = await loadHostedGameMessages(gameId)
      setMessages(rows)
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chat is unavailable.')
    } finally {
      setLoading(false)
    }
  }, [gameId])

  useEffect(() => {
    setMessages([])
    setDraft('')
    setLoading(true)
    void refresh()
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const timer = window.setInterval(refreshWhenVisible, 10_000)
    let unsubscribe: (() => void) | undefined
    let alive = true
    void subscribeToHostedGameMessages(gameId, () => void refresh())
      .then((stop) => {
        if (alive) unsubscribe = stop
        else stop()
      })
      .catch(() => {
        // Polling keeps the conversation current if Realtime is unavailable.
      })
    return () => {
      alive = false
      window.clearInterval(timer)
      unsubscribe?.()
    }
  }, [gameId, refresh])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages])

  async function send(body: string, kind: 'text' | 'preset') {
    const normalized = body.trim()
    if (!normalized || sending || !canSend || policy === 'disabled') return
    setSending(true)
    setError('')
    try {
      const message = await sendHostedGameMessage(gameId, normalized, kind)
      setMessages((current) => current.some((item) => item.$id === message.$id)
        ? current
        : [...current, message])
      setDraft('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send that message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="game-chat" aria-labelledby="game-chat-title">
      <header>
        <span><MessageCircle size={16} aria-hidden="true" /></span>
        <div>
          <h2 id="game-chat-title">Opponent chat</h2>
          <p>{canSend ? `Connected with ${opponentName}` : `Game chat with ${opponentName} · read only`}</p>
        </div>
      </header>

      <div className="game-chat-thread" aria-live="polite">
        {loading ? <p className="game-chat-empty">Loading messages…</p> : null}
        {!loading && !messages.length ? (
          <p className="game-chat-empty">
            {policy === 'disabled' ? 'Chat is disabled for this tournament.' : 'No messages yet. Keep it friendly and focused on the game.'}
          </p>
        ) : null}
        {messages.map((message) => {
          const mine = message.senderProfileId === currentProfileId
          return (
            <article className={mine ? 'mine' : undefined} key={message.$id}>
              <span>{mine ? 'You' : opponentName}</span>
              <p>{message.body}</p>
              <time dateTime={message.createdAt}>
                {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </time>
            </article>
          )
        })}
        <span ref={endRef} />
      </div>

      {canSend && policy !== 'disabled' ? (
        <>
          <div className="game-chat-presets">
            {CHAT_PRESETS.map((preset) => (
              <button type="button" disabled={sending} onClick={() => void send(preset, 'preset')} key={preset}>
                {preset}
              </button>
            ))}
          </div>
          {policy === 'full' ? (
            <form onSubmit={(event) => {
              event.preventDefault()
              void send(draft, 'text')
            }}>
              <input
                aria-label="Message your opponent"
                maxLength={500}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Message your opponent"
                value={draft}
              />
              <button type="submit" disabled={sending || !draft.trim()} aria-label="Send message">
                <Send size={15} aria-hidden="true" />
              </button>
            </form>
          ) : null}
        </>
      ) : (
        <p className="game-chat-closed">
          {policy === 'disabled' ? 'Messaging is disabled by the organizer.' : 'This conversation closed when the game ended.'}
        </p>
      )}
      {error ? <p className="game-chat-error" role="status">{error}</p> : null}
    </section>
  )
}
