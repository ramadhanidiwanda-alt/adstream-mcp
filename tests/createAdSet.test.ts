import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { createAdSet } from '../src/tools/createAdSet.js';

type MetaPostMock = ReturnType<typeof vi.fn>;

describe('createAdSet', () => {
  const mockMetaPost: MetaPostMock = vi.fn();
  const mockClient = {
    metaPost: mockMetaPost,
  } as unknown as MetaClient;

  const validOptions = {
    adAccountId: 'act_123456789',
    campaignId: '120248446250030168',
    name: 'Test Ad Set',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('dry-run mode (default)', () => {
    it('returns dry_run status without calling API', async () => {
      const result = await createAdSet(mockClient, validOptions);

      expect(result.status).toBe('dry_run');
      expect(result.executed).toBe(false);
      expect(result.preview).toBeDefined();
      expect(result.preview.name).toBe('Test Ad Set');
      expect(result.preview.campaign_id).toBe('120248446250030168');
      expect(result.preview.status).toBe('PAUSED');
      expect(mockClient.metaPost).not.toHaveBeenCalled();
    });

    it('includes daily_budget in preview when provided', async () => {
      const result = await createAdSet(mockClient, {
        ...validOptions,
        dailyBudget: 50000,
      });

      expect(result.preview.daily_budget).toBe(50000);
    });

    it('includes targeting in preview when provided', async () => {
      const result = await createAdSet(mockClient, {
        ...validOptions,
        targeting: {
          geoLocations: { countries: ['ID'] },
          ageMin: 18,
          ageMax: 65,
        },
      });

      expect(result.preview.targeting.geo_locations).toEqual({ countries: ['ID'] });
      expect(result.preview.targeting.age_min).toBe(18);
      expect(result.preview.targeting.age_max).toBe(65);
    });
  });

  describe('pending_confirmation', () => {
    it('returns pending_confirmation when dryRun=false but confirmed=false', async () => {
      const result = await createAdSet(mockClient, validOptions, {
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
    it('calls metaPost and returns executed with id on success', async () => {
      mockMetaPost.mockResolvedValueOnce({ id: '120248446250030169' });

      const result = await createAdSet(mockClient, validOptions, {
        dryRun: false,
        confirmed: true,
      });

      expect(result.status).toBe('executed');
      expect(result.executed).toBe(true);
      expect(result.id).toBe('120248446250030169');
      expect(mockMetaPost).toHaveBeenCalledTimes(1);

      const [path, payload] = mockMetaPost.mock.calls[0];
      expect(path).toContain('/act_123456789/adsets');
      expect(payload.name).toBe('Test Ad Set');
      expect(payload.campaign_id).toBe('120248446250030168');
      expect(payload.status).toBe('PAUSED');
    });

    it('returns failed when Meta does not return an id', async () => {
      mockMetaPost.mockResolvedValueOnce({ success: true });

      const result = await createAdSet(mockClient, validOptions, {
        dryRun: false,
        confirmed: true,
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('id');
    });

    it('returns failed on API error', async () => {
      mockMetaPost.mockRejectedValueOnce(new Error('API error'));

      const result = await createAdSet(mockClient, validOptions, {
        dryRun: false,
        confirmed: true,
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('API error');
    });

    it('passes billing_event and optimization_goal when provided', async () => {
      mockMetaPost.mockResolvedValueOnce({ id: '120248446250030170' });

      await createAdSet(mockClient, {
        ...validOptions,
        billingEvent: 'LINK_CLICKS',
        optimizationGoal: 'LINK_CLICKS',
      }, { dryRun: false, confirmed: true });

      const payload = mockMetaPost.mock.calls[0][1];
      expect(payload.billing_event).toBe('LINK_CLICKS');
      expect(payload.optimization_goal).toBe('LINK_CLICKS');
    });
  });

  describe('adAccountId normalization', () => {
    it('works with numeric accountId', async () => {
      mockMetaPost.mockResolvedValueOnce({ id: '120248446250030171' });

      const result = await createAdSet(mockClient, {
        ...validOptions,
        adAccountId: '123456789',
      }, { dryRun: false, confirmed: true });

      expect(result.status).toBe('executed');
      const [path] = mockMetaPost.mock.calls[0];
      expect(path).toBe('/act_123456789/adsets');
    });
  });
});
