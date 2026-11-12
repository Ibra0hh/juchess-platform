const attemptKey = 'juchess.oauthAttempt'
const maxAgeMs = 15 * 60 * 1000

type AttemptStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function storeOAuthAttempt(storage: AttemptStorage, nonce: string, now = Date.now()) {
  storage.setItem(attemptKey, JSON.stringify({ nonce, expiresAt: now + maxAgeMs }))
}

export function consumeOAuthAttempt(storage: AttemptStorage, nonce: string | null, now = Date.now()) {
  if (!nonce) return false
  try {
    const stored = storage.getItem(attemptKey)
    if (!stored) return false
    const attempt = JSON.parse(stored)
    if (attempt.nonce !== nonce) return false
    storage.removeItem(attemptKey)
    return Number.isFinite(attempt.expiresAt) && now < attempt.expiresAt
  } catch {
    return false
  }
}
