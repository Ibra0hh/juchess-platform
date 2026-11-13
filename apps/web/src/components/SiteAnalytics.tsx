import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

type Runtime = typeof import('../lib/siteAnalytics')
type Tracker = ReturnType<Runtime['startAnalytics']>

export default function SiteAnalytics() {
  const { pathname } = useLocation()
  const currentPath = useRef(pathname)
  const active = useRef<{ runtime: Runtime; tracker: Tracker } | null>(null)

  useEffect(() => {
    let cancelled = false
    void import('../lib/siteAnalytics').then((runtime) => {
      if (cancelled) return
      active.current = { runtime, tracker: runtime.startAnalytics(runtime.analyticsPage(currentPath.current)) }
    }).catch(() => undefined)
    return () => { cancelled = true; active.current?.tracker.stop(); active.current = null }
  }, [])

  useEffect(() => {
    const changed = currentPath.current.replace(/\/+$/, '') !== pathname.replace(/\/+$/, '')
    currentPath.current = pathname
    if (active.current) active.current.tracker.setPage(active.current.runtime.analyticsPage(pathname), changed)
  }, [pathname])
  return null
}
