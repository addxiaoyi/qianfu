import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

type SeoConfig = {
  title: string;
  description: string;
  path: string;
  robots?: string;
  schema?: Record<string, unknown>;
};

const SITE_NAME = '千服联灯';
const SITE_URL = 'https://mc-u.top';
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;

const SEO_MAP: Record<string, SeoConfig> = {
  '/': {
    title: '千服联灯 - Minecraft 服务器发现与发布平台',
    description: '千服联灯提供 Minecraft 服务器发现、发布、状态展示、推广和支持服务，聚合中文玩家常用入口。',
    path: '/',
  },
  '/mobile': {
    title: '千服联灯移动端 - Minecraft 服务器入口',
    description: '面向手机访问优化的千服联灯移动端入口，适合快速找服、发布、查看消息和进入个人中心。',
    path: '/mobile',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: '千服联灯移动端',
      url: `${SITE_URL}/mobile`,
        description: '手机端入口，适合浏览服务器、消息、工单和个人中心。',
      },
  },
  '/servers': {
    title: '服务器列表 - 千服联灯',
    description: '浏览公开的 Minecraft 服务器列表，按分类、版本、关键词和活跃度发现可加入的中文服务器。',
    path: '/servers',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Minecraft 服务器列表',
      url: `${SITE_URL}/servers`,
        description: '公开服务器列表和搜索入口。',
      },
  },
  '/search': {
    title: '搜索服务器 - 千服联灯',
    description: '搜索 Minecraft 服务器名称、版本、标签和介绍，快速定位目标服源。',
    path: '/search',
  },
  '/resources': {
    title: '资源中心 - 千服联灯',
    description: '整理 Minecraft 官方链接、社区论坛、百科、启动器、工具和玩家市场资源。',
    path: '/resources',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Minecraft 资源中心',
      url: `${SITE_URL}/resources`,
        description: 'Minecraft 玩家资源、工具和店铺聚合页。',
      },
  },
  '/marketplace/shop': {
    title: '玩家市场 - 千服联灯',
    description: '浏览千服联灯的公开玩家店铺、商品与创作者资源。',
    path: '/marketplace/shop',
    robots: 'index,follow',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: '千服联灯玩家市场',
      description: '公开玩家店铺、商品与创作者资源聚合页。',
    },
  },
  '/promotion': {
    title: '推广中心 - 千服联灯',
    description: '查看千服联灯的推广方案、奖励任务和服务器曝光入口。',
    path: '/promotion',
  },
  '/rules': {
    title: '等级与经验规则 - 千服联灯',
    description: '查看千服联灯的等级、经验、解锁项与权限说明。',
    path: '/rules',
  },
  '/team': {
    title: '社区团队 - 千服联灯',
    description: '了解千服联灯的社区协作、维护和支持团队。',
    path: '/team',
  },
  '/terms': {
    title: '服务条款 - 千服联灯',
    description: '查看千服联灯平台服务条款和使用规则。',
    path: '/terms',
    robots: 'index,follow',
  },
  '/privacy': {
    title: '隐私政策 - 千服联灯',
    description: '查看千服联灯隐私政策和数据处理说明。',
    path: '/privacy',
    robots: 'index,follow',
  },
  '/login': {
    title: '登录 - 千服联灯',
    description: '登录千服联灯账户，进入个人中心、工单、支付和服务器管理功能。',
    path: '/login',
    robots: 'noindex,nofollow',
  },
  '/register': {
    title: '注册 - 千服联灯',
    description: '注册千服联灯账户并完成邮箱验证后开始发布和管理内容。',
    path: '/register',
    robots: 'noindex,nofollow',
  },
  '/forgot-password': {
    title: '找回密码 - 千服联灯',
    description: '通过邮箱验证码找回千服联灯账户密码。',
    path: '/forgot-password',
    robots: 'noindex,nofollow',
  },
  '/reset-password': {
    title: '重置密码 - 千服联灯',
    description: '设置新的千服联灯账户密码。',
    path: '/reset-password',
    robots: 'noindex,nofollow',
  },
  '/verify-code': {
    title: '邮箱验证 - 千服联灯',
    description: '输入邮箱验证码，完成千服联灯账户验证。',
    path: '/verify-code',
    robots: 'noindex,nofollow',
  },
  '/dashboard': {
    title: '个人中心 - 千服联灯',
    description: '管理服务器、工单、账单和账户设置。',
    path: '/dashboard',
    robots: 'noindex,nofollow',
  },
  '/me': {
    title: '个人中心 - 千服联灯',
    description: '查看用户资料、签到、通知和账户快捷入口。',
    path: '/me',
    robots: 'noindex,nofollow',
  },
  '/messages': {
    title: '消息中心 - 千服联灯',
    description: '查看系统通知和工单消息，集中处理提醒和支持进度。',
    path: '/messages',
    robots: 'noindex,nofollow',
  },
  '/tickets': {
    title: '工单中心 - 千服联灯',
    description: '创建和跟进工单，查看支持请求和回复记录。',
    path: '/tickets',
    robots: 'noindex,nofollow',
  },
  '/editor': {
    title: '发布服务器 - 千服联灯',
    description: '提交或编辑 Minecraft 服务器资料，填写介绍、版本和标签。',
    path: '/editor',
    robots: 'noindex,nofollow',
  },
  '/payment': {
    title: '支付中心 - 千服联灯',
    description: '进行充值、套餐购买和支付订单管理。',
    path: '/payment',
    robots: 'noindex,nofollow',
  },
};

const PUBLIC_PATHS = new Set(['/', '/mobile', '/servers', '/search', '/resources', '/promotion', '/rules', '/team', '/terms', '/privacy']);

const DYNAMIC_ROUTE_SEO: Array<{
  test: (pathname: string) => boolean;
  title: string;
  description: string;
  robots?: string;
  schema?: Record<string, unknown>;
}> = [
  {
    test: (pathname) => /^\/server\/[^/]+$/.test(pathname),
    title: '服务器详情 - 千服联灯',
    description: '浏览公开 Minecraft 服务器详情、状态、版本、标签和评论。',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Minecraft 服务器详情',
    },
  },
  {
    test: (pathname) => /^\/user\/[^/]+$/.test(pathname),
    title: '公开主页 - 千服联灯',
    description: '查看公开用户主页、简介和发布的服务器内容。',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      mainEntity: {
        '@type': 'Person',
      },
    },
  },
  {
    test: (pathname) => /^\/marketplace\/products\/[^/]+$/.test(pathname),
    title: '玩家商品详情 - 千服联灯',
    description: '浏览公开玩家商品详情、评分、销量和资源说明。',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Product',
    },
  },
  {
    test: (pathname) => /^\/shop\/[^/]+$/.test(pathname),
    title: '玩家店铺 - 千服联灯',
    description: '浏览公开玩家店铺、公告与商品展示页。',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: '玩家店铺',
    },
  },
  {
    test: (pathname) => /^\/dashboard(\/.*)?$/.test(pathname),
    title: '控制台 - 千服联灯',
    description: '管理服务器、工单、账单和账户设置。',
    robots: 'noindex,nofollow',
  },
  {
    test: (pathname) => /^\/me(\/.*)?$/.test(pathname),
    title: '个人中心 - 千服联灯',
    description: '查看用户资料、签到、通知和账户快捷入口。',
    robots: 'noindex,nofollow',
  },
  {
    test: (pathname) => /^\/tickets(\/.*)?$/.test(pathname),
    title: '工单中心 - 千服联灯',
    description: '创建和跟进工单，查看支持请求和回复记录。',
    robots: 'noindex,nofollow',
  },
  {
    test: (pathname) => /^\/payment(\/.*)?$/.test(pathname),
    title: '支付中心 - 千服联灯',
    description: '进行充值、套餐购买和支付订单管理。',
    robots: 'noindex,nofollow',
  },
  {
    test: (pathname) => /^\/editor(\/.*)?$/.test(pathname),
    title: '发布服务器 - 千服联灯',
    description: '提交或编辑 Minecraft 服务器资料，填写介绍、版本和标签。',
    robots: 'noindex,nofollow',
  },
  {
    test: (pathname) => /^\/admin(?:[-/].*)?$/.test(pathname),
    title: '管理控制台 - 千服联灯',
    description: '查看平台审核、配置、运维和风控后台。',
    robots: 'noindex,nofollow',
  },
  {
    test: (pathname) => /^\/promotion\/(tasks|claims)(\/.*)?$/.test(pathname),
    title: '推广控制台 - 千服联灯',
    description: '管理推广任务、奖励领取和活动审核流转。',
    robots: 'noindex,nofollow',
  },
  {
    test: (pathname) => /^\/seller\/.+$/.test(pathname) || pathname === '/marketplace/manage',
    title: '店铺管理 - 千服联灯',
    description: '维护店铺资料、商品和公开展示内容。',
    robots: 'noindex,nofollow',
  },
];

function upsertMeta(selector: string, key: string, value: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(key, value);
    document.head.appendChild(tag);
    return tag;
  }
  tag.setAttribute(key, value);
  return tag;
}

function setLinkRel(rel: string, href: string) {
  let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
}

function resolveSeoConfig(pathname: string): SeoConfig {
  const exact = SEO_MAP[pathname];
  if (exact) {
    return exact;
  }

  const dynamic = DYNAMIC_ROUTE_SEO.find((item) => item.test(pathname));
  if (dynamic) {
    return {
      title: dynamic.title,
      description: dynamic.description,
      path: pathname,
      robots: dynamic.robots ?? 'index,follow',
      schema: dynamic.schema,
    };
  }

  return {
    title: SITE_NAME,
    description: '千服联灯是面向中文玩家和服主的 Minecraft 服务器发现、发布、状态展示、推广和支持平台。',
    path: pathname,
    robots: PUBLIC_PATHS.has(pathname) ? 'index,follow' : 'noindex,nofollow',
  };
}

const SeoHead: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const config = resolveSeoConfig(location.pathname);

    document.title = config.title;
    const absoluteUrl = `${SITE_URL}${config.path}`;
    const isIndexable = config.robots ? config.robots.startsWith('index') : PUBLIC_PATHS.has(config.path);
    const canonicalUrl = isIndexable ? absoluteUrl : `${SITE_URL}/`;

    upsertMeta('meta[name="description"]', 'name', 'description').content = config.description;
    upsertMeta('meta[name="robots"]', 'name', 'robots').content = config.robots ?? (isIndexable ? 'index,follow' : 'noindex,nofollow');
    upsertMeta('meta[property="og:title"]', 'property', 'og:title').content = config.title;
    upsertMeta('meta[property="og:description"]', 'property', 'og:description').content = config.description;
    upsertMeta('meta[property="og:url"]', 'property', 'og:url').content = absoluteUrl;
    upsertMeta('meta[property="og:image"]', 'property', 'og:image').content = DEFAULT_IMAGE;
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title').content = config.title;
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description').content = config.description;
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image').content = DEFAULT_IMAGE;
    setLinkRel('canonical', canonicalUrl);

    let schemaTag = document.head.querySelector<HTMLScriptElement>('script[data-seo-schema="true"]');
    if (config.schema) {
      if (!schemaTag) {
        schemaTag = document.createElement('script');
        schemaTag.type = 'application/ld+json';
        schemaTag.dataset.seoSchema = 'true';
        document.head.appendChild(schemaTag);
      }
      schemaTag.textContent = JSON.stringify({
        ...config.schema,
        name: config.schema.name ?? SITE_NAME,
        url: absoluteUrl,
        image: DEFAULT_IMAGE,
      });
    } else if (schemaTag) {
      schemaTag.remove();
    }
  }, [location.pathname]);

  return null;
};

export default SeoHead;
