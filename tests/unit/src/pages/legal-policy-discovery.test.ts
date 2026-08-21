import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const policyFiles = [
  { path: '/terms', file: 'public/terms/index.html', title: 'Terms of Service' },
  { path: '/privacy', file: 'public/privacy/index.html', title: 'Privacy Notice' },
  { path: '/refund-policy', file: 'public/refund-policy/index.html', title: 'Commercial Services Notice' },
  { path: '/acceptable-use', file: 'public/acceptable-use/index.html', title: 'Acceptable Use Policy' },
]

const pricingFiles = [
  { path: '/pricing', file: 'public/pricing/index.html', title: 'Free Service Notice' },
  { path: '/pricing-disclosure', file: 'public/pricing-disclosure/index.html', title: 'Commercial Feature Closure' },
]

describe('public legal policy discovery', () => {
  it.each(policyFiles)('ships a readable static document for $path', (policy) => {
    expect(existsSync(policy.file)).toBe(true)

    const html = readFileSync(policy.file, 'utf8')
    expect(html).toContain(`<h1>${policy.title}</h1>`)
    expect(html).not.toMatch(/<script\b/i)
    expect(html).toContain('href="/terms"')
    expect(html).toContain('href="/privacy"')
    expect(html).toContain('href="/refund-policy"')
    expect(html).toContain('href="/acceptable-use"')
    expect(html).toContain('mailto:support@0st.top')
  })

  it('publishes explicit prohibited-content and prohibited-conduct rules', () => {
    const html = readFileSync('public/acceptable-use/index.html', 'utf8')

    expect(html).toContain('NSFW')
    expect(html).toContain('harmful content')
    expect(html).toContain('Fraud')
    expect(html).not.toMatch(/<script\b/i)
  })

  it('keeps public policy pages aligned with personal filing mode', () => {
    for (const file of ['public/terms/index.html', 'public/privacy/index.html', 'public/refund-policy/index.html']) {
      const html = readFileSync(file, 'utf8')
      expect(html).toContain('PERSONAL_FILING_MODE')
      expect(html).toContain('不提供支付')
      expect(html).not.toMatch(/Paddle|Creem|钱包余额|商城订单|推广付费/i)
    }
  })

  it.each(pricingFiles)('ships a public pricing document for $path', (pricing) => {
    expect(existsSync(pricing.file)).toBe(true)

    const html = readFileSync(pricing.file, 'utf8')
    expect(html).toContain(`<h1>${pricing.title}</h1>`)
    expect(html).not.toMatch(/<script\b/i)
    expect(html).toContain('免费')
    expect(html).toContain('不提供支付')
    expect(html).not.toMatch(/¥\d|Paddle|Creem/i)
    expect(html).toContain('mailto:support@0st.top')
    expect(html).toContain('href="/terms"')
    expect(html).toContain('href="/privacy"')
    expect(html).toContain('href="/refund-policy"')
    expect(html).toContain('href="/acceptable-use"')
  })
})
