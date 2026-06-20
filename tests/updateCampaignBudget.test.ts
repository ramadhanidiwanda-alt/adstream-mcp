import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateCampaignBudget } from '../src/tools/updateCampaignBudget.js';
import type { MetaClient } from '../src/metaClient.js';

function createMockClient(): MetaClient {
  return {
    metaPost: vi.fn(),
    metaGet: vi.fn(),
    lastRateLimitInfo: null,
  } as unknown as MetaClient;
}

describe('updateCampaignBudget', () => {
  let client: MetaClient;

  beforeEach(() => {
    client = createMockClient();
    (client.metaGet as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ daily_budget: '50000', name: 'Test Campaign' }],
    });
  });

  it('should POST with daily_budget and return success', async () => {
    (client.metaPost as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    const result = await updateCampaignBudget(client, '120248446250030168', 75000);

    expect(client.metaGet).toHaveBeenCalledWith(
      '/120248446250030168',
      { fields: 'daily_budget,lifetime_budget,name' },
      { maxRetries: 3 }
    );
    expect(client.metaPost).toHaveBeenCalledWith('/120248446250030168', { daily_budget: 75000 }, 3);
    expect(result).toEqual({
      success: true,
      id: '120248446250030168',
      operation: 'update_budget',
      entityType: 'campaign',
      response: { success: true },
    });
  });

  it('should reject budget increase exceeding safety limit', async () => {
    // Current budget is 50000, max increase is 200% = max 150000
    // Requesting 200000 should fail
    (client.metaPost as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    await expect(
      updateCampaignBudget(client, '120248446250030168', 200000)
    ).rejects.toThrow('Budget increase exceeds safety limit');
  });

  it('should reject zero or negative budget', async () => {
    await expect(
      updateCampaignBudget(client, '120248446250030168', 0)
    ).rejects.toThrow('Invalid budget');
  });

  it('should accept custom maxBudgetIncrease', async () => {
    (client.metaPost as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    // With maxBudgetIncrease=1.0 (100%), max allowed is 100000
    // 100000 is exactly at the limit, should pass
    const result = await updateCampaignBudget(client, '120248446250030168', 100000, {
      maxBudgetIncrease: 1.0,
    });
    expect(result.success).toBe(true);
  });

  it('should skip safety check when maxBudgetIncrease is 0', async () => {
    (client.metaPost as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    const result = await updateCampaignBudget(client, '120248446250030168', 999999, {
      maxBudgetIncrease: 0,
    });
    expect(result.success).toBe(true);
  });

  it('should propagate Meta API errors', async () => {
    (client.metaPost as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

    await expect(
      updateCampaignBudget(client, '120248446250030168', 75000)
    ).rejects.toThrow('API error');
  });
});
