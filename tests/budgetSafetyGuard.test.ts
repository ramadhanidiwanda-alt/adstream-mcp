import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { assertBudgetIncreaseWithinLimit } from '../src/tools/budgetSafetyGuard.js';

function createMockClient(): MetaClient {
  return { metaGet: vi.fn(), metaGetObject: vi.fn() } as unknown as MetaClient;
}

describe('assertBudgetIncreaseWithinLimit', () => {
  let client: MetaClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('does nothing when maxIncreasePct is 0 (guard disabled)', async () => {
    await assertBudgetIncreaseWithinLimit(
      client,
      'cmp1',
      999999,
      'spend_cap,name',
      (row) => Number(row.spend_cap ?? 0),
      { maxIncreasePct: 0 }
    );
    expect(client.metaGetObject).not.toHaveBeenCalled();
  });

  it('passes when new value is within the default 200% increase cap', async () => {
    (client.metaGetObject as ReturnType<typeof vi.fn>).mockResolvedValue({
      spend_cap: '50000',
      name: 'Test',
    });

    await expect(
      assertBudgetIncreaseWithinLimit(client, 'cmp1', 100000, 'spend_cap,name', (row) =>
        Number(row.spend_cap ?? 0)
      )
    ).resolves.toBeUndefined();

    expect(client.metaGetObject).toHaveBeenCalledWith('/cmp1', { fields: 'spend_cap,name' }, 3);
  });

  it('throws when new value exceeds the increase cap', async () => {
    (client.metaGetObject as ReturnType<typeof vi.fn>).mockResolvedValue({
      spend_cap: '50000',
      name: 'Test',
    });

    await expect(
      assertBudgetIncreaseWithinLimit(client, 'cmp1', 999999, 'spend_cap,name', (row) =>
        Number(row.spend_cap ?? 0)
      )
    ).rejects.toThrow('Budget increase exceeds safety limit');
  });

  it('skips the check when current value is 0 or missing', async () => {
    (client.metaGetObject as ReturnType<typeof vi.fn>).mockResolvedValue({ name: 'Test' });

    await expect(
      assertBudgetIncreaseWithinLimit(client, 'cmp1', 999999, 'spend_cap,name', (row) =>
        Number(row.spend_cap ?? 0)
      )
    ).resolves.toBeUndefined();
  });

  // GET /{campaign_id} returns a flat node, never a {data:[...]} envelope. Reading it
  // through the paginated helper made every lookup yield undefined, which the "current
  // value is 0" branch silently treated as "no budget to compare against" — disabling
  // the guard entirely against the live API while the mocks still looked green.
  it('enforces the cap against the flat node shape the Graph API actually returns', async () => {
    (client.metaGetObject as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'cmp1',
      daily_budget: '50000',
      name: 'Test',
    });

    await expect(
      assertBudgetIncreaseWithinLimit(client, 'cmp1', 999999, 'daily_budget,name', (row) =>
        Number(row.daily_budget ?? 0)
      )
    ).rejects.toThrow('Budget increase exceeds safety limit');

    expect(client.metaGetObject).toHaveBeenCalledWith('/cmp1', { fields: 'daily_budget,name' }, 3);
  });
});
