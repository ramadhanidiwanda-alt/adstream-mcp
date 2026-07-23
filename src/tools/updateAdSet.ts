import type { MetaClient } from '../metaClient.js';
import type { StructuredMutationError } from '../types.js';
import type { AdSetTargeting } from './createAdSet.js';
import { formatMetaWriteError, formatStructuredMetaWriteError } from '../utils/formatMetaWriteError.js';

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

  const preview = buildUpdatePayload(options);
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
      error: 'replaceTargetingConfirmed=true is required when mode="replace" and targeting is provided.',
      structuredError: {
        code: 'REPLACE_CONFIRMATION_REQUIRED',
        message: 'Explicit targeting replacement confirmation is required.',
        provider: 'meta',
        actionableFix: 'Use mode="patch" for merge semantics or set replaceTargetingConfirmed=true after reviewing the dry-run preview.',
      },
    };
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

function buildUpdatePayload(options: UpdateAdSetOptions): Record<string, unknown> {
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
    const t: Record<string, unknown> = {};
    if (options.targeting.geoLocations) t.geo_locations = options.targeting.geoLocations;
    if (options.targeting.ageMin !== undefined) t.age_min = options.targeting.ageMin;
    if (options.targeting.ageMax !== undefined) t.age_max = options.targeting.ageMax;
    if (options.targeting.genders !== undefined) t.genders = options.targeting.genders;
    if (options.targeting.publisherPlatforms !== undefined) t.publisher_platforms = options.targeting.publisherPlatforms;
    if (options.targeting.interests !== undefined) t.interests = options.targeting.interests;
    if (options.targeting.customAudiences !== undefined) t.custom_audiences = options.targeting.customAudiences;
    if (options.targeting.excludedCustomAudiences !== undefined)
      t.excluded_custom_audiences = options.targeting.excludedCustomAudiences;
    if (options.targeting.facebookPositions !== undefined)
      t.facebook_positions = options.targeting.facebookPositions;
    if (options.targeting.instagramPositions !== undefined)
      t.instagram_positions = options.targeting.instagramPositions;
    if (options.targeting.threadsPositions !== undefined)
      t.threads_positions = options.targeting.threadsPositions;
    if (options.targeting.messengerPositions !== undefined)
      t.messenger_positions = options.targeting.messengerPositions;
    if (options.targeting.marketplacePositions !== undefined)
      t.marketplace_positions = options.targeting.marketplacePositions;
    if (options.targeting.devicePlatforms !== undefined)
      t.device_platforms = options.targeting.devicePlatforms;
    if (options.targeting.targetingAutomation !== undefined)
      t.targeting_automation = options.targeting.targetingAutomation;
    if (Object.keys(t).length > 0) payload.targeting = t;
  }

  return payload;
}
