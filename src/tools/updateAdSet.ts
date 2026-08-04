import type { MetaClient } from '../metaClient.js';
import type { StructuredMutationError } from '../types.js';
import type { AdSetTargeting } from './createAdSet.js';
import {
  formatMetaWriteError,
  formatStructuredMetaWriteError,
} from '../utils/formatMetaWriteError.js';
import {
  deepMergeTargeting,
  isPlainObject,
  stripReadonlyTargetingKeys,
} from '../utils/targetingMerge.js';
import { checkCampaignOptimizationGoalConsistency } from './metaOptimizationGoalConsistency.js';

export interface UpdateAdSetOptions {
  adSetId: string;
  name?: string;
  status?: 'ACTIVE' | 'PAUSED';
  dailyBudget?: number;
  lifetimeBudget?: number;
  bidStrategy?: string;
  optimizationGoal?: string;
  billingEvent?: string;
  targeting?: AdSetTargeting;
  mode?: 'patch' | 'replace';
  replaceTargetingConfirmed?: boolean;
  startTime?: string;
  endTime?: string;
}

export type UpdateAdSetStatus = 'dry_run' | 'pending_confirmation' | 'executed' | 'failed';

export interface UpdateAdSetResult {
  operation: 'update_adset';
  status: UpdateAdSetStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  mode: 'patch' | 'replace';
  success: boolean;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
  structuredError?: StructuredMutationError;
}

/**
 * Update an existing Meta ad set.
 *
 * Dry-run by default. Set dryRun=false + confirmed=true to execute.
 *
 * POST /{ad_set_id}
 *
 * Returns success/error.
 */
export async function updateAdSet(
  client: MetaClient,
  options: UpdateAdSetOptions,
  execOptions: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number } = {}
): Promise<UpdateAdSetResult> {
  const { dryRun = true, confirmed = false, maxRetries = 3 } = execOptions;
  const mode = options.mode ?? 'patch';

  let preview: Record<string, unknown>;
  try {
    preview = await buildUpdatePayload(client, options, mode, maxRetries);
  } catch (error) {
    return {
      operation: 'update_adset',
      status: 'failed',
      executed: false,
      preview: {},
      mode,
      success: false,
      error:
        `Failed to fetch the ad set's current targeting to merge for a patch-mode update; ` +
        `aborting rather than sending a partial targeting payload. ${formatMetaWriteError(error)}`,
      structuredError: {
        ...formatStructuredMetaWriteError(error),
        code: 'TARGETING_MERGE_FETCH_FAILED',
        provider: 'meta',
        actionableFix:
          'Retry the update once the read succeeds, or use mode="replace" with replaceTargetingConfirmed=true and a complete targeting object if you intend a full overwrite.',
      },
    };
  }

  const baseResult: UpdateAdSetResult = {
    operation: 'update_adset',
    status: 'dry_run',
    executed: false,
    preview,
    mode,
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

  if (mode === 'replace' && options.targeting && !options.replaceTargetingConfirmed) {
    return {
      ...baseResult,
      status: 'failed',
      error:
        'replaceTargetingConfirmed=true is required when mode="replace" and targeting is provided.',
      structuredError: {
        code: 'REPLACE_CONFIRMATION_REQUIRED',
        message: 'Explicit targeting replacement confirmation is required.',
        provider: 'meta',
        actionableFix:
          'Use mode="patch" for merge semantics or set replaceTargetingConfirmed=true after reviewing the dry-run preview.',
      },
    };
  }

  if (options.optimizationGoal !== undefined) {
    try {
      const current = await client.metaGetObject<{ id?: string; campaign_id?: string }>(
        `/${options.adSetId}`,
        { fields: 'id,campaign_id,optimization_goal' },
        maxRetries
      );
      if (typeof current.campaign_id === 'string' && current.campaign_id.length > 0) {
        const consistencyIssue = await checkCampaignOptimizationGoalConsistency(
          client,
          current.campaign_id,
          options.optimizationGoal,
          { currentAdSetId: options.adSetId, maxRetries }
        );
        if (consistencyIssue) {
          return {
            ...baseResult,
            status: 'failed',
            success: false,
            error: consistencyIssue.error,
            structuredError: consistencyIssue.structuredError,
          };
        }
      }
    } catch (error) {
      return {
        ...baseResult,
        status: 'failed',
        success: false,
        error:
          `Failed to verify sibling ad set optimization goals before update; ` +
          `aborting rather than risking Meta error #1885760. ${formatMetaWriteError(error)}`,
        structuredError: {
          ...formatStructuredMetaWriteError(error),
          code: 'OPTIMIZATION_GOAL_CONSISTENCY_CHECK_FAILED',
          provider: 'meta',
          actionableFix:
            'Retry once the ad set and sibling read succeeds, or split different optimization goals into separate campaigns.',
        },
      };
    }
  }

  try {
    const response = await client.metaPost<Record<string, unknown>>(
      `/${options.adSetId}`,
      preview,
      maxRetries
    );

    return {
      ...baseResult,
      status: 'executed',
      executed: true,
      success: true,
      id: options.adSetId,
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

/** Converts the typed targeting diff on `options.targeting` to Meta's snake_case shape. Does not include `metaTargetingOverride` — that's merged in separately. */
function buildTargetingDiff(targeting: AdSetTargeting): Record<string, unknown> {
  const t: Record<string, unknown> = {};
  if (targeting.geoLocations) t.geo_locations = targeting.geoLocations;
  if (targeting.ageMin !== undefined) t.age_min = targeting.ageMin;
  if (targeting.ageMax !== undefined) t.age_max = targeting.ageMax;
  if (targeting.ageRange !== undefined) t.age_range = targeting.ageRange;
  if (targeting.genders !== undefined) t.genders = targeting.genders;
  if (targeting.publisherPlatforms !== undefined)
    t.publisher_platforms = targeting.publisherPlatforms;
  if (targeting.interests !== undefined) t.interests = targeting.interests;
  if (targeting.customAudiences !== undefined) t.custom_audiences = targeting.customAudiences;
  if (targeting.excludedCustomAudiences !== undefined)
    t.excluded_custom_audiences = targeting.excludedCustomAudiences;
  if (targeting.facebookPositions !== undefined) t.facebook_positions = targeting.facebookPositions;
  if (targeting.instagramPositions !== undefined)
    t.instagram_positions = targeting.instagramPositions;
  if (targeting.threadsPositions !== undefined) t.threads_positions = targeting.threadsPositions;
  if (targeting.messengerPositions !== undefined)
    t.messenger_positions = targeting.messengerPositions;
  if (targeting.marketplacePositions !== undefined)
    t.marketplace_positions = targeting.marketplacePositions;
  if (targeting.devicePlatforms !== undefined) t.device_platforms = targeting.devicePlatforms;
  if (targeting.targetingAutomation !== undefined)
    t.targeting_automation = targeting.targetingAutomation;
  return t;
}

/**
 * Fetches only the `targeting` field for merge purposes. Deliberately does NOT
 * reuse readAdSetFull's best-effort/swallow-errors batching: a merge base must be
 * either fully trustworthy or absent-with-a-loud-error, never silently partial —
 * that silent-partial failure mode is exactly what caused the original incident.
 */
async function fetchRemoteTargetingForMerge(
  client: MetaClient,
  adSetId: string,
  maxRetries: number
): Promise<Record<string, unknown>> {
  const remote = await client.metaGetObject<{ targeting?: Record<string, unknown> }>(
    `/${adSetId}`,
    { fields: 'targeting' },
    maxRetries
  );
  return isPlainObject(remote.targeting) ? remote.targeting : {};
}

async function buildUpdatePayload(
  client: MetaClient,
  options: UpdateAdSetOptions,
  mode: 'patch' | 'replace',
  maxRetries: number
): Promise<Record<string, unknown>> {
  const payload: Record<string, unknown> = {};

  if (options.name !== undefined) payload.name = options.name.trim();
  if (options.status !== undefined) payload.status = options.status;
  if (options.dailyBudget !== undefined) payload.daily_budget = options.dailyBudget;
  if (options.lifetimeBudget !== undefined) payload.lifetime_budget = options.lifetimeBudget;
  if (options.bidStrategy !== undefined) payload.bid_strategy = options.bidStrategy;
  if (options.optimizationGoal !== undefined) payload.optimization_goal = options.optimizationGoal;
  if (options.billingEvent !== undefined) payload.billing_event = options.billingEvent;
  if (options.startTime !== undefined) payload.start_time = options.startTime;
  if (options.endTime !== undefined) payload.end_time = options.endTime;

  if (options.targeting) {
    const diff = buildTargetingDiff(options.targeting);
    const override = options.targeting.metaTargetingOverride;
    const hasDiff = Object.keys(diff).length > 0;
    const hasOverride = override !== undefined && Object.keys(override).length > 0;

    if (hasDiff || hasOverride) {
      // Explicit typed fields win over the raw override on key conflicts,
      // matching createAdSet.ts's precedent.
      const requestedLayer = deepMergeTargeting(override ?? {}, diff);

      if (mode === 'replace') {
        payload.targeting = requestedLayer;
      } else {
        const remoteTargeting = await fetchRemoteTargetingForMerge(
          client,
          options.adSetId,
          maxRetries
        );
        const sanitizedRemote = stripReadonlyTargetingKeys(remoteTargeting);
        payload.targeting = deepMergeTargeting(sanitizedRemote, requestedLayer);
      }
    }
  }

  return payload;
}
