/**
 * 用户标签服务
 * 优化项 308: 用户画像 - 标签体系
 */
import { PRESET_TAGS, TagDefinition, TagCategory, TAG_CATEGORY_META } from '../types/tags'

// 内存存储（实际项目应使用数据库）
const tagStore: Map<string, TagDefinition> = new Map()
const userTagsStore: Map<string, Map<string, { score: number; source: string; createdAt: string }>> = new Map()

// 初始化预设标签
function initPresetTags() {
  PRESET_TAGS.forEach(tag => {
    if (!tagStore.has(tag.id)) {
      tagStore.set(tag.id, {
        ...tag,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      })
    }
  })
}

initPresetTags()

// ============================================================
// 标签定义操作
// ============================================================

export class TagService {
  /**
   * 获取所有标签
   */
  static getAllTags(options?: { category?: TagCategory; isActive?: boolean }): TagDefinition[] {
    let tags = Array.from(tagStore.values())

    if (options?.category) {
      tags = tags.filter(t => t.category === options.category)
    }

    if (options?.isActive !== undefined) {
      tags = tags.filter(t => t.isActive === options.isActive)
    }

    return tags.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }

  /**
   * 根据ID获取标签
   */
  static getTagById(id: string): TagDefinition | undefined {
    return tagStore.get(id)
  }

  /**
   * 根据ID列表获取标签
   */
  static getTagsByIds(ids: string[]): TagDefinition[] {
    return ids.map(id => tagStore.get(id)).filter((t): t is TagDefinition => t !== undefined)
  }

  /**
   * 创建标签
   */
  static createTag(data: Omit<TagDefinition, 'id' | 'createdAt' | 'updatedAt'>): TagDefinition {
    const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const tag: TagDefinition = {
      ...data,
      id,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    tagStore.set(id, tag)
    return tag
  }

  /**
   * 更新标签
   */
  static updateTag(id: string, data: Partial<TagDefinition>): TagDefinition | null {
    const tag = tagStore.get(id)
    if (!tag) return null

    // 系统标签不可修改某些字段
    if (tag.isSystem) {
      const allowedUpdates = ['description', 'color', 'icon', 'isActive']
      const updates = Object.keys(data).filter(key => allowedUpdates.includes(key))
      if (updates.length === 0 && Object.keys(data).length > 0) {
        throw new Error('系统标签只能更新描述、颜色、图标和启用状态')
      }
    }

    const updatedTag: TagDefinition = {
      ...tag,
      ...data,
      updatedAt: new Date().toISOString(),
    }
    tagStore.set(id, updatedTag)
    return updatedTag
  }

  /**
   * 删除标签
   */
  static deleteTag(id: string): boolean {
    const tag = tagStore.get(id)
    if (!tag) return false
    if (tag.isSystem) {
      throw new Error('系统标签不可删除')
    }
    return tagStore.delete(id)
  }

  /**
   * 获取标签分类统计
   */
  static getCategoryStats(): Array<{ category: TagCategory; count: number }> {
    const stats: Partial<Record<TagCategory, number>> = {}

    tagStore.forEach(tag => {
      stats[tag.category] = (stats[tag.category] || 0) + 1
    })

    return Object.entries(stats).map(([category, count]) => ({
      category: category as TagCategory,
      count: count || 0,
    }))
  }

  /**
   * 获取分类信息
   */
  static getCategoryInfo() {
    const categoryStats = this.getCategoryStats()

    return Object.entries(TAG_CATEGORY_META).map(([category, meta]) => ({
      category: category as TagCategory,
      name: meta.name,
      description: meta.description,
      icon: meta.icon,
      count: categoryStats.find(s => s.category === category)?.count || 0,
    }))
  }
}

// ============================================================
// 用户标签操作
// ============================================================

export class UserTagService {
  /**
   * 获取用户的标签
   */
  static getUserTags(userId: string): Array<{
    tag: TagDefinition
    score: number
    source: string
    createdAt: string
  }> {
    const userTags = userTagsStore.get(userId)
    if (!userTags) return []

    return Array.from(userTags.entries()).map(([tagId, data]) => {
      const tag = tagStore.get(tagId)
      if (!tag) return null
      return { tag, ...data }
    }).filter(Boolean) as Array<{
      tag: TagDefinition
      score: number
      source: string
      createdAt: string
    }>
  }

  /**
   * 为用户分配标签
   */
  static assignTags(
    userId: string,
    tagIds: string[],
    options?: { scores?: Record<string, number>; source?: string }
  ): Array<{ tag: TagDefinition; score: number; source: string; createdAt: string }> {
    if (!userTagsStore.has(userId)) {
      userTagsStore.set(userId, new Map())
    }

    const userTags = userTagsStore.get(userId)!
    const now = new Date().toISOString()
    const source = options?.source || 'manual'

    const results: Array<{ tag: TagDefinition; score: number; source: string; createdAt: string }> = []

    tagIds.forEach(tagId => {
      const tag = tagStore.get(tagId)
      if (!tag || !tag.isActive) return

      const existing = userTags.get(tagId)
      const score = options?.scores?.[tagId] ?? 100

      userTags.set(tagId, {
        score: existing?.score ?? score,
        source: existing?.source || source,
        createdAt: existing?.createdAt || now,
      })

      results.push({
        tag,
        score: userTags.get(tagId)!.score,
        source: userTags.get(tagId)!.source,
        createdAt: userTags.get(tagId)!.createdAt,
      })
    })

    return results
  }

  /**
   * 移除用户的标签
   */
  static removeTags(userId: string, tagIds: string[]): boolean {
    const userTags = userTagsStore.get(userId)
    if (!userTags) return false

    tagIds.forEach(tagId => userTags.delete(tagId))
    return true
  }

  /**
   * 更新用户标签分值
   */
  static updateTagScore(userId: string, tagId: string, score: number): boolean {
    const userTags = userTagsStore.get(userId)
    if (!userTags) return false

    const existing = userTags.get(tagId)
    if (!existing) return false

    userTags.set(tagId, { ...existing, score })
    return true
  }

  /**
   * 清除用户的所有标签
   */
  static clearUserTags(userId: string): boolean {
    return userTagsStore.delete(userId)
  }

  /**
   * 获取用户的标签统计
   */
  static getUserTagStats(userId: string) {
    const userTags = this.getUserTags(userId)

    const byCategory: Partial<Record<TagCategory, number>> = {}
    let manualCount = 0
    let autoCount = 0

    userTags.forEach(({ tag, source }) => {
      byCategory[tag.category] = (byCategory[tag.category] || 0) + 1

      if (source === 'manual') {
        manualCount++
      } else {
        autoCount++
      }
    })

    return {
      byCategory: byCategory as Record<TagCategory, number>,
      manualCount,
      autoCount,
      totalCount: userTags.length,
    }
  }

  /**
   * 批量获取用户标签
   */
  static batchGetUserTags(userIds: string[]): Map<string, Array<{
    tag: TagDefinition
    score: number
    source: string
    createdAt: string
  }>> {
    const result = new Map()

    userIds.forEach(userId => {
      result.set(userId, this.getUserTags(userId))
    })

    return result
  }

  /**
   * 查找拥有特定标签的用户
   */
  static findUsersByTag(tagId: string): string[] {
    const users: string[] = []

    userTagsStore.forEach((tags, userId) => {
      if (tags.has(tagId)) {
        users.push(userId)
      }
    })

    return users
  }
}
