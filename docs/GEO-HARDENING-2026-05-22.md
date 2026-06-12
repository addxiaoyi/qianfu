# GEO hardening - 2026-05-22

## Scope

Strengthened public search and generative engine optimization for the QianFu Liandeng frontend.

## Changes

- Added complete static metadata in `qianfu-liandeng/index.html`:
  - Chinese `lang`
  - canonical URL
  - description, keywords, robots
  - Open Graph and Twitter card metadata
  - WebSite and Organization JSON-LD
- Updated `qianfu-liandeng/public/robots.txt`:
  - Allows public pages and AI answer engines
  - Blocks API, admin and private upload paths
  - Points sitemap to `https://mc-u.top/sitemap.xml`
- Added public machine-readable discovery files:
  - `qianfu-liandeng/public/sitemap.xml`
  - `qianfu-liandeng/public/llms.txt`
  - `qianfu-liandeng/public/ai-plugin.json`
- Added route-level SEO in `qianfu-liandeng/src/components/SeoHead.tsx`.
- Added content-level SEO in `qianfu-liandeng/src/components/PageSeo.tsx`.
- Connected dynamic SEO for:
  - `src/pages/ServerDetail.tsx`
  - `src/pages/MarketplaceDetail.tsx`
  - `src/pages/UserPublicProfile.tsx`
- Added visible semantic summary sections on:
  - `src/pages/Home.tsx`
  - `src/pages/ServerList.tsx`
  - `src/pages/ResourceCenter.tsx`

## Validation

- `npm run build` passed in `qianfu-liandeng`.

## Remaining Higher-Impact Work

- Current app uses `HashRouter`. Static metadata is improved, but crawlers still see an SPA shell before JavaScript runs. The next major step for stronger indexing is moving public routes to real URLs via `BrowserRouter`, prerendering, SSR, or generated static landing/detail pages.
- Sitemap currently lists stable public routes. Server detail pages should be added dynamically when there is a production source of approved public server IDs.
