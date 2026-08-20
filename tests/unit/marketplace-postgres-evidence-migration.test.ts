import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260804114500_marketplace_evidence_closure/migration.postgresql.sql',
);

describe('PostgreSQL marketplace evidence migration', () => {
  it('adds the listing fields required by the Prisma MarketplaceProduct model', () => {
    const migration = readFileSync(migrationPath, 'utf8');
    const fields = [
      ['currency', "TEXT NOT NULL DEFAULT 'CNY'"],
      ['tax_included', 'BOOLEAN NOT NULL DEFAULT true'],
      ['additional_fees', 'INTEGER NOT NULL DEFAULT 0'],
      ['validity_text', "TEXT NOT NULL DEFAULT '长期有效，具体以商品说明为准'"],
      ['delivery_method', "TEXT NOT NULL DEFAULT '数字下载'"],
      ['delivery_eta', "TEXT NOT NULL DEFAULT '支付确认后自动交付'"],
      ['compatibility', "TEXT NOT NULL DEFAULT '请查看商品描述中的兼容性说明'"],
      ['is_platform_operated', 'BOOLEAN NOT NULL DEFAULT false'],
      ['seller_identity', "TEXT NOT NULL DEFAULT ''"],
      ['after_sales_contact', "TEXT NOT NULL DEFAULT '平台工单'"],
      ['refund_terms', "TEXT NOT NULL DEFAULT '适用平台退款政策'"],
      ['ip_source', "TEXT NOT NULL DEFAULT '卖家声明拥有合法权利或授权'"],
      ['prohibited_use', "TEXT NOT NULL DEFAULT '禁止侵权、转售或违法用途'"],
      ['risk_notice', "TEXT NOT NULL DEFAULT '请在兼容环境中使用并自行备份'"],
      ['product_version', "TEXT NOT NULL DEFAULT '1.0.0'"],
      ['file_sha256', 'TEXT'],
      ['asset_size', 'INTEGER'],
      ['asset_mime', 'TEXT'],
    ] as const;

    for (const [field, definition] of fields) {
      expect(migration).toContain(`ADD COLUMN IF NOT EXISTS "${field}" ${definition}`);
    }
  });
});
