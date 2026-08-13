import { describe, it, expect, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { deleteAudience } from '../src/tools/deleteAudience.js';
import { isAdsMcpToolName, ADS_MCP_TOOL_NAMES } from '../src/broker/mcpTools.js';

function createMockClient(): MetaClient {
  return {
    metaDelete: vi.fn().mockResolvedValue({ success: true }),
  } as unknown as MetaClient;
}

const baseOptions = { audienceId: '120251449716200439' };

describe('deleteAudience', () => {
  it('dry-runs by default without calling the API', async () => {
    const client = createMockClient();
    const result = await deleteAudience(client, baseOptions);

    expect(result.status).toBe('dry_run');
    expect(result.executed).toBe(false);
    expect(client.metaDelete).not.toHaveBeenCalled();
    expect(result.preview).toEqual({ audienceId: baseOptions.audienceId });
  });

  it('requires confirmed=true before executing', async () => {
    const client = createMockClient();
    const result = await deleteAudience(client, baseOptions, { dryRun: false });

    expect(result.status).toBe('pending_confirmation');
    expect(client.metaDelete).not.toHaveBeenCalled();
    expect(result.error).toContain('permanent');
  });

  it('deletes the audience when confirmed', async () => {
    const client = createMockClient();
    const result = await deleteAudience(client, baseOptions, { dryRun: false, confirmed: true });

    expect(result.status).toBe('executed');
    expect(result.executed).toBe(true);
    expect(result.success).toBe(true);
    expect(result.id).toBe(baseOptions.audienceId);
    expect(client.metaDelete).toHaveBeenCalledWith(`/${baseOptions.audienceId}`, 3);
  });

  it('fails validation when audienceId is empty', async () => {
    const client = createMockClient();
    const result = await deleteAudience(client, { audienceId: '' });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('audienceId');
    expect(client.metaDelete).not.toHaveBeenCalled();
  });

  it('surfaces a Meta API error on failed deletion', async () => {
    const client = {
      metaDelete: vi.fn().mockRejectedValue(new Error('Unsupported delete request')),
    } as unknown as MetaClient;
    const result = await deleteAudience(client, baseOptions, { dryRun: false, confirmed: true });

    expect(result.status).toBe('failed');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported delete request');
  });
});

describe('ads_delete_audience MCP registration', () => {
  it('is a recognized MCP tool name', () => {
    expect(ADS_MCP_TOOL_NAMES).toContain('ads_delete_audience');
    expect(isAdsMcpToolName('ads_delete_audience')).toBe(true);
  });
});
