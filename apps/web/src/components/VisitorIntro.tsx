import { useEffect, useRef, useState } from 'react'
import { ArrowRight, LockKeyhole, LockKeyholeOpen } from 'lucide-react'
import { ExecutionMethod } from 'appwrite'
import { functions } from '../lib/appwrite'
import { lightCrestUrl } from '../lib/brand'
import './VisitorIntro.css'

const seenKey = 'juchess:visitor-intro:v1'
const squares = ['br', null, 'bk', null, 'bp', 'bp', 'bb', null, null, 'wp', 'wb', null, 'wr', null, 'wk', 'wn']
const missing = { 1: { piece: 'bn', name: 'knight' }, 7: { piece: 'bp', name: 'pawn' }, 13: { piece: 'wq', name: 'queen' } }
type MissingSquare = keyof typeof missing
const missingCount = Object.keys(missing).length
const rookSquare = 12
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
    const timeout = new Promise<boolean>((resolve) => { timer = window.setTimeout(resolve, 1800, false) })
    pendingStatus = Promise.race([networkVisit('/status').catch(() => false), timeout]).finally(() => {
      window.clearTimeout(timer)
      pendingStatus = undefined
    })
  }
  return pendingStatus
}

function Piece({ code, ghost = false }: { code: string; ghost?: boolean }) {
  return <img src={`${import.meta.env.BASE_URL}chess-pieces/${code}.png`} alt="" className={ghost ? 'visitor-intro__ghost' : undefined} draggable={false} />
}

export default function VisitorIntro() {
  const dialog = useRef<HTMLDialogElement>(null)
  const rook = useRef<HTMLButtonElement>(null)
  const enter = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(false)
  const [filled, setFilled] = useState<MissingSquare[]>([])
  const [unlocked, setUnlocked] = useState(false)
  const ready = filled.length === missingCount

  useEffect(() => {
    if (wasSeen()) return
    let mounted = true
    void checkNetworkVisit().then((seen) => {
      if (!mounted || wasSeen()) return
      if (seen) rememberVisit()
      else setVisible(true)
    })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const element = dialog.current
    if (!visible || !element) return
    element.showModal()
    return () => { element.close() }
  }, [visible])

  useEffect(() => {
    if (ready) rook.current?.focus()
  }, [ready])

  useEffect(() => {
    if (unlocked) enter.current?.focus()
  }, [unlocked])

  function finish() {
    rememberVisit()
    setVisible(false)
    void networkVisit('/complete').catch(() => {})
  }

  if (!visible) return null

  return (
    <dialog ref={dialog} className={`visitor-intro${unlocked ? ' visitor-intro--unlocked' : ''}`}
      aria-labelledby="visitor-intro-title" aria-describedby="visitor-intro-status"
      onCancel={(event) => { event.preventDefault(); finish() }}>
      <div className="visitor-intro__panel">
        <div className="visitor-intro__brand">
          <img src={lightCrestUrl} width="28" height="28" alt="" />
          <span>JuChess</span>
        </div>
        <div className="visitor-intro__heading">
          <span className="visitor-intro__badge" aria-hidden="true" key={String(unlocked)}>
            {unlocked ? <LockKeyholeOpen /> : <LockKeyhole />}
          </span>
          <h2 id="visitor-intro-title">{unlocked ? 'Access granted' : 'Access denied'}</h2>
        </div>
        <p id="visitor-intro-status" className="visitor-intro__status" aria-live="polite">
          {unlocked ? 'Welcome to JuChess.' : ready ? 'Tap the white rook.' : `Restore the missing pieces · ${filled.length}/${missingCount}`}
        </p>
        <div className="visitor-intro__board" role="group" aria-label="Welcome chess puzzle">
          {squares.map((piece, index) => {
            const dark = (Math.floor(index / 4) + index % 4) % 2 === 0
            const tile = `visitor-intro__square${dark ? ' visitor-intro__square--dark' : ''}`
            if (Object.hasOwn(missing, index)) {
              const square = index as MissingSquare
              const placed = filled.includes(square)
              return (
                <button key={index} type="button" className={`${tile} visitor-intro__target`} data-placed={placed}
                  aria-label={placed ? `${missing[square].name} restored` : `Restore the ${missing[square].name}`}
                  aria-disabled={placed} tabIndex={placed ? -1 : 0}
                  onClick={() => setFilled((current) => current.includes(square) ? current : [...current, square])}>
                  <Piece code={missing[square].piece} ghost={!placed} />
                </button>
              )
            }
            if (index === rookSquare) {
              return (
                <button ref={rook} key={index} type="button" className={`${tile} visitor-intro__rook`}
                  aria-label="Unlock with the white rook" disabled={!ready || unlocked}
                  onClick={() => setUnlocked(true)}>
                  <Piece code="wr" />
                </button>
              )
            }
            return <span key={index} className={tile} aria-hidden="true">{piece && <Piece code={piece} />}</span>
          })}
        </div>
        <div className="visitor-intro__actions">
          <button ref={enter} type="button" className="visitor-intro__enter" disabled={!unlocked} onClick={finish}>
            Enter JuChess {unlocked ? <ArrowRight aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
          </button>
          <button type="button" className="visitor-intro__skip" hidden={unlocked} onClick={finish}>Skip intro</button>
        </div>
      </div>
    </dialog>
  )
}
