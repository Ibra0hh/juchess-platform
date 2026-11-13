import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowUpRight, Check, LockKeyhole, LockKeyholeOpen } from 'lucide-react'
import { ExecutionMethod } from 'appwrite'
import { functions } from '../lib/appwrite'
import { compactCrestUrl } from '../lib/brand'
import './VisitorIntro.css'

const seenKey = 'juchess:visitor-intro:v1'
const pieces = [
  { name: 'Pawn', square: 'E2' },
  { name: 'Knight', square: 'G1' },
  { name: 'Bishop', square: 'C1' },
  { name: 'Queen', square: 'D1' },
  { name: 'Rook', square: 'A1' },
] as const
type Piece = typeof pieces[number]['name']
const rookIndex = pieces.length - 1
let seenInMemory = false
let pendingStatus: Promise<boolean> | undefined

function wasSeen() {
  try {
    return seenInMemory || localStorage.getItem(seenKey) === '1'
  } catch {
    return seenInMemory
  }
}

function rememberVisit() {
  seenInMemory = true
  try {
    localStorage.setItem(seenKey, '1')
  } catch {
    // A browser that blocks storage can still enter the site.
  }
}

async function networkVisit(path: '/status' | '/complete') {
  const execution = await functions.createExecution({
    functionId: 'visitor-intro',
    xpath: path,
    method: ExecutionMethod.POST,
    async: false,
  })
  return execution.responseStatusCode === 200 && JSON.parse(execution.responseBody).seen === true
}

function checkNetworkVisit() {
  if (!pendingStatus) {
    let timer: number
    const timeout = new Promise<boolean>((resolve) => { timer = window.setTimeout(resolve, 4500, false) })
    pendingStatus = Promise.race([networkVisit('/status').catch(() => false), timeout]).finally(() => {
      window.clearTimeout(timer)
      pendingStatus = undefined
    })
  }
  return pendingStatus
}

function PieceIcon({ piece, className }: { piece: Piece; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 80" fill="#fff9e9" stroke="#513b33" strokeWidth="1.5"
      strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      {piece === 'Pawn' && <><circle cx="32" cy="18" r="10" /><path d="M23 30h18v6H23zM27 36h10c-1 15 3 22 10 28H17c7-6 11-13 10-28ZM15 65h34v7H15zM11 73h42v5H11z" /></>}
      {piece === 'Knight' && <><path d="m19 13 2-10 10 10 7-9 4 13c15 12 16 29 6 47H18c1-14 12-21 15-32l-12 9-12-5-2-9Z" /><path d="m12 29 12-8M20 15l8 3" fill="none" strokeWidth="2" /><circle cx="29" cy="24" r="2.5" fill="#080b0d" /><path d="M15 65h34v7H15zM11 73h42v5H11z" /></>}
      {piece === 'Bishop' && <><circle cx="32" cy="7" r="4" /><path d="M31 11c-24 19-22 28-10 34h22c13-8 12-17-12-34Z" /><path d="m37 18-11 16" fill="none" strokeWidth="3" /><path d="M21 46h22v6H21zM26 52h12l8 12H18zM15 65h34v7H15zM11 73h42v5H11z" /></>}
      {piece === 'Queen' && <><circle cx="10" cy="17" r="3.5" /><circle cx="21" cy="11" r="3.5" /><circle cx="32" cy="7" r="3.8" /><circle cx="43" cy="11" r="3.5" /><circle cx="54" cy="17" r="3.5" /><path d="M10 21l9 28h26l9-28-11 15V16L32 38 21 16v20Z M19 50h26v7H19zM23 57h18l5 9H18zM15 67h34v6H15zM11 74h42v5H11z" /></>}
      {piece === 'Rook' && <path d="M11 8h10v9h7V8h9v9h7V8h9v22H11zM17 31h30v6H17zM22 37h20l3 26H19zM15 64h34v7H15zM11 72h42v6H11z" />}
    </svg>
  )
}

function StatusTriangle({ granted }: { granted: boolean }) {
  return (
    <div className="visitor-intro__signal" key={String(granted)}>
      <svg viewBox="0 0 36 34" fill="none" stroke="currentColor" strokeWidth="1.7"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 4a2.3 2.3 0 0 1 4 0l14 24a2.3 2.3 0 0 1-2 3H4a2.3 2.3 0 0 1-2-3Z" />
        {granted ? (
          <path d="m11 18 5 5 10-11" transform="translate(2.24 4.06) scale(.82)" strokeWidth="3.6" />
        ) : (
          <><path d="M18 12v8" strokeWidth="3" /><circle cx="18" cy="25" r="1.4" fill="currentColor" stroke="none" /></>
        )}
      </svg>
      <span>{granted ? 'Access granted' : 'Error 403'}<br />{granted ? 'Identity verified' : 'Access restricted'}</span>
    </div>
  )
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function VisitorIntro() {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const enter = useRef<HTMLButtonElement>(null)
  const timers = useRef(new Set<number>())
  const [visible, setVisible] = useState(false)
  const [collected, setCollected] = useState<number[]>([])
  const [landed, setLanded] = useState<number[]>([])
  const [granted, setGranted] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const preview = new URLSearchParams(window.location.search).get('intro') === 'preview'
  const heatmapPreview = window.self !== window.top && new URLSearchParams(window.location.search).get('heatmapPreview') === '1'
  const rookReady = collected.length >= rookIndex
  const lastLanding = landed.at(-1)

  useEffect(() => {
    if (preview || heatmapPreview) return
    if (wasSeen()) return
    let mounted = true
    void checkNetworkVisit().then((seen) => {
      if (!mounted || wasSeen()) return
      if (seen) rememberVisit()
      else setVisible(true)
    })
    return () => { mounted = false }
  }, [preview, heatmapPreview])

  useEffect(() => {
    const element = dialog.current
    if ((!visible && !preview) || !element) return
    const preventDismissal = (event: Event) => event.preventDefault()
    element.setAttribute('closedby', 'none')
    element.addEventListener('cancel', preventDismissal)
    element.showModal()
    heading.current?.focus({ preventScroll: true })
    return () => {
      element.removeEventListener('cancel', preventDismissal)
      element.close()
    }
  }, [visible, preview])

  useEffect(() => {
    const active = timers.current
    return () => { active.forEach((timer) => window.clearTimeout(timer)); active.clear() }
  }, [])

  useEffect(() => {
    if (landed.length !== pieces.length) return
    const timer = window.setTimeout(() => setGranted(true), reducedMotion() ? 0 : 520)
    return () => window.clearTimeout(timer)
  }, [landed.length])

  useEffect(() => {
    if (granted) enter.current?.focus({ preventScroll: true })
  }, [granted])

  function after(delay: number, callback: () => void) {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer)
      callback()
    }, delay)
    timers.current.add(timer)
  }

  function collect(index: number) {
    if (leaving || collected.includes(index) || (index === rookIndex && !rookReady)) return
    setCollected((current) => [...current, index])
    after(reducedMotion() ? 0 : index === rookIndex ? 1120 : 920, () => setLanded((current) => [...current, index]))
  }

  function finish() {
    if (!granted || leaving) return
    if (!preview) {
      rememberVisit()
      void networkVisit('/complete').catch(() => {})
    }
    setLeaving(true)
    after(reducedMotion() ? 0 : 680, () => {
      setVisible(false)
      dialog.current?.close()
    })
  }

  if (!visible && !preview) return null

  return (
    <dialog ref={dialog} className="visitor-intro" data-granted={granted} data-leaving={leaving}
      aria-labelledby="visitor-intro-title">
      <div className="visitor-intro__stage">
        <header className="visitor-intro__masthead">
          <div className="visitor-intro__brand">
            <img src={compactCrestUrl} width="24" height="48" alt="" />
            <span>Ju<em>Chess</em></span>
          </div>
          <span className="visitor-intro__club">University of Jordan<br />Chess Club</span>
        </header>

        <section className="visitor-intro__scene">
          <div className="visitor-intro__heading">
            <h2 ref={heading} tabIndex={-1} id="visitor-intro-title" aria-live="polite">
              Access <span>{granted ? 'Granted.' : 'Denied.'}</span>
            </h2>
            <StatusTriangle granted={granted} />
          </div>
          <p className="visitor-intro__subtitle">
            {granted ? <>Every missing piece recovered.<br />Welcome to JuChess.</> :
              <>Your access is restricted.<br />Restore the missing pieces to continue.</>}
          </p>
          <div className="visitor-intro__address">
            {granted ? <LockKeyholeOpen aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
            <span>juchess.page</span>
            <i aria-hidden="true" />
          </div>
          {granted && <button ref={enter} type="button" data-analytics-control="intro-enter" className="visitor-intro__enter" onClick={finish}>
            Enter JuChess <ArrowUpRight aria-hidden="true" />
          </button>}

          <div className="visitor-intro__collection">
            <div className="visitor-intro__collection-label">
              <strong>{granted ? 'All pieces restored' : 'The missing pieces'}</strong>
              <span>{granted ? 'Ready to play' : rookReady && collected.length === rookIndex ? 'Collect the rook' : 'Collect to unlock'}</span>
            </div>
            <div className="visitor-intro__tray" role="group" aria-label="Missing chess pieces">
              {pieces.map(({ name, square }, index) => {
                const used = collected.includes(index)
                const flying = used && !landed.includes(index)
                return (
                  <div className="visitor-intro__slot" key={name} data-rook={index === rookIndex}>
                    <button type="button" data-analytics-control="intro-piece" className="visitor-intro__token" data-used={used}
                      disabled={index === rookIndex && !rookReady} aria-disabled={used || undefined} tabIndex={used ? -1 : 0}
                      aria-label={used ? `${name} collected` : `Collect ${name.toLowerCase()} for ${square}`}
                      onClick={() => collect(index)}>
                      <PieceIcon piece={name} className="visitor-intro__piece" />
                      <strong>{name}</strong>
                      <small>{square}</small>
                      {used && <Check className="visitor-intro__collected" aria-hidden="true" />}
                    </button>
                    {flying && <PieceIcon piece={name} className="visitor-intro__flight" />}
                    {lastLanding === index && !granted && !reducedMotion() && (
                      <div className="visitor-intro__sparks" aria-hidden="true">
                        {Array.from({ length: index === rookIndex ? 18 : 12 }, (_, spark) => (
                          <i key={spark} style={{
                            '--angle': `${spark * (index === rookIndex ? 20 : 30)}deg`,
                            '--distance': `${36 + (spark % 4) * 9}px`,
                          } as CSSProperties} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {lastLanding !== undefined && !granted && !reducedMotion() && (
              <div className="visitor-intro__callout" key={lastLanding} data-final={lastLanding === rookIndex} aria-hidden="true">
                <strong>{lastLanding === rookIndex ? 'Final rook' : pieces[lastLanding].name} found</strong>
                <span>{pieces[lastLanding].square} secured</span>
              </div>
            )}
            <div className="visitor-intro__progress" role="status">
              <strong>{String(collected.length).padStart(2, '0')} / 05 collected</strong>
              <span>{granted ? 'Website unlocked' : 'Website locked'}</span>
            </div>
            <div className="visitor-intro__track" aria-hidden="true">
              <div style={{ width: `${collected.length / pieces.length * 100}%` }} />
            </div>
          </div>
        </section>

        <footer className="visitor-intro__footer">
          <span>JuChess &middot; University of Jordan</span>
          <em>{granted ? 'Welcome to JuChess.' : 'One club. A whole new chapter.'}</em>
        </footer>
      </div>
    </dialog>
  )
}
