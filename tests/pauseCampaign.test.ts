import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pauseCampaign } from '../src/tools/pauseCampaign.js';
import type { MetaClient } from '../src/metaClient.js';

function createMockClient(): MetaClient {
  return {
    metaPost: vi.fn(),
    metaGet: vi.fn(),
    lastRateLimitInfo: null,
  } as unknown as MetaClient;
}

describe('pauseCampaign', () => {
  let client: MetaClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('should POST with status=PAUSED and return success', async () => {
    (client.metaPost as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    const result = await pauseCampaign(client, '120248446250030168');

    expect(client.metaPost).toHaveBeenCalledWith('/120248446250030168', { status: 'PAUSED' }, 3);
    expect(result).toEqual({
      success: true,
      id: '120248446250030168',
      operation: 'pause',
      entityType: 'campaign',
      response: { success: true },
    });
  });

  it('should propagate Meta API errors', async () => {
    (client.metaPost as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

    await expect(pauseCampaign(client, '120248446250030168')).rejects.toThrow('API error');
  });

  it('should pass maxRetries option', async () => {
    (client.metaPost as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    await pauseCampaign(client, '120248446250030168', { maxRetries: 1 });

    expect(client.metaPost).toHaveBeenCalledWith('/120248446250030168', { status: 'PAUSED' }, 1);
  });
});
