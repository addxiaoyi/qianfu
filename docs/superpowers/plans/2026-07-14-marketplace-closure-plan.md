# Marketplace Listing And Order Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make product creation, publication, purchase, payment, fulfillment, download, review, favorite, and seller management secure and transactionally complete.

**Architecture:** Replace process-global marketplace arrays as the authority with Prisma queries and transactions. Public reads expose only published products; every mutation requires a verified authenticated user and ownership checks; order visibility is scoped to buyer, seller, or admin.

**Tech Stack:** Express Router, Prisma, MySQL, wallet HMAC transactions, Vitest, Supertest, React Query, Playwright

---

### Task 1: Lock down marketplace routes

**Files:**
- Modify: `server/core/controller/QianFuController.ts`
- Create: `server/core/controller/marketplaceSchemas.ts`
- Create: `tests/integration/marketplace-authorization.test.ts`

- [ ] **Step 1: Write failing authorization tests**

```ts
await expectStatus(guest, 'POST', '/api/v1/qianfu/marketplace/products', 401);
await expectStatus(otherUser, 'PATCH', `/api/v1/qianfu/marketplace/products/${productId}`, 403);
await expectStatus(guest, 'GET', '/api/v1/qianfu/marketplace/orders', 401);
```

- [ ] **Step 2: Replace `authenticateOptional` on mutations**

Require `authenticate`, verified email, CSRF protection, and validated bodies for product create/update/unpublish, order create/fulfill, favorite, review, and shop changes.

- [ ] **Step 3: Scope reads**

Remove the global order-list endpoint or restrict it to admins. Buyer order lists return only the buyer's orders; seller lists return only orders for products owned by that seller.

### Task 2: Move product state to Prisma authority

**Files:**
- Create: `server/services/marketplaceService.ts`
- Modify: `server/core/controller/QianFuController.ts`
- Test: `tests/unit/marketplace-service.test.ts`

- [ ] **Step 1: Add service tests for published filtering and ownership**

- [ ] **Step 2: Implement repository-style service functions**

```ts
export async function getOwnedProduct(productId: string, userId: number) {
  const product = await prisma.marketplaceProduct.findUnique({ where: { id: productId } });
  if (!product) throw new AppError('Product not found', 404, ErrorCode.NOT_FOUND);
  if (product.creator_id !== userId) throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
  return product;
}
```

- [ ] **Step 3: Stop using `marketplaceProducts` and `marketplaceOrders` as request-time authority**

All list/detail/update/order handlers query Prisma. Process restart must not change visible inventory or order state.

### Task 3: Make purchase and wallet deduction atomic

**Files:**
- Modify: `server/services/marketplaceService.ts`
- Modify: `server/lib/wallet.ts`
- Modify: `tests/unit/wallet.test.ts`
- Create: `tests/integration/marketplace-purchase.test.ts`

- [ ] **Step 1: Repair the transaction-client test harness**

Make `mockPrisma.$transaction` invoke its callback with `mockPrisma`:

```ts
mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma));
```

Then assert insufficient withdrawable balance rejects before order creation.

- [ ] **Step 2: Add concurrency tests**

Two purchase requests with the same idempotency key must create one order and one wallet debit. Insufficient balance must create neither.

- [ ] **Step 3: Execute debit, order creation, sales increment, and payment record in one Prisma transaction**

Do not mutate in-memory sales/order arrays before the transaction commits.

### Task 4: Enforce order and fulfillment invariants

**Files:**
- Modify: `server/services/marketplaceService.ts`
- Create: `tests/integration/marketplace-fulfillment.test.ts`

- [ ] **Step 1: Test allowed transitions**

`PENDING -> PAID -> FULFILLED` is allowed. Repeated fulfillment is idempotent. A buyer cannot fulfill; a seller cannot read another seller's order; download is unavailable before payment and fulfillment.

- [ ] **Step 2: Store fulfillment audit logs in the same transaction**

- [ ] **Step 3: Validate download URLs**

Allow only HTTPS URLs or controlled local upload paths; reject credentials, private network URLs, scripts, and `javascript:` schemes.

### Task 5: Complete seller and buyer UI states

**Files:**
- Modify: `qianfu-liandeng/src/pages/MarketplaceEdit.tsx`
- Modify: `qianfu-liandeng/src/pages/MarketplaceManage.tsx`
- Modify: `qianfu-liandeng/src/pages/MarketplaceDetail.tsx`
- Modify: `qianfu-liandeng/src/pages/MarketplaceOrderDetail.tsx`
- Create: `qianfu-liandeng/tests/e2e/marketplace-flow.spec.ts`

- [ ] **Step 1: Validate product form fields and upload failures**

- [ ] **Step 2: Show explicit draft/published/unpublished, pending/paid/fulfilled, empty, loading, and error states**

- [ ] **Step 3: Run seller-to-buyer Playwright flow**

Seller creates and publishes; buyer favorites and purchases; seller fulfills; buyer downloads and reviews; seller sees order and updated sales once.

### Task 6: Run production marketplace smoke

**Files:**
- Extend: `scripts/smoke-wallet-listing-flow.ts`
- Create: `scripts/smoke-marketplace-closure.ts`
- Create: `output/prod-launch/marketplace-closure.json`

- [ ] **Step 1: Verify listing recharge and server publication**

- [ ] **Step 2: Verify marketplace product/order/fulfillment/review flow**

- [ ] **Step 3: Verify unauthorized and cross-owner negative cases**

- [ ] **Step 4: Clean up smoke-created records and fail on any incomplete cleanup**

