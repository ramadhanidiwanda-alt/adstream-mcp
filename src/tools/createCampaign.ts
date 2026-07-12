import type { MetaClient } from '../metaClient.js';
import type { StructuredMutationError } from '../types.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';
import { formatMetaWriteError, formatStructuredMetaWriteError } from '../utils/formatMetaWriteError.js';

export type MetaCampaignObjective =
  | 'OUTCOME_SALES'
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_AWARENESS'
  | 'OUTCOME_APP_PROMOTION'
  | 'OUTCOME_CONVERSATIONS'
  | 'OUTCOME_RESHARES'
  | 'OUTCOME_VALUE'
  | 'OUTCOME_VIDEO_VIEWS'
  | 'OUTCOME_POST_ENGAGEMENT'
  | 'OUTCOME_LANDING_PAGE_VIEWS'
  | 'OUTCOME_REACH'
  | 'OUTCOME_MESSAGES'
  | 'OUTCOME_THRUPLAY';

export type CampaignStatus = 'ACTIVE' | 'PAUSED';

export interface CreateCampaignOptions {
  adAccountId: string;
  name: string;
  objective: MetaCampaignObjective;
  status?: CampaignStatus;
  specialAdCategories?: string[];
  buyType?: 'AUCTION' | 'RESERVED';
  dailyBudget?: number;
  lifetimeBudget?: number;
  bidStrategy?: string;
  dedupeByName?: boolean;
  externalReference?: string;
}

export type CreateCampaignStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed' | 'deduped';

export interface CreateCampaignResult {
  operation: 'create_campaign';
  status: CreateCampaignStatus;
  executed: boolean;
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

  const preview = buildCampaignPayload(options);
  if (options.externalReference) {
    preview.external_reference = options.externalReference;
  }
  const baseResult: CreateCampaignResult = {
    operation: 'create_campaign',
    status: 'dry_run',
    executed: false,
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
    const existing = await findExistingCampaignByName(client, accountPath, options.name, maxRetries);
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
      filtering: [{ field: 'name', operator: 'EQUAL', value: name.trim() }],
    },
    { maxRetries }
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

  if (options.bidStrategy) {
    payload.bid_strategy = options.bidStrategy;
  }

  return payload;
}
