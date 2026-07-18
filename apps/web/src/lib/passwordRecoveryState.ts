export type PasswordRecoveryCredential =
  | { kind: 'custom'; challengeId: string; token: string }
  | { kind: 'legacy'; userId: string; secret: string }

export type PasswordRecoveryEntry =
  | { kind: 'request' }
  | { kind: 'invalid' }
  | { kind: 'link'; credential: PasswordRecoveryCredential; source: 'url' | 'history' }

export type PasswordRecoveryLocationState = {
  passwordRecoveryCredential?: PasswordRecoveryCredential
} | null

export function isPasswordRecoveryCredential(value: unknown): value is PasswordRecoveryCredential {
  if (!value || typeof value !== 'object' || !('kind' in value)) return false
  const candidate = value as Partial<PasswordRecoveryCredential>
  if (candidate.kind === 'custom') {
    return typeof candidate.challengeId === 'string'
      && candidate.challengeId.length > 0
      && typeof candidate.token === 'string'
      && candidate.token.length > 0
  }
  if (candidate.kind === 'legacy') {
    return typeof candidate.userId === 'string'
      && candidate.userId.length > 0
      && typeof candidate.secret === 'string'
      && candidate.secret.length > 0
  }
  return false
}

export function parsePasswordRecoveryEntry(
  search: string,
  locationState: PasswordRecoveryLocationState = null,
): PasswordRecoveryEntry {
  const params = new URLSearchParams(search)
  const challengeId = params.get('challenge')?.trim() ?? ''
  const token = params.get('token')?.trim() ?? ''
  const userId = params.get('userId')?.trim() ?? ''
  const secret = params.get('secret')?.trim() ?? ''
  const hasCustom = Boolean(challengeId || token)
  const hasLegacy = Boolean(userId || secret)

  if (hasCustom || hasLegacy) {
    if (challengeId && token && !hasLegacy) {
      return { kind: 'link', credential: { kind: 'custom', challengeId, token }, source: 'url' }
    }
    if (userId && secret && !hasCustom) {
      return { kind: 'link', credential: { kind: 'legacy', userId, secret }, source: 'url' }
    }
    return { kind: 'invalid' }
  }

  const historyCredential = locationState?.passwordRecoveryCredential
  if (isPasswordRecoveryCredential(historyCredential)) {
    return { kind: 'link', credential: historyCredential, source: 'history' }
  }
  return { kind: 'request' }
}

export function hasPasswordRecoveryParams(search: string) {
  const params = new URLSearchParams(search)
  return ['challenge', 'token', 'userId', 'secret'].some((key) => params.has(key))
}

export function normalizePasswordRecoveryCode(value: string) {
  return value.replace(/\D/g, '').slice(0, 6)
}
