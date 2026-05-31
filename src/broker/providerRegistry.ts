import type { AdsProviderAdapter, AdsProviderId } from './types.js';
import { isAdsProviderId } from './types.js';

export class ProviderRegistry {
  private readonly adapters = new Map<AdsProviderId, AdsProviderAdapter>();

  register(adapter: AdsProviderAdapter): void {
    if (!isAdsProviderId(adapter.id)) {
      throw new Error('Unsupported ads provider');
    }

    if (this.adapters.has(adapter.id)) {
      throw new Error(`Provider adapter already registered: ${adapter.id}`);
    }

    this.adapters.set(adapter.id, adapter);
  }

  get(provider: unknown): AdsProviderAdapter | undefined {
    if (!isAdsProviderId(provider)) {
      throw new Error('Unsupported ads provider');
    }

    return this.adapters.get(provider);
  }

  list(): AdsProviderAdapter[] {
    return Array.from(this.adapters.values());
  }
}
