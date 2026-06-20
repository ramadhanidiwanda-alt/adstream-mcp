import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resumeCampaign } from '../src/tools/resumeCampaign.js';
import type { MetaClient } from '../src/metaClient.js';

function createMockClient(): MetaClient {
  return {
    metaPost: vi.fn(),
    metaGet: vi.fn(),
    lastRateLimitInfo: null,
  } as unknown as MetaClient;
}

describe('resumeCampaign', () => {
  let client: MetaClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('should POST with status=ACTIVE and return success', async () => {
    (client.metaPost as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    const result = await resumeCampaign(client, '120248446250030168');

    expect(client.metaPost).toHaveBeenCalledWith('/120248446250030168', { status: 'ACTIVE' }, 3);
    expect(result).toEqual({
      success: true,
      id: '120248446250030168',
      operation: 'resume',
      entityType: 'campaign',
      response: { success: true },
    });
  });

  it('should propagate Meta API errors', async () => {
    (client.metaPost as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

    await expect(resumeCampaign(client, '120248446250030168')).rejects.toThrow('API error');
  });
});
