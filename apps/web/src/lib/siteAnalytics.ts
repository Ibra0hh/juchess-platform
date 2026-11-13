import { appwriteConfig } from './appwrite'

const pages = new Set(['home', 'tournaments', 'tournament', 'tools', 'join-the-team', 'team', 'leaderboard', 'privacy', 'terms'])
const visitKey = 'juchess:analytics-tab'
const preferenceKey = 'juchess:analytics-disabled'
const preferenceEvent = 'juchess:analytics-preference'
type Layout = 'narrow' | 'wide'
type AnalyticsEvent = ['v', string, Layout, 0 | 1] | ['c', string, Layout, string | null, number | null, number | null]

export function analyticsPage(pathname: string) {
  const path = pathname.replace(/\/+$/, '').toLowerCase()
  if (!path) return 'home'
  if (/^\/(tournament|team)\/[^/]+$/.test(path)) return path.split('/')[1]
  const page = path.slice(1)
  return pages.has(page) ? page : null
}

export function browserDisablesAnalytics() {
  return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true || navigator.doNotTrack === '1'
}

export function analyticsDisabled() {
  if (browserDisablesAnalytics()) return true
  try { return localStorage.getItem(preferenceKey) === '1' } catch { return true }
}

export function setAnalyticsDisabled(disabled: boolean) {
  try {
    localStorage.setItem(preferenceKey, disabled ? '1' : '0')
    window.dispatchEvent(new Event(preferenceEvent))
  } catch { /* A browser without storage is already opted out. */ }
}

export function startAnalytics(initialPage: string | null) {
  let page: string | null = null
  let lastTracked: string | null = null
  let started = false
  try { started = sessionStorage.getItem(visitKey) === '1' } catch { /* Use in-memory visit state. */ }
  let queue: AnalyticsEvent[] = []
  let timer: number | undefined
  const layout = (): Layout => matchMedia('(max-width: 767px)').matches ? 'narrow' : 'wide'

  function flush() {
    window.clearTimeout(timer)
    timer = undefined
    if (analyticsDisabled()) queue = []
    if (!queue.length) return
    const events = queue
    queue = []
    void fetch(`${appwriteConfig.endpoint}/functions/site-analytics/executions`, {
      method: 'POST',
      keepalive: true,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { 'content-type': 'application/json', 'x-appwrite-project': appwriteConfig.projectId },
      body: JSON.stringify({ path: '/collect', method: 'POST', async: true, body: JSON.stringify(events) }),
    }).catch(() => undefined)
  }

  function enqueue(event: AnalyticsEvent) {
    if (analyticsDisabled()) return
    queue.push(event)
    if (queue.length >= 32) flush()
    else timer ??= window.setTimeout(flush, 8000)
  }

  function recordPage() {
    if (!page || page === lastTracked || document.visibilityState !== 'visible' || analyticsDisabled()) return
    enqueue(['v', page, layout(), started ? 0 : 1])
    lastTracked = page
    started = true
    try { sessionStorage.setItem(visitKey, '1') } catch { /* Storage is optional. */ }
  }

  function setPage(next: string | null, newPage = false) {
    if (next !== page || newPage) lastTracked = null
    page = next
    recordPage()
  }

  function onClick(event: MouseEvent) {
    if (!event.isTrusted || !page || analyticsDisabled() || !(event.target instanceof Element)) return
    if (event.target.closest('input, textarea, select, option, [contenteditable], [data-no-analytics]')) return
    const control = event.target.closest<HTMLElement>('[data-analytics-control]')
    if (control?.matches(':disabled, [aria-disabled="true"]')) return
    const id = control?.dataset.analyticsControl || null
    const clickPage = event.target.closest('dialog.visitor-intro') ? 'welcome' : page
    if (event.detail === 0) {
      if (id) enqueue(['c', clickPage, layout(), id, null, null])
      return
    }
    const root = document.documentElement
    const width = Math.max(root.clientWidth, 1)
    const height = Math.max(clickPage === 'welcome' ? root.clientHeight : root.scrollHeight, 1)
    const x = Math.max(0, Math.min(11, Math.floor(event.clientX / width * 12)))
    const y = Math.max(0, Math.min(15, Math.floor((event.clientY + (clickPage === 'welcome' ? 0 : window.scrollY)) / height * 16)))
    enqueue(['c', clickPage, layout(), id, x, y])
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') flush()
    else recordPage()
  }

  function onPreference() {
    if (analyticsDisabled()) {
      queue = []
      window.clearTimeout(timer)
      timer = undefined
      lastTracked = null
    } else recordPage()
  }

  document.addEventListener('click', onClick, { capture: true, passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', flush)
  window.addEventListener('storage', onPreference)
  window.addEventListener(preferenceEvent, onPreference)
  setPage(initialPage)
  return {
    setPage,
    stop() {
      window.clearTimeout(timer)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('storage', onPreference)
      window.removeEventListener(preferenceEvent, onPreference)
    },
  }
}
