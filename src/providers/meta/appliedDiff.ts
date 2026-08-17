/**
 * Compare a Graph API request payload against a read-back of the same object.
 *
 * Meta accepts writes it will not honour and drops values without error, so a
 * request payload is not evidence of stored state. Observed live: an ad set
 * update requested five `publisher_platforms` and Meta stored four, while the
 * write itself reported success. This helper turns the request and the
 * read-back into an explicit list of differences.
 *
 * Comparison rules, all driven by observed Meta behaviour:
 * - Arrays compare order-insensitively; Meta reorders `publisher_platforms`.
 * - Scalars compare by string form; Meta returns numbers as strings
 *   (`daily_budget: "19789"` for a requested `19789`).
 * - Keys present in the read-back but absent from the request are ignored;
 *   this reports what was asked for, not everything the object holds.
 */
export interface AppliedFieldDrop {
  field: string;
  requested: unknown;
  applied: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sameValue(requested: unknown, applied: unknown): boolean {
  if (Array.isArray(requested) && Array.isArray(applied)) {
    if (requested.length !== applied.length) return false;
    const normalize = (items: unknown[]): string[] => items.map((i) => JSON.stringify(i)).sort();
    const a = normalize(requested);
    const b = normalize(applied);
    return a.every((value, index) => value === b[index]);
  }
  if (Array.isArray(requested) || Array.isArray(applied)) return false;
  if (requested === undefined || applied === undefined) return requested === applied;
  if (requested === null || applied === null) return requested === applied;
  if (isRecord(requested) && isRecord(applied)) {
    return JSON.stringify(requested) === JSON.stringify(applied);
  }
  return String(requested) === String(applied);
}

export function computeAppliedDrops(
  requested: Record<string, unknown>,
  applied: Record<string, unknown>,
  nestedKeys: readonly string[] = ['targeting']
): AppliedFieldDrop[] {
  const drops: AppliedFieldDrop[] = [];

  for (const [key, wanted] of Object.entries(requested)) {
    const got = applied[key];

    if (nestedKeys.includes(key) && isRecord(wanted) && isRecord(got)) {
      for (const [nestedKey, nestedWanted] of Object.entries(wanted)) {
        const nestedGot = got[nestedKey];
        if (!sameValue(nestedWanted, nestedGot)) {
          drops.push({
            field: `${key}.${nestedKey}`,
            requested: nestedWanted,
            applied: nestedGot ?? null,
          });
        }
      }
      continue;
    }

    if (!sameValue(wanted, got)) {
      drops.push({ field: key, requested: wanted, applied: got ?? null });
    }
  }

  return drops;
}
