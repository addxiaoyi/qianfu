import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { queryClient } from './lib/query-client'
import { scheduleWebVitals } from './lib/webVitals'

if (typeof window !== 'undefined') {
  const { pathname, search, hash } = window.location
  const hasFileExtension = /\.[a-zA-Z0-9]+$/.test(pathname)
  const bypassPrefixes = ['/api', '/auth', '/xpay', '/open', '/assets', '/uploads', '/tinymce']
  const replaceUrlWithoutReload = (targetPath: string) => {
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (currentPath === targetPath) return false
    window.history.replaceState(window.history.state, '', targetPath)
    return true
  }

  const convertHashToPath = () => {
    if (!hash || !hash.startsWith('#/')) return false;
    const targetPath = `${hash.slice(1)}${search}`;
    return replaceUrlWithoutReload(targetPath)
  };

  if (!hash.startsWith('#/')) {
    const shouldRewriteToPath =
      pathname !== '/' &&
      !hasFileExtension &&
      !bypassPrefixes.some((prefix) => pathname.startsWith(prefix));

    if (shouldRewriteToPath) {
      const targetPath = `${pathname}${search}`;
      replaceUrlWithoutReload(targetPath)
    }
  } else {
    const converted = convertHashToPath();
    if (!converted) {
      const hashPath = hash.slice(1);
      if (hashPath && hashPath !== pathname) {
        const targetPath = `${hashPath}${search}`;
        replaceUrlWithoutReload(targetPath)
      }
    }
  }

  // Guard against accidental native form navigations on mobile/webview.
  // React form handlers still run; this only blocks full-page fallback submits.
  window.addEventListener(
    'submit',
    (event) => {
      const form = event.target as HTMLFormElement | null
      if (!(form instanceof HTMLFormElement)) return
      event.preventDefault()
    },
    true,
  )

  const isInteractiveTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    return Boolean(
      target.closest(
        'input, textarea, select, [contenteditable="true"], .tox, .ProseMirror',
      ),
    )
  }

  const getScrollTop = (target: EventTarget | null) => {
    if (target instanceof HTMLElement) {
      const scrollRoot = target.closest<HTMLElement>(
        '[data-mobile-scroll-root], .overflow-y-auto, .overflow-auto',
      )
      if (scrollRoot) {
        return scrollRoot.scrollTop
      }
    }
    return Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop)
  }

  const shouldApplyMobileRefreshGuard = () => {
    if (window.matchMedia('(max-width: 900px)').matches) return true
    const route = `${window.location.pathname}${window.location.hash}`.toLowerCase()
    return (
      route.includes('/mobile') ||
      route.includes('/login') ||
      route.includes('/register') ||
      route.includes('/tickets') ||
      route.includes('/editor')
    )
  }

  let touchStartY: number | null = null
  let touchStartFromInteractive = false
  const touchReset = () => {
    touchStartY = null
    touchStartFromInteractive = false
  }

  document.addEventListener(
    'touchstart',
    (event) => {
      if (!shouldApplyMobileRefreshGuard()) {
        touchReset()
        return
      }
      touchStartFromInteractive = isInteractiveTarget(event.target)
      touchStartY = event.touches[0]?.clientY ?? null
    },
    { passive: true, capture: true },
  )

  document.addEventListener(
    'touchmove',
    (event) => {
      if (!shouldApplyMobileRefreshGuard()) return
      if (touchStartY === null || touchStartFromInteractive) return
      const currentY = event.touches[0]?.clientY
      if (typeof currentY !== 'number') return

      const pullingDown = currentY > touchStartY + 2
      if (!pullingDown) return

      if (getScrollTop(event.target) > 0) return
      if (event.cancelable) {
        event.preventDefault()
      }
    },
    { passive: false, capture: true },
  )

  document.addEventListener('touchend', touchReset, { passive: true, capture: true })
  document.addEventListener('touchcancel', touchReset, { passive: true, capture: true })

  // Clear stale service workers from old releases to avoid stale caches and ghost reload behavior.
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(
          registrations.map((registration) =>
            registration.unregister().catch(() => false),
          ),
        ),
      )
      .catch(() => undefined)
  }
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
)

scheduleWebVitals()
