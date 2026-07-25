export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively merges `override` on top of `base`. Nested plain objects are merged
 * key-by-key; arrays and primitives in `override` fully replace the corresponding
 * value in `base`.
 */
export function deepMergeTargeting(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = result[key];
    result[key] =
      isPlainObject(baseValue) && isPlainObject(value)
        ? deepMergeTargeting(baseValue, value)
        : value;
  }
  return result;
}

/**
 * Sub-fields of the ad set `targeting` object that Meta returns on read but
 * rejects (or silently ignores) on write. Verified empirically against a live
 * account (2026-07): `age_range`, `age_min`/`age_max`, `flexible_spec`,
 * `geo_locations`, `targeting_automation`, and placement fields all round-trip
 * cleanly when resent as read, as long as paired sub-fields travel together
 * (e.g. `age_range` requires `targeting_automation.advantage_audience: 1`,
 * which a remote-targeting read already includes). No genuinely read-only
 * sub-field has been identified, so this list is empty for now — kept as an
 * extensible hook in case Meta adds computed-only sub-fields later.
 */
export const READONLY_TARGETING_KEYS: string[] = [];

/** Strips known non-writable sub-fields from a `targeting` object read from Meta. */
export function stripReadonlyTargetingKeys(
  targeting: Record<string, unknown>
): Record<string, unknown> {
  if (READONLY_TARGETING_KEYS.length === 0) return { ...targeting };
  const cleaned: Record<string, unknown> = { ...targeting };
  for (const key of READONLY_TARGETING_KEYS) delete cleaned[key];
  return cleaned;
}
