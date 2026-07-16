import { Link } from 'react-router-dom'
import './SiteFooter.css'

const crestUrl = `${import.meta.env.BASE_URL}prototype/assets/crest.png`

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <Link to="/home" className="site-footer-brand" aria-label="JuChess home">
          <img src={crestUrl} alt="" />
          <span>
            <strong>JuChess</strong>
            <small>University of Jordan Chess Club</small>
          </span>
        </Link>
        <nav aria-label="Footer navigation">
          <Link to="/tournaments">Tournaments</Link>
          <Link to="/tools">Tools</Link>
          <Link to="/sign-up">Join the club</Link>
          <Link to="/join-the-team">Join the team</Link>
        </nav>
      </div>
      <p>© 2026 JuChess / University of Jordan Chess Club / Amman</p>
    </footer>
  )
}

export default SiteFooter
