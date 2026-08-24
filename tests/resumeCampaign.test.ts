import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resumeCampaign } from '../src/tools/resumeCampaign.js';
import type { MetaClient } from '../src/metaClient.js';

function createMockClient(): MetaClient {
  return {
    metaPost: vi.fn(),
    metaGet: vi.fn(),
    metaGetObject: vi.fn(),
    lastRateLimitInfo: null,
  } as unknown as MetaClient;
}

describe('resumeCampaign', () => {
  let client: MetaClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('should POST with status=ACTIVE and report success once the read-back confirms ACTIVE', async () => {
    (client.metaPost as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (client.metaGetObject as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'ACTIVE',
      effective_status: 'ACTIVE',
    });

    const result = await resumeCampaign(client, '120248446250030168');

    expect(client.metaPost).toHaveBeenCalledWith('/120248446250030168', { status: 'ACTIVE' }, 3);
    expect(client.metaGetObject).toHaveBeenCalledWith(
      '/120248446250030168',
      { fields: 'status,effective_status,issues_info' },
      3
    );
    expect(result).toEqual({
      success: true,
      id: '120248446250030168',
      operation: 'resume',
      entityType: 'campaign',
      response: {
        success: true,
        read_back: {
          requested: 'ACTIVE',
          status: 'ACTIVE',
          effectiveStatus: 'ACTIVE',
          applied: true,
        },
      },
    });
  });

  // The exact case the audit found in production: the API acked the resume and
  // the campaign was still PAUSED. Reporting that as success is the bug.
  it('reports failure when the API acks but the campaign is still PAUSED', async () => {
    (client.metaPost as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (client.metaGetObject as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'PAUSED',
      effective_status: 'PAUSED',
    });

    const result = await resumeCampaign(client, '120248446250030168');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/masih berstatus PAUSED, bukan ACTIVE/);
    expect((result.response as { read_back: { applied: boolean } }).read_back.applied).toBe(false);
  });

  it('marks the result unverified rather than failed when the read-back itself fails', async () => {
    (client.metaPost as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (client.metaGetObject as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('rate limited'));

    const result = await resumeCampaign(client, '120248446250030168');

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(
      (result.response as { read_back: { unverified?: string } }).read_back.unverified
    ).toMatch(/tidak terverifikasi/);
  });

  it('should propagate Meta API errors', async () => {
    (client.metaPost as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

    await expect(resumeCampaign(client, '120248446250030168')).rejects.toThrow('API error');
  });
});
