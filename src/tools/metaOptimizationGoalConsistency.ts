import type { MetaClient } from '../metaClient.js';
import type { StructuredMutationError } from '../types.js';

interface SiblingAdSet {
  id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  optimization_goal?: string;
}

export interface OptimizationGoalConsistencyIssue {
  error: string;
  structuredError: StructuredMutationError;
}

const TERMINAL_STATUSES = new Set(['ARCHIVED', 'DELETED']);

export async function checkCampaignOptimizationGoalConsistency(
  client: MetaClient,
  campaignId: string,
  requestedOptimizationGoal: unknown,
  options: { currentAdSetId?: string; maxRetries?: number } = {}
): Promise<OptimizationGoalConsistencyIssue | null> {
  if (typeof requestedOptimizationGoal !== 'string' || requestedOptimizationGoal.length === 0) {
    return null;
  }

  const response = await client.metaGet<{ data?: SiblingAdSet[] }>(
    `/${campaignId}/adsets`,
    {
      fields: 'id,name,status,effective_status,optimization_goal',
      limit: 100,
    },
    { maxRetries: options.maxRetries ?? 3, paginate: true, maxPages: 20 }
  );

  const conflictingSibling = response?.data
    ?.filter((adSet) => adSet.id !== options.currentAdSetId)
    .filter((adSet) => !isArchivedOrDeleted(adSet))
    .find(
      (adSet) =>
        typeof adSet.optimization_goal === 'string' &&
        adSet.optimization_goal.length > 0 &&
        adSet.optimization_goal !== requestedOptimizationGoal
    );

  if (!conflictingSibling?.optimization_goal) return null;

  const siblingName = conflictingSibling.name ? ` '${conflictingSibling.name}'` : '';
  const message =
    `Optimization goal mismatch: sibling ad set${siblingName} in campaign '${campaignId}' uses ` +
    `'${conflictingSibling.optimization_goal}', but this request uses '${requestedOptimizationGoal}'. ` +
    `Meta requires ad sets in the same campaign to use the same optimization_goal under auto bid/CBO-style delivery.`;

  return {
    error: message,
    structuredError: {
      code: 'OPTIMIZATION_GOAL_MISMATCH',
      message,
      provider: 'meta',
      actionableFix: `Use '${conflictingSibling.optimization_goal}' for this ad set, update every active sibling to the same goal, or split different optimization goals into separate campaigns.`,
    },
  };
}

function isArchivedOrDeleted(adSet: SiblingAdSet): boolean {
  const status = typeof adSet.status === 'string' ? adSet.status.toUpperCase() : undefined;
  const effectiveStatus =
    typeof adSet.effective_status === 'string' ? adSet.effective_status.toUpperCase() : undefined;
  return (
    (status !== undefined && TERMINAL_STATUSES.has(status)) ||
    (effectiveStatus !== undefined && TERMINAL_STATUSES.has(effectiveStatus))
  );
}
