import { AdsBroker } from './AdsBroker.js';
import { CredentialResolver } from './credentials.js';
import { ProviderRegistry } from './providerRegistry.js';
import { MetaAdsAdapter } from '../providers/meta/MetaAdsAdapter.js';
import { TikTokAdsAdapter } from '../providers/tiktok/TikTokAdsAdapter.js';

export function createDefaultProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(new MetaAdsAdapter());
  registry.register(new TikTokAdsAdapter());
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
