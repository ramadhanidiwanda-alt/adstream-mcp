import { describe, it, expect, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { listAudiences } from '../src/tools/listAudiences.js';

describe('listAudiences', () => {
  it('lists audiences for an ad account and maps status objects to strings', async () => {
    const client = {
      metaGet: vi.fn().mockResolvedValue({
        data: [
          {
            id: '600111222333',
            name: 'Viewed but not purchased 14d',
            subtype: 'CUSTOM',
            approximate_count_lower_bound: 1000,
            approximate_count_upper_bound: 1200,
            delivery_status: { code: 200, description: 'This audience is ready to use.' },
            operation_status: { code: 200, description: 'Ready' },
          },
        ],
      }),
    } as unknown as MetaClient;

    const result = await listAudiences(client, { adAccountId: 'act_123456789' });

    expect(client.metaGet).toHaveBeenCalledWith('/act_123456789/customaudiences', {
      fields:
        'id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status,operation_status',
      limit: 100,
    });
    expect(result).toEqual([
      {
        id: '600111222333',
        name: 'Viewed but not purchased 14d',
        subtype: 'CUSTOM',
        approximate_count_lower_bound: 1000,
        approximate_count_upper_bound: 1200,
        delivery_status: 'This audience is ready to use.',
        operation_status: 'Ready',
      },
    ]);
  });

  it('accepts a plain string status field as well as an object', async () => {
    const client = {
      metaGet: vi.fn().mockResolvedValue({
        data: [{ id: '1', delivery_status: 'READY' }],
      }),
    } as unknown as MetaClient;

    const result = await listAudiences(client, { adAccountId: '123456789' });

    expect(result[0].delivery_status).toBe('READY');
  });

  it('returns an empty array when the account has no audiences', async () => {
    const client = { metaGet: vi.fn().mockResolvedValue({}) } as unknown as MetaClient;
    const result = await listAudiences(client, { adAccountId: '123456789' });
    expect(result).toEqual([]);
  });

  it('respects a custom limit', async () => {
    const client = { metaGet: vi.fn().mockResolvedValue({ data: [] }) } as unknown as MetaClient;
    await listAudiences(client, { adAccountId: '123456789', limit: 25 });

    expect(client.metaGet).toHaveBeenCalledWith(
      '/act_123456789/customaudiences',
      expect.objectContaining({ limit: 25 })
    );
  });
});
