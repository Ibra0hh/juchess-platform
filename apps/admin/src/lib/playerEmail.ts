export const PLAYER_EMAIL_LINK_TEXT_LIMIT = 80
export const PLAYER_EMAIL_LINK_URL_LIMIT = 2048

export type PlayerEmailLink = {
  text: string
  url: string
}

export function normalizePlayerEmailLinkUrlInput(value: string) {
  const url = value.trim()
  if (!url || /^https?:\/\//i.test(url)) return url
  if (/^[^\s/:]+\.[^\s]+$/.test(url)) return `https://${url}`
  return url
}

export function playerEmailLinkPreview(textValue: string, urlValue: string): PlayerEmailLink | null {
  const text = textValue.trim().replace(/\s+/g, ' ')
  const url = normalizePlayerEmailLinkUrlInput(urlValue)
  if (!text || !url || text.length > PLAYER_EMAIL_LINK_TEXT_LIMIT || url.length > PLAYER_EMAIL_LINK_URL_LIMIT) {
    return null
  }

  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
      return null
    }
    return { text, url }
  } catch {
    return null
  }
}

export function playerEmailLinkValidationMessage(textValue: string, urlValue: string) {
  if (!textValue.trim() && !urlValue.trim()) return 'Add the button text and destination, or remove the link button.'
  if (!textValue.trim()) return 'Add the text that should appear on the email button.'
  if (!urlValue.trim()) return 'Add the page the email button should open.'
  if (!playerEmailLinkPreview(textValue, urlValue)) {
    return 'Use a complete http:// or https:// address without a username or password.'
  }
  return null
}
