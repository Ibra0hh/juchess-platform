import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { execSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const env = { ...process.env, GITHUB_PAGES: 'true' }

function run(command, envOverrides = {}) {
  execSync(command, {
    env: { ...env, ...envOverrides },
    stdio: 'inherit',
  })
}

const publicRootFiles = ['manifest.webmanifest', 'robots.txt', 'sitemap.xml']
const staticRoutes = [
  ['home', 'JuChess | University of Jordan Chess Club', 'The University of Jordan Chess Club: campus tournaments, weekly chess activities, live boards, and tools to help every player improve.'],
  ['tournaments', 'Tournaments | JuChess', 'Discover upcoming, active, and completed University of Jordan Chess Club tournaments.'],
  ['tools', 'Chess Tools & Game Review | JuChess', 'Review chess games, import matches, analyze positions, and customize your JuChess board.'],
  ['games', 'Online Tournament Games | JuChess', 'Play assigned JuChess tournament games and watch live boards from active online events.', false],
  ['leaderboard', 'Club Leaderboard | JuChess', 'View active University of Jordan Chess Club player ratings and standings.', false],
  ['join-the-team', 'Join the JuChess Team', 'Apply to contribute your design, software, media, events, or management skills to the JuChess student team.'],
  ['privacy', 'Privacy Policy | JuChess', 'Learn what information JuChess collects, how it is used, and how club members can manage their data.'],
  ['terms', 'Terms of Use | JuChess', 'Read the account, tournament, fair-play, and community rules for using JuChess.'],
  ['sign-in', 'Sign In | JuChess', 'Sign in to your JuChess player club account.', false],
  ['sign-up', 'Create an Account | JuChess', 'Create your JuChess player club account.', false],
  ['profile', 'Your Profile | JuChess', 'Manage your JuChess player profile and connected tournament games.', false],
  ['forgot-password', 'Reset Password | JuChess', 'Reset the password for your JuChess account.', false],
  ['verify-email', 'Verify Email | JuChess', 'Verify the email address connected to your JuChess account.', false],
  ['auth/callback', 'Completing Sign In | JuChess', 'Complete your secure JuChess sign-in.', false],
  ['complete-profile', 'Complete Your Profile | JuChess', 'Complete the required details for your JuChess player profile.', false],
  ['attendance-confirm', 'Confirm Tournament Attendance | JuChess', 'Confirm your attendance for a JuChess tournament.', false],
]

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function renderRouteDocument(template, route, title, description, index = true) {
  const canonical = `https://juchess.page/${route}/`
  const escapedTitle = escapeHtml(title)
  const escapedDescription = escapeHtml(description)
  return template
    .replace(/<title>.*?<\/title>/, `<title>${escapedTitle}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(" \/>)/, `$1${escapedDescription}$2`)
    .replace(/(<meta name="robots" content=")[^"]*(" \/>)/, `$1${index ? 'index, follow' : 'noindex, nofollow'}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(" \/>)/, `$1${canonical}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(" \/>)/, `$1${escapedTitle}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(" \/>)/, `$1${escapedDescription}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(" \/>)/, `$1${canonical}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(" \/>)/, `$1${escapedTitle}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(" \/>)/, `$1${escapedDescription}$2`)
}

function writeStaticRoutes() {
  const template = readFileSync('docs/index.html', 'utf8')
  for (const [route, title, description, index = true] of staticRoutes) {
    const directory = join('docs', route)
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'index.html'), renderRouteDocument(template, route, title, description, index))
  }
}

// GitHub Pages clients can retain an older HTML document briefly. Preserve
// hashed JavaScript and CSS bundles across deployments so those cached
// documents do not fail while loading a route chunk or its styles after a
// newer build is published.
const assetDirs = ['docs/web/assets', 'docs/admin/assets']
const retainedAssetsRoot = mkdtempSync(join(tmpdir(), 'juchess-pages-assets-'))

for (const [index, assetDir] of assetDirs.entries()) {
  const retainedDir = join(retainedAssetsRoot, String(index))
  mkdirSync(retainedDir)
  if (!existsSync(assetDir)) continue
  for (const name of readdirSync(assetDir)) {
    if (name.endsWith('.js') || name.endsWith('.css')) {
      copyFileSync(join(assetDir, name), join(retainedDir, name))
    }
  }
}

try {
  // Keep the old /web URLs working, then add the custom-domain root build
  // without clearing the legacy bundle or the admin application.
  run('npm run build:web', { JUCHESS_PAGES_TARGET: 'web' })
  run('npm run build:web', {
    JUCHESS_PAGES_TARGET: 'root',
    VITE_ROUTER_BASE: '/',
  })
  cpSync('.pages-root/assets', 'docs/web/assets', { force: true, recursive: true })
  copyFileSync('.pages-root/index.html', 'docs/index.html')
  for (const fileName of publicRootFiles) {
    copyFileSync(join('apps/web/public', fileName), join('docs', fileName))
  }
  cpSync('apps/web/public/palette', 'docs/palette', { force: true, recursive: true })
  writeStaticRoutes()
  mkdirSync('docs/email', { recursive: true })
  copyFileSync('apps/web/public/email/juchess-email-logo.png', 'docs/email/juchess-email-logo.png')
  run('npm run build:admin')

  for (const [index, assetDir] of assetDirs.entries()) {
    const retainedDir = join(retainedAssetsRoot, String(index))
    for (const name of readdirSync(retainedDir)) {
      const destination = join(assetDir, name)
      if (!existsSync(destination)) {
        copyFileSync(join(retainedDir, name), destination)
      }
    }
  }

  copyFileSync('docs/index.html', 'docs/404.html')
  copyFileSync('docs/web/index.html', 'docs/web/404.html')
  copyFileSync('docs/admin/index.html', 'docs/admin/404.html')
} finally {
  rmSync('.pages-root', { force: true, recursive: true })
  rmSync(retainedAssetsRoot, { force: true, recursive: true })
}
