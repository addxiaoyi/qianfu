import type { TagCategory, TagCategoryInfo, TagDefinition } from '@/types/tags'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)

export const normalizeTagListResponse = (value: unknown): {
  items: TagDefinition[]
  categories: TagCategoryInfo[]
} => {
  if (!isRecord(value)) return { items: [], categories: [] }

  const items = Array.isArray(value.items)
    ? value.items.flatMap((item): TagDefinition[] => {
      if (!isRecord(item)) return []
      if (typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.category !== 'string') return []
      return [{
        id: item.id,
        name: item.name,
        category: item.category as TagCategory,
        ...(typeof item.description === 'string' ? { description: item.description } : {}),
        ...(typeof item.color === 'string' ? { color: item.color } : {}),
        ...(typeof item.icon === 'string' ? { icon: item.icon } : {}),
        ...(typeof item.isSystem === 'boolean' ? { isSystem: item.isSystem } : {}),
        ...(typeof item.isActive === 'boolean' ? { isActive: item.isActive } : {}),
        ...(typeof item.sortOrder === 'number' ? { sortOrder: item.sortOrder } : {}),
      }]
    })
    : []

  const categories = Array.isArray(value.categories)
    ? value.categories.flatMap((category): TagCategoryInfo[] => {
      if (!isRecord(category)) return []
      if (typeof category.category !== 'string' || typeof category.name !== 'string' || typeof category.count !== 'number') return []
      return [{
        category: category.category as TagCategory,
        name: category.name,
        count: category.count,
        ...(typeof category.description === 'string' ? { description: category.description } : {}),
      }]
    })
    : []

  return { items, categories }
}
