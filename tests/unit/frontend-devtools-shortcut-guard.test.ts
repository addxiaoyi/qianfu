import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('devtools shortcut guard', () => {
  it('does not install a runtime shortcut or timing guard', () => {
    const source = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/main.tsx'), 'utf8')
    expect(source).not.toContain('DevToolsShortcutGuard')
    expect(source).not.toContain('DevToolsTimingGuard')
  })
})
