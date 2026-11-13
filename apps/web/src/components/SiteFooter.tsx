import { Link } from 'react-router-dom'
import { lightCrestUrl } from '../lib/brand'
import './SiteFooter.css'

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <Link to="/home" className="site-footer-brand" aria-label="JuChess home">
          <img src={lightCrestUrl} alt="" />
          <span>
            <strong>JuChess</strong>
            <small>University of Jordan Chess Club</small>
          </span>
        </Link>
        <nav aria-label="Footer navigation">
          <Link data-analytics-control="footer-tournaments" to="/tournaments">Tournaments</Link>
          <Link data-analytics-control="footer-tools" to="/tools">Tools</Link>
          <Link data-analytics-control="footer-join" to="/sign-up">Join the club</Link>
          <Link data-analytics-control="footer-apply" to="/join-the-team">Join the team</Link>
        </nav>
      </div>
      <p>© 2026 JuChess / University of Jordan Chess Club / Amman</p>
    </footer>
  )
}

export default SiteFooter
