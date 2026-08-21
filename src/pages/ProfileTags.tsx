/**
 * 用户画像标签管理页面
 * 优化项 308: 用户画像 - 标签体系
 */
import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { useT } from '@/store/uiStore'
import { toast } from '@/hooks/use-toast'
import GeometricLantern from '@/components/ui/GeometricLantern'
import { UserTagManager } from '@/components/tags/TagSelector'
import { useAuthStore } from '@/store/authStore'

// 样式常量
const sectionTitleClass = 'text-xs font-black font-mono uppercase tracking-[0.4em] text-muted-foreground flex items-center gap-4 italic'

/**
 * 用户画像标签管理页面
 */
const ProfileTags: React.FC = () => {
  const t = useT()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [activeTab, setActiveTab] = useState<'tags' | 'categories'>('tags')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // 刷新用户标签数据
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      setRefreshKey((key) => key + 1)
      toast({ title: '数据已刷新' })
    } finally {
      setRefreshing(false)
    }
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-6 py-24 selection:bg-accent selection:text-white">
      <header className="mb-20">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="返回上一页"
          className="w-10 h-10 border border-zinc-200 rounded-xl flex items-center justify-center hover:bg-black hover:text-white hover:border-black transition-all group mb-8"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </button>
        <div className="mb-3 inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.32em] text-zinc-500">
          User Profile / Tags
        </div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none mb-4">
          {t('profile.tags.title')}
        </h1>
        <p className="text-sm sm:text-base text-zinc-500 max-w-xl leading-7">
          管理和自定义您的用户标签，构建精准的用户画像
        </p>
      </header>

      {/* 标签页切换 */}
      <div className="flex items-center gap-4 mb-10 border-b border-zinc-200">
        <button
          type="button"
          onClick={() => setActiveTab('tags')}
          className={`pb-3 px-2 text-[11px] font-black uppercase tracking-[0.28em] transition-all ${
            activeTab === 'tags'
              ? 'border-b-2 border-accent text-accent'
              : 'text-zinc-400 hover:text-zinc-600'
          }`}
        >
          <GeometricLantern variant="tag" className="w-4 h-4 inline mr-2" />
          我的标签
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`pb-3 px-2 text-[11px] font-black uppercase tracking-[0.28em] transition-all ${
            activeTab === 'categories'
              ? 'border-b-2 border-accent text-accent'
              : 'text-zinc-400 hover:text-zinc-600'
          }`}
        >
          <GeometricLantern variant="network" className="w-4 h-4 inline mr-2" />
          标签分类
        </button>
      </div>

      <div className="space-y-16">
        {activeTab === 'tags' && (
          <section className="matrix-card">
            <div className="flex items-center justify-between mb-8">
              <h2 className={sectionTitleClass}>
                <GeometricLantern variant="activity" className="w-5 h-5 text-accent" />
                标签管理
              </h2>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label="刷新标签数据"
                className="p-2 text-zinc-400 hover:text-accent transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {user ? (
              <UserTagManager key={refreshKey} userId={user.id} />
            ) : (
              <div className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
                无法读取当前会话，请重新登录后再试。
              </div>
            )}
          </section>
        )}

        {activeTab === 'categories' && (
          <section className="matrix-card">
            <div className="mb-8">
              <h2 className={sectionTitleClass}>
                <GeometricLantern variant="network" className="w-5 h-5 text-accent" />
                标签分类说明
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 基础属性 */}
              <CategoryCard
                category="basic"
                title="基础属性"
                description="用户的基本属性标签，包括认证状态、会员等级等"
                icon="user"
                color="#22c55e"
              />

              {/* 行为特征 */}
              <CategoryCard
                category="behavior"
                title="行为特征"
                description="基于用户活跃度和行为模式的标签"
                icon="activity"
                color="#10b981"
              />

              {/* 兴趣偏好 */}
              <CategoryCard
                category="interest"
                title="兴趣偏好"
                description="用户的游戏类型和玩法偏好"
                icon="heart"
                color="#ec4899"
              />

              {/* 消费能力 */}
              <CategoryCard
                category="consumption"
                title="消费能力"
                description="用户的消费水平和会员等级"
                icon="credit-card"
                color="#eab308"
              />

              {/* 社交属性 */}
              <CategoryCard
                category="social"
                title="社交属性"
                description="用户的社交关系和影响力"
                icon="users"
                color="#8b5cf6"
              />

              {/* 自定义标签 */}
              <CategoryCard
                category="custom"
                title="自定义标签"
                description="用户可以自行添加的个性化标签"
                icon="tag"
                color="#06b6d4"
              />
            </div>
          </section>
        )}

        {/* 标签使用指南 */}
        <section className="matrix-card">
          <div className="mb-8">
            <h2 className={sectionTitleClass}>
              <GeometricLantern variant="settings" className="w-5 h-5 text-accent" />
              标签使用指南
            </h2>
          </div>

          <div className="space-y-4 text-sm text-zinc-600">
            <div className="flex gap-4">
              <div className="w-6 h-6 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-black text-accent">1</span>
              </div>
              <p>点击标签即可添加或移除您的用户画像标签</p>
            </div>

            <div className="flex gap-4">
              <div className="w-6 h-6 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-black text-accent">2</span>
              </div>
              <p>系统标签不可删除，自动标签由系统根据行为自动分配</p>
            </div>

            <div className="flex gap-4">
              <div className="w-6 h-6 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-black text-accent">3</span>
              </div>
              <p>丰富的标签有助于获得更个性化的推荐和服务</p>
            </div>

            <div className="flex gap-4">
              <div className="w-6 h-6 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-black text-accent">4</span>
              </div>
              <p>管理员可以查看和管理所有用户的标签</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

// ============================================================
// 子组件
// ============================================================

interface CategoryCardProps {
  category: string
  title: string
  description: string
  icon: string
  color: string
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  title,
  description,
  icon,
  color,
}) => {
  return (
    <div data-category={category} className="p-6 bg-zinc-50 rounded-xl hover:bg-zinc-100 transition-colors group">
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}15` }}
        >
          <GeometricLantern
            variant={icon as 'user' | 'activity' | 'heart' | 'credit-card' | 'users' | 'tag'}
            className="w-6 h-6"
            style={{ color }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black mb-1">{title}</h3>
          <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  )
}

export default ProfileTags
