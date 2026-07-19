import { externalRatingText, hasExternalRating } from './externalRating.ts'

export type CopyablePlayerDetails = {
  id: string
  name: string
  universityId: string
  email: string
  phone: string
  role?: string
  status?: string
  chessComUsername?: string
  lichessUsername?: string
  rating: number
  ratingSource?: string
  ratingUpdatedAt?: string
}

export type PlayerDetailField = {
  label: string
  value: string
}

export function playerDetailFields(player: CopyablePlayerDetails): PlayerDetailField[] {
  const fields: PlayerDetailField[] = [
    { label: 'Profile ID', value: player.id },
    { label: 'Name', value: player.name },
    { label: 'University ID', value: player.universityId || 'Not set' },
    { label: 'Email', value: player.email || 'Not set' },
    { label: 'Phone number', value: player.phone || 'Not set' },
    { label: 'Account status', value: player.status || 'active' },
    { label: 'Club role', value: player.role || 'member' },
  ]

  if (player.chessComUsername) fields.push({ label: 'Chess.com username', value: player.chessComUsername })
  if (player.lichessUsername) fields.push({ label: 'Lichess username', value: player.lichessUsername })
  if (hasExternalRating(player.rating, player.ratingSource)) {
    fields.push({ label: 'External rating', value: externalRatingText(player.rating, player.ratingSource) })
    if (player.ratingUpdatedAt) fields.push({ label: 'Rating checked', value: player.ratingUpdatedAt })
  }

  return fields
}

export function playerDetailsText(player: CopyablePlayerDetails) {
  return playerDetailFields(player).map((field) => `${field.label}: ${field.value}`).join('\n')
}
