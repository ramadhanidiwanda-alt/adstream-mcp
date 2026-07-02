import { describe, it, expect } from 'vitest';
import {
  createDefaultAdsBroker,
  createDefaultCredentialResolver,
  createDefaultProviderRegistry,
  createRemoteCredentialResolver,
  createRemoteAdsBroker,
  createAdsBrokerFromConfig,
} from '../../src/broker/factory.js';
import type { BrokerConfig } from '../../src/broker/config.js';

describe('createDefaultProviderRegistry', () => {
  it('creates a provider registry with Meta, TikTok, and Google adapters', () => {
    const registry = createDefaultProviderRegistry();

    expect(registry).toBeDefined();
    expect(registry.get('meta')).toBeDefined();
    expect(registry.get('tiktok')).toBeDefined();
    expect(registry.get('google')).toBeDefined();
  });
});

describe('createDefaultCredentialResolver', () => {
  it('creates a credential resolver in local mode', () => {
    const resolver = createDefaultCredentialResolver();

    expect(resolver).toBeDefined();
  });
});

describe('createDefaultAdsBroker', () => {
  it('creates an ads broker with local mode resolver', () => {
    const broker = createDefaultAdsBroker();

    expect(broker).toBeDefined();
  });

  it('behavior unchanged from previous versions', () => {
    const broker = createDefaultAdsBroker();

    expect(broker).toBeDefined();
    expect(broker.listAccounts).toBeDefined();
    expect(broker.getCampaignPerformance).toBeDefined();
  });
});

describe('createRemoteCredentialResolver', () => {
  it('creates a credential resolver in remote mode', () => {
    const resolver = createRemoteCredentialResolver({
      cuanInsightBaseUrl: 'https://api.example.com',
    });

    expect(resolver).toBeDefined();
  });

  it('accepts optional endpoint path', () => {
    const resolver = createRemoteCredentialResolver({
      cuanInsightBaseUrl: 'https://api.example.com',
      cuanInsightEndpointPath: '/v2/credentials/resolve',
    });

    expect(resolver).toBeDefined();
  });

  it('accepts optional timeout', () => {
    const resolver = createRemoteCredentialResolver({
      cuanInsightBaseUrl: 'https://api.example.com',
      cuanInsightTimeoutMs: 5000,
    });

    expect(resolver).toBeDefined();
  });
});

describe('createRemoteAdsBroker', () => {
  it('creates an ads broker with remote mode resolver', () => {
    const broker = createRemoteAdsBroker({
      cuanInsightBaseUrl: 'https://api.example.com',
    });

    expect(broker).toBeDefined();
    expect(broker.listAccounts).toBeDefined();
    expect(broker.getCampaignPerformance).toBeDefined();
  });

  it('accepts full remote config', () => {
    const broker = createRemoteAdsBroker({
      cuanInsightBaseUrl: 'https://api.example.com',
      cuanInsightEndpointPath: '/v2/credentials/resolve',
      cuanInsightTimeoutMs: 5000,
    });

    expect(broker).toBeDefined();
  });
});

describe('createAdsBrokerFromConfig', () => {
  it('creates local broker when mode is local', () => {
    const config: BrokerConfig = {
      mode: 'local',
    };

    const broker = createAdsBrokerFromConfig(config);

    expect(broker).toBeDefined();
  });

  it('creates remote broker when mode is remote', () => {
    const config: BrokerConfig = {
      mode: 'remote',
      cuanInsight: {
        cuanInsightBaseUrl: 'https://api.example.com',
      },
    };

    const broker = createAdsBrokerFromConfig(config);

    expect(broker).toBeDefined();
  });

  it('creates test broker when mode is test', () => {
    const config: BrokerConfig = {
      mode: 'test',
    };

    const broker = createAdsBrokerFromConfig(config);

    expect(broker).toBeDefined();
  });

  it('throws when remote mode is missing cuanInsight config', () => {
    const config: BrokerConfig = {
      mode: 'remote',
    };

    expect(() => createAdsBrokerFromConfig(config)).toThrow(
      'Remote mode requires cuanInsight configuration'
    );
  });
});
