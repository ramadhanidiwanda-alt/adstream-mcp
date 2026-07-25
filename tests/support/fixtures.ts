/**
 * Typed fixture factories.
 *
 * Test objects that stand in for production config/request types must satisfy the
 * real interface, otherwise a test can assert against a shape that can never occur
 * at runtime. These factories supply the required fields with the same defaults
 * production uses, and take a `Partial` override so each test still states only
 * the fields it actually cares about.
 */
import type { HttpMcpConfig } from '../../src/mcp/http.js';

/**
 * A complete `HttpMcpConfig`.
 *
 * The OAuth TTLs are required on the interface and always populated by
 * `parseHttpMcpConfig`; the defaults here mirror the ones it applies when the
 * corresponding env vars are unset.
 */
export function httpMcpConfig(overrides: Partial<HttpMcpConfig> = {}): HttpMcpConfig {
  return {
    enabled: true,
    host: '127.0.0.1',
    port: 0,
    path: '/mcp',
    transport: 'http',
    authCodeTtlSeconds: 300,
    accessTokenTtlSeconds: 86400,
    ...overrides,
  };
}
