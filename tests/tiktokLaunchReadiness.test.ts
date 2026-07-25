import { describe, expect, it } from 'vitest';
import { checkTikTokLaunchReadiness } from '../src/tools/checkTikTokLaunchReadiness.js';

describe('checkTikTokLaunchReadiness', () => {
  it('is not ready when required base fields are missing', () => {
    const result = checkTikTokLaunchReadiness({ objectiveType: 'REACH', writesEnabled: true });
    expect(result.ready).toBe(false);
    expect(result.missing).toContain('advertiserId');
    expect(result.missing).toContain('campaignName');
  });

  it('is ready for REACH once all base fields are supplied and writes are enabled', () => {
    const result = checkTikTokLaunchReadiness({
      objectiveType: 'REACH',
      advertiserId: 'adv_1',
      campaignName: 'My campaign',
      dailyBudget: 100,
      adgroupName: 'My ad group',
      identityId: 'id_1',
      identityType: 'CUSTOMIZED_USER',
      videoId: 'v_1',
      landingPageUrl: 'https://example.com',
      callToAction: 'LEARN_MORE',
      writesEnabled: true,
    });
    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('flags appId and promotionType as missing for APP_PROMOTION', () => {
    const result = checkTikTokLaunchReadiness({
      objectiveType: 'APP_PROMOTION',
      writesEnabled: true,
    });
    expect(result.missing).toContain('appId');
    expect(result.missing).toContain('promotionType');
  });

  it('warns when writes are not enabled', () => {
    const result = checkTikTokLaunchReadiness({ objectiveType: 'REACH', writesEnabled: false });
    expect(result.warnings.some((w) => w.includes('ADSTREAM_ENABLE_WRITES'))).toBe(true);
    expect(result.ready).toBe(false);
  });

  it('accepts imageId or videoId or imageFilePath or videoFilePath as creativeAsset', () => {
    const result = checkTikTokLaunchReadiness({
      objectiveType: 'REACH',
      advertiserId: 'adv_1',
      campaignName: 'C',
      dailyBudget: 100,
      adgroupName: 'AG',
      identityId: 'id_1',
      identityType: 'CUSTOMIZED_USER',
      imageFilePath: '/tmp/local.jpg',
      landingPageUrl: 'https://example.com',
      callToAction: 'LEARN_MORE',
      writesEnabled: true,
    });
    expect(result.missing).not.toContain('creativeAsset');
  });
});
