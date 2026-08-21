import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbItem {
  name: string
  href?: string
  /** 是否为当前页（不可点击） */
  isCurrent?: boolean
  /** 自定义图标 */
  icon?: React.ComponentType<{ className?: string }>
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[]
  /** 是否显示首页链接 */
  showHome?: boolean
  /** 自定义首页文本 */
  homeText?: string
  /** 自定义首页链接 */
  homeHref?: string
  /** 自定义分隔符 */
  separator?: React.ReactNode
  /** 样式变体 */
  variant?: 'default' | 'compact' | 'expanded'
  /** 是否显示 Ref ID（如服务器 ID） */
  refId?: string
  /** Ref ID 标签 */
  refLabel?: string
  className?: string
}

/**
 * Breadcrumb - 面包屑导航组件
 *
 * @example
 * // 自动根据路径生成
 * <Breadcrumb />
 *
 * @example
 * // 自定义项目
 * <Breadcrumb
 *   items={[
 *     { name: '首页', href: '/' },
 *     { name: '服务器', href: '/servers' },
 *     { name: '详情', isCurrent: true }
 *   ]}
 * />
 */
const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  showHome = true,
  homeText = '首页',
  homeHref = '/',
  separator = <ChevronRight className="w-3 h-3 text-zinc-300" />,
  variant = 'default',
  refId,
  refLabel = 'REF',
  className = '',
}) => {
  const location = useLocation()

  // 如果没有提供 items，自动从路径生成
  const breadcrumbItems: BreadcrumbItem[] = React.useMemo(() => {
    if (items) return items

    const pathSegments = location.pathname.split('/').filter(Boolean)
    const generated: BreadcrumbItem[] = []

    if (showHome) {
      generated.push({
        name: homeText,
        href: homeHref,
        icon: Home,
      })
    }

    // 路径片段映射
    const pathLabels: Record<string, string> = {
      servers: '服务器列表',
      server: '服务器',
      search: '搜索',
      resources: '资源中心',
      rules: '等级规则',
      team: '团队',
      terms: '服务条款',
      privacy: '隐私声明',
      'acceptable-use': '可接受使用政策',
      compliance: '合规与信息服务规则',
      'minor-protection': '未成年人保护规则',
      'cookies-and-services': 'Cookie 与第三方服务',
      'prohibited-items': '平台禁止内容清单',
      'ip-complaints': '知识产权投诉规则',
      'reporting-rules': '举报与内容处置规则',
      login: '登录',
      register: '注册',
      dashboard: '控制台',
      me: '个人中心',
      messages: '消息',
      tickets: '工单',
      editor: '编辑器',
      admin: '管理后台',
      user: '用户',
    }

    let currentPath = ''
    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i]
      currentPath += `/${segment}`

      // 检查是否为动态路由参数（如服务器 ID、用户 ID）
      const isDynamicSegment = /^[a-zA-Z0-9_-]+$/.test(segment) && segment.length > 8

      if (isDynamicSegment) {
        // 动态路由片段 - 显示为 Ref 并标记为当前页
        generated.push({
          name: segment,
          isCurrent: i === pathSegments.length - 1,
        })
      } else {
        const label = pathLabels[segment] || segment
        generated.push({
          name: label,
          href: currentPath,
          isCurrent: i === pathSegments.length - 1,
        })
      }
    }

    return generated
  }, [items, showHome, homeText, homeHref, location.pathname])

  // 样式变体
  const variantStyles = {
    default: 'text-[10px]',
    compact: 'text-[9px]',
    expanded: 'text-xs',
  }

  return (
    <nav aria-label="面包屑导航" className={`${className}`}>
      <ol
        className={`flex items-center gap-2 flex-wrap ${variantStyles[variant]}`}
      >
        {breadcrumbItems.map((item, index) => {
          const isFirst = index === 0

          // 获取图标组件
          const IconComponent = item.icon

          return (
            <li key={`${item.name}-${index}`} className="flex items-center gap-2">
              {/* 可点击的链接项 */}
              {item.href && !item.isCurrent && (
                <>
                  {!isFirst && <span className="text-zinc-200">{separator}</span>}
                  <Link
                    to={item.href}
                    className="flex items-center gap-1.5 text-zinc-400 hover:text-black transition-all group"
                  >
                    {IconComponent && (
                      <IconComponent className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
                    )}
                    <span className="font-black uppercase tracking-widest italic group-hover:-translate-x-0.5 transition-transform">
                      {item.name}
                    </span>
                  </Link>
                </>
              )}

              {/* 首页链接 */}
              {isFirst && showHome && item.href && (
                <Link
                  to={item.href}
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-black transition-all group"
                >
                  {IconComponent ? (
                    <IconComponent className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
                  ) : (
                    <Home className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
                  )}
                  <span className="font-black uppercase tracking-widest italic">
                    {item.name}
                  </span>
                </Link>
              )}

              {/* 当前页（不可点击） */}
              {item.isCurrent && !item.href && (
                <>
                  {!isFirst && <span className="text-zinc-200">{separator}</span>}
                  <span className="font-black uppercase tracking-widest italic text-black truncate max-w-[200px]">
                    {item.name}
                  </span>
                </>
              )}
            </li>
          )
        })}

        {/* Ref ID 标识 */}
        {refId && (
          <li className="ml-4 flex items-center">
            <span className="text-[9px] font-black uppercase tracking-[0.4em] italic text-zinc-200">
              {refLabel}:
            </span>
            <span className="ml-2 px-2 py-0.5 bg-zinc-100 text-[9px] font-mono font-black uppercase tracking-wider text-zinc-500 rounded">
              {refId.toUpperCase()}
            </span>
          </li>
        )}
      </ol>
    </nav>
  )
}

export default Breadcrumb
