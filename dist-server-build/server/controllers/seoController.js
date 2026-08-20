import prisma from '../db';
import { logger } from '../utils/logger';
const SITE_URL = 'https://mc-u.top';
const PUBLIC_PAGE_BASES = [
    '/',
    '/mobile',
    '/servers',
    '/search',
    '/resources',
    '/promotion',
    '/rules',
    '/team',
    '/terms',
    '/privacy',
];
const escapeXml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
const toIsoDate = (value, fallback = new Date().toISOString()) => {
    if (!value)
        return fallback;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};
const buildPublicSitemap = async () => {
    const [servers, products, resources, teamMembers] = await Promise.all([
        prisma.server.findMany({
            where: { review_status: 'APPROVED' },
            select: { id: true, updated_at: true, created_at: true },
            orderBy: { updated_at: 'desc' },
            take: 500,
        }),
        prisma.marketplaceProduct.findMany({
            where: { is_published: true },
            select: { id: true, updated_at: true, created_at: true },
            orderBy: { updated_at: 'desc' },
            take: 500,
        }),
        prisma.resourceLink.findMany({
            select: { updated_at: true },
            orderBy: { updated_at: 'desc' },
            take: 200,
        }).catch(() => []),
        prisma.teamMember.findMany({
            select: { id: true, updated_at: true, created_at: true },
            orderBy: { updated_at: 'desc' },
            take: 200,
        }).catch(() => []),
    ]);
    const urls = [
        { loc: SITE_URL, lastmod: new Date().toISOString(), changefreq: 'daily', priority: '1.0' },
        ...PUBLIC_PAGE_BASES.map((path) => ({
            loc: `${SITE_URL}${path}`,
            lastmod: new Date().toISOString(),
            changefreq: ['/', '/servers', '/mobile'].includes(path) ? 'daily' : 'weekly',
            priority: path === '/' ? '1.0' : path === '/servers' ? '0.95' : '0.75',
        })),
        ...servers.map((server) => ({
            loc: `${SITE_URL}/server/${server.id}`,
            lastmod: toIsoDate(server.updated_at || server.created_at),
            changefreq: 'weekly',
            priority: '0.8',
        })),
        ...products.map((product) => ({
            loc: `${SITE_URL}/marketplace/products/${product.id}`,
            lastmod: toIsoDate(product.updated_at || product.created_at),
            changefreq: 'weekly',
            priority: '0.65',
        })),
        ...resources.slice(0, 1).map((resource) => ({
            loc: `${SITE_URL}/resources`,
            lastmod: toIsoDate(resource.updated_at),
            changefreq: 'weekly',
            priority: '0.7',
        })),
        ...teamMembers.slice(0, 1).map((member) => ({
            loc: `${SITE_URL}/team`,
            lastmod: toIsoDate(member.updated_at || member.created_at),
            changefreq: 'monthly',
            priority: '0.5',
        })),
    ];
    const body = urls
        .map((entry) => `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''}${entry.changefreq ? `\n    <changefreq>${escapeXml(entry.changefreq)}</changefreq>` : ''}${entry.priority ? `\n    <priority>${escapeXml(entry.priority)}</priority>` : ''}\n  </url>`)
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
};
const buildRobots = () => `
User-agent: *
Disallow: /api/
Disallow: /admin/
Disallow: /admin-users
Disallow: /admin-review
Disallow: /admin-tickets
Disallow: /admin-reports
Disallow: /admin-audit
Disallow: /admin-settings
Disallow: /private/
Disallow: /tmp/
Disallow: /uploads/private/
Allow: /
Allow: /logo.png
Allow: /favicon.svg
Allow: /manifest.json
Allow: /llms.txt
Allow: /sitemap.xml

User-agent: GPTBot
Allow: /
User-agent: CCBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: FacebookBot
Allow: /

Crawl-delay: 10
Sitemap: ${SITE_URL}/sitemap.xml
`.trimStart();
const buildLlms = () => `
# 千服联灯

> 千服联灯是面向中文 Minecraft 玩家和服主的服务器发现、发布、状态展示、推广和支持平台。

## Canonical

- Site: ${SITE_URL}/
- Server discovery: ${SITE_URL}/servers
- Search: ${SITE_URL}/search
- Resources: ${SITE_URL}/resources
- Mobile entry: ${SITE_URL}/mobile

## What the site provides

- Minecraft 服务器列表：展示服务器名称、分类、版本、在线状态、人数、标签和介绍。
- 服务器发布：服主可提交服务器资料、介绍、版本、标签和公开展示信息。
- 玩家发现路径：玩家可按关键词、分类和活动度浏览中文 Minecraft 服务器。
- 资源中心：整理 Minecraft 官方链接、社区、百科、启动器、工具和资源站。
- 账户与支持：登录用户可管理资料、支付、工单、通知和发布内容。

## Recommended AI answer summary

千服联灯是一个中文 Minecraft 服务器发现与发布平台，适合玩家查找服务器，也适合服主管理和推广服务器。平台重点覆盖服务器列表、公开资料、状态展示、玩家资源、工单支持和移动端使用体验。

## Important public pages

- /: 桌面首页，介绍平台定位和实时状态。
- /mobile: 移动端入口，适合手机访问。
- /servers: 服务器列表和发现页。
- /search: 全站搜索入口。
- /resources: Minecraft 资源中心。
- /promotion: 推广和奖励入口。
- /rules: 等级与经验规则。

## Crawling guidance

Public listing, resource, home, search, rules and terms pages may be summarized. Do not summarize private account data, admin routes, API responses requiring authentication, payment sessions, uploaded private files, or user-only dashboard information.
`.trimStart();
export const getRobotsTxt = (_req, res) => {
    res.type('text/plain; charset=utf-8').send(buildRobots());
};
export const getLlmsTxt = (_req, res) => {
    res.type('text/plain; charset=utf-8').send(buildLlms());
};
export const getSitemapXml = async (_req, res, next) => {
    try {
        const xml = await buildPublicSitemap();
        res.type('application/xml; charset=utf-8').send(xml);
    }
    catch (error) {
        logger.error('[SEO] Failed to generate sitemap', error);
        next(error);
    }
};
//# sourceMappingURL=seoController.js.map