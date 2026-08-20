import { describe, expect, it } from 'vitest';
import {
  reviewMarketplaceAppeal,
  submitMarketplaceAppeal,
} from '../../server/services/marketplaceAppealService';

function fakeDb(input: {
  users?: any[];
  products?: any[];
  appeals?: any[];
} = {}) {
  const users = input.users || [];
  const products = input.products || [];
  const appeals = input.appeals || [];
  const notifications: any[] = [];
  const db: any = {
    user: {
      findUnique: async ({ where }: any) => users.find((item) => item.id === where.id) || null,
      updateMany: async ({ where, data }: any) => {
        const user = users.find((item) => item.id === where.id && item.marketplace_seller_status === where.marketplace_seller_status);
        if (!user) return { count: 0 };
        Object.assign(user, data);
        return { count: 1 };
      },
    },
    marketplaceProduct: {
      findUnique: async ({ where }: any) => products.find((item) => item.id === where.id) || null,
      updateMany: async ({ where, data }: any) => {
        const product = products.find((item) => item.id === where.id && item.creator_id === where.creator_id && where.listing_status.in.includes(item.listing_status));
        if (!product) return { count: 0 };
        Object.assign(product, data);
        return { count: 1 };
      },
    },
    marketplaceAppeal: {
      findFirst: async ({ where }: any) => appeals.find((item) => item.appellant_id === where.appellant_id && item.target_type === where.target_type && item.target_id === where.target_id && item.status === where.status) || null,
      findUnique: async ({ where }: any) => appeals.find((item) => item.id === where.id) || null,
      create: async ({ data }: any) => {
        const row = { submitted_at: new Date(), updated_at: new Date(), ...data };
        appeals.push(row);
        return { ...row };
      },
      update: async ({ where, data }: any) => {
        const row = appeals.find((item) => item.id === where.id);
        if (!row) throw new Error('missing appeal');
        Object.assign(row, data);
        return { ...row };
      },
      findMany: async () => appeals,
    },
    notification: { create: async ({ data }: any) => { notifications.push(data); return data; } },
    $transaction: async (callback: any) => callback(db),
    state: { users, products, appeals, notifications },
  };
  return db;
}

describe('marketplace appeal workflow', () => {
  it('allows a suspended seller to submit one pending appeal', async () => {
    const db = fakeDb({ users: [{ id: 3, marketplace_seller_status: 'SUSPENDED' }] });
    const appeal = await submitMarketplaceAppeal(3, { targetType: 'SELLER', reason: 'Please review again' }, db);
    expect(appeal).toMatchObject({ appellant_id: 3, target_type: 'SELLER', target_id: '3', status: 'PENDING' });
    await expect(submitMarketplaceAppeal(3, { targetType: 'SELLER', reason: 'Duplicate' }, db)).rejects.toThrow('pending appeal');
  });

  it('rejects seller appeals when the seller is active', async () => {
    const db = fakeDb({ users: [{ id: 3, marketplace_seller_status: 'ACTIVE' }] });
    await expect(submitMarketplaceAppeal(3, { targetType: 'SELLER', reason: 'No action' }, db)).rejects.toThrow('Only suspended sellers');
  });

  it('enforces product ownership and moderation state', async () => {
    const db = fakeDb({ products: [{ id: 'p1', creator_id: 7, listing_status: 'REJECTED' }] });
    await expect(submitMarketplaceAppeal(8, { targetType: 'PRODUCT', targetId: 'p1', reason: 'Mine' }, db)).rejects.toThrow('Only the product owner');
    const appeal = await submitMarketplaceAppeal(7, { targetType: 'PRODUCT', targetId: 'p1', reason: 'Reconsider' }, db);
    expect(appeal.target_id).toBe('p1');
  });

  it('approves a seller appeal by restoring seller eligibility', async () => {
    const appeal = { id: 'a1', appellant_id: 3, target_type: 'SELLER', target_id: '3', status: 'PENDING' };
    const db = fakeDb({ users: [{ id: 3, marketplace_seller_status: 'SUSPENDED' }], appeals: [appeal] });
    const reviewed = await reviewMarketplaceAppeal('a1', 99, { decision: 'APPROVED', note: 'Restored after review' }, db);
    expect(reviewed.status).toBe('APPROVED');
    expect(db.state.users[0].marketplace_seller_status).toBe('ACTIVE');
    expect(db.state.notifications).toHaveLength(1);
  });

  it('requeues an approved product appeal instead of publishing directly', async () => {
    const appeal = { id: 'a2', appellant_id: 7, target_type: 'PRODUCT', target_id: 'p1', status: 'PENDING' };
    const product = { id: 'p1', creator_id: 7, listing_status: 'REJECTED', is_published: false };
    const db = fakeDb({ products: [product], appeals: [appeal] });
    await reviewMarketplaceAppeal('a2', 99, { decision: 'APPROVED', note: 'Re-review required' }, db);
    expect(product.listing_status).toBe('PENDING_REVIEW');
    expect(product.is_published).toBe(false);
  });
});
