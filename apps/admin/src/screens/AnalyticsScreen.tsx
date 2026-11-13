import { useEffect, useMemo, useState } from 'react'
import { formatAdminError, loadSiteAnalytics, type SiteAnalyticsReport } from '../lib/adminData'
import './AnalyticsScreen.css'

const pageLabels: Record<string, string> = {
  home: 'Home', tournaments: 'Tournaments', tournament: 'Tournament details', tools: 'Chess tools',
  'join-the-team': 'Join the team', team: 'Team profiles', leaderboard: 'Leaderboard',
  privacy: 'Privacy', terms: 'Terms', welcome: 'Welcome reel',
}

const controlLabels: Record<string, string> = {
  'nav-home': 'Home · navigation', 'nav-tournaments': 'Tournaments · navigation',
  'nav-tools': 'Tools · navigation', 'nav-profile': 'Profile · navigation', 'nav-sign-in': 'Sign in · header',
  'home-join': 'Join the club · home', 'home-vision': 'Our vision', 'home-news': 'Scroll to news',
  'home-feature': 'Featured tournament', 'home-team': 'Team member card', 'home-apply': 'Join the working team',
  'footer-tournaments': 'Tournaments · footer', 'footer-tools': 'Tools · footer',
  'footer-join': 'Join the club · footer', 'footer-apply': 'Join the team · footer',
  'tournament-card': 'Tournament card', 'tournament-filter': 'Tournament status filter',
  'tournament-list': 'Tournament list view', 'tournament-grid': 'Tournament grid view',
  'tools-review': 'Game Review', 'tools-analysis': 'New Analysis', 'tools-blank': 'Blank board',
  'tools-find-games': 'Find games', 'tools-load-more': 'Load more games', 'tools-start-review': 'Start review',
  'intro-piece': 'Collect a welcome piece', 'intro-enter': 'Enter JuChess',
}

const number = new Intl.NumberFormat('en')
type Layout = 'narrow' | 'wide'

export default function AnalyticsScreen() {
  const [days, setDays] = useState<1 | 7 | 30>(7)
  const [refresh, setRefresh] = useState(0)
  const [layout, setLayout] = useState<Layout>('wide')
  const [page, setPage] = useState('all')
  const [report, setReport] = useState<SiteAnalyticsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void loadSiteAnalytics(days)
      .then((value) => { if (active) setReport(value) })
      .catch((cause: unknown) => {
        if (active) {
          setReport(null)
          setError(formatAdminError(cause))
        }
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [days, refresh])

  const selectedPage = report?.pages.find((item) => item.page === page)
  const heatPage = selectedPage ?? report?.pages.find((item) => item.page === 'home') ?? report?.pages[0]
  const ranking = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of selectedPage ? [selectedPage] : report?.pages ?? []) {
      for (const [key, count] of row.controls) counts.set(key, (counts.get(key) ?? 0) + count)
    }
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10)
  }, [report, selectedPage])

  return (
    <section className="site-analytics" aria-label="Website analytics" aria-busy={loading}>
      <div className="filter-row site-analytics-filters">
        <label>Period <select aria-label="Period" value={days} onChange={(event) => setDays(Number(event.target.value) as 1 | 7 | 30)}>
          <option value={1}>Last 24 hours</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option>
        </select></label>
        <label>Page <select aria-label="Page" value={selectedPage ? page : 'all'} onChange={(event) => setPage(event.target.value)}>
          <option value="all">All public pages</option>
          {report?.pages.map((row) => <option key={row.page} value={row.page}>{pageLabels[row.page] ?? row.page}</option>)}
        </select></label>
        <button type="button" className="mini-button ghost" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>Refresh</button>
      </div>

      {loading ? <p className="muted" role="status">Loading website analytics…</p> : null}
      {error ? <p className="prototype-note" role="alert">Could not load analytics. {error}</p> : null}
      {!loading && report ? <>
        {report.truncated ? <p className="prototype-note">This report shows only the newest batches. Choose a shorter period for a complete count.</p> : null}
        <div className="recruitment-kpis site-analytics-stats">
          <article><div><strong>{number.format(selectedPage?.visits ?? report.visits)}</strong><small>{selectedPage ? 'Visits starting here' : 'Browser-tab visits'}</small></div></article>
          <article><div><strong>{number.format(selectedPage?.views ?? report.views)}</strong><small>Page views</small></div></article>
          <article><div><strong>{number.format(selectedPage?.clicks ?? report.clicks)}</strong><small>Recorded clicks</small></div></article>
        </div>
        <p className="muted">Visits count browser tabs, not unique people. Reports exclude account pages and browsers that opted out.</p>
        <div className="site-analytics-results">
          <section className="panel-card">
            <div className="panel-head"><strong>Most-clicked buttons and links</strong><span>{selectedPage ? pageLabels[selectedPage.page] : 'All public pages'}</span></div>
            {ranking.length ? <ol className="site-analytics-list">
              {ranking.map(([id, count]) => <li key={id}><span>{controlLabels[id] ?? id}</span><strong>{number.format(count)}</strong></li>)}
            </ol> : <p className="muted">No named controls have been clicked in this period yet.</p>}
          </section>
          <section className="panel-card">
            <div className="panel-head"><strong>Click heatmap</strong><span>{heatPage ? pageLabels[heatPage.page] : 'No activity yet'}</span></div>
            <label className="filter-row">Layout <select aria-label="Heatmap layout" value={layout} onChange={(event) => setLayout(event.target.value as Layout)}>
              <option value="wide">Wide (desktop)</option><option value="narrow">Narrow (mobile)</option>
            </select></label>
            <Heatmap heat={heatPage?.heat[layout] ?? []} />
            <p className="muted">Top to bottom of the page, including below the fold. Darker zones received more clicks. Keyboard clicks appear only in the ranking.</p>
          </section>
        </div>
        {!report.pages.length ? <p className="prototype-note">Analytics start collecting when the tracking code is published. Past traffic cannot be recovered.</p> : null}
        {!selectedPage && report.pages.length ? <section className="panel-card">
          <div className="panel-head"><strong>Pages by views</strong><span>Select a page above to inspect its clicks</span></div>
          <ul className="site-analytics-list">
            {report.pages.map((row) => <li key={row.page}><span>{pageLabels[row.page] ?? row.page}</span><strong>{number.format(row.views)}</strong></li>)}
          </ul>
        </section> : null}
      </> : null}
    </section>
  )
}

function Heatmap({ heat }: { heat: [number, number][] }) {
  const counts = new Map(heat)
  const max = Math.max(1, ...counts.values())
  const total = heat.reduce((sum, [, count]) => sum + count, 0)
  return (
    <figure className="site-analytics-heat">
      <figcaption>{number.format(total)} pointer {total === 1 ? 'click' : 'clicks'} · {heat.length} active {heat.length === 1 ? 'zone' : 'zones'}</figcaption>
      <div className="site-analytics-grid" role="img" aria-label={`Click heatmap: ${total} clicks in ${heat.length} zones from the top to the bottom of the page`}>
        {Array.from({ length: 192 }, (_, cell) => {
          const count = counts.get(cell) ?? 0
          return <span key={cell} title={`Row ${Math.floor(cell / 12) + 1}, column ${cell % 12 + 1}: ${count} clicks`}
            style={count ? { backgroundColor: `rgba(125, 36, 52, ${0.23 + 0.77 * Math.sqrt(count / max)})` } : undefined} />
        })}
      </div>
    </figure>
  )
}
