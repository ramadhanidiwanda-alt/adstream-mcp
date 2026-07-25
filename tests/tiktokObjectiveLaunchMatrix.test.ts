import { describe, expect, it } from 'vitest';
import {
  TIKTOK_OBJECTIVES,
  TikTokObjectiveLaunchValidationError,
  resolveTikTokObjectiveLaunchSpec,
  buildTikTokObjectiveFields,
} from '../src/providers/tiktok/objectiveLaunchMatrix.js';

describe('TikTok objective launch matrix', () => {
  it('exposes exactly the eight documented objectives', () => {
    expect(TIKTOK_OBJECTIVES).toEqual([
      'REACH',
      'TRAFFIC',
      'VIDEO_VIEWS',
      'ENGAGEMENT',
      'LEAD_GENERATION',
      'APP_PROMOTION',
      'WEB_CONVERSIONS',
      'PRODUCT_SALES',
    ]);
  });

  it('resolves REACH to a minimal spec with no objective-specific required inputs', () => {
    const spec = resolveTikTokObjectiveLaunchSpec({ objectiveType: 'REACH' });
    expect(spec.key).toBe('reach');
    expect(spec.defaultOptimizationGoal).toBe('REACH');
    expect(spec.requiredInputs).not.toContain('appId');
    expect(spec.requiredInputs).not.toContain('pixelId');
  });

  it('resolves APP_PROMOTION requiring appId and promotionType', () => {
    const spec = resolveTikTokObjectiveLaunchSpec({ objectiveType: 'APP_PROMOTION' });
    expect(spec.key).toBe('app_promotion');
    expect(spec.requiredInputs).toContain('appId');
    expect(spec.requiredInputs).toContain('promotionType');
  });

  it('resolves TRAFFIC with an explicit non-default optimizationGoal', () => {
    const spec = resolveTikTokObjectiveLaunchSpec({
      objectiveType: 'TRAFFIC',
      optimizationGoal: 'LANDING_PAGE_VIEW',
    });
    expect(spec.key).toBe('traffic');
    expect(spec.optimizationGoal).toBe('LANDING_PAGE_VIEW');
  });

  it('resolves VIDEO_VIEWS to its default optimization goal', () => {
    const spec = resolveTikTokObjectiveLaunchSpec({ objectiveType: 'VIDEO_VIEWS' });
    expect(spec.key).toBe('video_views');
    expect(spec.defaultOptimizationGoal).toBe('VIDEO_VIEW');
    expect(spec.optimizationGoal).toBe('VIDEO_VIEW');
  });

  it('resolves ENGAGEMENT to its default optimization goal', () => {
    const spec = resolveTikTokObjectiveLaunchSpec({ objectiveType: 'ENGAGEMENT' });
    expect(spec.key).toBe('engagement');
    expect(spec.defaultOptimizationGoal).toBe('ENGAGED_VIEW');
    expect(spec.optimizationGoal).toBe('ENGAGED_VIEW');
  });

  it('resolves WEB_CONVERSIONS requiring pixelId and optimizationEvent', () => {
    const spec = resolveTikTokObjectiveLaunchSpec({ objectiveType: 'WEB_CONVERSIONS' });
    expect(spec.requiredInputs).toContain('pixelId');
    expect(spec.requiredInputs).toContain('optimizationEvent');
  });

  it('resolves LEAD_GENERATION requiring instantFormPageId', () => {
    const spec = resolveTikTokObjectiveLaunchSpec({ objectiveType: 'LEAD_GENERATION' });
    expect(spec.requiredInputs).toContain('instantFormPageId');
  });

  it('resolves PRODUCT_SALES requiring catalogId and itemGroupIds', () => {
    const spec = resolveTikTokObjectiveLaunchSpec({ objectiveType: 'PRODUCT_SALES' });
    expect(spec.requiredInputs).toContain('catalogId');
    expect(spec.requiredInputs).toContain('itemGroupIds');
  });

  it('throws UNSUPPORTED_OBJECTIVE for an unknown objective', () => {
    expect(() => resolveTikTokObjectiveLaunchSpec({ objectiveType: 'MADE_UP' as never })).toThrow(
      TikTokObjectiveLaunchValidationError
    );
    try {
      resolveTikTokObjectiveLaunchSpec({ objectiveType: 'MADE_UP' as never });
    } catch (error) {
      expect((error as TikTokObjectiveLaunchValidationError).code).toBe('UNSUPPORTED_OBJECTIVE');
    }
  });

  it('rejects an optimizationGoal not allowed for the objective', () => {
    expect(() =>
      resolveTikTokObjectiveLaunchSpec({ objectiveType: 'REACH', optimizationGoal: 'APP_INSTALLS' })
    ).toThrow(TikTokObjectiveLaunchValidationError);
  });

  it('buildTikTokObjectiveFields returns adgroup-level app fields for APP_PROMOTION', () => {
    const spec = resolveTikTokObjectiveLaunchSpec({ objectiveType: 'APP_PROMOTION' });
    const fields = buildTikTokObjectiveFields(spec, {
      appId: 'app_1',
      promotionType: 'APP_INSTALL',
    });
    expect(fields.adgroup).toEqual({ app_id: 'app_1', promotion_type: 'APP_INSTALL' });
  });

  it('buildTikTokObjectiveFields throws MISSING_OBJECTIVE_FIELD when required field absent', () => {
    const spec = resolveTikTokObjectiveLaunchSpec({ objectiveType: 'APP_PROMOTION' });
    expect(() => buildTikTokObjectiveFields(spec, {})).toThrow(
      TikTokObjectiveLaunchValidationError
    );
  });

  it('buildTikTokObjectiveFields returns adgroup-level pixel fields for WEB_CONVERSIONS', () => {
    const spec = resolveTikTokObjectiveLaunchSpec({ objectiveType: 'WEB_CONVERSIONS' });
    const fields = buildTikTokObjectiveFields(spec, {
      pixelId: 'pixel_1',
      optimizationEvent: 'COMPLETE_PAYMENT',
    });
    expect(fields.adgroup).toEqual({ pixel_id: 'pixel_1', optimization_event: 'COMPLETE_PAYMENT' });
  });

  it('buildTikTokObjectiveFields returns creative-level page_id for LEAD_GENERATION', () => {
    const spec = resolveTikTokObjectiveLaunchSpec({ objectiveType: 'LEAD_GENERATION' });
    const fields = buildTikTokObjectiveFields(spec, { instantFormPageId: 'page_1' });
    expect(fields.creative).toEqual({ page_id: 'page_1' });
  });

  it('buildTikTokObjectiveFields returns catalog fields for PRODUCT_SALES, omitting optional store fields', () => {
    const spec = resolveTikTokObjectiveLaunchSpec({ objectiveType: 'PRODUCT_SALES' });
    const fields = buildTikTokObjectiveFields(spec, {
      catalogId: 'catalog_1',
      itemGroupIds: ['item_1', 'item_2'],
    });
    expect(fields.adgroup).toEqual({ catalog_id: 'catalog_1' });
    expect(fields.adgroup).not.toHaveProperty('store_id');
    expect(fields.adgroup).not.toHaveProperty('product_source');
    expect(fields.creative).toEqual({ item_group_ids: ['item_1', 'item_2'] });
  });

  it('buildTikTokObjectiveFields returns empty adgroup and creative for a base objective like REACH', () => {
    const spec = resolveTikTokObjectiveLaunchSpec({ objectiveType: 'REACH' });
    const fields = buildTikTokObjectiveFields(spec, {});
    expect(fields.adgroup).toEqual({});
    expect(fields.creative).toEqual({});
  });
});
