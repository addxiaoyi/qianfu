import type { PrismaClient } from '../../prisma/generated/client/index.js';

import {
  buildMarketplaceEvidenceId,
  hashDeliveryReference,
  hmacEvidenceValue,
  stableJsonStringify,
} from './marketplaceEvidenceService';
import { AppError, ErrorCode } from '../utils/errors';

export interface IssueMarketplaceDownloadInput {
  orderId: string;
  buyerId: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export const issueMarketplaceDownload = async (
  db: Pick<PrismaClient, '$transaction'>,
  input: IssueMarketplaceDownloadInput,
) => db.$transaction(async (tx) => {
  const order = await tx.marketplaceOrder.findUnique({
    where: { id: input.orderId },
    include: {
      product: true,
      evidence: {
        include: {
          product_version: true,
        },
      },
    },
  });
  if (!order) {
    throw new AppError('Order not found', 404, ErrorCode.NOT_FOUND);
  }
  if (order.buyer_id !== input.buyerId) {
    throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
  }
  if (order.payment_status !== 'PAID') {
    throw new AppError('Order payment is not complete', 409, ErrorCode.CONFLICT);
  }
  if (order.fulfillment_status !== 'DELIVERED') {
    throw new AppError('Order is not ready for download', 409, ErrorCode.CONFLICT);
  }

  const version = order.evidence?.product_version ?? null;
  const downloadUrl = version?.download_url || order.delivery_url || order.product.download_url;
  if (!downloadUrl) {
    throw new AppError('Download resource is unavailable', 409, ErrorCode.CONFLICT);
  }

  const occurredAt = new Date();
  await tx.marketplaceDeliveryEvidence.create({
    data: {
      id: buildMarketplaceEvidenceId('mde', `${order.id}:${occurredAt.toISOString()}`),
      order_id: order.id,
      product_version_id: version?.id ?? null,
      event_type: 'DOWNLOAD_ISSUED',
      delivery_ref: hashDeliveryReference(downloadUrl),
      ip_hmac: hmacEvidenceValue('marketplace-download-ip', input.ipAddress),
      user_agent_hmac: hmacEvidenceValue('marketplace-download-user-agent', input.userAgent),
      metadata_json: stableJsonStringify({
        productVersion: version?.version ?? order.product.product_version,
        fileSha256: version?.file_sha256 ?? order.product.file_sha256,
        assetSize: version?.asset_size ?? order.product.asset_size,
        assetMime: version?.asset_mime ?? order.product.asset_mime,
        source: version ? 'ORDER_PRODUCT_VERSION' : 'LEGACY_ORDER_FALLBACK',
      }),
      occurred_at: occurredAt,
    },
  });

  return {
    downloadUrl,
    file: {
      version: version?.version ?? order.product.product_version,
      sha256: version?.file_sha256 ?? order.product.file_sha256,
      size: version?.asset_size ?? order.product.asset_size,
      mime: version?.asset_mime ?? order.product.asset_mime,
    },
  };
}, { isolationLevel: 'Serializable' });
