import { describe, expect, it } from 'vitest'
import { resolveBrandPreset, resolveBrandPresetFromRules } from '../../qianfu-liandeng/src/components/business/brandPresets'

describe('dynamic branding route resolution', () => {
  it('uses the fallback branding for the home page', () => {
    expect(resolveBrandPreset('/').label).toBe('Q')
  })

  it('keeps specific route branding reachable', () => {
    expect(resolveBrandPreset('/servers').label).toBe('S')
    expect(resolveBrandPreset('/dashboard').label).toBe('D')
    expect(resolveBrandPreset('/tickets').label).toBe('T')
    expect(resolveBrandPreset('/admin').label).toBe('A')
  })

  it('does not throw when a route has no dedicated matcher', () => {
    expect(() => resolveBrandPreset('/unknown')).not.toThrow()
    expect(resolveBrandPreset('/unknown').label).toBe('Q')
  })

  it('ignores invalid runtime matchers instead of calling non-functions', () => {
    const fallback = { label: 'Q', bg: '#111111', fg: '#ffffff' }
    expect(() => resolveBrandPresetFromRules([
      { match: '/admin', preset: { label: 'A', bg: '#111111', fg: '#ffffff' } },
      { preset: fallback },
    ], '/admin')).not.toThrow()
    expect(resolveBrandPresetFromRules([
      { match: '/admin', preset: { label: 'A', bg: '#111111', fg: '#ffffff' } },
      { preset: fallback },
    ], '/admin').label).toBe('Q')
  })
})
