export type RequiredPlayerProfile = {
  displayName?: string
  university?: string
  universityId?: string
  phone?: string
  chessComUsername?: string
  lichessUsername?: string
}

export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 128
export const PROFILE_UNIVERSITY_MAX_LENGTH = 160
export const PROFILE_UNIVERSITY_ID_MAX_LENGTH = 64
export const PROFILE_PHONE_INPUT_MAX_LENGTH = 32
export const PROFILE_USERNAME_MAX_LENGTH = 80

export function normalizeJordanMobile(value?: string) {
  const raw = value?.trim()
  if (!raw) return ''

  const compact = raw.replace(/[^\d+]/g, '')
  if (compact.startsWith('+962')) return `+962${compact.slice(4).replace(/\D/g, '')}`
  if (compact.startsWith('00962')) return `+962${compact.slice(5).replace(/\D/g, '')}`
  if (compact.startsWith('962')) return `+962${compact.slice(3).replace(/\D/g, '')}`

  const digits = compact.replace(/\D/g, '')
  if (digits.startsWith('0')) return `+962${digits.slice(1)}`
  if (digits.startsWith('7') && digits.length === 9) return `+962${digits}`
  return raw
}

export function validateRequiredPlayerProfile(input: RequiredPlayerProfile) {
  const displayName = input.displayName?.trim() ?? ''
  const university = input.university?.trim() ?? ''
  const universityId = input.universityId?.trim() ?? ''
  const phone = normalizeJordanMobile(input.phone)

  if (!displayName || !university || !universityId || !phone) {
    return 'Full name, university, University ID, and phone number are required.'
  }
  if (displayName.length > PROFILE_DISPLAY_NAME_MAX_LENGTH) return 'Full name must be 128 characters or fewer.'
  if (university.length > PROFILE_UNIVERSITY_MAX_LENGTH) return 'University must be 160 characters or fewer.'
  if (universityId.length > PROFILE_UNIVERSITY_ID_MAX_LENGTH) return 'University ID must be 64 characters or fewer.'
  if (!/^\+9627\d{8}$/.test(phone)) return 'Enter a valid Jordan mobile number, such as 079 123 4567.'
  for (const [label, value] of [
    ['Chess.com username', input.chessComUsername],
    ['Lichess username', input.lichessUsername],
  ] as const) {
    const username = value?.trim() ?? ''
    if (username.length > PROFILE_USERNAME_MAX_LENGTH) return `${label} must be 80 characters or fewer.`
    if (/\s/u.test(username)) return `${label} cannot contain spaces.`
  }
  return null
}
