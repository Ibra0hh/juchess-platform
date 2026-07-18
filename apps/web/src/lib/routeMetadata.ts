export type PageMetadata = {
  description: string
  index?: boolean
  title: string
}

const siteUrl = 'https://juchess.page'
const defaultMetadata: PageMetadata = {
  title: 'JuChess | University of Jordan Chess Club',
  description: 'The University of Jordan Chess Club: campus tournaments, weekly chess activities, live boards, and tools to help every player improve.',
}

const routeMetadata: Record<string, PageMetadata> = {
  '/': defaultMetadata,
  '/home': defaultMetadata,
  '/tournaments': {
    title: 'Tournaments | JuChess',
    description: 'Discover upcoming, active, and completed University of Jordan Chess Club tournaments.',
  },
  '/tools': {
    title: 'Chess Tools & Game Review | JuChess',
    description: 'Review chess games, import matches, analyze positions, and customize your JuChess board.',
  },
  '/games': {
    title: 'Online Tournament Games | JuChess',
    description: 'Play assigned JuChess tournament games and watch live boards from active online events.',
    index: false,
  },
  '/leaderboard': {
    title: 'Club Leaderboard | JuChess',
    description: 'View active University of Jordan Chess Club player ratings and standings.',
    index: false,
  },
  '/join-the-team': {
    title: 'Join the JuChess Team',
    description: 'Apply to contribute your design, software, media, events, or management skills to the JuChess student team.',
  },
  '/privacy': {
    title: 'Privacy Policy | JuChess',
    description: 'Learn what information JuChess collects, how it is used, and how club members can manage their data.',
  },
  '/terms': {
    title: 'Terms of Use | JuChess',
    description: 'Read the account, tournament, fair-play, and community rules for using JuChess.',
  },
  '/sign-in': {
    title: 'Sign In | JuChess',
    description: 'Sign in to your JuChess player club account.',
    index: false,
  },
  '/sign-up': {
    title: 'Create an Account | JuChess',
    description: 'Create your JuChess player club account.',
    index: false,
  },
  '/profile': {
    title: 'Your Profile | JuChess',
    description: 'Manage your JuChess player profile and connected tournament games.',
    index: false,
  },
  '/forgot-password': {
    title: 'Reset Password | JuChess',
    description: 'Reset the password for your JuChess account.',
    index: false,
  },
  '/verify-email': {
    title: 'Verify Email | JuChess',
    description: 'Verify the email address connected to your JuChess account.',
    index: false,
  },
  '/auth/callback': {
    title: 'Completing Sign In | JuChess',
    description: 'Complete your secure JuChess sign-in.',
    index: false,
  },
  '/complete-profile': {
    title: 'Complete Your Profile | JuChess',
    description: 'Complete the required details for your JuChess player profile.',
    index: false,
  },
  '/attendance-confirm': {
    title: 'Confirm Tournament Attendance | JuChess',
    description: 'Confirm your attendance for a JuChess tournament.',
    index: false,
  },
}

export function metadataForPath(pathname: string): PageMetadata {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
  if (normalized.startsWith('/tournament/')) {
    return {
      title: 'Tournament Details | JuChess',
      description: 'View tournament details, pairings, standings, live games, and published results from JuChess.',
    }
  }
  return routeMetadata[normalized] ?? {
    title: 'Page Not Found | JuChess',
    description: 'Return to the JuChess homepage.',
    index: false,
  }
}

export function canonicalForPath(pathname: string) {
  const normalized = pathname === '/' ? '/' : `${pathname.replace(/\/$/, '')}/`
  return `${siteUrl}${normalized}`
}

