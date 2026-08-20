import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const routes = read('server/routes/promo.ts');
const claimService = read('server/services/promoClaimService.ts');
const metricService = read('server/services/promoMetricSettlementService.ts');
const controller = read('server/controllers/promoController.ts');
const userPage = read('qianfu-liandeng/src/pages/PromotionLanding.tsx');
const adminCreate = read('qianfu-liandeng/src/pages/admin/AdminPromoCreate.tsx');
const adminClaims = read('qianfu-liandeng/src/pages/admin/AdminPromoClaims.tsx');

describe('promotion popular-video tier flow contract', () => {
  it('exposes owner progress and CSRF-protected admin metric routes', () => {
    expect(routes).toContain("router.get('/claims/:id/progress', getPromoClaimProgress)");
    expect(routes).toContain("router.post('/claims/:id/metrics', adminOnly, csrfProtection, recordPromoClaimMetrics)");
  });

  it('requires a verified platform owner and binds a unique platform video', () => {
    expect(claimService).toContain("binding_status: 'VERIFIED'");
    expect(claimService).toContain('parsePromoVideoUrl(task.platform, submittedVideoUrl)');
    expect(claimService).toContain('platform_video_id: videoReference?.videoId ?? null');
    expect(claimService).toContain('This video has already been submitted for the task');
  });

  it('separates content approval from tier reward settlement', () => {
    expect(controller).toContain("rewardPolicy.mode === 'POPULAR_VIDEO_TIERED'");
    expect(controller).toContain("claim_status: 'VERIFIED'");
    expect(controller).toContain("settlement_status: 'MONITORING'");
    expect(controller).toContain('Video approved and entered metric monitoring');
  });

  it('pays only the new cumulative tier difference with concurrency guards', () => {
    expect(metricService).toContain('Math.max(0, targetAmount - previousTotal)');
    expect(metricService).toContain('claim_id_tier_key');
    expect(metricService).toContain('total_rewarded_amount: previousTotal');
    expect(metricService).toContain("ref_type: 'promo_reward_settlement'");
    expect(metricService).toContain("isolationLevel: 'Serializable'");
  });

  it('connects video submission, progress, tier editing, and metric entry in the UI', () => {
    expect(userPage).toContain('videoUrl: proofUrl.trim()');
    expect(userPage).toContain('promotionApi.getClaimProgress');
    expect(userPage).toContain('达到更高档位时只补发差额');
    expect(adminCreate).toContain('POPULAR_VIDEO_TIERED');
    expect(adminCreate).toContain('新增收益档位');
    expect(adminClaims).toContain('promotionApi.recordMetrics');
  });
});
