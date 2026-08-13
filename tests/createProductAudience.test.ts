import { describe, it, expect, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { createProductAudience } from '../src/tools/createProductAudience.js';
import { isAdsMcpToolName, ADS_MCP_TOOL_NAMES } from '../src/broker/mcpTools.js';

function createMockClient(): MetaClient {
  return {
    metaPost: vi.fn().mockResolvedValue({ id: '120000000000000099' }),
  } as unknown as MetaClient;
}

const baseOptions = {
  adAccountId: 'act_123456789',
  name: 'Viewed but not purchased 14d',
  productSetId: '999888777',
  inclusions: [{ retentionSeconds: 1209600, event: 'ViewContent' as const }],
};

describe('createProductAudience', () => {
  it('dry-runs by default without calling the API', async () => {
    const client = createMockClient();
    const result = await createProductAudience(client, baseOptions);

    expect(result.status).toBe('dry_run');
    expect(result.executed).toBe(false);
    expect(client.metaPost).not.toHaveBeenCalled();
    expect(result.preview).toMatchObject({
      name: baseOptions.name,
      product_set_id: baseOptions.productSetId,
      inclusions: [{ retention_seconds: 1209600, rule: { event: { eq: 'ViewContent' } } }],
    });
  });

  it('requires confirmed=true before executing', async () => {
    const client = createMockClient();
    const result = await createProductAudience(client, baseOptions, { dryRun: false });

    expect(result.status).toBe('pending_confirmation');
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it('creates the product audience when confirmed', async () => {
    const client = createMockClient();
    const result = await createProductAudience(client, baseOptions, {
      dryRun: false,
      confirmed: true,
    });

    expect(result.status).toBe('executed');
    expect(result.executed).toBe(true);
    expect(result.id).toBe('120000000000000099');
    expect(client.metaPost).toHaveBeenCalledWith(
      '/act_123456789/product_audiences',
      expect.objectContaining({ name: baseOptions.name, product_set_id: '999888777' }),
      3
    );
  });

  it('supports exclusions, e.g. excluding people who already purchased', async () => {
    const client = createMockClient();
    const result = await createProductAudience(client, {
      ...baseOptions,
      exclusions: [{ retentionSeconds: 2592000, event: 'Purchase' }],
    });

    expect(result.preview.exclusions).toEqual([
      { retention_seconds: 2592000, rule: { event: { eq: 'Purchase' } } },
    ]);
  });

  it('omits exclusions from the payload when none are given', async () => {
    const client = createMockClient();
    const result = await createProductAudience(client, baseOptions);

    expect(result.preview).not.toHaveProperty('exclusions');
  });

  it('fails validation when inclusions is empty', async () => {
    const client = createMockClient();
    const result = await createProductAudience(client, { ...baseOptions, inclusions: [] });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('inclusions');
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it('fails validation when retentionSeconds is not positive', async () => {
    const client = createMockClient();
    const result = await createProductAudience(client, {
      ...baseOptions,
      inclusions: [{ retentionSeconds: 0, event: 'ViewContent' }],
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('retentionSeconds');
  });

  it('fails validation when retentionSeconds exceeds the 180-day cap', async () => {
    const client = createMockClient();
    const result = await createProductAudience(client, {
      ...baseOptions,
      inclusions: [{ retentionSeconds: 20000000, event: 'ViewContent' }],
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('retentionSeconds');
  });

  it('fails validation when event is not a recognized value', async () => {
    const client = createMockClient();
    const result = await createProductAudience(client, {
      ...baseOptions,
      inclusions: [{ retentionSeconds: 1209600, event: 'InvalidEvent' as never }],
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('event');
  });

  it('fails validation when adAccountId is empty', async () => {
    const client = createMockClient();
    const result = await createProductAudience(client, { ...baseOptions, adAccountId: '' });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('adAccountId');
  });

  it('surfaces a Meta API error on failed creation', async () => {
    const client = {
      metaPost: vi.fn().mockRejectedValue(new Error('Invalid product_set_id')),
    } as unknown as MetaClient;
    const result = await createProductAudience(client, baseOptions, {
      dryRun: false,
      confirmed: true,
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Invalid product_set_id');
  });
});

describe('ads_create_product_audience MCP registration', () => {
  it('is a recognized MCP tool name', () => {
    expect(ADS_MCP_TOOL_NAMES).toContain('ads_create_product_audience');
    expect(isAdsMcpToolName('ads_create_product_audience')).toBe(true);
  });
});
