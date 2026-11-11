import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'
import teamMembers from '../lib/clubTeam.json'
import './TeamProfilePage.css'

export default function TeamProfilePage() {
  const { slug } = useParams()
  const member = teamMembers.find((item) => item.slug === slug)

  return (
    <>
      <SiteHeader />
      <main className="team-profile">
        <Link className="team-profile-back" to="/home"><ArrowLeft size={16} /> Back to JuChess</Link>
        {member ? (
          <div className="team-profile-layout">
            <img src={`${import.meta.env.BASE_URL}team/${member.photo}`} alt={member.name} />
            <div>
              <h1>{member.name}</h1>
              <p>{member.role}</p>
              {member.responsibility ? <p>{member.responsibility}</p> : null}
              <p className="team-profile-club">University of Jordan Chess Club</p>
            </div>
          </div>
        ) : <h1>Team profile not found</h1>}
      </main>
      <SiteFooter />
    </>
  )
}
