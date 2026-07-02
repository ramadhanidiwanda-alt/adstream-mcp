import { AdsBroker } from './AdsBroker.js';
import { CredentialResolver } from './credentials.js';
import { ProviderRegistry } from './providerRegistry.js';
import { MetaAdsAdapter } from '../providers/meta/MetaAdsAdapter.js';
import { TikTokAdsAdapter } from '../providers/tiktok/TikTokAdsAdapter.js';
import { GoogleAdsAdapter } from '../providers/google/GoogleAdsAdapter.js';

export function createDefaultProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(new MetaAdsAdapter());
  registry.register(new TikTokAdsAdapter());
  registry.register(new GoogleAdsAdapter());
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

import type { RemoteBrokerConfig, BrokerConfig } from './config.js';
import { createCuanInsightCredentialClient } from './cuanInsightClient.js';
import { CuanInsightCredentialProvider } from './credentials.js';

/**
 * Create a credential resolver configured for remote mode.
 *
 * This resolver uses the Cuan Insight credential client to resolve credentials
 * from a remote Cuan Insight API endpoint. It never falls back to environment
 * variables.
 *
 * Supports two auth modes:
 * - mcp_token (default): legacy MCP token flow
 * - connection_key: Connection Key from Cuan Insight UI
 *
 * Security rules:
 * - baseUrl must be provided via config, never hardcoded
 * - Remote mode never falls back to ENV credentials
 * - All errors are safe to surface (no token leaks)
 * - Connection keys and MCP tokens are never logged
 *
 * @param config - Remote broker configuration
 * @returns CredentialResolver configured for remote mode
 */
export function createRemoteCredentialResolver(
  config: RemoteBrokerConfig
): CredentialResolver {
  // Build client config with auth mode support
  const clientConfig = {
    baseUrl: config.cuanInsightBaseUrl,
    endpointPath: config.cuanInsightEndpointPath,
    timeoutMs: config.cuanInsightTimeoutMs,
    supabaseAnonKey: config.cuanInsightSupabaseAnonKey,
    mcpTokenHeaderName: config.cuanInsightMcpTokenHeaderName,
    authMode: config.cuanInsightAuthMode,
    connectionKey: config.cuanInsightConnectionKey,
  };

  // Create Cuan Insight HTTP client
  const client = createCuanInsightCredentialClient({
    config: clientConfig,
  });

  // Create Cuan Insight credential provider with both auth modes
  const cuanInsightProvider = new CuanInsightCredentialProvider(client, {
    callerToken: config.cuanInsightMcpToken,
    connectionKey: config.cuanInsightConnectionKey,
    authMode: config.cuanInsightAuthMode,
  });

  // Create resolver in remote mode
  return new CredentialResolver({
    mode: 'remote',
    cuanInsightProvider,
  });
}

/**
 * Create an AdsBroker configured for remote mode.
 *
 * This broker uses the Cuan Insight credential client to resolve credentials
 * from a remote Cuan Insight API endpoint. It never falls back to environment
 * variables.
 *
 * Security rules:
 * - baseUrl must be provided via config, never hardcoded
 * - Remote mode never falls back to ENV credentials
 * - All errors are safe to surface (no token leaks)
 *
 * @param config - Remote broker configuration
 * @returns AdsBroker configured for remote mode
 */
export function createRemoteAdsBroker(config: RemoteBrokerConfig): AdsBroker {
  return new AdsBroker({
    providerRegistry: createDefaultProviderRegistry(),
    credentialResolver: createRemoteCredentialResolver(config),
  });
}

/**
 * Create an AdsBroker from parsed broker configuration.
 *
 * This factory function selects the appropriate broker based on the runtime mode:
 * - 'local': Uses environment variables for credentials (default)
 * - 'remote': Uses Cuan Insight API for credentials
 * - 'test': Uses test provider (for testing only)
 *
 * @param config - Parsed broker configuration
 * @returns AdsBroker configured for the specified mode
 * @throws Error if remote mode is missing required configuration
 */
export function createAdsBrokerFromConfig(config: BrokerConfig): AdsBroker {
  if (config.mode === 'remote') {
    if (!config.cuanInsight) {
      throw new Error(
        'Remote mode requires cuanInsight configuration'
      );
    }
    return createRemoteAdsBroker(config.cuanInsight);
  }

  // Local or test mode uses default broker
  return createDefaultAdsBroker();
}
