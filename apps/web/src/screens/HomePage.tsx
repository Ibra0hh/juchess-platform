import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowRight, CalendarDays, MapPin, Trophy, Users, Wifi } from 'lucide-react'
import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { loadAnnouncements, loadTournaments, type Announcement, type Tournament } from '../lib/juchess'
import './HomePage.css'

const crestUrl = `${import.meta.env.BASE_URL}prototype/assets/crest.png`

const fallers = [
  { glyph: '♟', left: 12, size: 28, duration: 12.5, delay: -4.2, opacity: 0.1 },
  { glyph: '♞', left: 21, size: 42, duration: 17.3, delay: -13.4, opacity: 0.12 },
  { glyph: '♝', left: 32, size: 24, duration: 10.8, delay: -1.8, opacity: 0.08 },
  { glyph: '♜', left: 43, size: 38, duration: 18.5, delay: -8.4, opacity: 0.1 },
  { glyph: '♛', left: 56, size: 52, duration: 20.2, delay: -15.1, opacity: 0.09 },
  { glyph: '♚', left: 68, size: 34, duration: 14.8, delay: -6.5, opacity: 0.13 },
  { glyph: '♟', left: 78, size: 26, duration: 11.7, delay: -2.6, opacity: 0.08 },
  { glyph: '♞', left: 91, size: 48, duration: 19.6, delay: -11.2, opacity: 0.1 },
]

const visionCards = [
  {
    number: '01',
    title: 'Spread the game',
    body: 'Bring chess to more University of Jordan students - open meetups, beginner-friendly nights, and a club anyone can walk into, whatever their rating.',
  },
  {
    number: '02',
    title: 'Play in person',
    body: 'Run real over-the-board tournaments on campus - the handshake, the clock, the tension across the table that online play can never replace.',
  },
  {
    number: '03',
    title: 'Sharpen skills',
    body: 'Help every member improve - weekly training, game reviews, and friendly competition that turns casual players into confident competitors.',
  },
]

const teamMembers = [
  { initials: 'IA', name: 'Ibrahim Ahmad', role: 'Chair', note: 'Leads the club and its tournament program.', tone: 'black' },
  { initials: 'LH', name: 'Leen Haddad', role: 'Vice Chair', note: 'Runs sessions and player relations.', tone: 'cream' },
  { initials: 'YK', name: 'Yazan Khaled', role: 'Software Developer', note: 'Builds and maintains the JuChess platform.', tone: 'black' },
  { initials: 'SN', name: 'Sara Nasser', role: 'Designer', note: 'Shapes the club visual identity.', tone: 'cream' },
  { initials: 'OS', name: 'Omar Saleh', role: 'Event Manager', note: 'Plans and stages every tournament.', tone: 'black' },
  { initials: 'MK', name: 'Mohammad Al-Khatib', role: 'Media & Outreach', note: 'Grows the club across campus and online.', tone: 'cream' },
]

type HomeNewsItem = {
  id: string
  title: string
  body: string
  date: string
  to?: string
}

type FeatureSlot = {
  key: Tournament['status']
  label: string
  emptyTitle: string
  emptyBody: string
  tournament: Tournament | null
}

function HomePage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [newsLoading, setNewsLoading] = useState(true)
  const [cloudError, setCloudError] = useState(false)

  useEffect(() => {
    let alive = true

    Promise.all([loadTournaments(), loadAnnouncements()]).then(([tournamentResult, announcementResult]) => {
      if (!alive) return
      setTournaments(tournamentResult.tournaments)
      setAnnouncements(announcementResult.announcements)
      setCloudError(Boolean(tournamentResult.error))
      setLoading(false)
      setNewsLoading(false)
    })

    return () => {
      alive = false
    }
  }, [])

  const featureSlots = useMemo(() => buildFeatureSlots(tournaments), [tournaments])

  const newsItems = useMemo<HomeNewsItem[]>(() => {
    const publishedNews = announcements.slice(0, 3).map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      date: item.date,
    }))

    const tournamentNews = tournaments.slice(0, 3).map((item) => ({
      id: item.id,
      title: `${item.name} is ${item.status.toLowerCase()}`,
      body: `${item.format} / ${item.timeControl} / ${playerLabel(item)}.`,
      date: item.date,
      to: `/tournament/${item.id}`,
    }))

    return [...publishedNews, ...tournamentNews].slice(0, 3)
  }, [announcements, tournaments])

  return (
    <div className="home-screen" data-screen-label="Home">
      <SiteHeader active="home" />
      <main>
        <section className="home-hero" id="hero" aria-labelledby="home-title">
          <div className="home-grid-wash" aria-hidden="true" />
          <div className="home-glow" aria-hidden="true" />
          <div className="home-fall-layer" aria-hidden="true">
            {fallers.map((item, index) => (
              <span
                key={`${item.glyph}-${index}`}
                style={{
                  '--fall-left': `${item.left}%`,
                  '--fall-size': `${item.size}px`,
                  '--fall-duration': `${item.duration}s`,
                  '--fall-delay': `${item.delay}s`,
                  '--fall-opacity': item.opacity,
                } as CSSProperties}
              >
                {item.glyph}
              </span>
            ))}
          </div>

          <div className="home-hero-grid">
            <div className="hero-copy">
              <div className="hero-kicker">
                <span />
                <strong>Est. University of Jordan / Amman</strong>
              </div>
              <div className="hero-title-row">
                <img src={crestUrl} alt="Chess Club JU crest" />
                <h1 id="home-title">
                  <span>Ju</span>
                  <span>Chess</span>
                </h1>
              </div>
              <p className="hero-tagline">The University of Jordan Chess Club.</p>
              <p className="hero-description">
                A student-run club bringing chess to campus life - we organise in-person tournaments for University of
                Jordan students, run weekly meetups, and help every player sharpen their game across the board.
              </p>
              <div className="hero-actions">
                <Link to="/sign-up" className="primary-action">
                  <span aria-hidden="true">♞</span>
                  Join the Club
                </Link>
                <a href="#vision" className="secondary-action">Our Vision <span aria-hidden="true">↓</span></a>
              </div>
            </div>

            <FeaturedTournamentCarousel slots={featureSlots} loading={loading} cloudError={cloudError} />
          </div>

          <a href="#news" className="home-scroll-hint" aria-label="Scroll to news">↓</a>
        </section>

        <MarqueeStrip />
        <NewsSection items={newsItems} loading={newsLoading} />
        <VisionSection />
        <TeamSection />
        <AppSection />
      </main>
      <HomeFooter />
    </div>
  )
}

function FeaturedTournamentCarousel({
  cloudError,
  loading,
  slots,
}: {
  cloudError: boolean
  loading: boolean
  slots: FeatureSlot[]
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)

  if (loading) {
    return (
      <div className="home-feature-carousel">
        <div className="home-feature-card skeleton" aria-label="Loading featured tournaments" />
      </div>
    )
  }

  const scrollTo = (index: number) => {
    const track = trackRef.current
    if (!track) return
    track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' })
    setActiveIndex(index)
  }

  const updateActiveSlide = () => {
    const track = trackRef.current
    if (!track) return
    const index = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1))
    setActiveIndex(Math.min(Math.max(index, 0), slots.length - 1))
  }

  return (
    <div className="home-feature-carousel">
      <div
        ref={trackRef}
        className="home-feature-track"
        onScroll={updateActiveSlide}
        aria-label="Featured tournament carousel"
      >
        {slots.map((slot) => (
          <div className="home-feature-slide" key={slot.key}>
            <FeaturedTournamentCard slot={slot} cloudError={cloudError} />
          </div>
        ))}
      </div>
      <div className="home-feature-dots" aria-label="Featured tournament slides">
        {slots.map((slot, index) => (
          <button
            key={slot.key}
            type="button"
            className={activeIndex === index ? 'active' : undefined}
            aria-label={`Show ${slot.label.toLowerCase()} tournament`}
            aria-current={activeIndex === index ? 'true' : undefined}
            onClick={() => scrollTo(index)}
          />
        ))}
      </div>
    </div>
  )
}

function FeaturedTournamentCard({ slot, cloudError }: { slot: FeatureSlot; cloudError: boolean }) {
  const tournament = slot.tournament

  if (!tournament) {
    return (
      <div className="home-feature-card empty-feature">
        <div className="feature-eyebrow">
          <span>{cloudError ? 'Cloud unavailable' : 'Not published yet'}</span>
          <strong>{slot.label} tournament</strong>
        </div>
        <h2>{cloudError ? 'Tournaments will return shortly' : slot.emptyTitle}</h2>
        <p>{cloudError ? 'The club cloud could not be reached.' : slot.emptyBody}</p>
      </div>
    )
  }

  return (
    <Link to={`/tournament/${tournament.id}`} className="home-feature-card">
      <div className="feature-eyebrow">
        <span className={tournament.status === 'Active' ? 'live' : undefined}>
          {tournament.status === 'Active' ? `Live - ${tournament.round}` : tournament.status}
        </span>
        <strong>{slot.label} tournament</strong>
      </div>
      <h2>{tournament.name}</h2>
      <p>{tournament.format} / {tournament.timeControl}</p>
      <div className="feature-pills">
        <span><CalendarDays size={14} aria-hidden="true" />{tournament.date}</span>
        {tournament.playMode === 'online' ? (
          <span><Wifi size={14} aria-hidden="true" />Online · {tournament.location}</span>
        ) : (
          <span><MapPin size={14} aria-hidden="true" />{tournament.location}</span>
        )}
        <span><Users size={14} aria-hidden="true" />{playerLabel(tournament)}</span>
      </div>
      <div className="feature-footer">
        <span>
          <small>Leading</small>
          <strong>{featureLeader(tournament)}</strong>
        </span>
        <span className="feature-cta">
          {tournament.status === 'Active' ? 'Watch live' : 'View tournament'}
          <ArrowRight size={16} aria-hidden="true" />
        </span>
      </div>
    </Link>
  )
}

function buildFeatureSlots(tournaments: Tournament[]): FeatureSlot[] {
  return [
    {
      key: 'Upcoming',
      label: 'Upcoming',
      emptyTitle: 'No upcoming tournament',
      emptyBody: 'Upcoming events will appear here after they are published.',
      tournament: tournaments.find((item) => item.status === 'Upcoming') ?? null,
    },
    {
      key: 'Active',
      label: 'Live',
      emptyTitle: 'No live tournament',
      emptyBody: 'Active tournaments will appear here when games begin.',
      tournament: tournaments.find((item) => item.status === 'Active') ?? null,
    },
    {
      key: 'Completed',
      label: 'Completed',
      emptyTitle: 'No completed tournament',
      emptyBody: 'Finished tournaments will appear here with results.',
      tournament: tournaments.find((item) => item.status === 'Completed') ?? null,
    },
  ]
}

function MarqueeStrip() {
  return (
    <div className="home-marquee" aria-label="Club formats">
      {[
        ['♔', 'Swiss Opens'],
        ['♞', 'Single elimination'],
        ['♛', 'Team Matches'],
        ['♜', 'Arenas & Leagues'],
        ['♝', 'Game Review'],
      ].map(([icon, label]) => (
        <span key={label}>
          <b aria-hidden="true">{icon}</b>
          {label}
        </span>
      ))}
    </div>
  )
}

function NewsSection({ items, loading }: { items: HomeNewsItem[]; loading: boolean }) {
  return (
    <section className="home-news" id="news" aria-labelledby="home-news-title">
      <div className="home-section-heading">
        <span>Club news</span>
        <h2 id="home-news-title">Latest from JuChess</h2>
        <p>Published announcements and tournament updates from the same backend used by the app.</p>
      </div>
      <div className="news-grid">
        {loading ? (
          [0, 1, 2].map((item) => <div className="news-card skeleton" key={item} />)
        ) : items.length ? (
          items.map((item) => <NewsCard item={item} key={item.id} />)
        ) : (
          <div className="home-empty">No news published yet.</div>
        )}
      </div>
    </section>
  )
}

function NewsCard({ item }: { item: HomeNewsItem }) {
  const content = (
    <>
      <div className="news-icon"><Trophy size={18} aria-hidden="true" /></div>
      <span>
        <small>{item.date}</small>
        <strong>{item.title}</strong>
        <em>{item.body}</em>
      </span>
    </>
  )

  if (item.to) {
    return <Link to={item.to} className="news-card">{content}</Link>
  }

  return <article className="news-card">{content}</article>
}

function VisionSection() {
  return (
    <section className="home-vision" id="vision" aria-labelledby="vision-title">
      <div className="vision-grid" aria-hidden="true" />
      <div className="vision-glow" aria-hidden="true" />
      <div className="home-section-heading light">
        <span>Our Vision</span>
        <h2 id="vision-title">To make chess part of <em>university life.</em></h2>
        <p>
          We believe every student should have a board to sit at and a community to play with. Our mission is simple -
          grow the game on campus, and help everyone who plays it get better.
        </p>
      </div>
      <div className="vision-card-grid">
        {visionCards.map((card) => (
          <article className="vision-card" key={card.number}>
            <strong>{card.number}</strong>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function TeamSection() {
  return (
    <section className="home-team" id="team" aria-labelledby="team-title">
      <div className="home-section-heading">
        <span>The people behind the board</span>
        <h2 id="team-title">Meet the club team</h2>
        <p>Students who run the tournaments, build the tools, and keep the club moving - every semester, entirely on their own time.</p>
      </div>
      <div className="team-grid">
        {teamMembers.map((member) => (
          <article className="team-card" key={member.name}>
            <div className={`team-avatar ${member.tone}`}>{member.initials}</div>
            <h3>{member.name}</h3>
            <strong>{member.role}</strong>
            <p>{member.note}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function AppSection() {
  return (
    <section className="home-app" id="contact" aria-labelledby="app-title">
      <div className="home-app-panel">
        <div className="app-panel-grid" aria-hidden="true" />
        <div className="app-copy">
          <span>Get the app</span>
          <h2 id="app-title">The whole club, in your pocket.</h2>
          <p>Follow live boards, check standings, and register for tournaments from anywhere - the JuChess app is on both stores.</p>
          <div className="store-row">
            <a href="#contact" aria-label="Download JuChess on the App Store">
              <AppStoreIcon />
              <span><small>Download on the</small><strong>App Store</strong></span>
            </a>
            <a href="#contact" aria-label="Get JuChess on Google Play">
              <PlayStoreIcon />
              <span><small>Get it on</small><strong>Google Play</strong></span>
            </a>
          </div>
        </div>
        <div className="contact-list">
          <ContactRow icon="✉" label="Email" value="chessclub@ju.edu.jo" />
          <ContactRow icon="⌂" label="Find us" value="Student Union Building, JU / Amman" />
          <div className="social-row">
            {['IG', 'FB', 'X', 'WA'].map((item) => (
              <a href="#contact" aria-label={item} key={item}>{item}</a>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ContactRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="contact-row">
      <span aria-hidden="true">{icon}</span>
      <p>
        <small>{label}</small>
        <strong>{value}</strong>
      </p>
    </div>
  )
}

function HomeFooter() {
  return (
    <footer className="home-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <img src={crestUrl} alt="" />
          <span>
            <strong>JuChess</strong>
            <small>University of Jordan Chess Club</small>
          </span>
        </div>
        <nav aria-label="Footer navigation">
          <Link to="/tournaments">Tournaments</Link>
          <Link to="/tools">Tools</Link>
          <Link to="/games">Games</Link>
          <Link to="/leaderboard">Leaderboard</Link>
          <Link to="/sign-up">Join the club</Link>
        </nav>
        <div className="footer-social">
          {['IG', 'FB', 'X'].map((item) => (
            <a href="#contact" aria-label={item} key={item}>{item}</a>
          ))}
        </div>
      </div>
      <p>© 2026 JuChess / University of Jordan Chess Club / Amman</p>
    </footer>
  )
}

function AppStoreIcon() {
  return (
    <svg width="22" height="26" viewBox="0 0 170 210" fill="currentColor" aria-hidden="true">
      <path d="M150.4 71.6c-1 .8-19.7 11.3-19.7 34.7 0 27 23.7 36.6 24.4 36.8-.1.6-3.8 13-12.5 25.6-7.8 11.1-16 22.2-28.4 22.2s-15.6-7.2-29.9-7.2c-14 0-19 7.4-30.4 7.4S34.7 180.8 26 168.4C15.9 154 7.7 131.7 7.7 110.5c0-34 22.1-52 43.8-52 11.6 0 21.2 7.6 28.5 7.6 6.9 0 17.7-8.1 30.9-8.1 5 .1 23 .5 34.9 17.2l4.6-3.6zM108.7 33.2c5.7-6.7 9.7-16.1 9.7-25.5 0-1.3-.1-2.6-.3-3.7-9.2.3-20.2 6.1-26.8 13.8-5.2 5.9-10 15.3-10 24.8 0 1.4.2 2.9.3 3.3.6.1 1.5.2 2.5.2 8.3.1 18.7-5.4 24.6-12.9z" />
    </svg>
  )
}

function PlayStoreIcon() {
  return (
    <svg width="21" height="23" viewBox="0 0 512 512" aria-hidden="true">
      <path fill="#EA4335" d="M325 234 90 12c-8-8-19-13-31-12l236 234z" />
      <path fill="#34A853" d="M59 0C48 6 41 17 41 33v446c0 16 7 27 18 33l236-256z" />
      <path fill="#FBBC04" d="M325 234 89 500c9 1 19-2 30-8l178-100z" />
      <path fill="#4285F4" d="m420 202-73-41-49 73 62 62 60-34c18-14 18-46 0-60z" />
    </svg>
  )
}

function playerLabel(tournament: Tournament) {
  if (tournament.capacity && tournament.capacity > 0) {
    return `${tournament.participants}/${tournament.capacity} players`
  }

  return `${tournament.participants} players`
}

function featureLeader(tournament: Tournament) {
  const liveGame = tournament.publishedGames?.find((game) => game.status === 'live')
  const firstGame = liveGame ?? tournament.publishedGames?.[0]
  if (firstGame) return `${firstGame.white.name} vs ${firstGame.black.name}`
  return tournament.round
}

export default HomePage
