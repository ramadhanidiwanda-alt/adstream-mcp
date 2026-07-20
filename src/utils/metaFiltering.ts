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
