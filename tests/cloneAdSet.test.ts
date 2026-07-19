import { describe, it, expect, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { buildCloneAdSetPayload, cloneAdSet } from '../src/tools/cloneAdSet.js';

const source = {
  name: '30D | MID MONT JULI',
  campaign_id: 'cmp_1',
  optimization_goal: 'OFFSITE_CONVERSIONS',
  billing_event: 'IMPRESSIONS',
  destination_type: 'UNDEFINED',
  is_dynamic_creative: false,
  targeting: {
    age_min: 18,
    age_max: 65,
    age_range: [25, 65],
    custom_audiences: [{ id: 'aud_1' }],
    geo_locations: { countries: ['ID'] },
  },
  promoted_object: { product_set_id: 'ps_1', omnichannel_object: { app: [{ application_id: '1' }] } },
  attribution_spec: [{ event_type: 'CLICK_THROUGH', window_days: 7 }],
};

describe('buildCloneAdSetPayload', () => {
  it('copies core config and applies name/schedule overrides', () => {
    const payload = buildCloneAdSetPayload(source, {
      adAccountId: 'act_1',
      sourceAdSetId: 'as_src',
      name: '30D | PAYDAY GLOWDAY',
      startTime: '2026-07-20T01:00:00+0700',
      endTime: '2026-07-27T23:59:00+0700',
    });

    expect(payload.name).toBe('30D | PAYDAY GLOWDAY');
    expect(payload.campaign_id).toBe('cmp_1');
    expect(payload.status).toBe('PAUSED');
    expect(payload.optimization_goal).toBe('OFFSITE_CONVERSIONS');
    expect(payload.promoted_object).toEqual(source.promoted_object);
    expect(payload.attribution_spec).toEqual(source.attribution_spec);
    expect(payload.start_time).toBe('2026-07-20T01:00:00+0700');
    expect(payload.end_time).toBe('2026-07-27T23:59:00+0700');
  });

  it('strips read-only targeting fields (age_range) but keeps custom audiences', () => {
    const payload = buildCloneAdSetPayload(source, { adAccountId: 'act_1', sourceAdSetId: 'as_src' });
    const targeting = payload.targeting as Record<string, unknown>;
    expect(targeting.age_range).toBeUndefined();
    expect(targeting.age_min).toBe(18);
    expect(targeting.custom_audiences).toEqual([{ id: 'aud_1' }]);
  });

  it('defaults the name to "<source> (copy)" and omits UNDEFINED destination_type', () => {
    const payload = buildCloneAdSetPayload(source, { adAccountId: 'act_1', sourceAdSetId: 'as_src' });
    expect(payload.name).toBe('30D | MID MONT JULI (copy)');
    expect(payload.destination_type).toBeUndefined();
  });

  it('lets an explicit dailyBudget override the source', () => {
    const payload = buildCloneAdSetPayload({ ...source, daily_budget: '10000' }, {
      adAccountId: 'act_1',
      sourceAdSetId: 'as_src',
      dailyBudget: 50000,
    });
    expect(payload.daily_budget).toBe(50000);
  });
});

describe('cloneAdSet', () => {
  function client(post = vi.fn()): MetaClient {
    return {
      metaGetObject: vi.fn().mockResolvedValue(source),
      metaPost: post,
    } as unknown as MetaClient;
  }

  it('returns a dry-run preview without creating anything', async () => {
    const post = vi.fn();
    const r = await cloneAdSet(client(post), { adAccountId: 'act_1', sourceAdSetId: 'as_src', name: 'X' });
    expect(r.status).toBe('dry_run');
    expect(r.sourceAdSetId).toBe('as_src');
    expect(r.preview.name).toBe('X');
    expect(post).not.toHaveBeenCalled();
  });

  it('requires confirmation before executing', async () => {
    const post = vi.fn();
    const r = await cloneAdSet(client(post), { adAccountId: 'act_1', sourceAdSetId: 'as_src' }, { dryRun: false, confirmed: false });
    expect(r.status).toBe('pending_confirmation');
    expect(post).not.toHaveBeenCalled();
  });

  it('creates the ad set when confirmed and returns the new id', async () => {
    const post = vi.fn().mockResolvedValue({ id: 'as_new' });
    const r = await cloneAdSet(client(post), { adAccountId: 'act_1', sourceAdSetId: 'as_src' }, { dryRun: false, confirmed: true });
    expect(post).toHaveBeenCalledWith('/act_1/adsets', expect.objectContaining({ campaign_id: 'cmp_1' }), 3);
    expect(r.status).toBe('executed');
    expect(r.id).toBe('as_new');
  });
});
