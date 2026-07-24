import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const originalToken = process.env.META_ACCESS_TOKEN;
const originalApiVersion = process.env.META_API_VERSION;

afterEach(() => {
  if (originalToken === undefined) delete process.env.META_ACCESS_TOKEN;
  else process.env.META_ACCESS_TOKEN = originalToken;
  if (originalApiVersion === undefined) delete process.env.META_API_VERSION;
  else process.env.META_API_VERSION = originalApiVersion;
});

describe('Meta config', () => {
  it('defaults new connections to Marketing API v25.0', () => {
    process.env.META_ACCESS_TOKEN = 'EAA-test-token';
    delete process.env.META_API_VERSION;
    expect(loadConfig().apiVersion).toBe('v25.0');
  });
});
