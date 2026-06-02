import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseBrokerConfigFromEnv } from '../../src/broker/config.js';

describe('parseBrokerConfigFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('local mode (default)', () => {
    it('defaults to local mode when BROKER_RUNTIME_MODE is not set', () => {
      delete process.env.BROKER_RUNTIME_MODE;

      const config = parseBrokerConfigFromEnv();

      expect(config.mode).toBe('local');
      expect(config.cuanInsight).toBeUndefined();
    });

    it('parses local mode explicitly', () => {
      process.env.BROKER_RUNTIME_MODE = 'local';

      const config = parseBrokerConfigFromEnv();

      expect(config.mode).toBe('local');
      expect(config.cuanInsight).toBeUndefined();
    });

    it('does not require CUAN_INSIGHT_API_BASE_URL in local mode', () => {
      process.env.BROKER_RUNTIME_MODE = 'local';
      delete process.env.CUAN_INSIGHT_API_BASE_URL;

      const config = parseBrokerConfigFromEnv();

      expect(config.mode).toBe('local');
    });
  });

  describe('remote mode', () => {
    it('parses remote mode with base URL', () => {
      process.env.BROKER_RUNTIME_MODE = 'remote';
      process.env.CUAN_INSIGHT_API_BASE_URL = 'https://api.example.com';

      const config = parseBrokerConfigFromEnv();

      expect(config.mode).toBe('remote');
      expect(config.cuanInsight).toBeDefined();
      expect(config.cuanInsight?.cuanInsightBaseUrl).toBe('https://api.example.com');
    });

    it('trims whitespace from base URL', () => {
      process.env.BROKER_RUNTIME_MODE = 'remote';
      process.env.CUAN_INSIGHT_API_BASE_URL = '  https://api.example.com  ';

      const config = parseBrokerConfigFromEnv();

      expect(config.cuanInsight?.cuanInsightBaseUrl).toBe('https://api.example.com');
    });

    it('throws when remote mode is missing CUAN_INSIGHT_API_BASE_URL', () => {
      process.env.BROKER_RUNTIME_MODE = 'remote';
      delete process.env.CUAN_INSIGHT_API_BASE_URL;

      expect(() => parseBrokerConfigFromEnv()).toThrow(
        'CUAN_INSIGHT_API_BASE_URL is required when BROKER_RUNTIME_MODE=remote'
      );
    });

    it('throws when CUAN_INSIGHT_API_BASE_URL is empty string', () => {
      process.env.BROKER_RUNTIME_MODE = 'remote';
      process.env.CUAN_INSIGHT_API_BASE_URL = '';

      expect(() => parseBrokerConfigFromEnv()).toThrow(
        'CUAN_INSIGHT_API_BASE_URL is required when BROKER_RUNTIME_MODE=remote'
      );
    });

    it('throws when CUAN_INSIGHT_API_BASE_URL is whitespace only', () => {
      process.env.BROKER_RUNTIME_MODE = 'remote';
      process.env.CUAN_INSIGHT_API_BASE_URL = '   ';

      expect(() => parseBrokerConfigFromEnv()).toThrow(
        'CUAN_INSIGHT_API_BASE_URL is required when BROKER_RUNTIME_MODE=remote'
      );
    });

    it('parses optional credential resolve path', () => {
      process.env.BROKER_RUNTIME_MODE = 'remote';
      process.env.CUAN_INSIGHT_API_BASE_URL = 'https://api.example.com';
      process.env.CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH = '/v2/credentials/resolve';

      const config = parseBrokerConfigFromEnv();

      expect(config.cuanInsight?.cuanInsightEndpointPath).toBe('/v2/credentials/resolve');
    });

    it('trims whitespace from credential resolve path', () => {
      process.env.BROKER_RUNTIME_MODE = 'remote';
      process.env.CUAN_INSIGHT_API_BASE_URL = 'https://api.example.com';
      process.env.CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH = '  /v2/credentials/resolve  ';

      const config = parseBrokerConfigFromEnv();

      expect(config.cuanInsight?.cuanInsightEndpointPath).toBe('/v2/credentials/resolve');
    });

    it('leaves endpoint path undefined when not provided', () => {
      process.env.BROKER_RUNTIME_MODE = 'remote';
      process.env.CUAN_INSIGHT_API_BASE_URL = 'https://api.example.com';
      delete process.env.CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH;

      const config = parseBrokerConfigFromEnv();

      expect(config.cuanInsight?.cuanInsightEndpointPath).toBeUndefined();
    });

    it('parses optional MCP token without exposing it', () => {
      process.env.BROKER_RUNTIME_MODE = 'remote';
      process.env.CUAN_INSIGHT_API_BASE_URL = 'https://api.example.com';
      process.env.CUAN_INSIGHT_MCP_TOKEN = '  caller-token-secret  ';

      const config = parseBrokerConfigFromEnv();

      expect(config.cuanInsight?.cuanInsightMcpToken).toBe('caller-token-secret');
    });

    it('parses optional timeout as positive integer', () => {
      process.env.BROKER_RUNTIME_MODE = 'remote';
      process.env.CUAN_INSIGHT_API_BASE_URL = 'https://api.example.com';
      process.env.CUAN_INSIGHT_REQUEST_TIMEOUT_MS = '5000';

      const config = parseBrokerConfigFromEnv();

      expect(config.cuanInsight?.cuanInsightTimeoutMs).toBe(5000);
    });

    it('leaves timeout undefined when not provided', () => {
      process.env.BROKER_RUNTIME_MODE = 'remote';
      process.env.CUAN_INSIGHT_API_BASE_URL = 'https://api.example.com';
      delete process.env.CUAN_INSIGHT_REQUEST_TIMEOUT_MS;

      const config = parseBrokerConfigFromEnv();

      expect(config.cuanInsight?.cuanInsightTimeoutMs).toBeUndefined();
    });

    it('throws when timeout is not a number', () => {
      process.env.BROKER_RUNTIME_MODE = 'remote';
      process.env.CUAN_INSIGHT_API_BASE_URL = 'https://api.example.com';
      process.env.CUAN_INSIGHT_REQUEST_TIMEOUT_MS = 'not-a-number';

      expect(() => parseBrokerConfigFromEnv()).toThrow(
        'CUAN_INSIGHT_REQUEST_TIMEOUT_MS must be a positive integer'
      );
    });

    it('throws when timeout is zero', () => {
      process.env.BROKER_RUNTIME_MODE = 'remote';
      process.env.CUAN_INSIGHT_API_BASE_URL = 'https://api.example.com';
      process.env.CUAN_INSIGHT_REQUEST_TIMEOUT_MS = '0';

      expect(() => parseBrokerConfigFromEnv()).toThrow(
        'CUAN_INSIGHT_REQUEST_TIMEOUT_MS must be a positive integer'
      );
    });

    it('throws when timeout is negative', () => {
      process.env.BROKER_RUNTIME_MODE = 'remote';
      process.env.CUAN_INSIGHT_API_BASE_URL = 'https://api.example.com';
      process.env.CUAN_INSIGHT_REQUEST_TIMEOUT_MS = '-1000';

      expect(() => parseBrokerConfigFromEnv()).toThrow(
        'CUAN_INSIGHT_REQUEST_TIMEOUT_MS must be a positive integer'
      );
    });
  });

  describe('test mode', () => {
    it('parses test mode', () => {
      process.env.BROKER_RUNTIME_MODE = 'test';

      const config = parseBrokerConfigFromEnv();

      expect(config.mode).toBe('test');
      expect(config.cuanInsight).toBeUndefined();
    });

    it('does not require CUAN_INSIGHT_API_BASE_URL in test mode', () => {
      process.env.BROKER_RUNTIME_MODE = 'test';
      delete process.env.CUAN_INSIGHT_API_BASE_URL;

      const config = parseBrokerConfigFromEnv();

      expect(config.mode).toBe('test');
    });
  });

  describe('invalid mode', () => {
    it('throws when mode is invalid', () => {
      process.env.BROKER_RUNTIME_MODE = 'invalid';

      expect(() => parseBrokerConfigFromEnv()).toThrow(
        "Invalid BROKER_RUNTIME_MODE: invalid. Must be 'local', 'remote', or 'test'."
      );
    });
  });
});
