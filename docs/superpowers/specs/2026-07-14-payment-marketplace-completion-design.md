# Payment-to-Marketplace Completion Design

## Goal

Make every successful payment path complete its linked marketplace order exactly once: payment status, order payment status, fulfillment state, delivery visibility, product sales, and fulfillment log must agree after a callback or manual completion.

## Decisions

- Monetary database fields use fen. `MarketplaceProduct.price`, `MarketplaceOrder.total_price`, and `Payment.amount` are all fen; marketplace order creation passes `total_price` directly to Payment and never multiplies it again.
- A single transaction helper owns completion side effects. External callbacks and admin manual completion call the helper; event listeners remain for notifications and role upgrades only.
- Only a transition from `Payment.status != COMPLETED` to `COMPLETED` may change marketplace state. Replays return the already completed result without a second wallet transaction, sales increment, or fulfillment log.
- A linked order becomes `payment_status=PAID`; if the product has a download URL it becomes `fulfillment_status=DELIVERED` with `delivery_url`, otherwise `READY` with a null delivery URL. Delivery URLs remain hidden until the order is delivered.
- Product sales increment exactly once by order quantity in the same transaction. A payment with no linked marketplace order follows the existing wallet/plan behavior.
- Expected callback amount is compared against `Payment.amount` in fen before the transaction; mismatch leaves all records unchanged.

## Components

- `server/services/paymentCompletionService.ts`: serializable completion transaction, idempotent payment guard, custom-wallet credit, marketplace order synchronization, sales increment, and fulfillment log.
- `server/controllers/paymentController.ts`: delegate `completeExternalPayment` and `manualCompletePayment` to the service while preserving callback response contracts and audit logging.
- `server/core/controller/QianFuController.ts`: pass `order.totalPrice` directly when creating a Payment.
- `server/services/paymentHandler.ts`: no marketplace mutations; notification behavior remains asynchronous and non-authoritative.

## Verification

- Unit tests prove fen amount propagation and that both completion entry points call the shared service.
- Integration tests create a marketplace order/payment, complete it twice, and assert one paid order, one fulfillment log, one sales increment, visible delivery, and unchanged replay counts.
- Wrong amount and unknown payment tests assert no order, wallet, or sales mutation.
- Existing callback signature/replay tests remain green.
