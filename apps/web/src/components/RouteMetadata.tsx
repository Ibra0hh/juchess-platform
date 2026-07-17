import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { socialCrestUrl } from '../lib/brand'
import { canonicalForPath, metadataForPath } from '../lib/routeMetadata'

function setMeta(selector: string, value: string) {
  const element = document.head.querySelector<HTMLMetaElement>(selector)
  if (element) element.content = value
}

export default function RouteMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const metadata = metadataForPath(pathname)
    const canonicalUrl = canonicalForPath(pathname)
    document.title = metadata.title

    setMeta('meta[name="description"]', metadata.description)
    setMeta('meta[name="robots"]', metadata.index === false ? 'noindex, nofollow' : 'index, follow')
    setMeta('meta[property="og:title"]', metadata.title)
    setMeta('meta[property="og:description"]', metadata.description)
    setMeta('meta[property="og:url"]', canonicalUrl)
    setMeta('meta[property="og:image"]', socialCrestUrl)
    setMeta('meta[name="twitter:title"]', metadata.title)
    setMeta('meta[name="twitter:description"]', metadata.description)
    setMeta('meta[name="twitter:image"]', socialCrestUrl)

    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canonical) canonical.href = canonicalUrl
  }, [pathname])

  return null
}

