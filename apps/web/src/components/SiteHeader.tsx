import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { profileMediaUrl } from '../lib/auth'
import { compactCrestUrl } from '../lib/brand'
import { useOnlineTournamentPlayLock } from '../lib/onlineTournamentPlayLock'
import { type ApplicationReturn, withApplicationReturn } from '../lib/profileCompletion'
import './SiteHeader.css'

type SiteHeaderProps = {
  active?: 'home' | 'tournaments' | 'tools' | 'games' | 'leaderboard' | 'profile'
  profilePreview?: {
    displayName: string
    initials: string
    avatarUrl?: string
  }
  toolsDisabled?: boolean
  signInReturn?: ApplicationReturn | null
}

function SiteHeader({ active, profilePreview, toolsDisabled = false, signInReturn }: SiteHeaderProps) {
  const { loading, profile, signOut, user } = useAuth()
  const playLock = useOnlineTournamentPlayLock()
  const toolsUnavailable = toolsDisabled || Boolean(playLock)
  const toolsActive = active === 'tools' || active === 'games'
  const displayName = profile?.displayName || user?.name || user?.email || ''
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    || 'JU'
  const avatarUrl = profilePreview?.avatarUrl || profileMediaUrl(profile?.avatarFileId)

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/home" className="brand-link">
          <img src={compactCrestUrl} alt="Chess Club JU crest" />
          <span>
            <strong>JuChess</strong>
            <small>University of Jordan Chess Club</small>
          </span>
        </Link>

        <nav className="main-nav" aria-label="Primary navigation">
          <Link data-analytics-control="nav-home" to="/home" className={active === 'home' ? 'active' : undefined} aria-current={active === 'home' ? 'page' : undefined}>
            Home
          </Link>
          <Link data-analytics-control="nav-tournaments" to="/tournaments" className={active === 'tournaments' ? 'active' : undefined} aria-current={active === 'tournaments' ? 'page' : undefined}>
            Tournaments
          </Link>
          {toolsUnavailable ? (
            <span aria-current={toolsActive ? 'page' : undefined} aria-disabled="true" className={toolsActive ? 'disabled active' : 'disabled'} title="Tools are unavailable during live online tournament play">
              Tools
            </span>
          ) : (
            <Link data-analytics-control="nav-tools" to="/tools" className={toolsActive ? 'active' : undefined} aria-current={toolsActive ? 'page' : undefined}>
              Tools
            </Link>
          )}
          <Link data-analytics-control="nav-profile" to="/profile" className={active === 'profile' ? 'active' : undefined} aria-current={active === 'profile' ? 'page' : undefined}>
            Profile
          </Link>
        </nav>

        <div className="auth-nav">
          {profilePreview ? (
            <Link to="/profile" className="profile-link" title={profilePreview.displayName}>
              {avatarUrl ? <img src={avatarUrl} alt="" /> : profilePreview.initials}
            </Link>
          ) : user ? (
            <>
              <Link to="/profile" className="profile-link" title={displayName}>
                {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
              </Link>
              <button type="button" className="sign-out-link" onClick={() => void signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <Link data-analytics-control="nav-sign-in" to={withApplicationReturn('/sign-in', signInReturn)} className="sign-in-link" aria-disabled={loading}>
              {loading ? 'Checking...' : 'Sign in'}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

export default SiteHeader
