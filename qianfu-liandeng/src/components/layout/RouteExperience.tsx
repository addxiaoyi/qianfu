import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { gsap } from 'gsap'

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

  useLayoutEffect(() => {
    const media = gsap.matchMedia()

    media.add('(prefers-reduced-motion: no-preference)', () => {
      const main = document.getElementById('main-content')
      if (!main) return

      const explicitTargets = main.querySelectorAll<HTMLElement>('[data-ui-reveal]')
      const targets = explicitTargets.length > 0
        ? Array.from(explicitTargets).slice(0, 16)
        : Array.from(main.children).slice(0, 1)

      gsap.fromTo(
        targets,
        { autoAlpha: 0, y: 14 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.48,
          stagger: 0.045,
          ease: 'power3.out',
          clearProps: 'opacity,visibility,transform',
        },
      )
    })

    return () => media.revert()
  }, [location.key])

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
