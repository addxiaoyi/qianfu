import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const controller = readFileSync(
  resolve(process.cwd(), 'server/core/controller/QianFuController.ts'),
  'utf8',
);
const shop = readFileSync(
  resolve(process.cwd(), 'qianfu-liandeng/src/pages/MarketplaceShop.tsx'),
  'utf8',
);

describe('marketplace public shop contract', () => {
  it('provides a public creator listing endpoint', () => {
    expect(controller).toContain("router.get('/marketplace/creators/:creatorId/products'");
  });

  it('uses the route id and public creator endpoint instead of private listings', () => {
    expect(shop).toContain('const { id: creatorId } = useParams();');
    expect(shop).toContain('/qianfu/marketplace/creators/${creatorId}/products');
    expect(shop).not.toContain("api.get<{ products: Product[]; total: number }>('/qianfu/marketplace/me/listings')");
  });

  it('loads configuration and metrics for the creator in the route', () => {
    expect(controller).toContain("router.get('/marketplace/shops/:ownerId/config'");
    expect(shop).toContain('`/qianfu/marketplace/shops/${creatorId}/config`');
    expect(shop).toContain('`/qianfu/marketplace/shops/${creatorId}/metrics/click`');
    expect(shop).not.toContain("api.get<{ config: ShopConfig; editable: boolean; metrics: ShopMetrics; versions: ShopVersion[] }>('/qianfu/marketplace/shop/config')");
  });

  it('uses creator-scoped write endpoints for every shop mutation', () => {
    expect(shop).toContain('`/qianfu/marketplace/shops/${creatorId}/config`');
    expect(shop).toContain('`/qianfu/marketplace/shops/${creatorId}/config/reset`');
    expect(shop).toContain('`/qianfu/marketplace/shops/${creatorId}/theme/${theme}`');
  });

  it('shows the merchant badge only for an effective VERIFIED status', () => {
    const badgeAt = shop.indexOf('已认证商家');
    const verifiedGuardAt = shop.lastIndexOf("verification.status === 'VERIFIED'", badgeAt);

    expect(badgeAt).toBeGreaterThan(-1);
    expect(verifiedGuardAt).toBeGreaterThan(-1);
    expect(verifiedGuardAt).toBeLessThan(badgeAt);
  });
});
