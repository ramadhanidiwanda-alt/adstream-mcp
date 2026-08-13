import { describe, it, expect, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { createCustomAudience } from '../src/tools/createCustomAudience.js';
import { isAdsMcpToolName, ADS_MCP_TOOL_NAMES } from '../src/broker/mcpTools.js';

function createMockClient(): MetaClient {
  return {
    metaPost: vi.fn().mockResolvedValue({ id: '700111222333' }),
  } as unknown as MetaClient;
}

const baseOptions = {
  adAccountId: 'act_123456789',
  name: 'Website visitors 30d',
  subtype: 'WEBSITE' as const,
  pixelId: '1234567890',
  rule: {
    inclusions: {
      operator: 'or',
      rules: [{ event_sources: [{ type: 'pixel', id: '1234567890' }], retention_seconds: 2592000 }],
    },
  },
};

describe('createCustomAudience', () => {
  it('dry-runs by default without calling the API', async () => {
    const client = createMockClient();
    const result = await createCustomAudience(client, baseOptions);

    expect(result.status).toBe('dry_run');
    expect(client.metaPost).not.toHaveBeenCalled();
    expect(result.preview).toMatchObject({
      name: baseOptions.name,
      pixel_id: '1234567890',
      rule: baseOptions.rule,
    });
    // Meta rejects an explicit subtype for pixel/rule-based audiences as of
    // API v25.0 (confirmed live: subcode 1870053) — it must be inferred by
    // Meta from pixel_id + rule, not sent on create.
    expect(result.preview).not.toHaveProperty('subtype');
  });

  it('requires confirmed=true before executing', async () => {
    const client = createMockClient();
    const result = await createCustomAudience(client, baseOptions, { dryRun: false });

    expect(result.status).toBe('pending_confirmation');
    expect(client.metaPost).not.toHaveBeenCalled();
  });

  it('creates the audience when confirmed', async () => {
    const client = createMockClient();
    const result = await createCustomAudience(client, baseOptions, {
      dryRun: false,
      confirmed: true,
    });

    expect(result.status).toBe('executed');
    expect(result.id).toBe('700111222333');
    const [, sentPayload] = (client.metaPost as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(sentPayload).toMatchObject({ pixel_id: '1234567890' });
    expect(sentPayload).not.toHaveProperty('subtype');
    expect(client.metaPost).toHaveBeenCalledWith(
      '/act_123456789/customaudiences',
      expect.objectContaining({ pixel_id: '1234567890' }),
      3
    );
  });

  it('includes retentionDays and description when provided', async () => {
    const client = createMockClient();
    const result = await createCustomAudience(client, {
      ...baseOptions,
      retentionDays: 30,
      description: 'All website visitors, last 30 days',
    });

    expect(result.preview).toMatchObject({
      retention_days: 30,
      description: 'All website visitors, last 30 days',
    });
  });

  it('rejects retentionDays outside 1-180', async () => {
    const client = createMockClient();
    const result = await createCustomAudience(client, { ...baseOptions, retentionDays: 200 });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('retentionDays');
  });

  it('rejects an empty rule', async () => {
    const client = createMockClient();
    const result = await createCustomAudience(client, { ...baseOptions, rule: {} });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('rule');
  });

  it('rejects subtypes other than WEBSITE', async () => {
    const client = createMockClient();
    // @ts-expect-error — only WEBSITE is supported in this release
    const result = await createCustomAudience(client, { ...baseOptions, subtype: 'LOOKALIKE' });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('WEBSITE');
  });

  it('fails validation when adAccountId is empty', async () => {
    const client = createMockClient();
    const result = await createCustomAudience(client, { ...baseOptions, adAccountId: '' });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('adAccountId');
  });

  it('surfaces a Meta API error on failed creation', async () => {
    const client = {
      metaPost: vi.fn().mockRejectedValue(new Error('Invalid pixel_id')),
    } as unknown as MetaClient;
    const result = await createCustomAudience(client, baseOptions, {
      dryRun: false,
      confirmed: true,
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Invalid pixel_id');
  });
});

describe('ads_create_custom_audience MCP registration', () => {
  it('is a recognized MCP tool name', () => {
    expect(ADS_MCP_TOOL_NAMES).toContain('ads_create_custom_audience');
    expect(isAdsMcpToolName('ads_create_custom_audience')).toBe(true);
  });
});
