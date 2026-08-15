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
    targeting_automation: { advantage_audience: 1 },
    custom_audiences: [{ id: 'aud_1' }],
    geo_locations: { countries: ['ID'] },
  },
  promoted_object: {
    product_set_id: 'ps_1',
    omnichannel_object: { app: [{ application_id: '1' }] },
  },
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

  // Cloning a 7-day-click source to optimizationGoal CONVERSATIONS is rejected by Meta
  // (subcode 1885423) because messaging optimization only supports a 1-day window, and
  // there was no way to override the inherited spec.
  it('overrides the inherited attribution_spec', () => {
    const payload = buildCloneAdSetPayload(source, {
      adAccountId: 'act_1',
      sourceAdSetId: 'as_src',
      optimizationGoal: 'CONVERSATIONS',
      attributionSpec: [{ event_type: 'CLICK_THROUGH', window_days: 1 }],
    });

    expect(payload.attribution_spec).toEqual([{ event_type: 'CLICK_THROUGH', window_days: 1 }]);
    expect(payload.optimization_goal).toBe('CONVERSATIONS');
  });

  it.each([{ attributionSpec: null }, { attributionSpec: [] }])(
    'drops the inherited attribution_spec when given $attributionSpec',
    ({ attributionSpec }) => {
      const payload = buildCloneAdSetPayload(source, {
        adAccountId: 'act_1',
        sourceAdSetId: 'as_src',
        attributionSpec,
      });

      expect(payload).not.toHaveProperty('attribution_spec');
    }
  );

  it('keeps age_range (writable, tied to targeting_automation.advantage_audience) and custom audiences', () => {
    const payload = buildCloneAdSetPayload(source, {
      adAccountId: 'act_1',
      sourceAdSetId: 'as_src',
    });
    const targeting = payload.targeting as Record<string, unknown>;
    expect(targeting.age_range).toEqual([25, 65]);
    expect(targeting.targeting_automation).toEqual({ advantage_audience: 1 });
    expect(targeting.age_min).toBe(18);
    expect(targeting.custom_audiences).toEqual([{ id: 'aud_1' }]);
  });

  it('defaults the name to "<source> (copy)" and omits UNDEFINED destination_type', () => {
    const payload = buildCloneAdSetPayload(source, {
      adAccountId: 'act_1',
      sourceAdSetId: 'as_src',
    });
    expect(payload.name).toBe('30D | MID MONT JULI (copy)');
    expect(payload.destination_type).toBeUndefined();
  });

  it('does not copy Dynamic Creative from the source ad set', () => {
    const payload = buildCloneAdSetPayload(
      { ...source, is_dynamic_creative: true },
      { adAccountId: 'act_1', sourceAdSetId: 'as_dynamic' }
    );

    expect(payload).not.toHaveProperty('is_dynamic_creative');
  });

  it('lets an explicit dailyBudget override the source', () => {
    const payload = buildCloneAdSetPayload(
      { ...source, daily_budget: '10000' },
      {
        adAccountId: 'act_1',
        sourceAdSetId: 'as_src',
        dailyBudget: 50000,
      }
    );
    expect(payload.daily_budget).toBe(50000);
  });
});

describe('cloneAdSet', () => {
  function client(post = vi.fn()): MetaClient {
    return {
      metaGetObject: vi.fn().mockResolvedValue(source),
      metaGet: vi.fn().mockResolvedValue({ data: [] }),
      metaPost: post,
    } as unknown as MetaClient;
  }

  it('returns a dry-run preview without creating anything', async () => {
    const post = vi.fn();
    const r = await cloneAdSet(client(post), {
      adAccountId: 'act_1',
      sourceAdSetId: 'as_src',
      name: 'X',
    });
    expect(r.status).toBe('dry_run');
    expect(r.sourceAdSetId).toBe('as_src');
    expect(r.preview.name).toBe('X');
    expect(post).not.toHaveBeenCalled();
  });

  it('requires confirmation before executing', async () => {
    const post = vi.fn();
    const r = await cloneAdSet(
      client(post),
      { adAccountId: 'act_1', sourceAdSetId: 'as_src' },
      { dryRun: false, confirmed: false }
    );
    expect(r.status).toBe('pending_confirmation');
    expect(post).not.toHaveBeenCalled();
  });

  it('creates the ad set when confirmed and returns the new id', async () => {
    const post = vi.fn().mockResolvedValue({ id: 'as_new' });
    const r = await cloneAdSet(
      client(post),
      { adAccountId: 'act_1', sourceAdSetId: 'as_src' },
      { dryRun: false, confirmed: true }
    );
    expect(post).toHaveBeenCalledWith(
      '/act_1/adsets',
      expect.objectContaining({ campaign_id: 'cmp_1' }),
      3
    );
    expect(r.status).toBe('executed');
    expect(r.id).toBe('as_new');
  });

  it('rejects clones whose optimization goal differs from target campaign siblings', async () => {
    const post = vi.fn();
    const mockClient = client(post);
    vi.mocked(mockClient.metaGet).mockResolvedValueOnce({
      data: [
        {
          id: 'as_existing',
          name: 'Existing Messaging Purchases',
          status: 'ACTIVE',
          effective_status: 'ACTIVE',
          optimization_goal: 'MESSAGING_PURCHASE_CONVERSION',
        },
      ],
    });

    const r = await cloneAdSet(
      mockClient,
      { adAccountId: 'act_1', sourceAdSetId: 'as_src' },
      { dryRun: false, confirmed: true }
    );

    expect(r.status).toBe('failed');
    expect(r.structuredError?.code).toBe('OPTIMIZATION_GOAL_MISMATCH');
    expect(r.error).toContain('OFFSITE_CONVERSIONS');
    expect(r.error).toContain('MESSAGING_PURCHASE_CONVERSION');
    expect(post).not.toHaveBeenCalled();
  });
});

describe('cloneAdSet — spend control carry-over', () => {
  function client(post = vi.fn()): MetaClient {
    return {
      metaGetObject: vi.fn().mockResolvedValue({
        ...source,
        daily_spend_cap: 5000000,
        daily_min_spend_target: 1000000,
        lifetime_spend_cap: 90000000,
        lifetime_min_spend_target: 20000000,
      }),
      metaGet: vi.fn().mockResolvedValue({ data: [] }),
      metaPost: post,
    } as unknown as MetaClient;
  }

  it('carries spend controls from the source ad set into the clone payload', async () => {
    const r = await cloneAdSet(client(), {
      adAccountId: 'act_1',
      sourceAdSetId: 'as_src',
    });

    expect(r.preview).toMatchObject({
      daily_spend_cap: 5000000,
      daily_min_spend_target: 1000000,
      lifetime_spend_cap: 90000000,
      lifetime_min_spend_target: 20000000,
    });
  });

  it('omits the spend control keys entirely when the source ad set has none', () => {
    const payload = buildCloneAdSetPayload(source, {
      adAccountId: 'act_1',
      sourceAdSetId: 'as_src',
    });

    expect(payload).not.toHaveProperty('daily_spend_cap');
    expect(payload).not.toHaveProperty('daily_min_spend_target');
    expect(payload).not.toHaveProperty('lifetime_spend_cap');
    expect(payload).not.toHaveProperty('lifetime_min_spend_target');
  });
});
