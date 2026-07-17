export const ACCOUNT_NAME_MAX_LENGTH = 128
export const ACCOUNT_PASSWORD_MAX_LENGTH = 256
export const ACCOUNT_EMAIL_MAX_LENGTH = 254

export function normalizeAuthEmail(value: string) {
  return value.trim().toLowerCase()
}

export function validateAccountName(value: string) {
  const name = value.trim()
  if (!name) return 'Enter your full name.'
  if ([...name].some((character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  })) return 'Full name contains unsupported characters.'
  if (name.length > ACCOUNT_NAME_MAX_LENGTH) {
    return `Full name must be ${ACCOUNT_NAME_MAX_LENGTH} characters or fewer.`
  }
  return null
}

export function validateAccountEmail(value: string) {
  const email = normalizeAuthEmail(value)
  if (!email) return 'Enter your email address.'
  if (email.length > ACCOUNT_EMAIL_MAX_LENGTH) return 'Enter a valid email address.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.'
  return null
}

export function validateNewPassword(value: string) {
  if (value.length < 8 || !/[A-Z]/.test(value) || !/[0-9]/.test(value)) {
    return 'Use at least 8 characters with one uppercase letter and one number.'
  }
  if (value.length > ACCOUNT_PASSWORD_MAX_LENGTH) {
    return `Password must be ${ACCOUNT_PASSWORD_MAX_LENGTH} characters or fewer.`
  }
  return null
}

export function validateSignInPassword(value: string) {
  if (!value) return 'Enter your password.'
  if (value.length > ACCOUNT_PASSWORD_MAX_LENGTH) {
    return `Password must be ${ACCOUNT_PASSWORD_MAX_LENGTH} characters or fewer.`
  }
  return null
}
