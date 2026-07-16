import type { Announcement, Tournament } from './juchess'

const fixtureTournamentNames = new Set(['test', 'test tournament', 'tt'])

export function isPublicAnnouncement(announcement: Announcement) {
  const title = announcement.title.trim().toLowerCase()
  const body = announcement.body.trim().toLowerCase()

  return !announcement.id.startsWith('seed_')
    && !title.includes('seeded club data')
    && !body.includes('seed script')
}

export function isPublicTournament(tournament: Tournament) {
  const name = tournament.name.trim().toLowerCase()
  return !tournament.id.startsWith('seed_') && !fixtureTournamentNames.has(name)
}
