/**
 * Normalize a Meta Ads account ID by stripping the `act_` prefix if present.
 *
 * Meta API endpoints expect the `act_` prefix to be added by the caller,
 * but account IDs from various sources (Cuan Insight, environment variables,
 * user input) may or may not include it. This function ensures a consistent
 * numeric-only format so that callers can safely prepend `act_` without
 * creating a double prefix like `act_act_1417353822551653`.
 *
 * @param accountId - Raw account ID, e.g. `"act_1417353822551653"` or `"1417353822551653"`
 * @returns Numeric account ID without `act_` prefix, e.g. `"1417353822551653"`
 */
export function normalizeAccountId(accountId: string): string {
  if (accountId.startsWith('act_')) {
    return accountId.slice(4);
  }
  return accountId;
}
