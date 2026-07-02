import { describe, expect, it } from 'vitest';
import { ProviderRegistry } from '../src/broker/providerRegistry.js';
import { MetaAdsAdapter } from '../src/providers/meta/MetaAdsAdapter.js';
import { GoogleAdsAdapter } from '../src/providers/google/GoogleAdsAdapter.js';
import type { AdsProviderAdapter } from '../src/broker/types.js';

function createTikTokStub(): AdsProviderAdapter {
  const response = async () => ({ ok: false as const, provider: 'tiktok' as const });
  return {
    id: 'tiktok',
    displayName: 'TikTok Ads',
    capabilities: {
      providers: ['tiktok'],
      categories: ['accounts'],
      operations: ['read'],
    },
    listAccounts: response,
    getCampaignPerformance: response,
    getAdsetOrAdgroupPerformance: response,
    getAdPerformance: response,
    getCreativePerformance: response,
  };
}

describe('ProviderRegistry', () => {
  it('accepts meta, tiktok, and google provider ids', () => {
    const registry = new ProviderRegistry();
    registry.register(new MetaAdsAdapter());
    registry.register(createTikTokStub());
    registry.register(new GoogleAdsAdapter());

    expect(registry.list().map((adapter) => adapter.id)).toEqual(['meta', 'tiktok', 'google']);
  });

  it('rejects unknown provider lookup', () => {
    const registry = new ProviderRegistry();

    expect(() => registry.get('shopee' as never)).toThrow('Unsupported ads provider');
  });

  it('rejects duplicate provider registration', () => {
    const registry = new ProviderRegistry();
    registry.register(new MetaAdsAdapter());

    expect(() => registry.register(new MetaAdsAdapter())).toThrow('Provider adapter already registered: meta');
  });

  it('retrieves registered MetaAdsAdapter', () => {
    const registry = new ProviderRegistry();
    const adapter = new MetaAdsAdapter();
    registry.register(adapter);

    expect(registry.get('meta')).toBe(adapter);
  });
});
