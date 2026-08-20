import { describe, it, expect, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { getCampaigns } from '../src/tools/getCampaigns.js';

function mockClient(data: unknown[] = []) {
  const metaGet = vi.fn().mockResolvedValue({ data });
  return { client: { metaGet } as unknown as MetaClient, metaGet };
}

describe('getCampaigns', () => {
  it('requests the budget and bid fields that decide ad-set write guards', async () => {
    // checkCampaignOptimizationGoalConsistency gates on exactly these three.
    // Without them on the read surface there is no way to see why a write was
    // blocked, or whether the campaign is even subject to the rule.
    const { client, metaGet } = mockClient();

    await getCampaigns(client, { adAccountId: 'act_123' });

    const fields = String(metaGet.mock.calls[0][1].fields).split(',');
    expect(fields).toEqual(
      expect.arrayContaining(['bid_strategy', 'daily_budget', 'lifetime_budget'])
    );
  });

  it('keeps the existing identity and status fields', async () => {
    const { client, metaGet } = mockClient();

    await getCampaigns(client, { adAccountId: 'act_123' });

    const fields = String(metaGet.mock.calls[0][1].fields).split(',');
    expect(fields).toEqual(
      expect.arrayContaining([
        'id',
        'name',
        'status',
        'effective_status',
        'objective',
        'created_time',
        'updated_time',
      ])
    );
  });

  it('passes the budget fields through to the caller', async () => {
    const { client } = mockClient([
      {
        id: '120216685951590415',
        name: 'CBO campaign',
        status: 'ACTIVE',
        effective_status: 'ACTIVE',
        objective: 'OUTCOME_ENGAGEMENT',
        created_time: '2026-01-15T08:00:00+0000',
        updated_time: '2026-06-20T12:00:00+0000',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: '100000',
      },
    ]);

    const [campaign] = await getCampaigns(client, { adAccountId: 'act_123' });

    expect(campaign.bid_strategy).toBe('LOWEST_COST_WITHOUT_CAP');
    expect(campaign.daily_budget).toBe('100000');
  });

  it('leaves the budget fields absent for an ad-set-budget campaign', async () => {
    // Meta only returns daily_budget/lifetime_budget when the campaign holds the
    // budget, so their absence is the signal that the budget lives on the ad sets.
    const { client } = mockClient([
      {
        id: '120249813934540415',
        name: 'Ad-set budget campaign',
        status: 'ACTIVE',
        effective_status: 'ACTIVE',
        objective: 'OUTCOME_SALES',
        created_time: '2026-01-15T08:00:00+0000',
        updated_time: '2026-06-20T12:00:00+0000',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      },
    ]);

    const [campaign] = await getCampaigns(client, { adAccountId: 'act_123' });

    expect(campaign.daily_budget).toBeUndefined();
    expect(campaign.lifetime_budget).toBeUndefined();
  });

  it('returns an empty list when Meta returns no data', async () => {
    const metaGet = vi.fn().mockResolvedValue({});
    const client = { metaGet } as unknown as MetaClient;

    await expect(getCampaigns(client, { adAccountId: 'act_123' })).resolves.toEqual([]);
  });
});
