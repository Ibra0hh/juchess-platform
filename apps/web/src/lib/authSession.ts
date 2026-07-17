export function isExistingSessionError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const type = 'type' in error ? String(error.type) : ''
  const message = 'message' in error ? String(error.message) : ''
  return type === 'user_session_already_exists'
    || /creation of a session is prohibited when a session is active/i.test(message)
}

export function normalizeAccountEmail(value: string) {
  return value.trim().toLowerCase()
}
