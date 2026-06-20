import type { MetaClient } from '../metaClient.js';
import type {
  AuditLogEntry,
  CampaignMutationOptions,
  MutationOperation,
  MutationResult,
} from '../types.js';
import { pauseCampaign } from './pauseCampaign.js';
import { resumeCampaign } from './resumeCampaign.js';
import { updateCampaignBudget } from './updateCampaignBudget.js';
import { renameCampaign } from './renameCampaign.js';

/**
 * Preview what a mutation would do without executing it.
 * Fetches current campaign state and returns the diff.
 */
export async function previewCampaignMutation(
  client: MetaClient,
  operation: MutationOperation,
  campaignId: string,
  payload: { dailyBudget?: number; newName?: string }
): Promise<AuditLogEntry> {
  // Fetch current campaign state
  const fields = ['name', 'status', 'daily_budget', 'lifetime_budget'];
  const current = await client.metaGet<{
    data: Array<{
      name: string;
      status: string;
      daily_budget?: string;
      lifetime_budget?: string;
    }>;
  }>(`/${campaignId}`, { fields: fields.join(',') });

  const campaign = current.data?.[0];
  const fieldsChanged: AuditLogEntry['fields'] = {};

  if (operation === 'pause') {
    fieldsChanged.status = { old: campaign?.status ?? 'unknown', new: 'PAUSED' };
  } else if (operation === 'resume') {
    // Only resume if currently PAUSED
    fieldsChanged.status = { old: campaign?.status ?? 'unknown', new: 'ACTIVE' };
  } else if (operation === 'update_budget') {
    const currentBudget = campaign?.daily_budget ?? campaign?.lifetime_budget ?? '0';
    fieldsChanged.daily_budget = {
      old: Number(currentBudget),
      new: payload.dailyBudget ?? 0,
    };
  } else if (operation === 'rename') {
    fieldsChanged.name = {
      old: campaign?.name ?? '',
      new: payload.newName ?? '',
    };
  }

  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    operation,
    entityType: 'campaign',
    entityId: campaignId,
    before: campaign as unknown as Record<string, unknown>,
    after: {} as Record<string, unknown>,
    fields: fieldsChanged,
    status: 'dry_run',
  };

  // Build "after" state
  entry.after = {
    ...entry.before,
    ...Object.fromEntries(
      Object.entries(fieldsChanged).map(([key, val]) => [key, val.new])
    ),
  };

  return entry;
}

export interface CampaignMutationWorkflowOptions extends CampaignMutationOptions {
  /** Max retries on rate limit */
  maxRetries?: number;
}

export interface CampaignMutationWorkflowResult {
  preview: AuditLogEntry;
  executed: boolean;
  result?: MutationResult;
  error?: string;
}

/**
 * Full campaign mutation workflow with dry-run + audit log support.
 *
 * Mode dryRun=true → returns preview only, no changes made.
 * Mode dryRun=false → executes mutation, returns result + audit log.
 */
export async function executeCampaignMutation(
  client: MetaClient,
  operation: MutationOperation,
  campaignId: string,
  payload: { dailyBudget?: number; newName?: string },
  options: CampaignMutationWorkflowOptions = {}
): Promise<CampaignMutationWorkflowResult> {
  const { dryRun = false, maxRetries = 3, maxBudgetIncrease } = options;

  // Step 1: Preview (always, even for non-dry-run)
  const preview = await previewCampaignMutation(client, operation, campaignId, payload);

  if (dryRun) {
    return {
      preview,
      executed: false,
    };
  }

  // Step 2: Execute
  try {
    let result: MutationResult;

    switch (operation) {
      case 'pause':
        result = await pauseCampaign(client, campaignId, { maxRetries });
        break;
      case 'resume':
        result = await resumeCampaign(client, campaignId, { maxRetries });
        break;
      case 'update_budget': {
        const budget = payload.dailyBudget;
        if (budget === undefined) {
          throw new Error('dailyBudget is required for update_budget operation');
        }
        result = await updateCampaignBudget(client, campaignId, budget, {
          maxRetries,
          maxBudgetIncrease,
        });
        break;
      }
      case 'rename': {
        const name = payload.newName;
        if (!name) {
          throw new Error('newName is required for rename operation');
        }
        result = await renameCampaign(client, campaignId, name, { maxRetries });
        break;
      }
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    preview.status = 'executed';

    return {
      preview,
      executed: true,
      result,
    };
  } catch (error) {
    preview.status = 'failed';
    preview.error = error instanceof Error ? error.message : String(error);

    return {
      preview,
      executed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
