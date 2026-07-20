import type { MetaClient } from '../metaClient.js';

export interface BudgetIncreaseGuardOptions {
  /**
   * Max budget increase as fraction (0.2 = 20%).
   * If newValue exceeds current * (1 + maxIncreasePct), throws.
   * Default: 2.0 (allow up to 200% increase). Set to 0 to disable.
   */
  maxIncreasePct?: number;
  maxRetries?: number;
}

/**
 * Fetch a campaign's current field(s) and reject the new value if the
 * increase exceeds the configured safety limit. Shared by
 * updateCampaignBudget.ts (dailyBudget) and updateCampaign.ts
 * (lifetimeBudget, spendCap) so the guard logic isn't duplicated per field.
 */
export async function assertBudgetIncreaseWithinLimit(
  client: MetaClient,
  campaignId: string,
  newValue: number,
  fields: string,
  extractCurrent: (row: Record<string, string | undefined>) => number,
  options: BudgetIncreaseGuardOptions = {}
): Promise<void> {
  const maxIncreasePct = options.maxIncreasePct ?? 2.0;
  if (maxIncreasePct <= 0) return;

  const maxRetries = options.maxRetries ?? 3;
  const current = await client.metaGet<{ data: Array<Record<string, string | undefined>> }>(
    `/${campaignId}`,
    { fields },
    { maxRetries }
  );

  const currentValue = extractCurrent(current.data?.[0] ?? {});
  if (currentValue <= 0) return;

  const maxAllowed = Math.round(currentValue * (1 + maxIncreasePct));
  if (newValue > maxAllowed) {
    throw new Error(
      `Budget increase exceeds safety limit. ` +
      `Current: ${currentValue}, requested: ${newValue}, ` +
      `max allowed (${(maxIncreasePct * 100).toFixed(0)}% increase): ${maxAllowed}.`
    );
  }
}
