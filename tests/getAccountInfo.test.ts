import { describe, expect, it, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { getAccountInfo } from '../src/tools/getAccountInfo.js';

describe('getAccountInfo', () => {
  it('reads the account as a single object, not a list edge', async () => {
    // Meta's /act_{id} endpoint returns the account fields directly at the
    // top level — no `data` array wrapper like list/edge endpoints.
    const metaGetObject = vi.fn().mockResolvedValue({
      id: 'act_123',
      name: 'Test Account',
      currency: 'IDR',
      timezone_name: 'Asia/Jakarta',
      timezone_offset_hours_utc: 7,
      account_status: 1,
      balance: 100000,
      amount_spent: 50000,
      spend_cap: null,
      business_name: 'Test Business',
    });
    const metaGet = vi.fn();
    const client = { metaGet, metaGetObject } as unknown as MetaClient;

    const result = await getAccountInfo(client, { adAccountId: '123' });

    expect(metaGet).not.toHaveBeenCalled();
    expect(metaGetObject).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('act_123');
    expect(result.name).toBe('Test Account');
    expect(result.currency).toBe('IDR');
    expect(result.account_status).toBe(1);
    expect(result.account_status_label).toBe('ACTIVE');
    expect(result.balance).toBe(100000);
    expect(result.spending_limit).toBeNull();
  });

  it('falls back to UNKNOWN_<code> only for a genuinely unmapped status code', async () => {
    const metaGetObject = vi.fn().mockResolvedValue({
      id: 'act_999',
      name: 'Weird Status Account',
      account_status: 42,
    });
    const client = {
      metaGet: vi.fn(),
      metaGetObject,
    } as unknown as MetaClient;

    const result = await getAccountInfo(client, { adAccountId: '999' });

    expect(result.account_status_label).toBe('UNKNOWN_42');
  });
});

describe('getAccountInfo — existing customers audience segments', () => {
  it('requests existing_customers and returns it', async () => {
    const metaGetObject = vi.fn().mockResolvedValue({
      id: 'act_123456789',
      name: 'Test Account',
      currency: 'IDR',
      timezone_name: 'Asia/Jakarta',
      timezone_offset_hours_utc: 7,
      account_status: 1,
      balance: 0,
      amount_spent: 0,
      existing_customers: ['120000000000000111', '120000000000000222'],
    });
    const client = { metaGetObject } as unknown as MetaClient;

    const result = await getAccountInfo(client, { adAccountId: 'act_123456789' });

    expect(metaGetObject.mock.calls[0][1].fields).toContain('existing_customers');
    expect(result.existing_customers).toEqual([
      '120000000000000111',
      '120000000000000222',
    ]);
  });

  it('leaves existing_customers undefined when the account has no segments configured', async () => {
    const metaGetObject = vi.fn().mockResolvedValue({
      id: 'act_123456789',
      name: 'Test Account',
      currency: 'IDR',
      timezone_name: 'Asia/Jakarta',
      timezone_offset_hours_utc: 7,
      account_status: 1,
      balance: 0,
      amount_spent: 0,
    });
    const client = { metaGetObject } as unknown as MetaClient;

    const result = await getAccountInfo(client, { adAccountId: 'act_123456789' });

    expect(result.existing_customers).toBeUndefined();
  });
});
