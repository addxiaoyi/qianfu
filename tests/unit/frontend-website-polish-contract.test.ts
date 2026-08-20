import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (...parts: string[]) =>
  fs.readFileSync(path.join(root, ...parts), 'utf8')

describe('website polish contracts', () => {
  it('publishes direct canonical URLs only', () => {
    const sitemap = read('qianfu-liandeng', 'public', 'sitemap.xml')

    expect(sitemap).toContain('<loc>https://mc-u.top/servers</loc>')
    expect(sitemap).toContain('<loc>https://mc-u.top/compliance</loc>')
    expect(sitemap).not.toContain('#/')
    expect(sitemap).not.toContain('/promotion</loc>')
  })

  it('keeps private application routes out of crawler scope', () => {
    const robots = read('qianfu-liandeng', 'public', 'robots.txt')

    expect(robots).toContain('Disallow: /admin')
    expect(robots).toContain('Disallow: /dashboard')
    expect(robots).toContain('Disallow: /promotion')
    expect(robots).toContain('Allow: /.well-known/security.txt')
  })

  it('exposes a valid security contact and PWA shortcuts', () => {
    const security = read(
      'qianfu-liandeng',
      'public',
      '.well-known',
      'security.txt',
    )
    const manifest = JSON.parse(
      read('qianfu-liandeng', 'public', 'manifest.json'),
    ) as {
      shortcuts?: Array<{ url?: string }>
      share_target?: unknown
    }

    expect(security).toContain('Contact: mailto:support@0st.top')
    expect(security).toContain(
      'Canonical: https://mc-u.top/.well-known/security.txt',
    )
    expect(manifest.shortcuts?.some((shortcut) => shortcut.url === '/me')).toBe(
      true,
    )
    expect(manifest.share_target).toBeUndefined()
  })

  it('restores route focus and refreshes live homepage statistics', () => {
    const routeExperience = read(
      'qianfu-liandeng',
      'src',
      'components',
      'layout',
      'RouteExperience.tsx',
    )
    const home = read('qianfu-liandeng', 'src', 'pages', 'Home.tsx')
    const viteConfig = read('qianfu-liandeng', 'vite.config.ts')

    expect(routeExperience).toContain('useNavigationType')
    expect(routeExperience).toContain("getElementById('main-content')")
    expect(home).toContain('refetchInterval: 30_000')
    expect(viteConfig).toContain('manualChunks: resolveVendorChunk')
  })

  it('publishes Web Vitals without invalid identifiers', () => {
    const source = read('qianfu-liandeng', 'src', 'lib', 'webVitals.ts')

    expect(source).toContain('WEB_VITALS_ENDPOINT')
    expect(source).toContain('new Blob([body]')
    expect(source).not.toContain('WEB_VITAL_ENDPOINT')
    expect(source).not.toContain('[abody]')
  })
})
