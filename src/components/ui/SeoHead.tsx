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
const SITE_URL = (import.meta.env.VITE_APP_URL || 'https://mc-u.top');
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;

const SEO_MAP: Record<string, SeoConfig> = {
  '/': {
    title: '千服联灯 - Minecraft 服务器发现与发布平台',
    description: '千服联灯提供 Minecraft 服务器发现、免费发布、状态展示和支持服务，聚合中文玩家常用入口。',
    path: '/',
  },
  '/mobile': {
    title: '千服联灯 - Minecraft 服务器发现与发布平台',
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
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: '搜索服务器',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  },
  '/resources': {
    title: '资源中心 - 千服联灯',
    description: '整理 Minecraft 官方链接、社区入口、百科、启动器和玩家工具资源。',
    path: '/resources',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Minecraft 资源中心',
      url: `${SITE_URL}/resources`,
        description: 'Minecraft 玩家资源和工具聚合页。',
      },
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
    title: '隐私声明 - 千服联灯',
    description: '查看千服联灯个人信息收集、使用、共享、保存、安全保护和用户权利说明。',
    path: '/privacy',
    robots: 'index,follow',
  },
  '/acceptable-use': {
    title: '可接受使用政策 - 千服联灯',
    description: '查看千服联灯信息服务边界、禁止内容、禁止行为、审核处置和申诉渠道。',
    path: '/acceptable-use',
    robots: 'index,follow',
  },
  '/compliance': {
    title: '合规与信息服务规则中心 - 千服联灯',
    description: '集中查看信息服务边界、未成年人保护、Cookie、禁止内容、知识产权、举报和审核规则。',
    path: '/compliance',
    robots: 'index,follow',
  },
  '/minor-protection': {
    title: '未成年人保护规则 - 千服联灯',
    description: '查看未成年人注册、消费、内容接触、监护人协助和个人信息保护规则。',
    path: '/minor-protection',
    robots: 'index,follow',
  },
  '/cookies-and-services': {
    title: 'Cookie 与第三方服务清单 - 千服联灯',
    description: '查看平台必要 Cookie、本地存储、第三方服务类别、数据用途和供应商管理要求。',
    path: '/cookies-and-services',
    robots: 'index,follow',
  },
  '/prohibited-items': {
    title: '平台禁止内容清单 - 千服联灯',
    description: '查看不得在平台发布或展示的违法、恶意、侵权和高风险内容。',
    path: '/prohibited-items',
    robots: 'index,follow',
  },
  '/ip-complaints': {
    title: '知识产权投诉规则 - 千服联灯',
    description: '查看知识产权投诉、证据、临时处置、反通知、申诉和重复侵权处理规则。',
    path: '/ip-complaints',
    robots: 'index,follow',
  },
  '/reporting-rules': {
    title: '举报与内容处置规则 - 千服联灯',
    description: '查看举报入口、风险分级、处置措施、通知、申诉和防报复要求。',
    path: '/reporting-rules',
    robots: 'index,follow',
  },
  '/login': {
    title: '登录 - 千服联灯',
    description: '登录千服联灯账户，进入个人中心、工单和服务器管理功能。',
    path: '/login',
    robots: 'noindex,nofollow',
  },
  '/login/oauth': {
    title: '第三方登录 - 千服联灯',
    description: '选择受支持的第三方身份提供商登录千服联灯账户。',
    path: '/login/oauth',
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
    description: '管理服务器、工单和账户设置。',
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
};

const PUBLIC_PATHS = new Set([
  '/', '/mobile', '/servers', '/search', '/resources', '/rules', '/team',
  '/terms', '/privacy', '/acceptable-use', '/compliance', '/minor-protection',
  '/cookies-and-services', '/prohibited-items', '/ip-complaints', '/reporting-rules',
]);

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
    test: (pathname) => /^\/dashboard(\/.*)?$/.test(pathname),
    title: '控制台 - 千服联灯',
    description: '管理服务器、工单和账户设置。',
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
    description: '千服联灯是面向中文玩家和服主的 Minecraft 服务器发现、免费发布、状态展示和支持平台。',
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
