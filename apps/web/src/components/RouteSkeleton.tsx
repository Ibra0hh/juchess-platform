import { useLocation } from 'react-router-dom'

import { compactCrestUrl } from '../lib/brand'
const navItems = Array.from({ length: 4 }, (_, index) => index)

type SkeletonKind = 'auth' | 'board' | 'content'

function routeKind(pathname: string): SkeletonKind {
  if (/\/(?:games|tools)(?:\/|$)/.test(pathname)) return 'board'
  if (/\/(?:sign-in|sign-up|forgot-password|verify-email|complete-profile|auth)(?:\/|$)/.test(pathname)) return 'auth'
  return 'content'
}

function SkeletonNavigation() {
  return (
    <div className="route-skeleton-nav" aria-hidden="true">
      {navItems.map((item) => (
        <span key={item}>
          <b className="route-skeleton-shape" />
        </span>
      ))}
    </div>
  )
}

function ContentPreview() {
  return (
    <div className="route-skeleton-content-preview" aria-hidden="true">
      <div className="route-skeleton-heading route-skeleton-shape" />
      <div className="route-skeleton-subheading route-skeleton-shape" />
      <div className="route-skeleton-search route-skeleton-shape" />
      <div className="route-skeleton-filters">
        <span className="route-skeleton-shape" />
        <span className="route-skeleton-shape" />
        <span className="route-skeleton-shape" />
      </div>
      <div className="route-skeleton-card-list">
        {navItems.slice(0, 3).map((item) => (
          <div className="route-skeleton-card" key={item}>
            <span className="route-skeleton-card-icon route-skeleton-shape" />
            <div>
              <b className="route-skeleton-shape" />
              <i className="route-skeleton-shape" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BoardPreview() {
  return (
    <div className="route-skeleton-board-preview" aria-hidden="true">
      <div className="route-skeleton-board-heading route-skeleton-shape" />
      <div className="route-skeleton-player route-skeleton-shape" />
      <div className="route-skeleton-board-grid">
        <span className="route-skeleton-board-sheen" />
      </div>
      <div className="route-skeleton-player bottom route-skeleton-shape" />
      <div className="route-skeleton-board-actions">
        <span className="route-skeleton-shape" />
        <span className="route-skeleton-shape" />
      </div>
    </div>
  )
}

function AuthPreview() {
  return (
    <div className="route-skeleton-auth-preview" aria-hidden="true">
      <div className="route-skeleton-auth-card">
        <span className="route-skeleton-auth-mark route-skeleton-shape" />
        <div className="route-skeleton-auth-title route-skeleton-shape" />
        <div className="route-skeleton-auth-copy route-skeleton-shape" />
        <div className="route-skeleton-auth-field route-skeleton-shape" />
        <div className="route-skeleton-auth-field route-skeleton-shape" />
        <div className="route-skeleton-auth-submit route-skeleton-shape" />
      </div>
    </div>
  )
}

export default function RouteSkeleton() {
  const { pathname } = useLocation()
  const kind = routeKind(pathname)

  return (
    <main
      className={`route-skeleton route-skeleton-${kind}`}
      data-variant={kind}
      role="status"
      aria-label="Loading JuChess"
    >
      <header className="route-skeleton-header">
        <div className="route-skeleton-header-inner">
          <div className="route-skeleton-brand" aria-hidden="true">
              <img src={compactCrestUrl} alt="" />
            <span>
              <strong>JuChess</strong>
              <small>University of Jordan Chess Club</small>
            </span>
          </div>
          <SkeletonNavigation />
          <span className="route-skeleton-account route-skeleton-shape" aria-hidden="true" />
        </div>
      </header>

      {kind === 'board' ? <BoardPreview /> : kind === 'auth' ? <AuthPreview /> : <ContentPreview />}
      <span className="route-skeleton-status">Loading JuChess…</span>
    </main>
  )
}
