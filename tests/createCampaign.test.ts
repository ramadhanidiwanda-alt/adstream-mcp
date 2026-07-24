import { describe, it, expect, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { createCampaign } from '../src/tools/createCampaign.js';
import { META_ODAX_OBJECTIVES } from '../src/providers/meta/objectiveLaunchMatrix.js';

type MetaPostMock = ReturnType<typeof vi.fn>;

describe('createCampaign', () => {
  const mockMetaPost: MetaPostMock = vi.fn();
  const mockMetaGet: MetaPostMock = vi.fn();
  const mockClient = {
    metaPost: mockMetaPost,
    metaGet: mockMetaGet,
  } as unknown as MetaClient;

  const validOptions = {
    adAccountId: 'act_123456789',
    name: 'Test Campaign',
    objective: 'OUTCOME_TRAFFIC' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMetaGet.mockResolvedValue({ data: [] });
  });

  describe('dry-run mode (default)', () => {
    it('rejects non-ODAX campaign objectives at runtime', async () => {
      const result = await createCampaign(
        mockClient,
        { ...validOptions, objective: 'OUTCOME_MESSAGES' as never },
        { dryRun: true }
      );

      expect(result).toMatchObject({
        status: 'failed',
        executed: false,
        structuredError: { code: 'UNSUPPORTED_OBJECTIVE' },
      });
      expect(mockMetaPost).not.toHaveBeenCalled();
    });

    it.each(META_ODAX_OBJECTIVES)('previews the ODAX objective %s', async (objective) => {
      const result = await createCampaign(mockClient, {
        ...validOptions,
        objective,
      });

      expect(result).toMatchObject({
        status: 'dry_run',
        executed: false,
        preview: { objective },
      });
    });

    it('returns dry_run status without calling API', async () => {
      const result = await createCampaign(mockClient, validOptions);

      expect(result.status).toBe('dry_run');
      expect(result.executed).toBe(false);
      expect(result.preview).toBeDefined();
      expect(result.preview.name).toBe('Test Campaign');
      expect(result.preview.objective).toBe('OUTCOME_TRAFFIC');
      expect(result.preview.status).toBe('PAUSED');
      expect(result.preview.is_adset_budget_sharing_enabled).toBe(false);
      expect(mockClient.metaPost).not.toHaveBeenCalled();
    });

    it('shows daily_budget in preview when provided', async () => {
      const result = await createCampaign(mockClient, validOptions);

      expect(result.preview.daily_budget).toBeUndefined();
    });

    it('includes daily_budget and bid_strategy in preview when provided', async () => {
      const result = await createCampaign(mockClient, {
        ...validOptions,
        dailyBudget: 50000,
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
      });

      expect(result.preview.daily_budget).toBe(50000);
      expect(result.preview.bid_strategy).toBe('LOWEST_COST_WITHOUT_CAP');
    });

    it('returns mode as local metadata without sending it in the Meta payload', async () => {
      const result = await createCampaign(mockClient, {
        ...validOptions,
        mode: 'collaborative_ads',
      });

      expect(result.mode).toBe('collaborative_ads');
      expect(result.preview).toEqual({
        name: 'Test Campaign',
        objective: 'OUTCOME_TRAFFIC',
        status: 'PAUSED',
        special_ad_categories: [],
        buying_type: 'AUCTION',
        is_adset_budget_sharing_enabled: false,
      });
      expect(result.preview).not.toHaveProperty('mode');
    });

    it('allows marketers to enable ad set budget sharing explicitly', async () => {
      const result = await createCampaign(mockClient, {
        ...validOptions,
        isAdSetBudgetSharingEnabled: true,
      });

      expect(result.preview.is_adset_budget_sharing_enabled).toBe(true);
    });

    it('omits the ad set budget sharing default when campaign budget is used', async () => {
      const result = await createCampaign(mockClient, {
        ...validOptions,
        dailyBudget: 50000,
      });

      expect(result.preview).not.toHaveProperty('is_adset_budget_sharing_enabled');
    });
  });

  describe('pending_confirmation', () => {
    it('returns pending_confirmation when dryRun=false but confirmed=false', async () => {
      const result = await createCampaign(mockClient, validOptions, {
        dryRun: false,
        confirmed: false,
      });

      expect(result.status).toBe('pending_confirmation');
      expect(result.executed).toBe(false);
      expect(result.error).toContain('confirmation');
      expect(mockClient.metaPost).not.toHaveBeenCalled();
    });
  });

  describe('execution mode', () => {
    it('does not create a duplicate campaign when dedupeByName finds an existing one', async () => {
      mockMetaGet.mockResolvedValueOnce({
        data: [{ id: 'existing_campaign_1', name: 'Test Campaign', status: 'PAUSED' }],
      });

      const result = await createCampaign(
        mockClient,
        {
          ...validOptions,
          dedupeByName: true,
        },
        {
          dryRun: false,
          confirmed: true,
        }
      );

      expect(result.status).toBe('deduped');
      expect(result.executed).toBe(false);
      expect(result.id).toBe('existing_campaign_1');
      expect(result.response?.deduped).toBe(true);
      expect(mockMetaGet.mock.calls[0][1]).not.toHaveProperty('filtering');
      expect(mockMetaGet.mock.calls[0][2]).toMatchObject({ paginate: true, maxPages: 20 });
      expect(mockClient.metaPost).not.toHaveBeenCalled();
    });

    it('calls metaPost and returns executed with id on success', async () => {
      mockClient.metaPost.mockResolvedValueOnce({ id: '120248446250030168' });

      const result = await createCampaign(mockClient, validOptions, {
        dryRun: false,
        confirmed: true,
      });

      expect(result.status).toBe('executed');
      expect(result.executed).toBe(true);
      expect(result.id).toBe('120248446250030168');
      expect(mockClient.metaPost).toHaveBeenCalledTimes(1);

      const [path, payload] = mockClient.metaPost.mock.calls[0];
      expect(path).toContain('/act_123456789/campaigns');
      expect(payload.name).toBe('Test Campaign');
      expect(payload.objective).toBe('OUTCOME_TRAFFIC');
      expect(payload.status).toBe('PAUSED');
      expect(payload.is_adset_budget_sharing_enabled).toBe(false);
    });

    it('returns failed when Meta does not return an id', async () => {
      mockClient.metaPost.mockResolvedValueOnce({ success: true });

      const result = await createCampaign(mockClient, validOptions, {
        dryRun: false,
        confirmed: true,
      });

      expect(result.status).toBe('failed');
      expect(result.executed).toBe(false);
      expect(result.error).toContain('id');
    });

    it('returns failed on API error', async () => {
      mockClient.metaPost.mockRejectedValueOnce(new Error('Rate limit exceeded'));

      const result = await createCampaign(mockClient, validOptions, {
        dryRun: false,
        confirmed: true,
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Rate limit exceeded');
    });

    it('handles ACTIVE status option', async () => {
      mockClient.metaPost.mockResolvedValueOnce({ id: '120248446250030169' });

      const result = await createCampaign(
        mockClient,
        { ...validOptions, status: 'ACTIVE' },
        {
          dryRun: false,
          confirmed: true,
        }
      );

      expect(result.status).toBe('executed');
      const payload = mockClient.metaPost.mock.calls[0][1];
      expect(payload.status).toBe('ACTIVE');
    });

    it('handles specialAdCategories', async () => {
      mockClient.metaPost.mockResolvedValueOnce({ id: '120248446250030170' });

      const result = await createCampaign(
        mockClient,
        { ...validOptions, specialAdCategories: ['CREDIT'] },
        {
          dryRun: false,
          confirmed: true,
        }
      );

      expect(result.status).toBe('executed');
      const payload = mockClient.metaPost.mock.calls[0][1];
      expect(payload.special_ad_categories).toEqual(['CREDIT']);
    });
  });

  describe('adAccountId normalization', () => {
    it('works with numeric accountId', async () => {
      mockClient.metaPost.mockResolvedValueOnce({ id: '120248446250030171' });

      const result = await createCampaign(
        mockClient,
        {
          ...validOptions,
          adAccountId: '123456789',
        },
        { dryRun: false, confirmed: true }
      );

      expect(result.status).toBe('executed');
      const [path] = mockClient.metaPost.mock.calls[0];
      expect(path).toBe('/act_123456789/campaigns');
    });
  });

});
