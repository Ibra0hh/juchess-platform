const key = 'juchess:admin-google-attempt'
const maxAgeMs = 15 * 60 * 1000
type AttemptStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function createAdminGoogleAttempt(storage: AttemptStorage, adminUrl: URL, nonce: string, now = Date.now()) {
  storage.setItem(key, JSON.stringify({ nonce, expiresAt: now + maxAgeMs }))
  function callback(status: string) {
    const url = new URL(adminUrl)
    url.search = new URLSearchParams({ adminGoogle: status, attempt: nonce }).toString()
    url.hash = ''
    return url.href
  }
  return { success: callback('success'), failure: callback('failure') }
}

export function consumeAdminGoogleReturn(params: URLSearchParams, storage: AttemptStorage, now = Date.now()) {
  if (!params.has('adminGoogle')) return null
  const expired = { error: 'This Google sign-in did not start in this tab or has expired. Please try again.' }
  try {
    const stored = storage.getItem(key)
    if (!stored) return expired
    const attempt = JSON.parse(stored)
    if (typeof attempt?.nonce !== 'string' || params.get('attempt') !== attempt.nonce) return expired
    storage.removeItem(key)
    if (!Number.isFinite(attempt.expiresAt) || now >= attempt.expiresAt) return expired
  } catch {
    return expired
  }
  if (params.get('adminGoogle') !== 'success') {
    return { error: 'Google sign-in was cancelled or could not be completed. You can try again or use your password.' }
  }
  const userId = params.get('userId')
  const secret = params.get('secret')
  if (!userId || !secret) return { error: 'The Google sign-in response was incomplete. Please try again.' }
  return { userId, secret }
}
