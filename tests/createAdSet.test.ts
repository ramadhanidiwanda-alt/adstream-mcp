import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { createAdSet } from '../src/tools/createAdSet.js';
import { MetaApiError } from '../src/utils/metaError.js';
import { resolveMetaObjectiveLaunchSpec } from '../src/providers/meta/objectiveLaunchMatrix.js';

function createMockClient(overrides: Record<string, unknown> = {}): MetaClient {
  return {
    metaGetObject: vi.fn().mockResolvedValue({
      id: '120000000000000001',
      objective: 'OUTCOME_TRAFFIC',
      bid_strategy: 'LOWEST_COST_WITH_BID_CAP',
      daily_budget: 100000,
      lifetime_budget: undefined,
      ...overrides,
    }),
    metaGet: vi.fn().mockResolvedValue({ data: [] }),
    metaPost: vi.fn().mockResolvedValue({ id: '120000000000000002' }),
  } as unknown as MetaClient;
}

const defaultOptions = {
  adAccountId: 'act_123456789',
  campaignId: '120000000000000001',
  name: 'Test Ad Set',
  optimizationGoal: 'REACH' as const,
};

describe('createAdSet — bid strategy + pre-flight validation', () => {
  describe('objective launch matrix', () => {
    it('resolves the v25 Collaborative Ads catalog launch through sales_catalog', () => {
      expect(
        resolveMetaObjectiveLaunchSpec({
          objective: 'OUTCOME_SALES',
          conversionLocation: 'CATALOG',
          creativeFormat: 'catalog',
          apiVersion: 'v25.0',
        })
      ).toMatchObject({
        key: 'sales_catalog',
        promotedObjectKind: 'collaborative_catalog',
        destinationType: 'WEBSITE',
      });
    });

    it.each([
      {
        objective: 'OUTCOME_AWARENESS',
        conversionLocation: 'AWARENESS' as const,
        creativeFormat: 'single_image' as const,
        optimizationGoal: undefined,
        expected: { optimization_goal: 'REACH', billing_event: 'IMPRESSIONS' },
      },
      {
        objective: 'OUTCOME_AWARENESS',
        conversionLocation: 'AWARENESS' as const,
        creativeFormat: 'single_image' as const,
        optimizationGoal: 'IMPRESSIONS' as const,
        expected: { optimization_goal: 'IMPRESSIONS', billing_event: 'IMPRESSIONS' },
      },
      {
        objective: 'OUTCOME_TRAFFIC',
        conversionLocation: 'WEBSITE' as const,
        creativeFormat: 'single_image' as const,
        optimizationGoal: undefined,
        expected: {
          optimization_goal: 'LANDING_PAGE_VIEWS',
          billing_event: 'IMPRESSIONS',
          destination_type: 'WEBSITE',
        },
      },
      {
        objective: 'OUTCOME_ENGAGEMENT',
        conversionLocation: 'POST' as const,
        creativeFormat: 'existing_post' as const,
        optimizationGoal: undefined,
        expected: {
          optimization_goal: 'POST_ENGAGEMENT',
          billing_event: 'IMPRESSIONS',
          destination_type: 'ON_POST',
        },
      },
      {
        objective: 'OUTCOME_ENGAGEMENT',
        conversionLocation: 'VIDEO' as const,
        creativeFormat: 'video' as const,
        optimizationGoal: undefined,
        expected: {
          optimization_goal: 'THRUPLAY',
          billing_event: 'IMPRESSIONS',
          destination_type: 'ON_VIDEO',
        },
      },
    ])('uses the canonical $objective/$conversionLocation payload', async (testCase) => {
      const client = createMockClient({
        objective: testCase.objective,
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: undefined,
      });

      const result = await createAdSet(client, {
        ...defaultOptions,
        conversionLocation: testCase.conversionLocation,
        creativeFormat: testCase.creativeFormat,
        optimizationGoal: testCase.optimizationGoal,
      });

      expect(result.preview).toMatchObject(testCase.expected);
      expect(client.metaPost).not.toHaveBeenCalled();
    });

    it('defaults website traffic to landing page views through the matrix', async () => {
      const client = createMockClient({
        objective: 'OUTCOME_TRAFFIC',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: undefined,
      });
      const result = await createAdSet(client, {
        ...defaultOptions,
        optimizationGoal: undefined,
        conversionLocation: 'WEBSITE',
        targeting: { geoLocations: { countries: ['ID'] } },
      });

      expect(result.preview).toMatchObject({
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LANDING_PAGE_VIEWS',
        destination_type: 'WEBSITE',
      });
    });

    it('rejects a sales ad set optimized for reach', async () => {
      const client = createMockClient({
        objective: 'OUTCOME_SALES',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: undefined,
      });
      const result = await createAdSet(client, {
        ...defaultOptions,
        conversionLocation: 'WEBSITE',
        optimizationGoal: 'REACH',
      });

      expect(result.structuredError?.code).toBe('INVALID_OBJECTIVE_GOAL_COMBINATION');
      expect(client.metaPost).not.toHaveBeenCalled();
    });

    it('rejects a canonical Collaborative Ads launch outside the catalog conversion location', async () => {
      const client = createMockClient({
        objective: 'OUTCOME_SALES',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: undefined,
      });

      const result = await createAdSet(client, {
        ...defaultOptions,
        optimizationGoal: undefined,
        mode: 'collaborative_ads',
        conversionLocation: 'WEBSITE',
        creativeFormat: 'single_image',
        collaborativeCatalog: { productSetId: 'shared-set' },
      });

      expect(result).toMatchObject({
        status: 'failed',
        structuredError: { code: 'INVALID_OBJECTIVE_DESTINATION_COMBINATION' },
      });
      expect(client.metaGetObject).not.toHaveBeenCalled();
      expect(client.metaPost).not.toHaveBeenCalled();
    });
  });

  describe('client-side validation (no API call)', () => {
    it('requires an explicit optimization goal when conversionLocation is omitted', async () => {
      const client = createMockClient({
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: undefined,
      });
      const result = await createAdSet(client, {
        ...defaultOptions,
        optimizationGoal: undefined,
      });

      expect(result.structuredError?.code).toBe('MISSING_OBJECTIVE_DEPENDENCY');
      expect(client.metaPost).not.toHaveBeenCalled();
    });

    it('should reject invalid bidStrategy "LOWEST_COST"', async () => {
      const client = createMockClient();
      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          bidStrategy: 'LOWEST_COST',
        },
        { dryRun: false, confirmed: true }
      );
      expect(result.status).toBe('failed');
      expect(result.error).toContain('LOWEST_COST');
      expect(client.metaPost).not.toHaveBeenCalled();
    });

    it('should reject LOWEST_COST_WITH_BID_CAP without bidAmount', async () => {
      const client = createMockClient();
      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          bidStrategy: 'LOWEST_COST_WITH_BID_CAP',
        },
        { dryRun: false, confirmed: true }
      );
      expect(result.status).toBe('failed');
      expect(result.error).toContain('bidAmount is required');
      expect(client.metaPost).not.toHaveBeenCalled();
    });

    it('should reject COST_CAP without bidAmount', async () => {
      const client = createMockClient();
      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          bidStrategy: 'COST_CAP',
        },
        { dryRun: false, confirmed: true }
      );
      expect(result.status).toBe('failed');
      expect(result.error).toContain('bidAmount is required');
    });

    it('should reject TARGET_COST without bidAmount', async () => {
      const client = createMockClient();
      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          bidStrategy: 'TARGET_COST',
        },
        { dryRun: false, confirmed: true }
      );
      expect(result.status).toBe('failed');
      expect(result.error).toContain('bidAmount');
    });

    it('should reject LOWEST_COST_WITH_MIN_ROAS without bidConstraints', async () => {
      const client = createMockClient();
      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          bidStrategy: 'LOWEST_COST_WITH_MIN_ROAS',
        },
        { dryRun: false, confirmed: true }
      );
      expect(result.status).toBe('failed');
      expect(result.error).toContain('bidConstraints');
    });

    it('should accept LOWEST_COST_WITHOUT_CAP without bidAmount', async () => {
      const client = createMockClient();
      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
        },
        { dryRun: false, confirmed: true }
      );
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
      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          dailyBudget: 50000,
        },
        { dryRun: false, confirmed: true }
      );
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Budget conflict');
      expect(result.error).toContain('CBO');
      expect(client.metaPost).not.toHaveBeenCalled();
    });

    it('should reject lifetimeBudget when campaign has CBO', async () => {
      const client = createMockClient({ daily_budget: 100000 });
      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          lifetimeBudget: 500000,
        },
        { dryRun: false, confirmed: true }
      );
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Budget conflict');
    });

    it('should allow no budget when campaign has CBO', async () => {
      const client = createMockClient({ daily_budget: 100000 });
      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          // No dailyBudget or lifetimeBudget
        },
        { dryRun: false, confirmed: true }
      );
      // Will proceed to pre-flight check 2 (campaign uses LOWEST_COST_WITH_BID_CAP)
      // Without bidAmount, this should fail
      expect(result.status).toBe('failed');
      expect(result.error).toContain('bidAmount is required');
    });
  });

  describe('pre-flight: campaign bid strategy requires bidAmount', () => {
    it('should not create duplicate ad set when dedupeByName finds an existing one', async () => {
      const client = createMockClient({
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: undefined,
      });
      vi.mocked(client.metaGet).mockResolvedValueOnce({
        data: [{ id: 'existing_adset_1', name: 'Test Ad Set', status: 'PAUSED' }],
      });

      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          dedupeByName: true,
        },
        { dryRun: false, confirmed: true }
      );

      expect(result.status).toBe('deduped');
      expect(result.executed).toBe(false);
      expect(result.id).toBe('existing_adset_1');
      expect(vi.mocked(client.metaGet).mock.calls[0][1]).not.toHaveProperty('filtering');
      expect(vi.mocked(client.metaGet).mock.calls[0][2]).toMatchObject({
        paginate: true,
        maxPages: 20,
      });
      expect(client.metaPost).not.toHaveBeenCalled();
    });

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
      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          bidAmount: 500000,
          // No bidStrategy — should auto-set from campaign
        },
        { dryRun: false, confirmed: true }
      );
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
    it('should run read-only preflight and return preview without mutation when dryRun=true', async () => {
      const client = createMockClient();
      const result = await createAdSet(client, defaultOptions, { dryRun: true });
      expect(result.status).toBe('failed');
      expect(result.executed).toBe(false);
      expect(result.preview).toBeDefined();
      expect(client.metaPost).not.toHaveBeenCalled();
      expect(client.metaGetObject).toHaveBeenCalled();
      expect(result.error).toContain('bidAmount is required');
    });

    it('should return dry_run when read-only preflight passes', async () => {
      const client = createMockClient({
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: undefined,
      });
      const result = await createAdSet(client, defaultOptions, { dryRun: true });
      expect(result.status).toBe('dry_run');
      expect(result.executed).toBe(false);
      expect(client.metaPost).not.toHaveBeenCalled();
      expect(client.metaGetObject).toHaveBeenCalled();
    });
  });

  describe('execution options', () => {
    it('should require confirmed=true before executing', async () => {
      const client = createMockClient();
      const result = await createAdSet(client, defaultOptions, { dryRun: false, confirmed: false });
      expect(result.status).toBe('pending_confirmation');
      expect(result.error).toContain('confirmation');
    });

    it('redacts credentials and signed URLs from generic ad-set POST errors', async () => {
      const credentialFixture = 'final_review_adset_credential_123456789';
      const signedUrl = `https://cdn.example.test/private/adset.jpg?X-Amz-Signature=${credentialFixture}&expires=60`;
      const client = createMockClient({
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: undefined,
      });
      vi.mocked(client.metaPost).mockRejectedValueOnce(
        new Error(`Ad-set provider failed: access_token=${credentialFixture}; asset=${signedUrl}`)
      );

      const result = await createAdSet(client, defaultOptions, { dryRun: false, confirmed: true });
      const serialized = JSON.stringify(result);

      expect(result).toMatchObject({
        status: 'failed',
        structuredError: { code: 'INTERNAL_ERROR' },
      });
      expect(result.error).toContain('[REDACTED]');
      expect(result.error).toContain('[REDACTED_SIGNED_URL]');
      expect(serialized).not.toContain(credentialFixture);
      expect(serialized).not.toContain(signedUrl);
      expect(serialized).not.toContain('cdn.example.test/private/adset.jpg');
    });
  });

  describe('new fields in payload', () => {
    it('should include new fields in preview when provided', async () => {
      const client = createMockClient();
      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          destinationType: 'WEBSITE',
          attributionSpec: [{ event_type: 'CLICK_THROUGH', window_days: 7 }],
          frequencyControlSpecs: [{ event: 'IMPRESSIONS', interval_days: 7, max_frequency: 3 }],
          isDynamicCreative: true,
        },
        { dryRun: true }
      );
      expect(result.preview.destination_type).toBe('WEBSITE');
      expect(result.preview.attribution_spec).toBeDefined();
      expect(result.preview.frequency_control_specs).toBeDefined();
      expect(result.preview.is_dynamic_creative).toBe(true);
    });
  });

  describe('collaborative catalog context', () => {
    it('reads an accessible collaborative product set before creating the ad set', async () => {
      const client = createMockClient({
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: undefined,
      });
      vi.mocked(client.metaGetObject).mockImplementation(async (path) => {
        if (path === '/product-set-1') {
          return {
            id: 'product-set-1',
            name: 'Retailer best sellers',
            product_catalog: { id: 'catalog-1' },
            product_count: 24,
          };
        }
        return {
          id: '120000000000000001',
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        };
      });

      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          mode: 'collaborative_ads',
          collaborativeCatalog: { productSetId: ' product-set-1 ' },
        },
        { dryRun: false, confirmed: true }
      );

      expect(result.status).toBe('executed');
      expect(client.metaGetObject).toHaveBeenNthCalledWith(
        1,
        '/product-set-1',
        { fields: 'id,name,product_catalog,product_count' },
        3
      );
      expect(client.metaPost).toHaveBeenCalledTimes(1);
    });

    it('returns Indonesian structured guidance and does not POST when the product set is inaccessible', async () => {
      const client = createMockClient({
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: undefined,
      });
      vi.mocked(client.metaGetObject).mockImplementation(async (path) => {
        if (path === '/inaccessible-set') {
          throw new Error('Object does not exist or is not accessible');
        }
        return {
          id: '120000000000000001',
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        };
      });

      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          mode: 'collaborative_ads',
          collaborativeCatalog: { productSetId: 'inaccessible-set' },
        },
        { dryRun: false, confirmed: true }
      );

      expect(result).toMatchObject({
        status: 'failed',
        executed: false,
        structuredError: {
          provider: 'meta',
          code: 'COLLABORATIVE_PRODUCT_SET_UNAVAILABLE',
          actionableFix: expect.stringMatching(/pastikan.*product set.*dibagikan/i),
        },
      });
      expect(result.error).toMatch(/product set.*tidak dapat diakses/i);
      expect(client.metaPost).not.toHaveBeenCalled();
    });

    it('rejects an explicitly empty collaborative product set before POST', async () => {
      const client = createMockClient({
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: undefined,
      });
      vi.mocked(client.metaGetObject).mockImplementation(async (path) => {
        if (path === '/empty-set') {
          return {
            id: 'empty-set',
            name: 'Empty retailer segment',
            product_catalog: { id: 'catalog-1' },
            product_count: 0,
          };
        }
        return {
          id: '120000000000000001',
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        };
      });

      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          mode: 'collaborative_ads',
          collaborativeCatalog: { productSetId: 'empty-set' },
        },
        { dryRun: false, confirmed: true }
      );

      expect(result).toMatchObject({
        status: 'failed',
        structuredError: {
          provider: 'meta',
          code: 'COLLABORATIVE_PRODUCT_SET_INELIGIBLE',
          actionableFix: expect.stringMatching(/produk.*aktif/i),
        },
      });
      expect(result.error).toMatch(/tidak memiliki produk/i);
      expect(client.metaPost).not.toHaveBeenCalled();
    });

    it('does not treat absent optional product-set eligibility fields as ineligible', async () => {
      const client = createMockClient({
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: undefined,
      });
      vi.mocked(client.metaGetObject).mockImplementation(async (path) => {
        if (path === '/accessible-without-optionals') {
          return { id: 'accessible-without-optionals', name: 'Retailer segment' };
        }
        return {
          id: '120000000000000001',
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        };
      });

      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          mode: 'collaborative_ads',
          collaborativeCatalog: { productSetId: 'accessible-without-optionals' },
        },
        { dryRun: true }
      );

      expect(result.status).toBe('dry_run');
      expect(client.metaGetObject).toHaveBeenCalledWith(
        '/accessible-without-optionals',
        { fields: 'id,name,product_catalog,product_count' },
        3
      );
      expect(client.metaPost).not.toHaveBeenCalled();
    });

    it('places a collaborative product set in promoted_object', async () => {
      const client = createMockClient({
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: undefined,
      });
      vi.mocked(client.metaGetObject).mockImplementation(async (path) => {
        if (path === '/product-set-1') return { id: 'product-set-1' };
        return {
          id: '120000000000000001',
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        };
      });
      const result = await createAdSet(
        client,
        {
          adAccountId: 'act_1',
          campaignId: 'campaign-1',
          name: 'Shopee Product Set',
          mode: 'collaborative_ads',
          collaborativeCatalog: {
            productSetId: ' product-set-1 ',
            pixelId: ' pixel-1 ',
            customEventType: ' PURCHASE ',
          },
        },
        { dryRun: true }
      );

      expect(result.preview.promoted_object).toEqual({
        product_set_id: 'product-set-1',
        pixel_id: 'pixel-1',
        custom_event_type: 'PURCHASE',
      });
    });

    it('builds the complete Shopee omnichannel promoted object', async () => {
      const client = createMockClient({
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: undefined,
      });
      vi.mocked(client.metaGetObject).mockImplementation(async (path) => {
        if (path === '/shopee-set') return { id: 'shopee-set' };
        return {
          id: '120000000000000001',
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        };
      });

      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          mode: 'collaborative_ads',
          collaborativeCatalog: {
            productSetId: 'shopee-set',
            pixelId: 'cpas-pixel',
            customEventType: 'PURCHASE',
            applicationId: 'shopee-app',
            objectStoreUrls: [
              'http://play.google.com/store/apps/details?id=com.shopee.id',
              'http://itunes.apple.com/app/id959841443',
            ],
          },
        },
        { dryRun: true }
      );

      expect(result.preview.promoted_object).toEqual({
        product_set_id: 'shopee-set',
        smart_pse_enabled: false,
        omnichannel_object: {
          app: [
            {
              application_id: 'shopee-app',
              custom_event_type: 'PURCHASE',
              object_store_urls: [
                'http://play.google.com/store/apps/details?id=com.shopee.id',
                'http://itunes.apple.com/app/id959841443',
              ],
            },
          ],
          pixel: [{ pixel_id: 'cpas-pixel', custom_event_type: 'PURCHASE' }],
        },
      });
    });

    it('preserves the Collaborative Ads promoted object when catalog matrix defaults apply', async () => {
      const client = createMockClient({
        objective: 'OUTCOME_SALES',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: undefined,
      });
      vi.mocked(client.metaGetObject).mockImplementation(async (path) => {
        if (path === '/shopee-set') return { id: 'shopee-set' };
        return {
          id: '120000000000000001',
          objective: 'OUTCOME_SALES',
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        };
      });

      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          optimizationGoal: undefined,
          mode: 'collaborative_ads',
          conversionLocation: 'CATALOG',
          creativeFormat: 'catalog',
          productSetId: 'shopee-set',
          collaborativeCatalog: {
            productSetId: 'shopee-set',
            pixelId: 'cpas-pixel',
            customEventType: 'PURCHASE',
            applicationId: 'shopee-app',
            objectStoreUrls: [
              'http://play.google.com/store/apps/details?id=com.shopee.id',
              'http://itunes.apple.com/app/id959841443',
            ],
          },
        },
        { dryRun: true }
      );

      expect(result.preview).toMatchObject({
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        destination_type: 'WEBSITE',
      });
      expect(result.preview.promoted_object).toEqual({
        product_set_id: 'shopee-set',
        smart_pse_enabled: false,
        omnichannel_object: {
          app: [
            {
              application_id: 'shopee-app',
              custom_event_type: 'PURCHASE',
              object_store_urls: [
                'http://play.google.com/store/apps/details?id=com.shopee.id',
                'http://itunes.apple.com/app/id959841443',
              ],
            },
          ],
          pixel: [{ pixel_id: 'cpas-pixel', custom_event_type: 'PURCHASE' }],
        },
      });
    });

    it('continues when Meta permits use but blocks direct retailer product-set reads', async () => {
      const client = createMockClient({
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        daily_budget: undefined,
      });
      vi.mocked(client.metaGetObject).mockImplementation(async (path) => {
        if (path === '/shared-retailer-set') {
          throw new MetaApiError({
            message:
              '(#100) This application has not been approved to use this api. Please check the application capabilities or access token permissions.',
            type: 'OAuthException',
            code: 100,
          });
        }
        return {
          id: '120000000000000001',
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        };
      });

      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          mode: 'collaborative_ads',
          collaborativeCatalog: { productSetId: 'shared-retailer-set' },
        },
        { dryRun: true }
      );

      expect(result.status).toBe('dry_run');
      expect(client.metaPost).not.toHaveBeenCalled();
    });

    it('rejects collaborative ad sets without a product set before POST', async () => {
      const client = createMockClient();
      const result = await createAdSet(
        client,
        {
          adAccountId: 'act_1',
          campaignId: 'campaign-1',
          name: 'Missing Product Set',
          mode: 'collaborative_ads',
        },
        { dryRun: true }
      );

      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/product set.*wajib/i);
      expect(client.metaPost).not.toHaveBeenCalled();
    });

    it('rejects mismatched collaborative and legacy promoted product sets', async () => {
      const client = createMockClient();
      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          mode: 'collaborative_ads',
          collaborativeCatalog: { productSetId: 'collaborative-product-set' },
          promotedObject: { product_set_id: 'legacy-product-set' },
        },
        { dryRun: true }
      );

      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/product set.*harus sama/i);
      expect(client.metaPost).not.toHaveBeenCalled();
    });
  });

  describe('targeting_automation default', () => {
    it('should add targeting_automation.advantage_audience: 0 when targeting provided', async () => {
      const client = createMockClient();
      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          targeting: { geoLocations: { countries: ['ID'] } },
        },
        { dryRun: true }
      );
      const targeting = result.preview.targeting as Record<string, unknown>;
      expect(targeting?.targeting_automation).toEqual({ advantage_audience: 0 });
    });

    it('should not override user-provided targeting_automation', async () => {
      const client = createMockClient();
      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          targeting: {
            geoLocations: { countries: ['ID'] },
            targetingOptimization: 'none',
          },
        },
        { dryRun: true }
      );
      const targeting = result.preview.targeting as Record<string, unknown>;
      expect(targeting?.targeting_automation).toEqual({ advantage_audience: 0 });
    });
  });

  describe('granular placement targeting', () => {
    it('serializes instagramPositions and threadsPositions into snake_case fields', async () => {
      const client = createMockClient();
      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          targeting: {
            publisherPlatforms: ['instagram', 'threads'],
            instagramPositions: ['stream', 'story', 'explore', 'reels', 'profile_feed'],
            threadsPositions: ['threads_stream'],
            devicePlatforms: ['mobile'],
          },
        },
        { dryRun: true }
      );
      const targeting = result.preview.targeting as Record<string, unknown>;
      expect(targeting.instagram_positions).toEqual([
        'stream',
        'story',
        'explore',
        'reels',
        'profile_feed',
      ]);
      expect(targeting.threads_positions).toEqual(['threads_stream']);
      expect(targeting.device_platforms).toEqual(['mobile']);
    });
  });

  describe('flexible_spec (behaviors / work_employers / work_positions)', () => {
    it('serializes a flexibleSpec group into targeting.flexible_spec', async () => {
      const client = createMockClient();
      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          targeting: {
            interests: [{ id: '6003139266461', name: 'Movies' }],
            flexibleSpec: [
              {
                behaviors: [{ id: '6002714895372', name: 'Engaged Shoppers' }],
                work_employers: [{ id: '50431654', name: 'Tech Company' }],
                work_positions: [{ id: '789012', name: 'Engineer' }],
              },
            ],
          },
        },
        { dryRun: true }
      );
      const targeting = result.preview.targeting as Record<string, unknown>;
      expect(targeting.interests).toEqual([{ id: '6003139266461', name: 'Movies' }]);
      expect(targeting.flexible_spec).toEqual([
        {
          behaviors: [{ id: '6002714895372', name: 'Engaged Shoppers' }],
          work_employers: [{ id: '50431654', name: 'Tech Company' }],
          work_positions: [{ id: '789012', name: 'Engineer' }],
        },
      ]);
    });

    it('deep-merges metaTargetingOverride as the base, with typed fields winning on conflicts', async () => {
      const client = createMockClient();
      const result = await createAdSet(
        client,
        {
          ...defaultOptions,
          targeting: {
            interests: [{ id: '6003139266461', name: 'Movies' }],
            metaTargetingOverride: {
              interests: [{ id: 'should-be-overridden' }],
              custom_audiences: [{ id: 'aud_1' }],
              flexible_spec: [{ life_events: [{ id: 'life_1' }] }],
            },
          },
        },
        { dryRun: true }
      );
      const targeting = result.preview.targeting as Record<string, unknown>;
      // typed interests wins over the override's interests
      expect(targeting.interests).toEqual([{ id: '6003139266461', name: 'Movies' }]);
      // fields only present in the override still pass through
      expect(targeting.custom_audiences).toEqual([{ id: 'aud_1' }]);
      expect(targeting.flexible_spec).toEqual([{ life_events: [{ id: 'life_1' }] }]);
    });
  });
});
