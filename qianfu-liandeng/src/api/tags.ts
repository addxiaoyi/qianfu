/**
 * 标签 API 客户端
 * 优化项 308: 用户画像 - 标签体系
 */
import { request } from '@/api/request'
import type {
  TagDefinition,
  TagCategory,
  TagListResponse,
  UserTagsResponse,
  TagCategoryInfo,
  TagStats,
  CreateTagRequest,
  UpdateTagRequest,
  AssignTagsRequest,
} from '@/types/tags'

// ============================================================
// 标签定义 API
// ============================================================

/**
 * 获取所有标签
 */
export async function getTags(options?: {
  category?: TagCategory
  isActive?: boolean
}): Promise<TagListResponse> {
  const params = new URLSearchParams()
  if (options?.category) params.set('category', options.category)
  if (options?.isActive !== undefined) params.set('isActive', String(options.isActive))

  const query = params.toString()
  return request(`/api/tags${query ? `?${query}` : ''}`)
}

/**
 * 获取标签分类信息
 */
export async function getTagCategories(): Promise<TagCategoryInfo[]> {
  return request('/api/tags/categories')
}

/**
 * 获取单个标签
 */
export async function getTag(id: string): Promise<TagDefinition> {
  return request(`/api/tags/${id}`)
}

/**
 * 创建标签
 */
export async function createTag(data: CreateTagRequest): Promise<TagDefinition> {
  return request('/api/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/**
 * 更新标签
 */
export async function updateTag(id: string, data: UpdateTagRequest): Promise<TagDefinition> {
  return request(`/api/tags/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/**
 * 删除标签
 */
export async function deleteTag(id: string): Promise<{ success: boolean }> {
  return request(`/api/tags/${id}`, { method: 'DELETE' })
}

// ============================================================
// 用户标签 API
// ============================================================

/**
 * 获取用户标签
 */
export async function getUserTags(userId: string): Promise<UserTagsResponse> {
  return request(`/api/tags/users/${userId}`)
}

/**
 * 为用户分配标签
 */
export async function assignUserTags(
  userId: string,
  data: AssignTagsRequest
): Promise<UserTagsResponse> {
  return request(`/api/tags/users/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/**
 * 更新用户标签
 */
export async function updateUserTag(
  userId: string,
  tagId: string,
  score: number
): Promise<UserTagsResponse> {
  return request(`/api/tags/users/${userId}/tags/${tagId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score }),
  })
}

/**
 * 移除用户标签
 */
export async function removeUserTags(
  userId: string,
  tagIds?: string[]
): Promise<{ success: boolean }> {
  const query = tagIds ? `?tagIds=${tagIds.join(',')}` : ''
  return request(`/api/tags/users/${userId}${query}`, { method: 'DELETE' })
}

/**
 * 获取用户标签统计
 */
export async function getUserTagStats(userId: string): Promise<TagStats> {
  return request(`/api/tags/users/${userId}/stats`)
}

/**
 * 用户自助管理标签
 */
export async function selfManageTags(
  userId: string,
  tagIds: string[],
  action: 'add' | 'remove'
): Promise<UserTagsResponse | { success: boolean; stats: TagStats }> {
  return request(`/api/tags/users/${userId}/self`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tagIds, action }),
  })
}

// ============================================================
// 批量操作
// ============================================================

/**
 * 批量获取用户标签
 */
export async function batchGetUserTags(userIds: string[]): Promise<Record<string, UserTagsResponse>> {
  // 如果API支持批量查询可以使用这个
  const results: Record<string, UserTagsResponse> = {}
  await Promise.all(
    userIds.map(async (userId) => {
      results[userId] = await getUserTags(userId)
    })
  )
  return results
}
