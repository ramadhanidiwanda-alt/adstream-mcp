import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renameCampaign } from '../src/tools/renameCampaign.js';
import type { MetaClient } from '../src/metaClient.js';

function createMockClient(): MetaClient {
  return {
    metaPost: vi.fn(),
    metaGet: vi.fn(),
    lastRateLimitInfo: null,
  } as unknown as MetaClient;
}

describe('renameCampaign', () => {
  let client: MetaClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('should POST with new name and return success', async () => {
    (client.metaPost as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    const result = await renameCampaign(client, '120248446250030168', 'New Campaign Name');

    expect(client.metaPost).toHaveBeenCalledWith(
      '/120248446250030168',
      { name: 'New Campaign Name' },
      3
    );
    expect(result).toEqual({
      success: true,
      id: '120248446250030168',
      operation: 'rename',
      entityType: 'campaign',
      response: { success: true },
    });
  });

  it('should reject empty name', async () => {
    await expect(
      renameCampaign(client, '120248446250030168', '')
    ).rejects.toThrow('Campaign name cannot be empty');
  });

  it('should propagate Meta API errors', async () => {
    (client.metaPost as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

    await expect(
      renameCampaign(client, '120248446250030168', 'New Name')
    ).rejects.toThrow('API error');
  });
});
