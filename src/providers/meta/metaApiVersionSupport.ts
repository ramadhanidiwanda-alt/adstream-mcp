/**
 * Gate for requesting threads_user_id on a creative read.
 *
 * Both read paths that ask for it — getMetaCreativeFields in MetaAdsAdapter and
 * CREATIVE_READ_BACK_FIELDS in tools/createAdCreative — build ONE combined Graph
 * request, so an unsupported field 400s (code 100) the entire call rather than
 * failing in isolation the way readAdCreativeFull's FIELD_BATCHES does.
 * META_API_VERSION is user-settable and providerApiVersion can arrive from a
 * remote broker, so older versions are genuinely reachable in production.
 *
 * threads_user_id is recent enough that no minimum version is recorded anywhere
 * in this repo or in the Meta docs consulted for this branch. The threshold is a
 * deliberately conservative REUSE of supportsMediaSourcingSpec's >= 23 (the same
 * floor as minApiMajor in objectiveLaunchMatrix and the "v23+" baseline in
 * docs/superpowers/plans/2026-08-15-meta-threads-identity.md), not a researched
 * minimum. Losing a read-back field on an old version is a minor degradation;
 * 400-ing the whole call is an outage.
 *
 * instagram_user_id is long-established and stays ungated.
 *
 * One predicate, shared by both call sites deliberately: two copies would drift.
 */
export function supportsThreadsUserIdField(apiVersion: string | undefined): boolean {
  const match = /^v(\d+)(?:\.|$)/i.exec(apiVersion ?? 'v25.0');
  return match !== null && Number(match[1]) >= 23;
}
