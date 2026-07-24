export type MetaFilteringScalar = string | number | boolean;
export type MetaFilteringValue = MetaFilteringScalar | MetaFilteringScalar[];

export interface MetaFilteringRule {
  field: string;
  operator: string;
  value: MetaFilteringValue;
}

const CANONICAL_OPERATOR_MAP: Record<string, string> = {
  eq: 'EQUAL',
  ne: 'NOT_EQUAL',
  neq: 'NOT_EQUAL',
  gt: 'GREATER_THAN',
  gte: 'GREATER_THAN_OR_EQUAL',
  lt: 'LESS_THAN',
  lte: 'LESS_THAN_OR_EQUAL',
  in: 'IN',
  not_in: 'NOT_IN',
  contains: 'CONTAIN',
  not_contains: 'NOT_CONTAIN',
};

function toIdList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).filter((id) => id.trim().length > 0);
}

/**
 * Build Meta Graph API `filtering` rules from one or more id-valued params
 * (each accepting a single id or an array of ids). Fields with no value are
 * skipped. Returns undefined when no rule has any id, so callers can omit
 * the `filtering` query param entirely instead of sending an empty array.
 */
export function buildMetaIdFilteringRules(
  idFilters: Array<{ field: string; value: string | string[] | undefined }>
): MetaFilteringRule[] | undefined {
  const rules: MetaFilteringRule[] = [];
  for (const { field, value } of idFilters) {
    const ids = toIdList(value);
    if (ids.length > 0) rules.push({ field, operator: 'IN', value: ids });
  }
  return rules.length > 0 ? rules : undefined;
}

/**
 * Parse a caller-supplied, already-Meta-shaped filtering array (the
 * `filters` MCP param on ads_get_performance, or `params.filtering` passed
 * through on other read tools) into validated MetaFilteringRule objects.
 * Silently drops malformed entries (missing field/operator, or a value that
 * isn't a string or array of strings) rather than throwing — a read tool's
 * job is to return the best answer it can, not to fail a whole request over
 * one bad filter entry the caller can see in the response and correct.
 */
export function parseExplicitMetaFilters(value: unknown): MetaFilteringRule[] {
  if (!Array.isArray(value)) return [];

  const rules: MetaFilteringRule[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const field = (entry as Record<string, unknown>).field;
    const operator = (entry as Record<string, unknown>).operator;
    const rawValue = (entry as Record<string, unknown>).value;
    if (
      typeof field !== 'string' ||
      !field.trim() ||
      typeof operator !== 'string' ||
      !operator.trim()
    ) {
      continue;
    }
    const parsedValue = parseMetaFilteringValue(rawValue);
    if (parsedValue === undefined) continue;
    rules.push({ field: field.trim(), operator: operator.trim(), value: parsedValue });
  }
  return rules;
}

/** Translate canonical MCP filter operators into Meta Insights operators. */
export function parseCanonicalMetaFilters(value: unknown): MetaFilteringRule[] {
  return parseExplicitMetaFilters(value).flatMap((rule) => {
    const operator = CANONICAL_OPERATOR_MAP[rule.operator.toLowerCase()];
    if (!operator) return [];
    const normalizedValue =
      (operator === 'IN' || operator === 'NOT_IN') && !Array.isArray(rule.value)
        ? [rule.value]
        : rule.value;
    return [{ ...rule, operator, value: normalizedValue }];
  });
}

function parseMetaFilteringValue(value: unknown): MetaFilteringValue | undefined {
  if (typeof value === 'string') return value.trim() ? value : undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (!Array.isArray(value)) return undefined;

  const values = value.filter((entry): entry is MetaFilteringScalar => {
    if (typeof entry === 'string') return entry.trim().length > 0;
    if (typeof entry === 'number') return Number.isFinite(entry);
    return typeof entry === 'boolean';
  });
  return values.length > 0 ? values : undefined;
}

/** Merge auto-derived id filters with caller-supplied explicit filters. */
export function mergeMetaFilteringRules(
  ...ruleSets: Array<MetaFilteringRule[] | undefined>
): MetaFilteringRule[] | undefined {
  const merged = ruleSets.flatMap((rules) => rules ?? []);
  return merged.length > 0 ? merged : undefined;
}

export interface MetaAdsEdgeScope {
  /** Graph API path to call for the ads edge — scoped to a single campaign/ad set node when possible. */
  path: string;
  /**
   * True when campaignId and/or adSetId were requested but couldn't be fully
   * expressed by `path` alone (multiple ids, or both campaignId and adSetId
   * given together). Callers MUST run the result through
   * `filterAdsByEntityScope` in this case.
   */
  needsPostFilter: boolean;
}

/**
 * Meta's `/act_{id}/ads` edge does not support scoping results to a campaign
 * or ad set via the `filtering` query param — the `campaign.id`/`adset.id`
 * dot-notation syntax is documented by Meta only for the `/insights` edge.
 * The reliable way to scope ads on a direct listing edge is to call the
 * campaign's or ad set's own nested `/ads` edge instead (`/{id}/ads`).
 *
 * Picks that nested path when exactly one campaign or ad set id was
 * requested (the common case). Falls back to the account-level `/act_{id}/ads`
 * edge — with `needsPostFilter: true` — when multiple ids or both a
 * campaignId and an adSetId were given together, since a single path can't
 * express that; callers must apply `filterAdsByEntityScope` afterward.
 */
export function resolveAdsEdgeScope(
  accountId: string,
  campaignId: string | string[] | undefined,
  adSetId: string | string[] | undefined
): MetaAdsEdgeScope {
  const campaignIds = toIdList(campaignId);
  const adSetIds = toIdList(adSetId);

  if (adSetIds.length === 1 && campaignIds.length === 0) {
    return { path: `/${adSetIds[0]}/ads`, needsPostFilter: false };
  }
  if (campaignIds.length === 1 && adSetIds.length === 0) {
    return { path: `/${campaignIds[0]}/ads`, needsPostFilter: false };
  }
  return {
    path: `/act_${accountId}/ads`,
    needsPostFilter: campaignIds.length > 0 || adSetIds.length > 0,
  };
}

/**
 * Client-side safety net for `resolveAdsEdgeScope`'s multi-id fallback case.
 * No-ops (returns `ads` unchanged) when neither campaignId nor adSetId was
 * requested, so it's safe to call unconditionally.
 */
export function filterAdsByEntityScope<T>(
  ads: T[],
  campaignId: string | string[] | undefined,
  adSetId: string | string[] | undefined,
  getCampaignId: (ad: T) => string | undefined,
  getAdSetId: (ad: T) => string | undefined
): T[] {
  const campaignIds = new Set(toIdList(campaignId));
  const adSetIds = new Set(toIdList(adSetId));
  if (campaignIds.size === 0 && adSetIds.size === 0) return ads;

  return ads.filter((ad) => {
    if (campaignIds.size > 0) {
      const id = getCampaignId(ad);
      if (!id || !campaignIds.has(id)) return false;
    }
    if (adSetIds.size > 0) {
      const id = getAdSetId(ad);
      if (!id || !adSetIds.has(id)) return false;
    }
    return true;
  });
}
