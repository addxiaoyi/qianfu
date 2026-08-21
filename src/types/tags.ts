/**
 * 用户画像标签体系 - 类型定义
 * 优化项 308: 用户画像 - 标签体系
 */

// ============================================================
// 标签分类
// ============================================================

export const TagCategory = {
  /** 基础属性 */
  BASIC: 'basic',
  /** 行为特征 */
  BEHAVIOR: 'behavior',
  /** 兴趣偏好 */
  INTEREST: 'interest',
  /** 消费能力 */
  CONSUMPTION: 'consumption',
  /** 社交属性 */
  SOCIAL: 'social',
  /** 自定义标签 */
  CUSTOM: 'custom',
} as const

export type TagCategory = typeof TagCategory[keyof typeof TagCategory]

// ============================================================
// 标签定义
// ============================================================

export interface TagDefinition {
  /** 标签唯一标识 */
  id: string
  /** 标签名称 */
  name: string
  /** 标签描述 */
  description?: string
  /** 所属分类 */
  category: TagCategory
  /** 标签颜色（十六进制） */
  color?: string
  /** 图标（Lucide图标名） */
  icon?: string
  /** 是否为系统标签（不可删除） */
  isSystem?: boolean
  /** 是否启用 */
  isActive?: boolean
  /** 排序权重 */
  sortOrder?: number
  /** 创建时间 */
  createdAt?: string
  /** 更新时间 */
  updatedAt?: string
}

// ============================================================
// 用户标签
// ============================================================

export interface UserTag {
  /** 标签定义 */
  tag: TagDefinition
  /** 用户ID */
  userId: string
  /** 标签分值（0-100，用于权重计算） */
  score?: number
  /** 标签来源 */
  source?: 'manual' | 'auto' | 'rule'
  /** 标签到期时间（可选） */
  expiresAt?: string
  /** 是否已验证 */
  verified?: boolean
  /** 添加时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt?: string
}

// ============================================================
// 用户画像
// ============================================================

export interface UserProfile {
  /** 用户ID */
  userId: string
  /** 用户名 */
  username: string
  /** 邮箱 */
  email?: string
  /** 头像 */
  avatarUrl?: string
  /** 标签列表 */
  tags: UserTag[]
  /** 标签统计 */
  tagStats?: TagStats
  /** 画像更新时间 */
  updatedAt?: string
}

// ============================================================
// 标签统计
// ============================================================

export interface TagStats {
  /** 各分类的标签数量 */
  byCategory: Record<TagCategory, number>
  /** 手动标签数 */
  manualCount: number
  /** 自动标签数 */
  autoCount: number
  /** 标签总数 */
  totalCount: number
}

// ============================================================
// API 请求/响应
// ============================================================

export interface CreateTagRequest {
  name: string
  description?: string
  category: TagCategory
  color?: string
  icon?: string
}

export interface UpdateTagRequest {
  name?: string
  description?: string
  color?: string
  icon?: string
  isActive?: boolean
  sortOrder?: number
}

export interface AssignTagsRequest {
  /** 要分配的标签ID列表 */
  tagIds: string[]
  /** 标签分值 */
  scores?: Record<string, number>
  /** 过期时间 */
  expiresAt?: string
}

export interface UserTagsResponse {
  userId: string
  tags: UserTag[]
  stats: TagStats
}

export interface TagListResponse {
  items: TagDefinition[]
  total: number
  categories: TagCategoryInfo[]
}

export interface TagCategoryInfo {
  category: TagCategory
  name: string
  description?: string
  count: number
}

// ============================================================
// 标签规则（自动打标）
// ============================================================

export interface TagRule {
  id: string
  name: string
  description?: string
  /** 条件组合 */
  conditions: TagRuleCondition[]
  /** 条件逻辑关系 */
  conditionLogic: 'and' | 'or'
  /** 满足条件时分配的标签 */
  actionTags: string[]
  /** 是否启用 */
  isActive: boolean
  /** 优先级 */
  priority: number
}

export interface TagRuleCondition {
  /** 字段 */
  field: string
  /** 操作符 */
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'notIn'
  /** 值 */
  value: string | number | string[] | number[]
}

// ============================================================
// 预设标签配置
// ============================================================

export const PRESET_TAGS: Omit<TagDefinition, 'createdAt' | 'updatedAt'>[] = [
  // 基础属性
  { id: 'basic-verified', name: '已认证', category: TagCategory.BASIC, color: '#22c55e', icon: 'check-circle', isSystem: true, sortOrder: 1 },
  { id: 'basic-premium', name: '高级用户', category: TagCategory.BASIC, color: '#a855f7', icon: 'crown', isSystem: true, sortOrder: 2 },
  { id: 'basic-new', name: '新用户', category: TagCategory.BASIC, color: '#3b82f6', icon: 'sparkles', isSystem: true, sortOrder: 3 },

  // 行为特征
  { id: 'behavior-daily', name: '日常活跃', category: TagCategory.BEHAVIOR, color: '#10b981', icon: 'activity', sortOrder: 10 },
  { id: 'behavior-weekly', name: '周活跃', category: TagCategory.BEHAVIOR, color: '#14b8a6', icon: 'calendar', sortOrder: 11 },
  { id: 'behavior-monthly', name: '月活跃', category: TagCategory.BEHAVIOR, color: '#f59e0b', icon: 'calendar-days', sortOrder: 12 },
  { id: 'behavior-dormant', name: '休眠用户', category: TagCategory.BEHAVIOR, color: '#6b7280', icon: 'moon', sortOrder: 13 },

  // 兴趣偏好
  { id: 'interest-survival', name: '生存服爱好者', category: TagCategory.INTEREST, color: '#22c55e', icon: 'tree-pine', sortOrder: 20 },
  { id: 'interest-creative', name: '创造服玩家', category: TagCategory.INTEREST, color: '#8b5cf6', icon: 'palette', sortOrder: 21 },
  { id: 'interest-pvp', name: 'PVP玩家', category: TagCategory.INTEREST, color: '#ef4444', icon: 'swords', sortOrder: 22 },
  { id: 'interest-pve', name: 'PVE玩家', category: TagCategory.INTEREST, color: '#f97316', icon: 'shield', sortOrder: 23 },
  { id: 'interest-tech', name: '技术流', category: TagCategory.INTEREST, color: '#06b6d4', icon: 'cpu', sortOrder: 24 },

  // 消费能力
  { id: 'consumption-high', name: '高消费', category: TagCategory.CONSUMPTION, color: '#eab308', icon: 'gem', sortOrder: 30 },
  { id: 'consumption-medium', name: '中等消费', category: TagCategory.CONSUMPTION, color: '#84cc16', icon: 'wallet', sortOrder: 31 },
  { id: 'consumption-low', name: '低消费', category: TagCategory.CONSUMPTION, color: '#94a3b8', icon: 'coins', sortOrder: 32 },
  { id: 'consumption-vip', name: 'VIP会员', category: TagCategory.CONSUMPTION, color: '#f59e0b', icon: 'star', sortOrder: 33 },

  // 社交属性
  { id: 'social-leader', name: '公会领袖', category: TagCategory.SOCIAL, color: '#ec4899', icon: 'users', sortOrder: 40 },
  { id: 'social-helper', name: '热心助人', category: TagCategory.SOCIAL, color: '#14b8a6', icon: 'heart-handshake', sortOrder: 41 },
  { id: 'social-influencer', name: '意见领袖', category: TagCategory.SOCIAL, color: '#f43f5e', icon: 'megaphone', sortOrder: 42 },
]

// ============================================================
// 分类元数据
// ============================================================

export const TAG_CATEGORY_META: Record<TagCategory, { name: string; description: string; icon: string }> = {
  [TagCategory.BASIC]: { name: '基础属性', description: '用户的基本属性标签', icon: 'user' },
  [TagCategory.BEHAVIOR]: { name: '行为特征', description: '用户的活跃和行为特征', icon: 'activity' },
  [TagCategory.INTEREST]: { name: '兴趣偏好', description: '用户的兴趣和偏好标签', icon: 'heart' },
  [TagCategory.CONSUMPTION]: { name: '消费能力', description: '用户的消费能力和等级', icon: 'credit-card' },
  [TagCategory.SOCIAL]: { name: '社交属性', description: '用户的社交关系和影响力', icon: 'users' },
  [TagCategory.CUSTOM]: { name: '自定义标签', description: '用户自定义的个性化标签', icon: 'tag' },
}
