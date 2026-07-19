import { describe, expect, it, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import {
  readAdSetFull,
  listAdSetsFull,
  ADSET_FULL_FIELDS,
} from '../src/tools/readAdSetFull.js';

describe('readAdSetFull', () => {
  it('merges field batches into one ad set object', async () => {
    const client = {
      metaGetObject: vi
        .fn()
        .mockImplementation(async (_path: string, opts: { fields?: string }) => {
          const fields = opts.fields ?? '';
          if (fields.includes('targeting')) {
            return {
              targeting: {
                age_min: 18,
                age_max: 45,
                custom_audiences: [{ id: 'ca_1', name: '30D Purchasers' }],
              },
            };
          }
          if (fields.includes('optimization_goal')) {
            return { bid_strategy: 'LOWEST_COST_WITHOUT_CAP', optimization_goal: 'OFFSITE_CONVERSIONS' };
          }
          return { id: 'as_1', name: 'Test Ad Set', status: 'PAUSED', campaign_id: 'c_1' };
        }),
      metaGet: vi.fn(),
      metaPost: vi.fn(),
      metaDelete: vi.fn(),
    } as unknown as MetaClient;

    const result = await readAdSetFull(client, { adsetId: 'as_1' });

    expect(result.id).toBe('as_1');
    expect(result.name).toBe('Test Ad Set');
    expect(result.campaign_id).toBe('c_1');
    const targeting = result.targeting as Record<string, unknown>;
    expect(targeting.age_min).toBe(18);
    expect((targeting.custom_audiences as unknown[]).length).toBe(1);
    expect(result.optimization_goal).toBe('OFFSITE_CONVERSIONS');
  });

  it('silently skips field batches that fail', async () => {
    const client = {
      metaGetObject: vi
        .fn()
        .mockImplementation(async (_path: string, opts: { fields?: string }) => {
          const fields = opts.fields ?? '';
          if (fields.includes('targeting')) {
            throw new Error('(#100) Tried accessing nonexisting field');
          }
          return { id: 'as_2', name: 'Minimal', status: 'ACTIVE', campaign_id: 'c_2' };
        }),
      metaGet: vi.fn(),
      metaPost: vi.fn(),
      metaDelete: vi.fn(),
    } as unknown as MetaClient;

    const result = await readAdSetFull(client, { adsetId: 'as_2' });

    expect(result.id).toBe('as_2');
    expect(result.targeting).toBeUndefined();
  });

  it('returns empty object when all batches fail', async () => {
    const client = {
      metaGetObject: vi.fn().mockRejectedValue(new Error('API Error')),
      metaGet: vi.fn(),
      metaPost: vi.fn(),
      metaDelete: vi.fn(),
    } as unknown as MetaClient;

    const result = await readAdSetFull(client, { adsetId: 'as_fail' });
    expect(result).toEqual({});
  });

  it('exposes a non-empty ADSET_FULL_FIELDS list', () => {
    expect(ADSET_FULL_FIELDS).toContain('targeting');
    expect(ADSET_FULL_FIELDS).toContain('optimization_goal');
    expect(ADSET_FULL_FIELDS).toContain('daily_budget');
  });
});

describe('listAdSetsFull', () => {
  it('lists ad sets under a campaign via the campaign adsets endpoint', async () => {
    const metaGet = vi.fn().mockResolvedValue({
      data: [
        { id: 'as_1', name: 'Set A', targeting: { age_min: 18 } },
        { id: 'as_2', name: 'Set B', targeting: { age_min: 25 } },
      ],
      paging: { cursors: { after: 'CURSOR123' } },
    });
    const client = { metaGet, metaGetObject: vi.fn(), metaPost: vi.fn(), metaDelete: vi.fn() } as unknown as MetaClient;

    const result = await listAdSetsFull(client, { campaignId: 'c_1', limit: 25 });

    expect(metaGet).toHaveBeenCalledWith(
      '/c_1/adsets',
      expect.objectContaining({ limit: 25 })
    );
    expect(result.adsets.length).toBe(2);
    expect(result.adsets[0].id).toBe('as_1');
    expect(result.nextCursor).toBe('CURSOR123');
    expect(result.droppedFields).toBe(false);
  });

  it('lists ad sets under an account, normalizing the act_ prefix and passing cursor', async () => {
    const metaGet = vi.fn().mockResolvedValue({ data: [{ id: 'as_9', name: 'Acct Set' }] });
    const client = { metaGet, metaGetObject: vi.fn(), metaPost: vi.fn(), metaDelete: vi.fn() } as unknown as MetaClient;

    const result = await listAdSetsFull(client, {
      accountId: 'act_662014947775593',
      limit: 10,
      cursor: 'NEXT',
    });

    expect(metaGet).toHaveBeenCalledWith(
      '/act_662014947775593/adsets',
      expect.objectContaining({ limit: 10, after: 'NEXT' })
    );
    expect(result.adsets[0].id).toBe('as_9');
    expect(result.nextCursor).toBeNull();
  });

  it('falls back to core fields when the full field request is rejected', async () => {
    const metaGet = vi
      .fn()
      .mockRejectedValueOnce(new Error('(#100) Tried accessing nonexisting field'))
      .mockResolvedValueOnce({ data: [{ id: 'as_1', name: 'Set A', targeting: { age_min: 18 } }] });
    const client = { metaGet, metaGetObject: vi.fn(), metaPost: vi.fn(), metaDelete: vi.fn() } as unknown as MetaClient;

    const result = await listAdSetsFull(client, { campaignId: 'c_1', limit: 25 });

    expect(metaGet).toHaveBeenCalledTimes(2);
    expect(result.adsets.length).toBe(1);
    expect(result.droppedFields).toBe(true);
  });
});
