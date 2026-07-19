import type { MetaClient } from '../metaClient.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';

export interface ReadAdSetFullOptions {
  /** Meta Ad Set ID (numeric, e.g. '120250499282510071') */
  adsetId: string;
}

export interface ListAdSetsFullOptions {
  /** Account id (with or without act_ prefix). Used when campaignId is absent. */
  accountId?: string;
  /** Campaign id. Lists ad sets under this campaign. */
  campaignId?: string;
  /** Page size. Default 25. */
  limit?: number;
  /** Pagination cursor (Meta `after`). */
  cursor?: string;
}

export type AdSetFull = Record<string, unknown>;

export interface ListAdSetsFullResult {
  adsets: AdSetFull[];
  nextCursor: string | null;
  /** True when the full field set was rejected and a core-field fallback was used. */
  droppedFields: boolean;
}

// Independent batches for single-ad-set reads, so a rejected field
// (not applicable to this ad set) does not block the others.
// This is the single source of truth for the ad set field list.
const FIELD_BATCHES: string[][] = [
  ['id', 'name', 'status', 'effective_status', 'campaign_id', 'created_time', 'updated_time'],
  ['daily_budget', 'lifetime_budget', 'budget_remaining'],
  ['bid_strategy', 'bid_amount', 'bid_constraints', 'billing_event', 'optimization_goal'],
  ['targeting'],
  ['promoted_object', 'destination_type', 'attribution_spec'],
  ['start_time', 'end_time', 'adset_schedule'],
  [
    'is_dynamic_creative',
    'frequency_control_specs',
    'pacing_type',
    'multi_optimization_goal_weight',
    'dsa_beneficiary',
    'dsa_payor',
  ],
];

/**
 * Flat field list used for the list endpoints (single string) and for the
 * adapter's fields_retrieved / fields_missing computation. Derived from
 * FIELD_BATCHES so the two can never desync.
 */
export const ADSET_FULL_FIELDS: string[] = FIELD_BATCHES.flat();

// Core fields that always succeed — used as the list-mode fallback.
const CORE_LIST_FIELDS = ['id', 'name', 'status', 'effective_status', 'campaign_id', 'targeting'];

/**
 * Read the full configuration of one Meta Ad Set via GET /{adset_id}?fields=...
 * Fields are requested in independent batches; a failing batch is skipped.
 */
export async function readAdSetFull(
  client: MetaClient,
  options: ReadAdSetFullOptions
): Promise<AdSetFull> {
  const { adsetId } = options;
  const results: Record<string, unknown> = {};

  for (const batch of FIELD_BATCHES) {
    try {
      const partial = await client.metaGetObject<Record<string, unknown>>(`/${adsetId}`, {
        fields: batch.join(','),
      });
      for (const key of batch) {
        if (partial[key] !== undefined) {
          results[key] = partial[key];
        }
      }
    } catch {
      // Field batch not applicable to this ad set — skip silently.
    }
  }

  return results;
}

interface MetaAdSetListResponse {
  data?: AdSetFull[];
  paging?: { cursors?: { after?: string } };
}

/**
 * List ad sets (with full fields) under a campaign or account.
 * If the full field request is rejected, retries with a core-field set
 * and flags droppedFields = true.
 */
export async function listAdSetsFull(
  client: MetaClient,
  options: ListAdSetsFullOptions
): Promise<ListAdSetsFullResult> {
  const { campaignId, accountId, limit = 25, cursor } = options;

  const path = campaignId
    ? `/${campaignId}/adsets`
    : `${normalizeAccountPath(accountId ?? '')}/adsets`;

  const baseParams: Record<string, string | number> = { limit };
  if (cursor) {
    baseParams.after = cursor;
  }

  let droppedFields = false;
  let response: MetaAdSetListResponse;

  try {
    response = await client.metaGet<MetaAdSetListResponse>(path, {
      ...baseParams,
      fields: ADSET_FULL_FIELDS.join(','),
    });
  } catch {
    droppedFields = true;
    response = await client.metaGet<MetaAdSetListResponse>(path, {
      ...baseParams,
      fields: CORE_LIST_FIELDS.join(','),
    });
  }

  return {
    adsets: response.data ?? [],
    nextCursor: response.paging?.cursors?.after ?? null,
    droppedFields,
  };
}
