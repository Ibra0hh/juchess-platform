import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowRight, CalendarDays, MapPin, Trophy, Users, Wifi } from 'lucide-react'
import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/useAuth'
import { loadAnnouncements, loadTournamentSummaries, type Announcement, type Tournament } from '../lib/juchess'
import './HomePage.css'

const crestUrl = `${import.meta.env.BASE_URL}prototype/assets/crest.png`
const gmailGlyphUrl = `${import.meta.env.BASE_URL}prototype/assets/gmail-glyph-gradient.svg`
const instagramGlyphUrl = `${import.meta.env.BASE_URL}prototype/assets/instagram-glyph-gradient.svg`

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

const teamPhoto = (fileName: string) => `${import.meta.env.BASE_URL}team/${fileName}`

const teamMembers = [
  {
    name: 'Maya Erani',
    role: 'President',
    responsibility: 'Social Media Manager',
    image: teamPhoto('maya-erani.webp'),
  },
  {
    name: 'Ruba Al Qudah',
    role: 'Vice President',
    responsibility: 'HR Manager',
    image: teamPhoto('ruba-al-qudah.webp'),
  },
  {
    name: 'Yazan Shalan',
    role: 'Vice President',
    responsibility: 'Public Relations Manager',
    image: teamPhoto('yazan-shalan.webp'),
  },
  {
    name: 'Lameea Sakhriah',
    role: 'Design Manager',
    image: teamPhoto('lameea-sakhriah.webp'),
  },
  {
    name: 'Dalya Yousef',
    role: 'Events and PR Manager',
    image: teamPhoto('dalya-yousef.jpg'),
  },
  {
    name: 'Ibrahim Aladily',
    role: 'Software Developer',
    image: teamPhoto('ibrahim-aladily.webp'),
  },
  {
    name: 'Retal Aljubeh',
    role: 'Design Manager',
    image: teamPhoto('retal-aljubeh.jpg'),
  },
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
  const { loading: authLoading, user } = useAuth()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [newsLoading, setNewsLoading] = useState(true)
  const [cloudError, setCloudError] = useState(false)

  useEffect(() => {
    let alive = true

    Promise.all([loadTournamentSummaries(), loadAnnouncements()]).then(([tournamentResult, announcementResult]) => {
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
                {!authLoading && !user ? (
                  <Link to="/sign-in" className="primary-action">
                    <span aria-hidden="true">♞</span>
                    Join the Club
                  </Link>
                ) : null}
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
        <p>Meet the students leading JuChess, shaping its events and identity, and building the platform behind the club.</p>
      </div>
      <div className="team-grid">
        {teamMembers.map((member) => (
          <article className="team-card" key={member.name}>
            <div className="team-photo-wrap">
              <img src={member.image} alt={`${member.name}, ${member.role}`} loading="lazy" />
              <span className="team-piece" aria-hidden="true">♞</span>
            </div>
            <div className="team-card-copy">
              <strong>{member.role}</strong>
              <h4>{member.name}</h4>
              {'responsibility' in member && member.responsibility ? <p>{member.responsibility}</p> : null}
            </div>
          </article>
        ))}
      </div>
      <div className="team-join-action">
        <Link to="/join-the-team" className="team-join-link">Join the working team <ArrowRight size={16} /></Link>
      </div>
    </section>
  )
}

function AppSection() {
  return (
    <section className="home-app" id="contact" aria-labelledby="contact-title">
      <div className="home-app-panel">
        <div className="app-panel-grid" aria-hidden="true" />
        <div className="app-copy">
          <div className="contact-heading">
            <img className="contact-logo" src={crestUrl} alt="JuChess crest" />
            <div className="contact-heading-copy">
              <span>Contact the club</span>
              <h2 id="contact-title">Get in touch with us.</h2>
            </div>
          </div>
          <p>Questions about membership, tournaments, or club activities? Contact the JuChess team by email or Instagram.</p>
        </div>
        <div className="contact-side">
          <div className="contact-options" aria-label="Club contact details">
            <a href="mailto:Juchess180@gmail.com" aria-label="Email JuChess at Juchess180@gmail.com">
              <span className="contact-option-icon contact-option-icon--email">
                <img src={gmailGlyphUrl} alt="" aria-hidden="true" />
              </span>
              <span><small>Email</small><strong>Juchess180@gmail.com</strong></span>
              <ArrowRight className="contact-option-arrow" aria-hidden="true" size={17} />
            </a>
            <a
              href="https://www.instagram.com/ju.chess?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
              target="_blank"
              rel="noreferrer"
              aria-label="Open JuChess on Instagram"
            >
              <span className="contact-option-icon contact-option-icon--instagram">
                <img src={instagramGlyphUrl} alt="" aria-hidden="true" />
              </span>
              <span><small>Instagram</small><strong>@ju.chess</strong></span>
              <ArrowRight className="contact-option-arrow" aria-hidden="true" size={17} />
            </a>
          </div>
        </div>
      </div>
    </section>
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
          <Link to="/sign-up">Join the club</Link>
          <Link to="/join-the-team">Join the team</Link>
        </nav>
      </div>
      <p>© 2026 JuChess / University of Jordan Chess Club / Amman</p>
    </footer>
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
