const sourceLabels: Record<string, string> = {
  'chess.com:rapid': 'Chess.com Rapid',
  'chess.com:blitz': 'Chess.com Blitz',
  'chess.com:bullet': 'Chess.com Bullet',
  'chess.com:daily': 'Chess.com Daily',
  'lichess:rapid': 'Lichess Rapid',
  'lichess:blitz': 'Lichess Blitz',
  'lichess:bullet': 'Lichess Bullet',
  'lichess:classical': 'Lichess Classical',
  'lichess:correspondence': 'Lichess Correspondence',
}

export function hasExternalRating(rating?: number | null, source?: string | null) {
  return Number.isInteger(rating) && Number(rating) > 0 && Boolean(sourceLabels[source ?? ''])
}

export function externalRatingSourceLabel(source?: string | null) {
  return sourceLabels[source ?? ''] ?? ''
}

export function externalRatingText(rating?: number | null, source?: string | null) {
  if (!hasExternalRating(rating, source)) return ''
  return `${rating} · ${externalRatingSourceLabel(source)}`
}
