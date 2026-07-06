import SiteHeader from '../components/SiteHeader'
import { members } from '../lib/juchess'
import './ClubScreens.css'

const trends = ['+24', '+18', '-6', '+11', '+9', '-14', '+7', '+3', '-8', '+5', '-2', '+1']

const podiumOrder = [
  { memberIndex: 1, placeLabel: '2nd place', piece: '\u265c', tone: 'light' },
  { memberIndex: 0, placeLabel: 'Club champion', piece: '\u265a', tone: 'champion' },
  { memberIndex: 2, placeLabel: '3rd place', piece: '\u265e', tone: 'bronze' },
] as const

function LeaderboardPage() {
  return (
    <div className="club-screen" data-screen-label="Leaderboard">
      <SiteHeader active="leaderboard" />
      <main className="leaderboard-main">
        <section className="club-title-block">
          <h1>Club Leaderboard</h1>
          <p>Season 2025-26 club ratings - updated after every rated round</p>
        </section>

        <section className="podium-grid" aria-label="Top ranked players">
          {podiumOrder.map((podium) => {
            const member = members[podium.memberIndex]

            return (
              <article className={`podium-card ${podium.tone}`} key={member.id}>
                <div className="podium-piece" aria-hidden="true">
                  {podium.piece}
                </div>
                <h2>{member.name}</h2>
                <p>{member.universityId}</p>
                <strong>{member.rating}</strong>
                <span>{podium.placeLabel}</span>
              </article>
            )
          })}
        </section>

        <section className="leaderboard-table-wrap" aria-label="Full club leaderboard">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Username</th>
                <th>Rating</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member, index) => {
                const trend = trends[index] || '-'
                const isPositive = trend.startsWith('+')

                return (
                  <tr className={index === 0 ? 'leader-row' : undefined} key={member.id}>
                    <td>{index + 1}</td>
                    <td>{member.name}</td>
                    <td>{member.universityId}</td>
                    <td>{member.rating}</td>
                    <td className={isPositive ? 'positive' : 'negative'}>{trend}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  )
}

export default LeaderboardPage
