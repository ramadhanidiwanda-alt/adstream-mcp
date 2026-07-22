import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { updateCampaign } from '../src/tools/updateCampaign.js';

type MetaMock = ReturnType<typeof vi.fn>;

describe('updateCampaign', () => {
  const mockMetaPost: MetaMock = vi.fn();
  const mockMetaGet: MetaMock = vi.fn();
  const mockClient = { metaPost: mockMetaPost, metaGet: mockMetaGet } as unknown as MetaClient;

  const baseOpts = { campaignId: 'cmp789' };

  beforeEach(() => vi.clearAllMocks());

  it('returns dry_run without calling the API', async () => {
    const r = await updateCampaign(mockClient, { ...baseOpts, name: 'New Campaign Name' });
    expect(r.status).toBe('dry_run');
    expect(r.preview.name).toBe('New Campaign Name');
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('returns pending_confirmation when not confirmed', async () => {
    const r = await updateCampaign(mockClient, baseOpts, { dryRun: false, confirmed: false });
    expect(r.status).toBe('pending_confirmation');
  });

  it('executes a simple name/status update', async () => {
    mockMetaPost.mockResolvedValueOnce({ success: true });
    const r = await updateCampaign(
      mockClient,
      { ...baseOpts, name: 'New Name', status: 'PAUSED' },
      { dryRun: false, confirmed: true }
    );
    expect(r.status).toBe('executed');
    expect(r.success).toBe(true);
    expect(mockMetaPost.mock.calls[0][1]).toEqual({ name: 'New Name', status: 'PAUSED' });
  });

  it('requires deleteConfirmed when status is DELETED', async () => {
    const r = await updateCampaign(
      mockClient,
      { ...baseOpts, status: 'DELETED' },
      { dryRun: false, confirmed: true }
    );
    expect(r.status).toBe('failed');
    expect(r.error).toContain('deleteConfirmed');
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('executes DELETED only with deleteConfirmed=true', async () => {
    mockMetaPost.mockResolvedValueOnce({ success: true });
    const r = await updateCampaign(
      mockClient,
      { ...baseOpts, status: 'DELETED', deleteConfirmed: true },
      { dryRun: false, confirmed: true }
    );
    expect(r.status).toBe('executed');
    expect(mockMetaPost.mock.calls[0][1]).toEqual({ status: 'DELETED' });
  });

  it('applies the budget guard to lifetimeBudget', async () => {
    mockMetaGet.mockResolvedValueOnce({ data: [{ daily_budget: '50000', name: 'Test' }] });

    const r = await updateCampaign(
      mockClient,
      { ...baseOpts, lifetimeBudget: 999999 },
      { dryRun: false, confirmed: true }
    );

    expect(r.status).toBe('failed');
    expect(r.error).toContain('Budget increase exceeds safety limit');
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('applies the budget guard to spendCap independently', async () => {
    mockMetaGet.mockResolvedValueOnce({ data: [{ spend_cap: '50000', name: 'Test' }] });

    const r = await updateCampaign(
      mockClient,
      { ...baseOpts, spendCap: 999999 },
      { dryRun: false, confirmed: true }
    );

    expect(r.status).toBe('failed');
    expect(r.error).toContain('Budget increase exceeds safety limit');
    expect(mockMetaGet).toHaveBeenCalledWith('/cmp789', { fields: 'spend_cap,name' }, { maxRetries: 3 });
  });

  it('builds specialAdCategories and schedule fields', async () => {
    const r = await updateCampaign(mockClient, {
      ...baseOpts,
      specialAdCategories: ['NONE'],
      startTime: '2026-08-01T00:00:00+0000',
      stopTime: '2026-08-31T00:00:00+0000',
      bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
    });
    expect(r.preview).toEqual({
      special_ad_categories: ['NONE'],
      start_time: '2026-08-01T00:00:00+0000',
      stop_time: '2026-08-31T00:00:00+0000',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    });
  });

  it('returns failed on API error', async () => {
    mockMetaPost.mockRejectedValueOnce(new Error('update error'));
    const r = await updateCampaign(mockClient, { ...baseOpts, name: 'Fail' }, { dryRun: false, confirmed: true });
    expect(r.status).toBe('failed');
  });

  describe('adsetBudgets (CBO <-> ABO toggle)', () => {
    it('maps adsetBudgets into the dry-run preview', async () => {
      const r = await updateCampaign(mockClient, {
        ...baseOpts,
        adsetBudgets: [
          { adsetId: 'as1', dailyBudget: 50000 },
          { adsetId: 'as2', lifetimeBudget: 100000 },
        ],
      });
      expect(r.status).toBe('dry_run');
      expect(r.preview.adset_budgets).toEqual([
        { adset_id: 'as1', daily_budget: 50000 },
        { adset_id: 'as2', lifetime_budget: 100000 },
      ]);
    });

    it('executes with adset_budgets in the POST payload', async () => {
      mockMetaPost.mockResolvedValueOnce({ success: true });
      const r = await updateCampaign(
        mockClient,
        {
          ...baseOpts,
          adsetBudgets: [{ adsetId: 'as1', dailyBudget: 50000 }],
        },
        { dryRun: false, confirmed: true }
      );
      expect(r.status).toBe('executed');
      expect(mockMetaPost.mock.calls[0][1]).toEqual({
        adset_budgets: [{ adset_id: 'as1', daily_budget: 50000 }],
      });
    });

    it('rejects an empty adsetBudgets array', async () => {
      const r = await updateCampaign(
        mockClient,
        { ...baseOpts, adsetBudgets: [] },
        { dryRun: false, confirmed: true }
      );
      expect(r.status).toBe('failed');
      expect(r.structuredError?.code).toBe('INVALID_ADSET_BUDGETS');
      expect(mockMetaPost).not.toHaveBeenCalled();
    });

    it('rejects an entry with neither dailyBudget nor lifetimeBudget', async () => {
      const r = await updateCampaign(
        mockClient,
        { ...baseOpts, adsetBudgets: [{ adsetId: 'as1' }] },
        { dryRun: false, confirmed: true }
      );
      expect(r.status).toBe('failed');
      expect(r.structuredError?.code).toBe('INVALID_ADSET_BUDGETS');
      expect(mockMetaPost).not.toHaveBeenCalled();
    });

    it('rejects an entry with both dailyBudget and lifetimeBudget', async () => {
      const r = await updateCampaign(
        mockClient,
        {
          ...baseOpts,
          adsetBudgets: [{ adsetId: 'as1', dailyBudget: 50000, lifetimeBudget: 100000 }],
        },
        { dryRun: false, confirmed: true }
      );
      expect(r.status).toBe('failed');
      expect(r.structuredError?.code).toBe('INVALID_ADSET_BUDGETS');
      expect(mockMetaPost).not.toHaveBeenCalled();
    });
  });
});
