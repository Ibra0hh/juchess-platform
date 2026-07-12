import { Chess } from 'chess.js'

const resultTokens = new Set(['1-0', '0-1', '1/2-1/2', '*', 'live'])

export function parseStoredMoves(value?: string) {
  const source = value?.trim()
  if (!source) return []

  try {
    const chess = new Chess()
    chess.loadPgn(source)
    return chess.history()
  } catch {
    return parseLegacyMoveText(source)
  }
}

function parseLegacyMoveText(source: string) {
  const chess = new Chess()
  const tokens = stripVariations(source)
    .replace(/^\s*\[[^\]]*\]\s*$/gm, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/;[^\r\n]*/g, ' ')
    .replace(/\$\d+/g, ' ')
    .split(/\s+/)

  for (const rawToken of tokens) {
    const token = rawToken
      .trim()
      .replace(/^\d+\.(?:\.\.)?/, '')
      .replace(/[!?]+$/g, '')
    if (!token || resultTokens.has(token)) continue

    try {
      if (!chess.move(token)) break
    } catch {
      break
    }
  }

  return chess.history()
}

function stripVariations(value: string) {
  let result = value
  let previous = ''
  while (result !== previous) {
    previous = result
    result = result.replace(/\([^()]*\)/g, ' ')
  }
  return result
}
