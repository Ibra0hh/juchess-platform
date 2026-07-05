import { Link } from 'react-router-dom'
import './SiteHeader.css'

type SiteHeaderProps = {
  active: 'home' | 'tournaments' | 'games' | 'leaderboard' | 'profile'
}

const crestUrl = `${import.meta.env.BASE_URL}prototype/assets/crest.png`

function SiteHeader({ active }: SiteHeaderProps) {
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
            Home
          </Link>
          <Link to="/tournaments" className={active === 'tournaments' ? 'active' : undefined}>
            Tournaments
          </Link>
          <Link to="/games" className={active === 'games' ? 'active' : undefined}>
            Games
          </Link>
          <Link to="/leaderboard" className={active === 'leaderboard' ? 'active' : undefined}>
            Leaderboard
          </Link>
          <Link to="/profile" className={active === 'profile' ? 'active' : undefined}>
            Profile
          </Link>
        </nav>

        <Link to="/sign-in" className="sign-in-link">
          Sign in
        </Link>
      </div>
    </header>
  )
}

export default SiteHeader
