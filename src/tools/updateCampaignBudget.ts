import type { MetaClient } from '../metaClient.js';
import type { MutationResult } from '../types.js';
import { assertBudgetIncreaseWithinLimit } from './budgetSafetyGuard.js';

export interface UpdateCampaignBudgetOptions {
  /** Max retries on rate limit */
  maxRetries?: number;
  /**
   * Max budget increase as fraction (0.2 = 20%).
   * If the new budget exceeds old_budget * (1 + maxBudgetIncrease),
   * the tool will throw instead of sending the request.
   * Default: 2.0 (allow up to 200% increase).
   * Set to 0 to disable the guard.
   */
  maxBudgetIncrease?: number;
}

/**
 * Update a campaign's daily budget.
 * POST /{campaign_id} with daily_budget={amount}
 *
 * If maxBudgetIncrease is set, validates the increase is within bounds
 * before sending the request (requires fetching the current campaign).
 *
 * Returns { success, id } on success.
 * Throws if budget increase exceeds safety limit or Meta API error.
 */
export async function updateCampaignBudget(
  client: MetaClient,
  campaignId: string,
  dailyBudget: number,
  options: UpdateCampaignBudgetOptions = {}
): Promise<MutationResult> {
  const maxRetries = options.maxRetries ?? 3;

  // Validate budget is positive
  if (dailyBudget <= 0) {
    throw new Error(`Invalid budget: ${dailyBudget}. Budget must be positive.`);
  }

  await assertBudgetIncreaseWithinLimit(
    client,
    campaignId,
    dailyBudget,
    'daily_budget,lifetime_budget,name',
    (row) => Number(row.daily_budget ?? row.lifetime_budget ?? 0),
    { maxIncreasePct: options.maxBudgetIncrease ?? 2.0, maxRetries }
  );

  const result = await client.metaPost<{ success: boolean }>(
    `/${campaignId}`,
    { daily_budget: dailyBudget },
    maxRetries
  );

  return {
    success: result.success ?? true,
    id: campaignId,
    operation: 'update_budget',
    entityType: 'campaign',
    response: result as unknown as Record<string, unknown>,
  };
}
