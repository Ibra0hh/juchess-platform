export const PLAYER_EMAIL_LINK_TEXT_LIMIT = 80
export const PLAYER_EMAIL_LINK_URL_LIMIT = 2048

export type PlayerEmailLink = {
  text: string
  url: string
}

export function playerEmailLinkPreview(textValue: string, urlValue: string): PlayerEmailLink | null {
  const text = textValue.trim().replace(/\s+/g, ' ')
  const url = urlValue.trim()
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
