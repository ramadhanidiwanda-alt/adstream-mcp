export interface MetaFilteringRule {
  field: string;
  operator: 'IN';
  value: string[];
}

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
