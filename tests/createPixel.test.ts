import { describe, it, expect, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { createPixel } from '../src/tools/createPixel.js';
import { isAdsMcpToolName, ADS_MCP_TOOL_NAMES } from '../src/broker/mcpTools.js';

function createMockClient(): MetaClient {
  return {
    metaPost: vi.fn().mockResolvedValue({ id: '1234567890123456' }),
  } as unknown as MetaClient;
}

const baseOptions = {
  adAccountId: 'act_123456789',
  name: 'My Website Pixel',
};

describe('createPixel', () => {
  it('dry-runs by default without calling the API', async () => {
    const client = createMockClient();
    const result = await createPixel(client, baseOptions);

    expect(result.status).toBe('dry_run');
    expect(result.executed).toBe(false);
    expect(client.metaPost).not.toHaveBeenCalled();
    expect(result.preview).toEqual({ name: baseOptions.name });
  });

  it('requires confirmed=true before executing', async () => {
    const client = createMockClient();
    const result = await createPixel(client, baseOptions, { dryRun: false });

    expect(result.status).toBe('pending_confirmation');
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it('creates the pixel when confirmed', async () => {
    const client = createMockClient();
    const result = await createPixel(client, baseOptions, { dryRun: false, confirmed: true });

    expect(result.status).toBe('executed');
    expect(result.executed).toBe(true);
    expect(result.id).toBe('1234567890123456');
    expect(client.metaPost).toHaveBeenCalledWith(
      '/act_123456789/adspixels',
      { name: baseOptions.name },
      3
    );
  });

  it('fails validation when name is blank', async () => {
    const client = createMockClient();
    const result = await createPixel(client, { ...baseOptions, name: '  ' });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('name');
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it('trims the name before sending', async () => {
    const client = createMockClient();
    const result = await createPixel(
      client,
      { ...baseOptions, name: '  My Pixel  ' },
      { dryRun: false, confirmed: true }
    );

    expect(client.metaPost).toHaveBeenCalledWith(
      '/act_123456789/adspixels',
      { name: 'My Pixel' },
      3
    );
    expect(result.preview).toEqual({ name: 'My Pixel' });
  });

  it('surfaces a Meta API error on failed creation (e.g. account already has a pixel)', async () => {
    const client = {
      metaPost: vi.fn().mockRejectedValue(new Error('A pixel already exists for this account')),
    } as unknown as MetaClient;
    const result = await createPixel(client, baseOptions, { dryRun: false, confirmed: true });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('pixel already exists');
  });
});

describe('ads_create_pixel MCP registration', () => {
  it('is a recognized MCP tool name', () => {
    expect(ADS_MCP_TOOL_NAMES).toContain('ads_create_pixel');
    expect(isAdsMcpToolName('ads_create_pixel')).toBe(true);
  });
});
