import { ArrowLeft, Mail, Scale, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import './LegalPage.css'

type LegalPageProps = {
  kind: 'privacy' | 'terms'
}

const contactEmail = 'Juchess180@gmail.com'

export default function LegalPage({ kind }: LegalPageProps) {
  const privacy = kind === 'privacy'

  return (
    <div className="club-screen legal-screen" data-screen-label={privacy ? 'Privacy policy' : 'Terms of use'}>
      <SiteHeader />
      <main className="legal-main">
        <header className="legal-hero">
          <span className="legal-icon" aria-hidden="true">
            {privacy ? <ShieldCheck /> : <Scale />}
          </span>
          <p>JuChess member information</p>
          <h1>{privacy ? 'Privacy policy' : 'Terms of use'}</h1>
          <span>Last updated July 16, 2026</span>
        </header>

        <article className="legal-article">
          {privacy ? <PrivacyContent /> : <TermsContent />}
        </article>

        <aside className="legal-contact" aria-label="Policy contact">
          <Mail aria-hidden="true" />
          <div>
            <strong>Questions about your information?</strong>
            <span>Contact the JuChess team at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</span>
          </div>
        </aside>

        <nav className="legal-navigation" aria-label="Legal page navigation">
          <Link to="/home"><ArrowLeft size={16} aria-hidden="true" /> Back to JuChess</Link>
          <Link to={privacy ? '/terms' : '/privacy'}>{privacy ? 'Read the terms of use' : 'Read the privacy policy'}</Link>
        </nav>
      </main>
    </div>
  )
}

function PrivacyContent() {
  return (
    <>
      <section>
        <h2>1. What JuChess collects</h2>
        <p>When you create or complete an account, JuChess may collect your name, email address, phone number, university, university ID, chess-platform usernames, rating, profile picture, and cover picture.</p>
        <p>Tournament participation can also create registration, attendance, pairing, game, result, chat, and fair-play records connected to your profile.</p>
      </section>

      <section>
        <h2>2. How the information is used</h2>
        <p>We use this information to verify club membership, operate tournaments, contact registered players, display appropriate public profile information, maintain ratings and results, review recruitment applications, and protect fair play.</p>
        <p>Your university ID and phone number are intended for club administration and are not displayed on the public website.</p>
      </section>

      <section>
        <h2>3. Online games and fair play</h2>
        <p>During an online tournament game, JuChess may record game moves, clock activity, connection state, focus changes, and other tournament-integrity signals. These signals support organizer review; they are not treated as automatic proof of cheating by themselves.</p>
      </section>

      <section>
        <h2>4. Services used by the platform</h2>
        <p>JuChess uses service providers to operate account authentication, data storage, email, and live tournament features. If you connect or import games from services such as Google, Chess.com, or Lichess, those services also apply their own privacy terms.</p>
      </section>

      <section>
        <h2>5. Visibility and sharing</h2>
        <p>Public club pages may show your display name, profile image, rating, tournament record, standings, and published games. Private contact and verification details are restricted to authorized club administrators.</p>
      </section>

      <section>
        <h2>6. Retention and your choices</h2>
        <p>JuChess keeps information while it is needed to operate the club, preserve tournament records, meet administrative requirements, or resolve fair-play and safety concerns. You may ask to correct or delete account information by contacting the club. Some completed tournament records may be retained as part of the event history.</p>
      </section>

      <section>
        <h2>7. Changes to this policy</h2>
        <p>We may update this policy when club processes or platform features change. The latest version and update date will remain available on this page.</p>
      </section>
    </>
  )
}

function TermsContent() {
  return (
    <>
      <section>
        <h2>1. Your account</h2>
        <p>Provide accurate information, keep your sign-in credentials private, and use only the account that belongs to you. Contact the club if you believe your account has been accessed without permission.</p>
      </section>

      <section>
        <h2>2. Club and tournament conduct</h2>
        <p>Follow organizer instructions, attendance requirements, tournament rules, and respectful community standards. Harassment, impersonation, abusive messaging, or deliberate disruption may lead to removal from an event or restriction of an account.</p>
      </section>

      <section>
        <h2>3. Fair play</h2>
        <p>Do not use engines, analysis tools, outside assistance, another person, or unauthorized materials during a rated or restricted tournament game. Organizers may review game and activity signals, request an explanation, adjust results, or disqualify a player when tournament rules are violated.</p>
      </section>

      <section>
        <h2>4. Profile content and messages</h2>
        <p>Only upload profile images, links, and content that you have the right to use. Tournament chat must stay respectful and relevant. JuChess may remove content that is unsafe, misleading, unlawful, or inconsistent with club standards.</p>
      </section>

      <section>
        <h2>5. Service availability</h2>
        <p>The platform may occasionally be unavailable because of maintenance, network failures, third-party services, or tournament administration. Organizers may correct technical errors, restore clocks or positions, reschedule games, or make a final event ruling when necessary.</p>
      </section>

      <section>
        <h2>6. Account and event actions</h2>
        <p>JuChess administrators may restrict features, reject registrations, remove participants, or suspend accounts to protect members, tournament integrity, or the platform. Significant decisions should be based on the available evidence and club rules.</p>
      </section>

      <section>
        <h2>7. Changes to these terms</h2>
        <p>These terms may be updated as JuChess introduces new features or tournament formats. Continued use after an update means that the current terms apply to future activity.</p>
      </section>
    </>
  )
}

