/**
 * 用户标签 Hook
 * 优化项 308: 用户画像 - 标签体系
 */
import { useState, useCallback, useEffect } from 'react'
import { request } from '@/api/request'
import type {
  TagDefinition,
  UserTag,
  UserTagsResponse,
  TagStats,
  TagCategoryInfo,
  TagListResponse,
} from '@/types/tags'

// ============================================================
// 标签相关 Hooks
// ============================================================

/**
 * 用户标签管理 Hook
 */
export function useUserTags(userId: string) {
  const [tags, setTags] = useState<UserTag[]>([])
  const [stats, setStats] = useState<TagStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 加载用户标签
  const loadTags = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await request<UserTagsResponse>(`/api/tags/users/${userId}`)
      setTags(response.tags || [])
      setStats(response.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载标签失败')
    } finally {
      setLoading(false)
    }
  }, [userId])

  // 初始加载
  useEffect(() => {
    if (userId) {
      loadTags()
    }
  }, [userId, loadTags])

  // 分配标签
  const assignTags = useCallback(
    async (tagIds: string[], options?: { scores?: Record<string, number>; source?: string }) => {
      try {
        const response = await request<UserTagsResponse>(`/api/tags/users/${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagIds, ...options }),
        })
        setTags(response.tags || [])
        setStats(response.stats)
        return response
      } catch (err) {
        setError(err instanceof Error ? err.message : '分配标签失败')
        throw err
      }
    },
    [userId]
  )

  // 移除标签
  const removeTags = useCallback(
    async (tagIds: string[]) => {
      try {
        await request(`/api/tags/users/${userId}?tagIds=${tagIds.join(',')}`, {
          method: 'DELETE',
        })
        setTags(prev => prev.filter(t => !tagIds.includes(t.tag.id)))
      } catch (err) {
        setError(err instanceof Error ? err.message : '移除标签失败')
        throw err
      }
    },
    [userId]
  )

  // 更新标签分值
  const updateTagScore = useCallback(
    async (tagId: string, score: number) => {
      try {
        const response = await request<UserTagsResponse>(
          `/api/tags/users/${userId}/tags/${tagId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score }),
          }
        )
        setTags(response.tags || [])
        setStats(response.stats)
      } catch (err) {
        setError(err instanceof Error ? err.message : '更新标签失败')
        throw err
      }
    },
    [userId]
  )

  // 清除所有标签
  const clearAllTags = useCallback(async () => {
    try {
      await request(`/api/tags/users/${userId}`, { method: 'DELETE' })
      setTags([])
      setStats({
        byCategory: {
          basic: 0,
          behavior: 0,
          interest: 0,
          consumption: 0,
          social: 0,
          custom: 0,
        },
        manualCount: 0,
        autoCount: 0,
        totalCount: 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '清除标签失败')
      throw err
    }
  }, [userId])

  return {
    tags,
    stats,
    loading,
    error,
    loadTags,
    assignTags,
    removeTags,
    updateTagScore,
    clearAllTags,
  }
}

/**
 * 全局标签列表 Hook
 */
export function useTags(options?: { category?: string; isActive?: boolean }) {
  const [tags, setTags] = useState<TagDefinition[]>([])
  const [categories, setCategories] = useState<TagCategoryInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 加载标签
  const loadTags = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options?.category) params.set('category', options.category)
      if (options?.isActive !== undefined) params.set('isActive', String(options.isActive))

      const query = params.toString()
      const response = await request<TagListResponse>(`/api/tags${query ? `?${query}` : ''}`)

      setTags(response.items || [])
      setCategories(response.categories || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载标签失败')
    } finally {
      setLoading(false)
    }
  }, [options?.category, options?.isActive])

  // 初始加载
  useEffect(() => {
    loadTags()
  }, [loadTags])

  // 创建标签
  const createTag = useCallback(async (data: Partial<TagDefinition>) => {
    try {
      const tag = await request<TagDefinition>('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      setTags(prev => [...prev, tag])
      return tag
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建标签失败')
      throw err
    }
  }, [])

  // 更新标签
  const updateTag = useCallback(async (id: string, data: Partial<TagDefinition>) => {
    try {
      const tag = await request<TagDefinition>(`/api/tags/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      setTags(prev => prev.map(t => (t.id === id ? tag : t)))
      return tag
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新标签失败')
      throw err
    }
  }, [])

  // 删除标签
  const deleteTag = useCallback(async (id: string) => {
    try {
      await request(`/api/tags/${id}`, { method: 'DELETE' })
      setTags(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除标签失败')
      throw err
    }
  }, [])

  return {
    tags,
    categories,
    loading,
    error,
    loadTags,
    createTag,
    updateTag,
    deleteTag,
  }
}

/**
 * 标签搜索 Hook
 */
export function useTagSearch() {
  const [results, setResults] = useState<TagDefinition[]>([])
  const [searching, setSearching] = useState(false)

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([])
      return
    }

    try {
      setSearching(true)
      const response = await request<TagListResponse>(`/api/tags?search=${encodeURIComponent(query)}`)
      setResults(response.items || [])
    } catch (err) {
      console.error('Tag search error:', err)
    } finally {
      setSearching(false)
    }
  }, [])

  const clearResults = useCallback(() => {
    setResults([])
  }, [])

  return {
    results,
    searching,
    search,
    clearResults,
  }
}

/**
 * 批量用户标签 Hook
 */
export function useBatchUserTags() {
  const [tagMap, setTagMap] = useState<Map<string, UserTag[]>>(new Map())
  const [loading, setLoading] = useState(false)

  const loadBatch = useCallback(async (userIds: string[]) => {
    try {
      setLoading(true)
      const newMap = new Map<string, UserTag[]>()

      await Promise.all(
        userIds.map(async (userId) => {
          const response = await request<UserTagsResponse>(`/api/tags/users/${userId}`)
          newMap.set(userId, response.tags || [])
        })
      )

      setTagMap(newMap)
    } catch (err) {
      console.error('Batch load tags error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const getUserTags = useCallback(
    (userId: string): UserTag[] => {
      return tagMap.get(userId) || []
    },
    [tagMap]
  )

  return {
    tagMap,
    loading,
    loadBatch,
    getUserTags,
  }
}
