import type { MetaClient } from '../metaClient.js';
import type { MutationResult } from '../types.js';

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

  // Safety guard: fetch current campaign to check increase bound
  const maxIncreasePct = options.maxBudgetIncrease ?? 2.0;
  if (maxIncreasePct > 0) {
    const current = await client.metaGet<{
      data: Array<{ daily_budget?: string; lifetime_budget?: string; name?: string }>;
    }>(`/${campaignId}`, { fields: 'daily_budget,lifetime_budget,name' }, { maxRetries });

    const currentBudget = Number(current.data?.[0]?.daily_budget ?? current.data?.[0]?.lifetime_budget ?? 0);
    if (currentBudget > 0) {
      const maxAllowed = Math.round(currentBudget * (1 + maxIncreasePct));
      if (dailyBudget > maxAllowed) {
        throw new Error(
          `Budget increase exceeds safety limit. ` +
          `Current: ${currentBudget}, requested: ${dailyBudget}, ` +
          `max allowed (${(maxIncreasePct * 100).toFixed(0)}% increase): ${maxAllowed}.`
        );
      }
    }
  }

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
