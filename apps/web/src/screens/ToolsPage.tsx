import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { demoTournaments, members, sampleGamesBySource } from '../lib/juchess'
import './ClubScreens.css'

const toolCards = [
  {
    to: '/games',
    icon: '\u2658',
    tag: 'Review',
    title: 'Game review',
    body: 'Open archived club games with move lists, accuracy, evaluation labels, and board positions.',
    action: 'Review games',
  },
  {
    to: '/games?mode=analysis',
    icon: '\u2657',
    tag: 'Board',
    title: 'Analysis board',
    body: 'Use the existing board workspace as the base for position study and post-game review.',
    action: 'Open board',
  },
  {
    to: '/tournaments',
    icon: '\u2659',
    tag: 'Events',
    title: 'Tournament finder',
    body: 'Browse active, upcoming, and completed tournament pages from the shared club data.',
    action: 'Browse events',
  },
  {
    to: '/tournament/spring-open',
    icon: '\u2656',
    tag: 'Live',
    title: 'Live boards',
    body: 'Jump into the Spring Open detail page with standings, pairings, games, and round data.',
    action: 'Open live event',
  },
  {
    to: '/leaderboard',
    icon: '\u2655',
    tag: 'Ladder',
    title: 'Club leaderboard',
    body: 'Check the podium, full ladder, ratings, and rating trend summaries.',
    action: 'View ladder',
  },
  {
    to: '/profile',
    icon: '\u2654',
    tag: 'Player',
    title: 'Player profile',
    body: 'Open the sample player record with recent games, rating context, and club activity.',
    action: 'Open profile',
  },
] as const

function ToolsPage() {
  const totalGames = Object.values(sampleGamesBySource).reduce((sum, games) => sum + games.length, 0)

  return (
    <div className="club-screen tools-screen" data-screen-label="Tools">
      <SiteHeader active="tools" />
      <main className="tools-main">
        <section className="tools-hero" aria-labelledby="tools-title">
          <div>
            <h1 id="tools-title">Chess tools</h1>
            <p>
              A focused launch pad for review, analysis, live tournament boards, rankings, and player records across
              the Chess Club JU prototype.
            </p>
            <div className="tools-summary" aria-label="Club tool summary">
              <SummaryBox label="Review games" value={totalGames} />
              <SummaryBox label="Tournament pages" value={demoTournaments.length} />
              <SummaryBox label="Rated players" value={members.length} />
            </div>
          </div>
          <img src={`${import.meta.env.BASE_URL}prototype/assets/crest.png`} alt="Chess Club JU logo" />
        </section>

        <section aria-labelledby="quick-tools-title">
          <div className="tools-section-head">
            <h2 id="quick-tools-title">Quick tools</h2>
            <Link to="/games">Open games workspace &rarr;</Link>
          </div>
          <div className="tools-grid">
            {toolCards.map((card) => (
              <Link to={card.to} className="tool-card" key={card.title}>
                <div>
                  <div className="tool-top">
                    <span className="tool-icon" aria-hidden="true">
                      {card.icon}
                    </span>
                    <span className="tool-tag">{card.tag}</span>
                  </div>
                  <strong>{card.title}</strong>
                  <p>{card.body}</p>
                </div>
                <em>{card.action} &rarr;</em>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

function SummaryBox({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

export default ToolsPage
