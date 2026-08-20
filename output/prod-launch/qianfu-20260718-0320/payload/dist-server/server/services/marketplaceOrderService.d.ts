import type { PrismaClient } from '../../prisma/generated/client/index.js';
export interface CreateMarketplaceOrderInput {
    buyerId: number;
    buyerName: string;
    productId: string;
    quantity: number;
    idempotencyKey: string;
}
export declare const createMarketplaceOrder: (db: Pick<PrismaClient, "$transaction">, input: CreateMarketplaceOrderInput) => Promise<{
    order: {
        status: string;
        id: string;
        created_at: Date;
        updated_at: Date;
        payment_id: string | null;
        product_id: string;
        buyer_id: number | null;
        buyer_name: string;
        quantity: number;
        total_price: number;
        payment_status: string;
        fulfillment_status: string;
        dispute_status: string;
        dispute_reason: string | null;
        dispute_description: string | null;
        dispute_resolution: string | null;
        dispute_opened_at: Date | null;
        dispute_resolved_at: Date | null;
        delivery_url: string | null;
    };
    payment: {
        status: string;
        currency: string;
        id: string;
        user_id: number;
        created_at: Date;
        updated_at: Date;
        amount: number;
        plan_id: string;
        payment_method: string;
    };
    product: {
        creator: {
            marketplace_seller_status: string;
        } | null;
    } & {
        id: string;
        created_at: Date;
        updated_at: Date;
        description: string;
        title: string;
        category: string;
        price: number;
        sales: number;
        rating: number;
        review_count: number;
        is_published: boolean;
        listing_status: string;
        moderation_notes: string | null;
        author_name: string;
        cover_url: string | null;
        download_url: string | null;
        creator_id: number | null;
    };
    replayed: boolean;
}>;
//# sourceMappingURL=marketplaceOrderService.d.ts.map