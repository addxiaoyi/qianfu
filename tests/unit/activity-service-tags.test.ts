import { describe, expect, it } from 'vitest';

import {
  isBedrockServer,
  wasOnlineAtLastProbe,
} from '../../server/services/activityService';

describe('activity service tag handling', () => {
  it('detects Bedrock from structured tags without assuming a string field', () => {
    expect(isBedrockServer([{ label: '生存' }, { name: 'Bedrock' }])).toBe(true);
    expect(isBedrockServer({ tag: '基岩版' })).toBe(true);
    expect(isBedrockServer(['Java', '生存'])).toBe(false);
  });

  it('uses the persisted server status for the stability bonus', () => {
    expect(wasOnlineAtLastProbe({ online: true })).toBe(true);
    expect(wasOnlineAtLastProbe({ online: false })).toBe(false);
    expect(wasOnlineAtLastProbe(null)).toBe(false);
  });
});
