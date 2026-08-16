import { describe, expect, it } from 'vitest';
import { TikTokAdsAdapter } from '../src/providers/tiktok/TikTokAdsAdapter.js';
import type { TikTokApiClient } from '../src/tiktokClient.js';
import type { AdsBrokerRequest } from '../src/broker/types.js';

/**
 * Every tool below publishes dryRun/confirmed and describes them as a preview
 * gate. The Meta adapter honours that gate inside its tool functions; the TikTok
 * tool functions take no such options, so the adapter has to. Before that gate
 * existed a default call — the preview step the descriptions tell callers to
 * start with — created the entity for real and answered executed: true.
 *
 * These tests assert the gate from the outside: the API client must not be
 * touched at all until the caller has both cleared dryRun and confirmed.
 */
function createSpyClient() {
  const calls: Array<{ path: string; body: unknown }> = [];
  const client = {
    get: async <T>() => ({}) as T,
    post: async <T>(path: string, body: unknown) => {
      calls.push({ path, body });
      return { campaign_id: 'c1', adgroup_id: 'g1', ad_ids: ['a1'] } as T;
    },
  } as unknown as TikTokApiClient;

  return { client, calls };
}

function tiktokRequest(params: Record<string, unknown>): AdsBrokerRequest {
  return {
    provider: 'tiktok',
    accountId: 'advertiser_1',
    params,
    credentials: {
      provider: 'tiktok',
      accessToken: 'secret-token',
      accountId: 'advertiser_1',
      source: 'test',
    },
  } as unknown as AdsBrokerRequest;
}

const gatedWrites = [
  {
    tool: 'ads_create_campaign',
    method: 'createCampaign',
    params: { campaignName: 'Test', objectiveType: 'PRODUCT_SALES', budget: 50000 },
  },
  {
    tool: 'ads_create_adset',
    method: 'createAdSet',
    params: { campaignId: 'c1', name: 'AdGroup', budget: 50000, optimizationGoal: 'CONVERT' },
  },
  {
    tool: 'ads_create_ad',
    method: 'createAd',
    params: { adSetId: 'g1', name: 'Ad', creatives: [] },
  },
  {
    tool: 'ads_create_ecommerce_campaign_bundle',
    method: 'createEcommerceCampaignBundle',
    params: { campaignName: 'Bundle', objectiveType: 'PRODUCT_SALES', storeIds: ['s1'] },
  },
  {
    tool: 'tiktok_gmv_max_create_campaign',
    method: 'gmvMaxCreateCampaign',
    params: {
      campaignName: 'GMV',
      objectiveType: 'PRODUCT_SALES',
      storeIds: ['s1'],
      shoppingAdsType: 'PRODUCT',
    },
  },
] as const;

type WriteMethod = (request: AdsBrokerRequest) => Promise<{
  ok: boolean;
  data?: { status?: string; executed?: boolean; preview?: unknown; error?: string };
}>;

function callWrite(adapter: TikTokAdsAdapter, method: string, request: AdsBrokerRequest) {
  const fn = (adapter as unknown as Record<string, WriteMethod>)[method];
  return fn.call(adapter, request);
}

describe('TikTok write tools honour the dryRun/confirmed gate', () => {
  it.each(gatedWrites)('$tool previews by default without calling TikTok', async (write) => {
    const { client, calls } = createSpyClient();
    const adapter = new TikTokAdsAdapter({ client });

    const response = await callWrite(adapter, write.method, tiktokRequest({ ...write.params }));

    expect(response.ok).toBe(true);
    expect(response.data?.status).toBe('dry_run');
    expect(response.data?.executed).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it.each(gatedWrites)('$tool refuses dryRun=false without confirmed', async (write) => {
    const { client, calls } = createSpyClient();
    const adapter = new TikTokAdsAdapter({ client });

    const response = await callWrite(
      adapter,
      write.method,
      tiktokRequest({ ...write.params, dryRun: false })
    );

    expect(response.data?.status).toBe('pending_confirmation');
    expect(response.data?.executed).toBe(false);
    expect(response.data?.error).toMatch(/confirmation/i);
    expect(calls).toHaveLength(0);
  });

  it.each(gatedWrites)('$tool executes once dryRun=false and confirmed', async (write) => {
    const { client, calls } = createSpyClient();
    const adapter = new TikTokAdsAdapter({ client });

    const response = await callWrite(
      adapter,
      write.method,
      tiktokRequest({ ...write.params, dryRun: false, confirmed: true })
    );

    expect(response.data?.status).toBe('executed');
    expect(response.data?.executed).toBe(true);
    expect(calls.length).toBeGreaterThan(0);
  });

  it('previews the payload it would send, not an empty object', async () => {
    const { client } = createSpyClient();
    const adapter = new TikTokAdsAdapter({ client });

    const response = await callWrite(
      adapter,
      'createCampaign',
      tiktokRequest({ campaignName: 'Named For Preview', objectiveType: 'PRODUCT_SALES' })
    );

    expect(response.data?.preview).toMatchObject({
      advertiserId: 'advertiser_1',
      campaignName: 'Named For Preview',
      objectiveType: 'PRODUCT_SALES',
    });
  });
});
