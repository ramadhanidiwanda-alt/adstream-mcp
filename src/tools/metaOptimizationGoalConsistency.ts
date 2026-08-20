import type { MetaClient } from '../metaClient.js';
import type { StructuredMutationError } from '../types.js';

interface SiblingAdSet {
  id?: string;
  name?: string;
  status?: string;
  effective_status?: string;
  optimization_goal?: string;
}

/** The campaign fields that decide whether Meta enforces one optimization goal per campaign. */
export interface CampaignBudgetInfo {
  bid_strategy?: string;
  daily_budget?: number | string;
  lifetime_budget?: number | string;
}

export interface OptimizationGoalConsistencyIssue {
  error: string;
  structuredError: StructuredMutationError;
}

const TERMINAL_STATUSES = new Set(['ARCHIVED', 'DELETED']);

/** The only bid strategy Meta calls "auto bid". */
const AUTO_BID_STRATEGY = 'LOWEST_COST_WITHOUT_CAP';

/**
 * Whether Meta requires every ad set in this campaign to share one optimization
 * goal. Meta scopes the rule to Advantage campaign budget under auto bid — "All
 * optimization goals must be the same across ad sets under auto bid" — so both
 * conditions must hold:
 *
 * 1. the budget sits on the campaign (Advantage campaign budget / CBO), and
 * 2. delivery runs under auto bid.
 *
 * A campaign whose budgets live on its ad sets, or a CBO campaign on COST_CAP /
 * bid-cap / min-ROAS, may mix optimization goals freely.
 *
 * @see https://developers.facebook.com/documentation/ads-commerce/marketing-api/bidding/guides/advantage-campaign-budget
 */
export function campaignEnforcesUniformOptimizationGoal(
  campaign: CampaignBudgetInfo | undefined
): boolean {
  if (!campaign) return false;
  if (campaign.bid_strategy !== AUTO_BID_STRATEGY) return false;
  return hasBudget(campaign.daily_budget) || hasBudget(campaign.lifetime_budget);
}

function hasBudget(budget: number | string | undefined): boolean {
  if (typeof budget === 'number') return budget > 0;
  if (typeof budget !== 'string') return false;
  const parsed = Number(budget);
  return Number.isFinite(parsed) && parsed > 0;
}

export async function checkCampaignOptimizationGoalConsistency(
  client: MetaClient,
  campaignId: string,
  requestedOptimizationGoal: unknown,
  options: {
    currentAdSetId?: string;
    maxRetries?: number;
    /** Pre-fetched campaign, to avoid reading the campaign node twice. */
    campaign?: CampaignBudgetInfo;
  } = {}
): Promise<OptimizationGoalConsistencyIssue | null> {
  if (typeof requestedOptimizationGoal !== 'string' || requestedOptimizationGoal.length === 0) {
    return null;
  }

  const maxRetries = options.maxRetries ?? 3;
  const campaign =
    options.campaign ??
    (await client.metaGetObject<CampaignBudgetInfo>(
      `/${campaignId}`,
      { fields: 'id,bid_strategy,daily_budget,lifetime_budget' },
      maxRetries
    ));

  // Nothing to enforce, so do not spend a paginated sibling read finding out.
  if (!campaignEnforcesUniformOptimizationGoal(campaign)) return null;

  const response = await client.metaGet<{ data?: SiblingAdSet[] }>(
    `/${campaignId}/adsets`,
    {
      fields: 'id,name,status,effective_status,optimization_goal',
      limit: 100,
    },
    { maxRetries, paginate: true, maxPages: 20 }
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
    `This campaign holds its own budget (Advantage campaign budget) and runs under auto bid, and ` +
    `Meta requires every ad set in that setup to share one optimization_goal.`;

  return {
    error: message,
    structuredError: {
      code: 'OPTIMIZATION_GOAL_MISMATCH',
      message,
      provider: 'meta',
      actionableFix: `Use '${conflictingSibling.optimization_goal}' for this ad set, update every active sibling to the same goal, move the budget to the ad sets, or split different optimization goals into separate campaigns.`,
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
