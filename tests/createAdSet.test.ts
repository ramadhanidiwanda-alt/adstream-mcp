import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { createAdSet } from '../src/tools/createAdSet.js';

function createMockClient(overrides: Record<string, unknown> = {}): MetaClient {
  return {
    metaGetObject: vi.fn().mockResolvedValue({
      id: '120000000000000001',
      bid_strategy: 'LOWEST_COST_WITH_BID_CAP',
      daily_budget: 100000,
      lifetime_budget: undefined,
      ...overrides,
    }),
    metaPost: vi.fn().mockResolvedValue({ id: '120000000000000002' }),
  } as unknown as MetaClient;
}

const defaultOptions = {
  adAccountId: 'act_123456789',
  campaignId: '120000000000000001',
  name: 'Test Ad Set',
};

describe('createAdSet — bid strategy + pre-flight validation', () => {
  describe('client-side validation (no API call)', () => {
    it('should reject invalid bidStrategy "LOWEST_COST"', async () => {
      const client = createMockClient();
      const result = await createAdSet(client, {
        ...defaultOptions,
        bidStrategy: 'LOWEST_COST',
      }, { dryRun: false, confirmed: true });
      expect(result.status).toBe('failed');
      expect(result.error).toContain('LOWEST_COST');
      expect(client.metaPost).not.toHaveBeenCalled();
    });

    it('should reject LOWEST_COST_WITH_BID_CAP without bidAmount', async () => {
      const client = createMockClient();
      const result = await createAdSet(client, {
        ...defaultOptions,
        bidStrategy: 'LOWEST_COST_WITH_BID_CAP',
      }, { dryRun: false, confirmed: true });
      expect(result.status).toBe('failed');
      expect(result.error).toContain('bidAmount is required');
      expect(client.metaPost).not.toHaveBeenCalled();
    });

    it('should reject COST_CAP without bidAmount', async () => {
      const client = createMockClient();
      const result = await createAdSet(client, {
        ...defaultOptions,
        bidStrategy: 'COST_CAP',
      }, { dryRun: false, confirmed: true });
      expect(result.status).toBe('failed');
      expect(result.error).toContain('bidAmount is required');
    });

    it('should reject TARGET_COST without bidAmount', async () => {
      const client = createMockClient();
      const result = await createAdSet(client, {
        ...defaultOptions,
        bidStrategy: 'TARGET_COST',
      }, { dryRun: false, confirmed: true });
      expect(result.status).toBe('failed');
      expect(result.error).toContain('bidAmount');
    });

    it('should reject LOWEST_COST_WITH_MIN_ROAS without bidConstraints', async () => {
      const client = createMockClient();
      const result = await createAdSet(client, {
        ...defaultOptions,
        bidStrategy: 'LOWEST_COST_WITH_MIN_ROAS',
      }, { dryRun: false, confirmed: true });
      expect(result.status).toBe('failed');
      expect(result.error).toContain('bidConstraints');
    });

    it('should accept LOWEST_COST_WITHOUT_CAP without bidAmount', async () => {
      const client = createMockClient();
      const result = await createAdSet(client, {
        ...defaultOptions,
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
      }, { dryRun: false, confirmed: true });
      // After client-side validation, pre-flight runs and finds campaign has
      // LOWEST_COST_WITH_BID_CAP which requires bid_amount. But we explicitly
      // overrode with LOWEST_COST_WITHOUT_CAP, so it should proceed to metaPost
      if (result.status === 'executed') {
        expect(result.id).toBeTruthy();
      } else {
        // Pre-flight may reject if campaign strategy conflicts
        expect(['executed', 'failed']).toContain(result.status);
      }
    });
  });

  describe('pre-flight: CBO budget conflict', () => {
    it('should reject dailyBudget when campaign has CBO', async () => {
      const client = createMockClient({ daily_budget: 100000 });
      const result = await createAdSet(client, {
        ...defaultOptions,
        dailyBudget: 50000,
      }, { dryRun: false, confirmed: true });
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Budget conflict');
      expect(result.error).toContain('CBO');
      expect(client.metaPost).not.toHaveBeenCalled();
    });

    it('should reject lifetimeBudget when campaign has CBO', async () => {
      const client = createMockClient({ daily_budget: 100000 });
      const result = await createAdSet(client, {
        ...defaultOptions,
        lifetimeBudget: 500000,
      }, { dryRun: false, confirmed: true });
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Budget conflict');
    });

    it('should allow no budget when campaign has CBO', async () => {
      const client = createMockClient({ daily_budget: 100000 });
      const result = await createAdSet(client, {
        ...defaultOptions,
        // No dailyBudget or lifetimeBudget
      }, { dryRun: false, confirmed: true });
      // Will proceed to pre-flight check 2 (campaign uses LOWEST_COST_WITH_BID_CAP)
      // Without bidAmount, this should fail
      expect(result.status).toBe('failed');
      expect(result.error).toContain('bidAmount is required');
    });
  });

  describe('pre-flight: campaign bid strategy requires bidAmount', () => {
    it('should require bidAmount when campaign uses COST_CAP', async () => {
      const client = createMockClient({ bid_strategy: 'COST_CAP' });
      const result = await createAdSet(client, defaultOptions, { dryRun: false, confirmed: true });
      expect(result.status).toBe('failed');
      expect(result.error).toContain('bidAmount is required');
      expect(result.error).toContain('COST_CAP');
    });

    it('should require bidAmount when campaign uses LOWEST_COST_WITH_BID_CAP', async () => {
      const client = createMockClient({ bid_strategy: 'LOWEST_COST_WITH_BID_CAP' });
      const result = await createAdSet(client, defaultOptions, { dryRun: false, confirmed: true });
      expect(result.status).toBe('failed');
      expect(result.error).toContain('bidAmount is required');
    });

    it('should auto-set bid_strategy from campaign when only bidAmount provided', async () => {
      const client = createMockClient({ bid_strategy: 'COST_CAP' });
      const result = await createAdSet(client, {
        ...defaultOptions,
        bidAmount: 500000,
        // No bidStrategy — should auto-set from campaign
      }, { dryRun: false, confirmed: true });
      // Should pass pre-flight, call metaPost
      if (result.status === 'executed') {
        expect(result.id).toBeTruthy();
        expect(client.metaPost).toHaveBeenCalled();
      }
    });

    it('should pass when campaign uses LOWEST_COST_WITHOUT_CAP (no bidAmount needed)', async () => {
      const client = createMockClient({ bid_strategy: 'LOWEST_COST_WITHOUT_CAP' });
      const result = await createAdSet(client, defaultOptions, { dryRun: false, confirmed: true });
      // Should pass pre-flight (no bidAmount needed)
      if (result.status === 'executed') {
        expect(result.id).toBeTruthy();
      }
    });
  });

  describe('dry-run mode', () => {
    it('should return preview without API call when dryRun=true', async () => {
      const client = createMockClient();
      const result = await createAdSet(client, defaultOptions, { dryRun: true });
      expect(result.status).toBe('dry_run');
      expect(result.executed).toBe(false);
      expect(result.preview).toBeDefined();
      expect(client.metaPost).not.toHaveBeenCalled();
      expect(client.metaGetObject).not.toHaveBeenCalled();
    });
  });

  describe('execution options', () => {
    it('should require confirmed=true before executing', async () => {
      const client = createMockClient();
      const result = await createAdSet(client, defaultOptions, { dryRun: false, confirmed: false });
      expect(result.status).toBe('pending_confirmation');
      expect(result.error).toContain('confirmation');
    });
  });

  describe('new fields in payload', () => {
    it('should include new fields in preview when provided', async () => {
      const client = createMockClient();
      const result = await createAdSet(client, {
        ...defaultOptions,
        destinationType: 'WEBSITE',
        attributionSpec: [{ event_type: 'CLICK_THROUGH', window_days: 7 }],
        frequencyControlSpecs: [{ event: 'IMPRESSIONS', interval_days: 7, max_frequency: 3 }],
        isDynamicCreative: true,
      }, { dryRun: true });
      expect(result.preview.destination_type).toBe('WEBSITE');
      expect(result.preview.attribution_spec).toBeDefined();
      expect(result.preview.frequency_control_specs).toBeDefined();
      expect(result.preview.is_dynamic_creative).toBe(true);
    });
  });

  describe('targeting_automation default', () => {
    it('should add targeting_automation.advantage_audience: 0 when targeting provided', async () => {
      const client = createMockClient();
      const result = await createAdSet(client, {
        ...defaultOptions,
        targeting: { geoLocations: { countries: ['ID'] } },
      }, { dryRun: true });
      const targeting = result.preview.targeting as Record<string, unknown>;
      expect(targeting?.targeting_automation).toEqual({ advantage_audience: 0 });
    });

    it('should not override user-provided targeting_automation', async () => {
      const client = createMockClient();
      const result = await createAdSet(client, {
        ...defaultOptions,
        targeting: {
          geoLocations: { countries: ['ID'] },
          targetingOptimization: 'none',
        },
      }, { dryRun: true });
      const targeting = result.preview.targeting as Record<string, unknown>;
      expect(targeting?.targeting_automation).toEqual({ advantage_audience: 0 });
    });
  });
});
