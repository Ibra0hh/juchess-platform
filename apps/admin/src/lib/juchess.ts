export type TournamentStatus = 'draft' | 'upcoming' | 'active' | 'completed' | 'archived'

export const tableIds = {
  adminProfiles: 'admin_profiles',
  profiles: 'profiles',
  tournaments: 'tournaments',
  registrations: 'registrations',
  games: 'games',
  standings: 'standings',
  announcements: 'announcements',
  crewApplications: 'crew_applications',
  crewApplicationReviews: 'crew_application_reviews',
  adminAudit: 'admin_audit',
  identityBlocks: 'identity_blocks',
  ipBlocks: 'ip_blocks',
} as const

export const adminQueues = {
  pendingMembers: 4,
  pendingRegistrations: 7,
  pairingsToPublish: 2,
}
