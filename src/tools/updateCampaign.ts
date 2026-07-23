import type { MetaClient } from '../metaClient.js';
import type { StructuredMutationError } from '../types.js';
import { assertBudgetIncreaseWithinLimit } from './budgetSafetyGuard.js';
import { formatMetaWriteError, formatStructuredMetaWriteError } from '../utils/formatMetaWriteError.js';

export interface UpdateCampaignOptions {
  campaignId: string;
  name?: string;
  status?: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED';
  lifetimeBudget?: number;
  spendCap?: number;
  bidStrategy?: string;
  specialAdCategories?: string[];
  startTime?: string;
  stopTime?: string;
  /** Required when status is 'DELETED' — deletion is irreversible via the API. */
  deleteConfirmed?: boolean;
  /** Max budget increase as fraction. Default 2.0 (200%), same as updateCampaignBudget. Set 0 to disable. */
  maxBudgetIncrease?: number;
  /**
   * Toggles the campaign between Campaign Budget Optimization (CBO) and Ad Set Budget (ABO).
   * Must include every non-deleted, non-archived ad set under the campaign — Meta rejects the
   * request otherwise (error_subcode 1885937). Each entry needs exactly one of dailyBudget or
   * lifetimeBudget. Passing this converts an existing CBO campaign to ABO without recreating it.
   */
  adsetBudgets?: Array<{ adsetId: string; dailyBudget?: number; lifetimeBudget?: number }>;
}

export type UpdateCampaignStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';

export interface UpdateCampaignResult {
  operation: 'update_campaign';
  status: UpdateCampaignStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  success: boolean;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
  structuredError?: StructuredMutationError;
}

/**
 * Update an existing Meta campaign.
 *
 * Dry-run by default. Set dryRun=false + confirmed=true to execute.
 * status: 'DELETED' additionally requires deleteConfirmed=true (irreversible).
 * lifetimeBudget/spendCap reuse the same increase-safety guard as
 * updateCampaignBudget's dailyBudget.
 *
 * POST /{campaign_id}
 */
export async function updateCampaign(
  client: MetaClient,
  options: UpdateCampaignOptions,
  execOptions: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number } = {}
): Promise<UpdateCampaignResult> {
  const { dryRun = true, confirmed = false, maxRetries = 3 } = execOptions;

  const preview = buildUpdateCampaignPayload(options);
  const baseResult: UpdateCampaignResult = {
    operation: 'update_campaign',
    status: 'dry_run',
    executed: false,
    preview,
    success: false,
  };

  if (dryRun) return baseResult;

  if (!confirmed) {
    return {
      ...baseResult,
      status: 'pending_confirmation',
      error: 'Explicit confirmation is required after reviewing the dry-run preview.',
    };
  }

  if (options.status === 'DELETED' && !options.deleteConfirmed) {
    return {
      ...baseResult,
      status: 'failed',
      error: 'deleteConfirmed=true is required when status="DELETED" — deletion is irreversible via the API.',
      structuredError: {
        code: 'DELETE_CONFIRMATION_REQUIRED',
        message: 'Explicit delete confirmation is required.',
        provider: 'meta',
        actionableFix: 'Set deleteConfirmed=true after reviewing the dry-run preview. Note status="ARCHIVED" is not a safer alternative — Meta treats it as equally permanent (neither reverts via the API).',
      },
    };
  }

  if (options.adsetBudgets !== undefined) {
    const invalidEntry = options.adsetBudgets.find(
      (entry) =>
        !entry.adsetId ||
        (entry.dailyBudget === undefined) === (entry.lifetimeBudget === undefined)
    );
    if (options.adsetBudgets.length === 0 || invalidEntry) {
      return {
        ...baseResult,
        status: 'failed',
        error:
          'adsetBudgets must be a non-empty array where every entry has an adsetId and exactly one of dailyBudget or lifetimeBudget.',
        structuredError: {
          code: 'INVALID_ADSET_BUDGETS',
          message: 'Invalid adsetBudgets entry.',
          provider: 'meta',
          actionableFix:
            'Provide adsetId plus exactly one of dailyBudget/lifetimeBudget per entry, and include every non-deleted, non-archived ad set under the campaign.',
        },
      };
    }
  }

  try {
    const maxIncreasePct = options.maxBudgetIncrease ?? 2.0;

    if (options.lifetimeBudget !== undefined) {
      await assertBudgetIncreaseWithinLimit(
        client,
        options.campaignId,
        options.lifetimeBudget,
        'daily_budget,lifetime_budget,name',
        (row) => Number(row.daily_budget ?? row.lifetime_budget ?? 0),
        { maxIncreasePct, maxRetries }
      );
    }

    if (options.spendCap !== undefined) {
      await assertBudgetIncreaseWithinLimit(
        client,
        options.campaignId,
        options.spendCap,
        'spend_cap,name',
        (row) => Number(row.spend_cap ?? 0),
        { maxIncreasePct, maxRetries }
      );
    }

    const response = await client.metaPost<Record<string, unknown>>(
      `/${options.campaignId}`,
      preview,
      maxRetries
    );

    return {
      ...baseResult,
      status: 'executed',
      executed: true,
      success: true,
      id: options.campaignId,
      response,
    };
  } catch (error) {
    return {
      ...baseResult,
      status: 'failed',
      success: false,
      error: formatMetaWriteError(error),
      structuredError: formatStructuredMetaWriteError(error),
    };
  }
}

function buildUpdateCampaignPayload(options: UpdateCampaignOptions): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (options.name !== undefined) payload.name = options.name.trim();
  if (options.status !== undefined) payload.status = options.status;
  if (options.lifetimeBudget !== undefined) payload.lifetime_budget = options.lifetimeBudget;
  if (options.spendCap !== undefined) payload.spend_cap = options.spendCap;
  if (options.bidStrategy !== undefined) payload.bid_strategy = options.bidStrategy;
  if (options.specialAdCategories !== undefined) payload.special_ad_categories = options.specialAdCategories;
  if (options.startTime !== undefined) payload.start_time = options.startTime;
  if (options.stopTime !== undefined) payload.stop_time = options.stopTime;
  if (options.adsetBudgets !== undefined) {
    payload.adset_budgets = options.adsetBudgets.map((entry) => {
      const mapped: Record<string, unknown> = { adset_id: entry.adsetId };
      if (entry.dailyBudget !== undefined) mapped.daily_budget = entry.dailyBudget;
      if (entry.lifetimeBudget !== undefined) mapped.lifetime_budget = entry.lifetimeBudget;
      return mapped;
    });
  }

  return payload;
}
