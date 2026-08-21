import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const ROUTE_SETTLE_DELAY_MS = 50
const REVEAL_SELECTOR = [
  '[data-ui-reveal]',
  '[data-gsap-reveal]',
  '.ui-panel',
  'section',
  'article',
  'table',
].join(',')
const GROUP_SELECTOR = '[data-gsap-group], [role="list"], tbody'
const ACTION_SELECTOR = 'button:not(:disabled), [role="button"], a.ui-button, a.btn-accent'
const CARD_SELECTOR = '[data-ui-card], [data-gsap-card], .ui-panel'

const visibleTargets = (root: HTMLElement, selector: string): HTMLElement[] => (
  Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((element) => {
    const style = window.getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
)

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

      const animated = new WeakSet<HTMLElement>()
      const animatedGroups = new WeakSet<HTMLElement>()
      const triggers: ScrollTrigger[] = []

      const reveal = (elements: HTMLElement[], immediate = false): void => {
        const fresh = elements.filter((element) => !animated.has(element)).slice(0, 80)
        fresh.forEach((element) => animated.add(element))
        if (fresh.length === 0) return

        if (immediate) {
          gsap.fromTo(fresh.slice(0, 16), { autoAlpha: 0, y: 14 }, {
            autoAlpha: 1,
            y: 0,
            duration: 0.48,
            stagger: 0.045,
            ease: 'power3.out',
            clearProps: 'opacity,visibility,transform',
          })
          return
        }

        fresh.forEach((element) => {
          gsap.set(element, { autoAlpha: 0, y: 22 })
          const trigger = ScrollTrigger.create({
            trigger: element,
            start: 'top 92%',
            once: true,
            onEnter: () => gsap.to(element, {
              autoAlpha: 1,
              y: 0,
              duration: 0.55,
              ease: 'power3.out',
              clearProps: 'opacity,visibility,transform',
            }),
          })
          triggers.push(trigger)
        })
      }

      const enhance = (): void => {
        const candidates = visibleTargets(main, REVEAL_SELECTOR)
        const aboveFold = candidates.filter((element) => element.getBoundingClientRect().top < window.innerHeight * 0.88)
        const belowFold = candidates.filter((element) => !aboveFold.includes(element))
        reveal(aboveFold, true)
        reveal(belowFold)

        visibleTargets(main, GROUP_SELECTOR).forEach((group) => {
          if (animatedGroups.has(group)) return
          animatedGroups.add(group)
          const children = Array.from(group.children).filter((child): child is HTMLElement => child instanceof HTMLElement)
          if (children.length < 2 || children.length > 30) return
          children.forEach((child) => animated.add(child))
          gsap.set(children, { autoAlpha: 0, y: 16 })
          const groupTrigger = ScrollTrigger.create({
            trigger: group,
            start: 'top 92%',
            once: true,
            onEnter: () => gsap.to(children, {
              autoAlpha: 1,
              y: 0,
              duration: 0.44,
              stagger: 0.055,
              ease: 'power3.out',
              clearProps: 'opacity,visibility,transform',
            }),
          })
          triggers.push(groupTrigger)
        })
        ScrollTrigger.refresh()
      }

      const frame = window.requestAnimationFrame(enhance)
      const observer = new MutationObserver(() => window.requestAnimationFrame(enhance))
      observer.observe(main, { childList: true, subtree: true })

      const press = (event: PointerEvent): void => {
        const action = (event.target as Element | null)?.closest<HTMLElement>(ACTION_SELECTOR)
        if (!action) return
        gsap.to(action, { scale: 0.975, duration: 0.12, ease: 'power2.out', overwrite: true })
      }
      const release = (event: PointerEvent): void => {
        const action = (event.target as Element | null)?.closest<HTMLElement>(ACTION_SELECTOR)
        if (!action) return
        gsap.to(action, { scale: 1, duration: 0.28, ease: 'back.out(2)', clearProps: 'transform', overwrite: true })
      }
      main.addEventListener('pointerdown', press)
      main.addEventListener('pointerup', release)
      main.addEventListener('pointercancel', release)

      return () => {
        window.cancelAnimationFrame(frame)
        observer.disconnect()
        main.removeEventListener('pointerdown', press)
        main.removeEventListener('pointerup', release)
        main.removeEventListener('pointercancel', release)
        triggers.forEach((trigger) => trigger.kill())
      }
    })

    media.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
      const main = document.getElementById('main-content')
      if (!main) return
      const enter = (event: PointerEvent): void => {
        const card = (event.target as Element | null)?.closest<HTMLElement>(CARD_SELECTOR)
        if (!card || card.contains(event.relatedTarget as Node | null)) return
        gsap.to(card, { y: -3, duration: 0.24, ease: 'power2.out', overwrite: true })
      }
      const leave = (event: PointerEvent): void => {
        const card = (event.target as Element | null)?.closest<HTMLElement>(CARD_SELECTOR)
        if (!card || card.contains(event.relatedTarget as Node | null)) return
        gsap.to(card, { y: 0, duration: 0.34, ease: 'power3.out', clearProps: 'transform', overwrite: true })
      }
      main.addEventListener('pointerover', enter)
      main.addEventListener('pointerout', leave)
      return () => {
        main.removeEventListener('pointerover', enter)
        main.removeEventListener('pointerout', leave)
      }
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
