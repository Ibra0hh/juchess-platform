import assert from 'node:assert/strict'
import test from 'node:test'
import { isPublicAnnouncement, isPublicTournament } from './publicContent.ts'

test('seed announcements are excluded from public news', () => {
  assert.equal(isPublicAnnouncement({
    body: 'This announcement was inserted through the Appwrite seed script.',
    date: 'Jul 8, 2026',
    id: 'seed_announcement_01',
    title: 'Seeded club data is live',
  }), false)

  assert.equal(isPublicAnnouncement({
    body: 'Weekly chess meetup in the Student Union.',
    date: 'Jul 18, 2026',
    id: 'weekly_meetup',
    title: 'Friday meetup',
  }), true)
})

test('obvious fixture tournaments are excluded from public listings', () => {
  const baseTournament = {
    capacity: 16,
    date: 'Jul 18, 2026',
    format: 'Swiss',
    id: 'club_open',
    location: 'University of Jordan',
    name: 'Summer Club Open',
    participants: 12,
    round: 'Round 1 of 5',
    status: 'Upcoming' as const,
    timeControl: '5+3 Blitz',
  }

  assert.equal(isPublicTournament(baseTournament), true)
  assert.equal(isPublicTournament({ ...baseTournament, id: 'fixture', name: 'tt' }), false)
  assert.equal(isPublicTournament({ ...baseTournament, id: 'seed_tournament_01' }), false)
})
