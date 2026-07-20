import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { assertBudgetIncreaseWithinLimit } from '../src/tools/budgetSafetyGuard.js';

function createMockClient(): MetaClient {
  return { metaGet: vi.fn() } as unknown as MetaClient;
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
    expect(client.metaGet).not.toHaveBeenCalled();
  });

  it('passes when new value is within the default 200% increase cap', async () => {
    (client.metaGet as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ spend_cap: '50000', name: 'Test' }],
    });

    await expect(
      assertBudgetIncreaseWithinLimit(
        client,
        'cmp1',
        100000,
        'spend_cap,name',
        (row) => Number(row.spend_cap ?? 0)
      )
    ).resolves.toBeUndefined();

    expect(client.metaGet).toHaveBeenCalledWith('/cmp1', { fields: 'spend_cap,name' }, { maxRetries: 3 });
  });

  it('throws when new value exceeds the increase cap', async () => {
    (client.metaGet as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ spend_cap: '50000', name: 'Test' }],
    });

    await expect(
      assertBudgetIncreaseWithinLimit(
        client,
        'cmp1',
        999999,
        'spend_cap,name',
        (row) => Number(row.spend_cap ?? 0)
      )
    ).rejects.toThrow('Budget increase exceeds safety limit');
  });

  it('skips the check when current value is 0 or missing', async () => {
    (client.metaGet as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [{ name: 'Test' }] });

    await expect(
      assertBudgetIncreaseWithinLimit(
        client,
        'cmp1',
        999999,
        'spend_cap,name',
        (row) => Number(row.spend_cap ?? 0)
      )
    ).resolves.toBeUndefined();
  });
});
