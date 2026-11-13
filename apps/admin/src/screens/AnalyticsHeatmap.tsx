import { useEffect, useRef, useState } from 'react'

const routes: Record<string, string> = {
  home: '/home/', tournaments: '/tournaments/', tools: '/tools/', 'join-the-team': '/join-the-team/',
  team: '/team/ibrahim-aladily/', leaderboard: '/leaderboard/', privacy: '/privacy/', terms: '/terms/',
  welcome: '/home/',
}

const number = new Intl.NumberFormat('en')

export default function AnalyticsHeatmap({ page, layout, heat }: {
  page: string
  layout: 'narrow' | 'wide'
  heat: [number, number][]
}) {
  const path = routes[page]
  const src = path ? `${path}?heatmapPreview=1${page === 'welcome' ? '&intro=preview' : ''}` : ''
  const viewport = layout === 'narrow' ? { width: 390, height: 844, max: 224 } : { width: 1366, height: 900, max: 760 }
  const host = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [availableWidth, setAvailableWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [scroll, setScroll] = useState(0)
  const [frameFailed, setFrameFailed] = useState(false)
  const scale = Math.min(availableWidth, viewport.max) / viewport.width
  const counts = new Map(heat)
  const max = Math.max(1, ...counts.values())
  const total = heat.reduce((sum, [, count]) => sum + count, 0)

  useEffect(() => {
    if (!host.current) return
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width))
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!src || !scale || frameFailed) return
    let child: Document | null | undefined
    let observer: ResizeObserver | undefined
    const element = frame.current
    const measure = () => {
      if (!child) return
      setHeight(page === 'welcome' ? viewport.height : Math.max(viewport.height, child.documentElement.scrollHeight))
    }
    const observe = () => {
      observer?.disconnect()
      try {
        child = element?.contentDocument
        if (!child?.body) { setFrameFailed(true); return }
        observer = new ResizeObserver(measure)
        observer.observe(child.body)
        observer.observe(child.documentElement)
        measure()
      } catch { setFrameFailed(true) }
    }
    element?.addEventListener('load', observe)
    if (element?.contentDocument?.readyState === 'complete' && element.contentDocument.location.pathname === path) observe()
    return () => { element?.removeEventListener('load', observe); observer?.disconnect() }
  }, [src, path, scale, page, viewport.height, frameFailed])

  function scrollPreview(value: number) {
    setScroll(value)
    if (scale) frame.current?.contentWindow?.scrollTo({ top: value / scale, behavior: 'instant' })
  }

  return (
    <figure className="site-analytics-heat">
      <figcaption>{number.format(total)} pointer {total === 1 ? 'click' : 'clicks'} · {heat.length} active {heat.length === 1 ? 'zone' : 'zones'}</figcaption>
      <div className="site-analytics-preview-host" ref={host}>
        {src && !frameFailed ? (
          <div className="site-analytics-preview-scroll" tabIndex={0} aria-label="Scroll through the website preview"
            style={{ width: scale * viewport.width, height: scale * viewport.height }}
            onScroll={(event) => scrollPreview(event.currentTarget.scrollTop)}>
            <div style={{ height: scale * Math.max(viewport.height, height) }}>
              <div className="site-analytics-preview-stage" style={{ height: scale * viewport.height }}>
                {scale > 0 ? <iframe ref={frame} title="Read-only JuChess page preview" src={src} tabIndex={-1} inert
                  sandbox="allow-scripts allow-same-origin" onError={() => setFrameFailed(true)}
                  style={{ width: viewport.width, height: viewport.height, transform: `scale(${scale})` }} /> : null}
                <div className="site-analytics-hotspots" role="img" aria-label={`Website click overlay: ${total} pointer clicks`}
                  style={{ height: scale * Math.max(viewport.height, height), top: -scroll }}>
                  {heat.map(([cell, count]) => <span key={cell} title={`${count} ${count === 1 ? 'click' : 'clicks'} in this zone`}
                    style={{ left: `${(cell % 12) * 100 / 12}%`, top: `${Math.floor(cell / 12) * 100 / 16}%`,
                      opacity: 0.24 + 0.55 * Math.sqrt(count / max) }}>{count}</span>)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="muted">{!src ? 'These clicks combine different tournament pages, so there is no single page to preview.' : 'The page preview could not load. The click zones are still available.'}</p>
            <div className="site-analytics-grid" role="img" aria-label={`Click heatmap: ${total} clicks`}>
              {Array.from({ length: 192 }, (_, cell) => {
                const count = counts.get(cell) ?? 0
                return <span key={cell} title={`Row ${Math.floor(cell / 12) + 1}, column ${cell % 12 + 1}: ${count} clicks`}
                  style={count ? { backgroundColor: `rgba(125, 36, 52, ${0.23 + 0.77 * Math.sqrt(count / max)})` } : undefined} />
              })}
            </div>
          </>
        )}
      </div>
      {!total ? <p className="muted">No pointer clicks recorded for this page, layout, and period.</p> : null}
      {page === 'team' ? <p className="muted">Team clicks are combined across profiles; this is a representative page.</p> : null}
      <p className="muted">Scroll inside the preview. Numbered zones show approximate click locations on the current layout, not a replay. Keyboard clicks appear only in the ranking.</p>
    </figure>
  )
}
