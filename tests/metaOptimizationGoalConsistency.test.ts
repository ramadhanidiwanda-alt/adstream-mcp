import { describe, it, expect, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import {
  campaignEnforcesUniformOptimizationGoal,
  checkCampaignOptimizationGoalConsistency,
} from '../src/tools/metaOptimizationGoalConsistency.js';

const CONFLICTING_SIBLINGS = {
  data: [
    {
      id: 'sibling_1',
      name: 'Existing Purchase Messages',
      status: 'ACTIVE',
      effective_status: 'ACTIVE',
      optimization_goal: 'MESSAGING_PURCHASE_CONVERSION',
    },
  ],
};

function mockClient(campaign: Record<string, unknown>): MetaClient {
  return {
    metaGetObject: vi.fn().mockResolvedValue(campaign),
    metaGet: vi.fn().mockResolvedValue(CONFLICTING_SIBLINGS),
    metaPost: vi.fn(),
  } as unknown as MetaClient;
}

describe('campaignEnforcesUniformOptimizationGoal', () => {
  // Meta scopes the rule to Advantage campaign budget under auto bid:
  // "All optimization goals must be the same across ad sets under auto bid."
  // https://developers.facebook.com/documentation/ads-commerce/marketing-api/bidding/guides/advantage-campaign-budget
  it('enforces on a CBO campaign under auto bid', () => {
    expect(
      campaignEnforcesUniformOptimizationGoal({
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: 100000,
      })
    ).toBe(true);
  });

  it('enforces on a lifetime-budget CBO campaign under auto bid', () => {
    expect(
      campaignEnforcesUniformOptimizationGoal({
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        lifetime_budget: '250000',
      })
    ).toBe(true);
  });

  it('does not enforce when the budget lives on the ad sets, not the campaign', () => {
    expect(
      campaignEnforcesUniformOptimizationGoal({ bid_strategy: 'LOWEST_COST_WITHOUT_CAP' })
    ).toBe(false);
  });

  it('does not enforce on a CBO campaign that is not under auto bid', () => {
    for (const bidStrategy of [
      'COST_CAP',
      'LOWEST_COST_WITH_BID_CAP',
      'LOWEST_COST_WITH_MIN_ROAS',
    ]) {
      expect(
        campaignEnforcesUniformOptimizationGoal({
          bid_strategy: bidStrategy,
          daily_budget: 100000,
        })
      ).toBe(false);
    }
  });

  it('does not enforce when the bid strategy is unreadable', () => {
    expect(campaignEnforcesUniformOptimizationGoal({ daily_budget: 100000 })).toBe(false);
    expect(campaignEnforcesUniformOptimizationGoal(undefined)).toBe(false);
  });

  it('treats a zero campaign budget as no campaign budget', () => {
    expect(
      campaignEnforcesUniformOptimizationGoal({
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: 0,
      })
    ).toBe(false);
  });
});

describe('checkCampaignOptimizationGoalConsistency', () => {
  it('flags a mismatch on a CBO campaign under auto bid', async () => {
    const client = mockClient({
      id: 'cmp_1',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      daily_budget: 100000,
    });

    const issue = await checkCampaignOptimizationGoalConsistency(client, 'cmp_1', 'CONVERSATIONS');

    expect(issue?.structuredError.code).toBe('OPTIMIZATION_GOAL_MISMATCH');
    expect(issue?.error).toContain('MESSAGING_PURCHASE_CONVERSION');
  });

  it('allows mixed optimization goals when the campaign has no campaign-level budget', async () => {
    const client = mockClient({ id: 'cmp_1', bid_strategy: 'LOWEST_COST_WITHOUT_CAP' });

    const issue = await checkCampaignOptimizationGoalConsistency(client, 'cmp_1', 'CONVERSATIONS');

    expect(issue).toBeNull();
  });

  it('allows mixed optimization goals on a CBO campaign using a bid cap', async () => {
    const client = mockClient({
      id: 'cmp_1',
      bid_strategy: 'LOWEST_COST_WITH_BID_CAP',
      daily_budget: 100000,
    });

    const issue = await checkCampaignOptimizationGoalConsistency(client, 'cmp_1', 'CONVERSATIONS');

    expect(issue).toBeNull();
  });

  it('skips the sibling read entirely when the campaign does not enforce the rule', async () => {
    const client = mockClient({ id: 'cmp_1', bid_strategy: 'COST_CAP', daily_budget: 100000 });

    await checkCampaignOptimizationGoalConsistency(client, 'cmp_1', 'CONVERSATIONS');

    expect(client.metaGet).not.toHaveBeenCalled();
  });

  it('reuses a pre-fetched campaign instead of reading it again', async () => {
    const client = mockClient({ id: 'cmp_1' });

    const issue = await checkCampaignOptimizationGoalConsistency(client, 'cmp_1', 'CONVERSATIONS', {
      campaign: { bid_strategy: 'LOWEST_COST_WITHOUT_CAP', daily_budget: 100000 },
    });

    expect(client.metaGetObject).not.toHaveBeenCalled();
    expect(issue?.structuredError.code).toBe('OPTIMIZATION_GOAL_MISMATCH');
  });
});
