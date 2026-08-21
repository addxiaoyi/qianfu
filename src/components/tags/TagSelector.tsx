/**
 * 标签选择器组件
 * 优化项 308: 用户画像 - 标签体系
 */
import React, { useState, useMemo, useCallback } from 'react'
import { request } from '@/api/request'
import { toast } from '@/hooks/use-toast'
import GeometricLantern from '@/components/ui/GeometricLantern'
import type {
  TagDefinition,
  UserTag,
} from '@/types/tags'
import { normalizeUserTagResponse } from '@/utils/userTagResponse'
import { normalizeTagListResponse } from '@/utils/tagResponse'

// 图标映射
const iconMap: Record<string, React.ReactNode> = {
  'check-circle': <CheckCircleIcon />,
  'crown': <CrownIcon />,
  'sparkles': <LampIcon />,
  'activity': <ActivityIcon />,
  'calendar': <CalendarIcon />,
  'calendar-days': <CalendarDaysIcon />,
  'moon': <MoonIcon />,
  'tree-pine': <TreePineIcon />,
  'palette': <PaletteIcon />,
  'swords': <SwordsIcon />,
  'shield': <ShieldIcon />,
  'cpu': <CpuIcon />,
  'gem': <GemIcon />,
  'wallet': <WalletIcon />,
  'coins': <CoinsIcon />,
  'star': <LampIcon />,
  'users': <UsersIcon />,
  'heart-handshake': <HeartHandshakeIcon />,
  'megaphone': <MegaphoneIcon />,
  'heart': <HeartIcon />,
  'credit-card': <CreditCardIcon />,
  'tag': <TagIcon />,
  'user': <UserIcon />,
}

// 简单 SVG 图标组件
function CheckCircleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
}

function CrownIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M4 18h16"/>
    </svg>
  )
}

function LampIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2h8l4 10H4L8 2Z"/><path d="M12 12v6"/><path d="M8 22h8"/><path d="M10 18h4"/>
    </svg>
  )
}

function ActivityIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  )
}

function CalendarDaysIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
    </svg>
  )
}

function TreePineIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14"/><path d="M12 20v-8"/><path d="m10.7 10.3-.7.7a2 2 0 0 1-2.8 0l-.6-.6a2 2 0 0 1 0-2.8l.7-.7"/>
    </svg>
  )
}

function PaletteIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/>
    </svg>
  )
}

function SwordsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/>
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
    </svg>
  )
}

function CpuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>
    </svg>
  )
}

function GemIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
    </svg>
  )
}

function CoinsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a3 3 0 0 0-2-2.87"/><path d="M7 21v-2a3 3 0 0 1 2-2.87"/><circle cx="12" cy="7" r="4"/><path d="M22 21v-2a3 3 0 0 0-2-2.87"/><circle cx="17" cy="5" r="2.5"/><circle cx="7" cy="5" r="2.5"/>
    </svg>
  )
}

function HeartHandshakeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4C8 2 3 4 3 9c0 4 4 8 9 12 5-4 9-8 9-12 0-5-5-7-9-5z"/><path d="m12 13-1-1 2-2-3-3 2-2"/><path d="m17 18-1-1 2-2-3-3 2-2"/>
    </svg>
  )
}

function MegaphoneIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
    </svg>
  )
}

function CreditCardIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
    </svg>
  )
}

function TagIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>
    </svg>
  )
}

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
  )
}

// ============================================================
// 样式
// ============================================================

const tagChipClass = `
  inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider
  transition-all duration-200 cursor-pointer select-none
  hover:scale-105 active:scale-95
`

const categoryTabClass = `
  px-4 py-2 text-[11px] font-black uppercase tracking-widest italic
  border-b-2 border-transparent transition-all duration-200 cursor-pointer
  hover:text-accent
`

// ============================================================
// 组件 Props
// ============================================================

interface TagChipProps {
  tag: TagDefinition
  selected?: boolean
  onClick?: () => void
  showRemove?: boolean
  onRemove?: () => void
  size?: 'sm' | 'md' | 'lg'
}

interface TagSelectorProps {
  /** 当前选中的标签ID列表 */
  selectedIds: string[]
  /** 标签变更回调 */
  onChange: (tagIds: string[]) => void
  /** 是否显示移除按钮 */
  showRemove?: boolean
  /** 是否只读模式 */
  readonly?: boolean
  /** 允许选择的分类（为空则全部可选） */
  allowedCategories?: TagCategory[]
  /** 自定义样式类 */
  className?: string
}

// ============================================================
// 组件实现
// ============================================================

/**
 * 单个标签芯片
 */
export const TagChip: React.FC<TagChipProps> = ({
  tag,
  selected = false,
  onClick,
  showRemove = false,
  onRemove,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[9px]',
    md: 'px-2.5 py-1 text-[10px]',
    lg: 'px-3 py-1.5 text-[11px]',
  }

  return (
    <div
      className={`${tagChipClass} ${sizeClasses[size]} ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        backgroundColor: selected ? (tag.color || '#6b7280') : `${tag.color || '#6b7280'}15`,
        color: selected ? 'white' : (tag.color || '#6b7280'),
      }}
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? selected : undefined}
    >
      {tag.icon && iconMap[tag.icon]}
      <span>{tag.name}</span>
      {showRemove && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 hover:bg-white/20 rounded-full p-0.5 transition-colors"
          aria-label={`移除标签 ${tag.name}`}
        >
          <XIcon />
        </button>
      )}
    </div>
  )
}

/**
 * 标签选择器
 */
export const TagSelector: React.FC<TagSelectorProps> = ({
  selectedIds,
  onChange,
  showRemove = false,
  readonly = false,
  allowedCategories = [],
  className = '',
}) => {
  const [tags, setTags] = useState<TagDefinition[]>([])
  const [categories, setCategories] = useState<TagCategoryInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<TagCategory | 'all'>('all')
  const [search, setSearch] = useState('')

  // 加载标签
  React.useEffect(() => {
    async function loadTags() {
      try {
        setLoading(true)
        const response = await request('/api/tags')
        const normalized = normalizeTagListResponse(response)
        setTags(normalized.items)
        setCategories(normalized.categories)
      } catch (error) {
        console.error('Failed to load tags:', error)
      } finally {
        setLoading(false)
      }
    }
    loadTags()
  }, [])

  // 过滤标签
  const filteredTags = useMemo(() => {
    let result = tags

    // 分类过滤
    if (activeCategory !== 'all') {
      result = result.filter(t => t.category === activeCategory)
    }

    // 分类限制
    if (allowedCategories.length > 0) {
      result = result.filter(t => allowedCategories.includes(t.category))
    }

    // 搜索过滤
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(
        t => t.name.toLowerCase().includes(searchLower) ||
             t.description?.toLowerCase().includes(searchLower)
      )
    }

    // 只显示激活的标签
    result = result.filter(t => t.isActive !== false)

    return result
  }, [tags, activeCategory, allowedCategories, search])

  // 按分类分组
  const groupedTags = useMemo(() => {
    const groups: Record<string, TagDefinition[]> = {}

    filteredTags.forEach(tag => {
      if (!groups[tag.category]) {
        groups[tag.category] = []
      }
      groups[tag.category].push(tag)
    })

    return groups
  }, [filteredTags])

  // 切换标签选中状态
  const toggleTag = useCallback((tagId: string) => {
    if (readonly) return

    const newSelected = selectedIds.includes(tagId)
      ? selectedIds.filter(id => id !== tagId)
      : [...selectedIds, tagId]

    onChange(newSelected)
  }, [selectedIds, onChange, readonly])

  // 移除标签
  const removeTag = useCallback((tagId: string) => {
    if (readonly) return
    onChange(selectedIds.filter(id => id !== tagId))
  }, [selectedIds, onChange, readonly])

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        <span className="text-xs text-muted-foreground">加载标签...</span>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 搜索框 */}
      <div className="relative">
        <input
          type="text"
          aria-label="搜索标签"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索标签..."
          className="w-full px-4 py-2 pl-10 bg-zinc-50 border border-zinc-200 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
        <GeometricLantern
          variant="spark"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
        />
      </div>

      {/* 分类标签页 */}
      <div className="flex flex-wrap gap-1 border-b border-zinc-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`${categoryTabClass} ${activeCategory === 'all' ? 'border-accent text-accent' : 'text-zinc-500'}`}
        >
          全部
        </button>
        {categories.map(cat => (
          <button
            key={cat.category}
            type="button"
            onClick={() => setActiveCategory(cat.category)}
            className={`${categoryTabClass} ${activeCategory === cat.category ? 'border-accent text-accent' : 'text-zinc-500'}`}
          >
            {cat.name}
            <span className="ml-1 text-[9px] text-zinc-400">({cat.count})</span>
          </button>
        ))}
      </div>

      {/* 标签列表 */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(groupedTags).map(([category, categoryTags]) => (
          <div key={category} className="w-full">
            {activeCategory === 'all' && (
              <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2 italic">
                {categories.find(c => c.category === category)?.name || category}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mb-3">
              {categoryTags.map(tag => (
                <TagChip
                  key={tag.id}
                  tag={tag}
                  selected={selectedIds.includes(tag.id)}
                  onClick={readonly ? undefined : () => toggleTag(tag.id)}
                  showRemove={showRemove && selectedIds.includes(tag.id)}
                  onRemove={() => removeTag(tag.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 空状态 */}
      {filteredTags.length === 0 && (
        <div className="text-center py-8 text-zinc-400">
          <TagIcon />
          <p className="text-sm mt-2">没有找到匹配的标签</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 用户标签管理组件
// ============================================================

interface UserTagManagerProps {
  userId: string
  readonly?: boolean
  onTagsChange?: (tags: UserTag[]) => void
}

/**
 * 用户标签管理组件
 */
export const UserTagManager: React.FC<UserTagManagerProps> = ({
  userId,
  readonly = false,
  onTagsChange,
}) => {
  const [stats, setStats] = useState<{
    byCategory: Record<string, number>
    manualCount: number
    autoCount: number
    totalCount: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // 加载用户标签
  React.useEffect(() => {
    async function loadUserTags() {
      try {
        setLoading(true)
        const response = await request(`/api/tags/users/${userId}`)
        const normalized = normalizeUserTagResponse(response)
        setStats(normalized.stats)
        setSelectedIds(normalized.tags.map((tag) => tag.tag.id))
        onTagsChange?.(normalized.tags)
      } catch (error) {
        console.error('Failed to load user tags:', error)
      } finally {
        setLoading(false)
      }
    }
    loadUserTags()
  }, [userId, onTagsChange])

  // 保存标签
  const saveTags = useCallback(async (tagIds: string[]) => {
    try {
      await request(`/api/tags/users/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds }),
      })
      toast({ title: '标签已保存' })
    } catch (error) {
      toast({ variant: 'destructive', title: '保存失败' })
    }
  }, [userId])

  // 处理标签变更
  const handleTagsChange = useCallback(async (tagIds: string[]) => {
    setSelectedIds(tagIds)
    await saveTags(tagIds)

    // 重新加载
    const response = await request(`/api/tags/users/${userId}`)
    const normalized = normalizeUserTagResponse(response)
    setStats(normalized.stats)
    onTagsChange?.(normalized.tags)
  }, [userId, saveTags, onTagsChange])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 标签统计 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-zinc-50 rounded-xl">
          <div className="text-center">
            <div className="text-2xl font-black text-accent">{stats.totalCount}</div>
            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 italic">
              总标签
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-green-500">{stats.manualCount}</div>
            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 italic">
              手动
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-blue-500">{stats.autoCount}</div>
            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 italic">
              自动
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-purple-500">
              {Object.keys(stats.byCategory).length}
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-400 italic">
              分类数
            </div>
          </div>
        </div>
      )}

      {/* 标签选择器 */}
      <TagSelector
        selectedIds={selectedIds}
        onChange={handleTagsChange}
        readonly={readonly}
      />
    </div>
  )
}

export default TagSelector
