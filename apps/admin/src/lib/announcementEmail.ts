export const ANNOUNCEMENT_EMAIL_RECIPIENT_LIMIT = 50

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type AnnouncementEmailRecipients = {
  emails: string[]
  invalid: string[]
}

export function parseAnnouncementRecipientEmails(value: string): AnnouncementEmailRecipients {
  const candidates = value
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

  const unique = Array.from(new Set(candidates))
  return {
    emails: unique.filter((email) => email.length <= 254 && emailPattern.test(email)),
    invalid: unique.filter((email) => email.length > 254 || !emailPattern.test(email)),
  }
}
