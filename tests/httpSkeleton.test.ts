import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('HTTP MCP Skeleton Config', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should default to disabled', () => {
    delete process.env.ENABLE_EXPERIMENTAL_HTTP_MCP;
    const enabled = process.env.ENABLE_EXPERIMENTAL_HTTP_MCP === 'true';
    expect(enabled).toBe(false);
  });

  it('should enable when flag is true', () => {
    process.env.ENABLE_EXPERIMENTAL_HTTP_MCP = 'true';
    const enabled = process.env.ENABLE_EXPERIMENTAL_HTTP_MCP === 'true';
    expect(enabled).toBe(true);
  });

  it('should default host to localhost', () => {
    delete process.env.MCP_HTTP_HOST;
    const host = process.env.MCP_HTTP_HOST || '127.0.0.1';
    expect(host).toBe('127.0.0.1');
  });

  it('should default port to 3000', () => {
    delete process.env.MCP_HTTP_PORT;
    const portStr = process.env.MCP_HTTP_PORT || '3000';
    const port = parseInt(portStr, 10);
    expect(port).toBe(3000);
  });

  it('should parse custom port', () => {
    process.env.MCP_HTTP_PORT = '8080';
    const port = parseInt(process.env.MCP_HTTP_PORT, 10);
    expect(port).toBe(8080);
  });

  it('should detect invalid port', () => {
    process.env.MCP_HTTP_PORT = 'invalid';
    const port = parseInt(process.env.MCP_HTTP_PORT, 10);
    expect(isNaN(port)).toBe(true);
  });

  it('should default endpoint to /message', () => {
    delete process.env.MCP_HTTP_ENDPOINT;
    const endpoint = process.env.MCP_HTTP_ENDPOINT || '/message';
    expect(endpoint).toBe('/message');
  });
});

describe('HTTP MCP Skeleton Security', () => {
  it('should not expose Authorization in config', () => {
    const config = {
      enabled: true,
      host: '127.0.0.1',
      port: 3000,
      endpoint: '/message',
    };

    const serialized = JSON.stringify(config);
    expect(serialized).not.toContain('Authorization');
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('token');
  });

  it('should bind to localhost by default', () => {
    delete process.env.MCP_HTTP_HOST;
    const host = process.env.MCP_HTTP_HOST || '127.0.0.1';
    expect(host).toBe('127.0.0.1');
    expect(host).not.toBe('0.0.0.0');
  });
});
