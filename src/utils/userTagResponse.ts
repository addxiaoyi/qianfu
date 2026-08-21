import type { TagCategory, TagDefinition, TagStats, UserTag } from '@/types/tags'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)

const normalizeTagDefinition = (value: unknown): TagDefinition | null => {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.category !== 'string') return null

  return {
    id: value.id,
    name: value.name,
    category: value.category as TagCategory,
    ...(typeof value.description === 'string' ? { description: value.description } : {}),
    ...(typeof value.color === 'string' ? { color: value.color } : {}),
    ...(typeof value.icon === 'string' ? { icon: value.icon } : {}),
    ...(typeof value.isSystem === 'boolean' ? { isSystem: value.isSystem } : {}),
    ...(typeof value.isActive === 'boolean' ? { isActive: value.isActive } : {}),
    ...(typeof value.sortOrder === 'number' && Number.isFinite(value.sortOrder) ? { sortOrder: value.sortOrder } : {}),
  }
}

const normalizeUserTag = (value: unknown, fallbackUserId: string): UserTag | null => {
  if (!isRecord(value)) return null
  const tag = normalizeTagDefinition(value.tag)
  if (!tag) return null
  if (Object.prototype.hasOwnProperty.call(value, 'userId') && typeof value.userId !== 'string') return null

  const source = value.source === 'manual' || value.source === 'auto' || value.source === 'rule'
    ? value.source
    : undefined
  const score = typeof value.score === 'number' && Number.isFinite(value.score) ? value.score : undefined

  return {
    tag,
    userId: typeof value.userId === 'string' ? value.userId : fallbackUserId,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    ...(score === undefined ? {} : { score }),
    ...(source === undefined ? {} : { source }),
    ...(typeof value.expiresAt === 'string' ? { expiresAt: value.expiresAt } : {}),
    ...(typeof value.verified === 'boolean' ? { verified: value.verified } : {}),
    ...(typeof value.updatedAt === 'string' ? { updatedAt: value.updatedAt } : {}),
  }
}

const normalizeUserTagStats = (value: unknown): TagStats | null => {
  if (!isRecord(value) || !isRecord(value.byCategory)) return null
  const counts = Object.entries(value.byCategory).reduce<Record<string, number>>((result, [key, count]) => {
    if (typeof count === 'number' && Number.isFinite(count)) result[key] = count
    return result
  }, {})
  const numbers = ['manualCount', 'autoCount', 'totalCount']
  if (numbers.some((key) => typeof value[key] !== 'number' || !Number.isFinite(value[key]))) return null

  return {
    byCategory: counts as TagStats['byCategory'],
    manualCount: value.manualCount as number,
    autoCount: value.autoCount as number,
    totalCount: value.totalCount as number,
  }
}

export const normalizeUserTagResponse = (value: unknown): { tags: UserTag[]; stats: TagStats | null } => {
  if (!isRecord(value)) return { tags: [], stats: null }
  const userId = typeof value.userId === 'string' ? value.userId : ''
  const tags = Array.isArray(value.tags)
    ? value.tags.flatMap((item) => {
      const normalized = normalizeUserTag(item, userId)
      return normalized ? [normalized] : []
    })
    : []

  return { tags, stats: normalizeUserTagStats(value.stats) }
}
