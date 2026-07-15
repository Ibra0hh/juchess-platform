import { Link } from 'react-router-dom'
import { ChartNoAxesColumnIncreasing, Gamepad2, Home, Trophy, UserRound, Wrench } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { profileMediaUrl } from '../lib/auth'
import { useOnlineTournamentPlayLock } from '../lib/onlineTournamentPlayLock'
import './SiteHeader.css'

type SiteHeaderProps = {
  active: 'home' | 'tournaments' | 'tools' | 'games' | 'leaderboard' | 'profile'
  profilePreview?: {
    displayName: string
    initials: string
    avatarUrl?: string
  }
  toolsDisabled?: boolean
}

const crestUrl = `${import.meta.env.BASE_URL}prototype/assets/crest.png`

function SiteHeader({ active, profilePreview, toolsDisabled = false }: SiteHeaderProps) {
  const { loading, profile, signOut, user } = useAuth()
  const playLock = useOnlineTournamentPlayLock()
  const toolsUnavailable = toolsDisabled || Boolean(playLock)
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
          <img src={crestUrl} alt="Chess Club JU crest" />
          <span>
            <strong>JuChess</strong>
            <small>University of Jordan Chess Club</small>
          </span>
        </Link>

        <nav className="main-nav" aria-label="Primary navigation">
          <Link to="/home" className={active === 'home' ? 'active' : undefined}>
            <Home className="nav-icon" aria-hidden="true" />
            <span>Home</span>
          </Link>
          <Link to="/tournaments" className={active === 'tournaments' ? 'active' : undefined}>
            <Trophy className="nav-icon" aria-hidden="true" />
            <span>Tournaments</span>
          </Link>
          {toolsUnavailable ? (
            <span aria-disabled="true" className="disabled" title="Tools are unavailable during live online tournament play">
              <Wrench className="nav-icon" aria-hidden="true" />
              <span>Tools</span>
            </span>
          ) : (
            <Link to="/tools" className={active === 'tools' ? 'active' : undefined}>
              <Wrench className="nav-icon" aria-hidden="true" />
              <span>Tools</span>
            </Link>
          )}
          <Link to="/games" className={active === 'games' ? 'active' : undefined}>
            <Gamepad2 className="nav-icon" aria-hidden="true" />
            <span>Games</span>
          </Link>
          <Link to="/leaderboard" className={active === 'leaderboard' ? 'active' : undefined}>
            <ChartNoAxesColumnIncreasing className="nav-icon" aria-hidden="true" />
            <span>Leaderboard</span>
          </Link>
          <Link to="/profile" className={active === 'profile' ? 'active' : undefined}>
            <UserRound className="nav-icon" aria-hidden="true" />
            <span>Profile</span>
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
            <Link to="/sign-in" className="sign-in-link" aria-disabled={loading}>
              {loading ? 'Checking...' : 'Sign in'}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

export default SiteHeader
