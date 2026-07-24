import type { MetaClient } from '../metaClient.js';
import type { MetaAdsMode, StructuredMutationError } from '../types.js';
import {
  META_ODAX_OBJECTIVES,
  type MetaOdaxObjective,
} from '../providers/meta/objectiveLaunchMatrix.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';
import {
  formatMetaWriteError,
  formatStructuredMetaWriteError,
} from '../utils/formatMetaWriteError.js';

export type MetaCampaignObjective = MetaOdaxObjective;

export type CampaignStatus = 'ACTIVE' | 'PAUSED';

export interface CreateCampaignOptions {
  adAccountId: string;
  name: string;
  objective: MetaCampaignObjective;
  mode?: MetaAdsMode;
  status?: CampaignStatus;
  specialAdCategories?: string[];
  buyType?: 'AUCTION' | 'RESERVED';
  /**
   * Allow ad sets without campaign budget to share up to 20% of their budgets.
   * Meta requires an explicit boolean for campaigns that do not use CBO.
   */
  isAdSetBudgetSharingEnabled?: boolean;
  dailyBudget?: number;
  lifetimeBudget?: number;
  bidStrategy?: string;
  dedupeByName?: boolean;
  externalReference?: string;
}

export type CreateCampaignStatus =
  | 'dry_run'
  | 'pending_confirmation'
  | 'executed'
  | 'failed'
  | 'deduped';

export interface CreateCampaignResult {
  operation: 'create_campaign';
  status: CreateCampaignStatus;
  executed: boolean;
  mode: MetaAdsMode;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
  structuredError?: StructuredMutationError;
}

interface MetaIdResponse extends Record<string, unknown> {
  id?: string;
}

/**
 * Create a Meta ad campaign with a specified objective.
 *
 * Dry-run by default: returns preview without calling the API.
 * Set dryRun=false + confirmed=true to execute.
 *
 * POST /act_{ad_account_id}/campaigns
 *
 * Returns campaign ID on success.
 */
export async function createCampaign(
  client: MetaClient,
  options: CreateCampaignOptions,
  execOptions: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number } = {}
): Promise<CreateCampaignResult> {
  const { dryRun = true, confirmed = false, maxRetries = 3 } = execOptions;

  if (!META_ODAX_OBJECTIVES.includes(options.objective as MetaOdaxObjective)) {
    const message = `Unsupported Meta objective: ${options.objective}.`;
    return {
      operation: 'create_campaign',
      status: 'failed',
      executed: false,
      mode: options.mode ?? 'standard',
      preview: {},
      error: message,
      structuredError: {
        provider: 'meta',
        code: 'UNSUPPORTED_OBJECTIVE',
        message,
        actionableFix: `Use one of: ${META_ODAX_OBJECTIVES.join(', ')}.`,
      },
    };
  }

  const preview = buildCampaignPayload(options);
  if (options.externalReference) {
    preview.external_reference = options.externalReference;
  }
  const baseResult: CreateCampaignResult = {
    operation: 'create_campaign',
    status: 'dry_run',
    executed: false,
    mode: options.mode ?? 'standard',
    preview,
  };

  if (dryRun) return baseResult;

  if (!confirmed) {
    return {
      ...baseResult,
      status: 'pending_confirmation',
      error: 'Explicit confirmation is required after reviewing the dry-run preview.',
    };
  }

  const accountPath = normalizeAccountPath(options.adAccountId);

  if (options.dedupeByName) {
    const existing = await findExistingCampaignByName(
      client,
      accountPath,
      options.name,
      maxRetries
    );
    if (existing) {
      return {
        ...baseResult,
        status: 'deduped',
        executed: false,
        id: existing.id,
        response: { deduped: true, existing },
      };
    }
  }

  try {
    const response = await client.metaPost<MetaIdResponse>(
      `${accountPath}/campaigns`,
      preview,
      maxRetries
    );

    if (!response.id || typeof response.id !== 'string') {
      return {
        ...baseResult,
        status: 'failed',
        error: 'Meta did not return an id for created campaign',
      };
    }

    return {
      ...baseResult,
      status: 'executed',
      executed: true,
      id: response.id,
      response,
    };
  } catch (error) {
    return {
      ...baseResult,
      status: 'failed',
      error: formatMetaWriteError(error),
      structuredError: formatStructuredMetaWriteError(error),
    };
  }
}

interface ExistingNamedEntity extends Record<string, unknown> {
  id: string;
  name?: string;
  status?: string;
}

async function findExistingCampaignByName(
  client: MetaClient,
  accountPath: string,
  name: string,
  maxRetries: number
): Promise<ExistingNamedEntity | null> {
  const response = await client.metaGet<{ data?: ExistingNamedEntity[] }>(
    `${accountPath}/campaigns`,
    {
      fields: 'id,name,status',
      limit: 100,
    },
    { maxRetries, paginate: true, maxPages: 20 }
  );

  return response.data?.find((campaign) => campaign.name === name.trim()) ?? null;
}

function buildCampaignPayload(options: CreateCampaignOptions): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: options.name.trim(),
    objective: options.objective,
    status: options.status ?? 'PAUSED',
    special_ad_categories: options.specialAdCategories ?? [],
    buying_type: options.buyType ?? 'AUCTION',
  };

  if (options.dailyBudget !== undefined) {
    payload.daily_budget = options.dailyBudget;
  }

  if (options.lifetimeBudget !== undefined) {
    payload.lifetime_budget = options.lifetimeBudget;
  }

  const usesCampaignBudget =
    options.dailyBudget !== undefined || options.lifetimeBudget !== undefined;
  if (!usesCampaignBudget) {
    payload.is_adset_budget_sharing_enabled = options.isAdSetBudgetSharingEnabled ?? false;
  } else if (options.isAdSetBudgetSharingEnabled !== undefined) {
    payload.is_adset_budget_sharing_enabled = options.isAdSetBudgetSharingEnabled;
  }

  if (options.bidStrategy) {
    payload.bid_strategy = options.bidStrategy;
  }

  return payload;
}
