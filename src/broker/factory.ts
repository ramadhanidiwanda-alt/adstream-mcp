import { AdsBroker } from './AdsBroker.js';
import { CredentialResolver } from './credentials.js';
import { ProviderRegistry } from './providerRegistry.js';
import type {
  AdsBrokerResponse,
  AdsMetricRecord,
  AdsProviderAdapter,
  AdsProviderCapabilities,
} from './types.js';
import { MetaAdsAdapter } from '../providers/meta/MetaAdsAdapter.js';

export function createDefaultProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(new MetaAdsAdapter());
  registry.register(new NotImplementedTikTokAdsAdapter());
  return registry;
}

export function createDefaultCredentialResolver(): CredentialResolver {
  return new CredentialResolver({ mode: 'local' });
}

export function createDefaultAdsBroker(): AdsBroker {
  return new AdsBroker({
    providerRegistry: createDefaultProviderRegistry(),
    credentialResolver: createDefaultCredentialResolver(),
  });
}

export class NotImplementedTikTokAdsAdapter implements AdsProviderAdapter {
  readonly id = 'tiktok' as const;
  readonly displayName = 'TikTok Ads';
  readonly capabilities: AdsProviderCapabilities = {
    providers: ['tiktok'],
    categories: ['accounts', 'campaigns', 'ad_groups', 'ads', 'creatives', 'insights', 'reports', 'diagnostics'],
    operations: ['read'],
    supportsRaw: false,
  };

  async listAccounts(): Promise<AdsBrokerResponse<never>> {
    return this.notImplemented();
  }

  async getCampaignPerformance(): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.notImplemented();
  }

  async getAdsetOrAdgroupPerformance(): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.notImplemented();
  }

  async getAdPerformance(): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.notImplemented();
  }

  async getCreativePerformance(): Promise<AdsBrokerResponse<AdsMetricRecord[]>> {
    return this.notImplemented();
  }

  private notImplemented(): AdsBrokerResponse<never> {
    return {
      ok: false,
      provider: 'tiktok',
      errors: [
        {
          provider: 'tiktok',
          code: 'NOT_IMPLEMENTED',
          message: 'TikTok Ads adapter is not implemented yet',
        },
      ],
    };
  }
}
