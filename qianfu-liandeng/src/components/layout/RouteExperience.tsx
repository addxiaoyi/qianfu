import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const ROUTE_SETTLE_DELAY_MS = 50

const scrollToRouteTarget = (hash: string): void => {
  if (!hash) {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    return
  }

  const targetId = decodeURIComponent(hash.slice(1))
  const target = document.getElementById(targetId)
  if (target) {
    target.scrollIntoView({ block: 'start', behavior: 'auto' })
    return
  }

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
}

const focusMainContent = (): void => {
  const main = document.getElementById('main-content')
  if (!(main instanceof HTMLElement)) return
  main.focus({ preventScroll: true })
}

export default function RouteExperience() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const timeoutRef = useRef<number | null>(null)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = window.setTimeout(() => {
      if (navigationType !== 'POP') {
        scrollToRouteTarget(location.hash)
      }

      focusMainContent()
      setAnnouncement(document.title || '页面已加载')
    }, ROUTE_SETTLE_DELAY_MS)

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [location.hash, location.pathname, location.search, navigationType])

  return (
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcement}
    </span>
  )
}
