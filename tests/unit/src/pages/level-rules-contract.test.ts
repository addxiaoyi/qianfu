import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const pagePath = resolve('src/pages/LevelRules.tsx')
const apiPath = resolve('src/api/levelRulesApi.ts')
const typesPath = resolve('src/types/api.ts')

describe('LevelRules page contract', () => {
  it('loads public rules with optional personal progress from the level rules API', () => {
    expect(existsSync(apiPath)).toBe(true)

    const apiSource = readFileSync(apiPath, 'utf8')
    expect(apiSource).toContain("api.get<LevelRulesResponse>('/api/v1/user/level/rules'")
    expect(apiSource).toContain('useAuth: true')
  })

  it('defines typed rules, progress, and next unlock data', () => {
    const typesSource = readFileSync(typesPath, 'utf8')

    expect(typesSource).toContain('export interface LevelRule')
    expect(typesSource).toContain('export interface LevelProgress')
    expect(typesSource).toContain('export interface LevelRulesResponse')
    expect(typesSource).toContain('nextUnlock')
  })

  it('renders stateful progress, real activity entries, and no native select', () => {
    const pageSource = readFileSync(pagePath, 'utf8')

    expect(pageSource).toContain("from '@/api/levelRulesApi'")
    expect(pageSource).toContain('useQuery')
    expect(pageSource).toContain('isLoading')
    expect(pageSource).toContain('isError')
    expect(pageSource).toContain('重新加载')
    expect(pageSource).toContain('暂无等级规则')
    expect(pageSource).toContain('当前等级')
    expect(pageSource).toContain('XP')
    expect(pageSource).toContain('下一解锁')
    expect(pageSource).toContain('签到')
    expect(pageSource).toContain('找服')
    expect(pageSource).toContain('评论')
    expect(pageSource).toContain('to="/dashboard"')
    expect(pageSource).toContain('to="/servers"')
    expect(pageSource).not.toMatch(/<select\b/i)
  })

  it('renders a richer progression view with filters and unlock states', () => {
    const pageSource = readFileSync(pagePath, 'utf8')

    expect(pageSource).toContain('成长路线')
    expect(pageSource).toContain('获取 XP')
    expect(pageSource).toContain('等级权益')
    expect(pageSource).toContain('已解锁')
    expect(pageSource).toContain('待解锁')
    expect(pageSource).toContain('规则说明')
  })

  it('connects today growth tasks to the real check-in status and next-level actions', () => {
    const pageSource = readFileSync(pagePath, 'utf8')
    const typesSource = readFileSync(typesPath, 'utf8')

    expect(typesSource).toContain('export interface CheckinStatus')
    expect(pageSource).toContain("api.get<CheckinStatus>('/user/checkin/status')")
    expect(pageSource).toContain('今日成长任务')
    expect(pageSource).toContain('连续签到')
    expect(pageSource).toContain('行动建议')
    expect(pageSource).toContain('今日已签到')
    expect(pageSource).toContain('立即签到')
    expect(pageSource).toContain('到下一等级还需要')
  })
})
