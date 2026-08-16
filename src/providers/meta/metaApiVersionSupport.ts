/**
 * Version gates for creative fields requested on a combined Graph read.
 *
 * Every read path that asks for these — getMetaCreativeFields in MetaAdsAdapter
 * and getCreativeReadBackFields in tools/createAdCreative — builds ONE combined
 * Graph request, so an unsupported field 400s (code 100) the entire call rather
 * than failing in isolation the way readAdCreativeFull's FIELD_BATCHES does.
 * META_API_VERSION is user-settable and providerApiVersion can arrive from a
 * remote broker, so older versions are genuinely reachable in production.
 *
 * Losing a read-back field on an old version is a minor degradation; 400-ing the
 * whole call is an outage — and on createAdCreative's strict paths
 * (placement_image, video CTWA) that outage is reported as status 'failed' for a
 * creative that was in fact created.
 *
 * threads_user_id has no minimum version recorded in Meta's docs: the field is
 * listed in the AdCreative reference without a version note, neither the v22.0
 * nor the v23.0 Graph API changelog mentions Threads, and version-pinned
 * reference URLs redirect to the current version so they cannot be used to
 * bisect. Threads support in the Marketing API expanded on 2025-05-19, which
 * falls in v23.0's release window, so >= 23 is consistent with the public
 * timeline. It remains the conservative side of an asymmetric risk: too low
 * costs a missing read-back field, too high costs a 400.
 *
 * instagram_user_id is long-established and stays ungated.
 *
 * One predicate per field, shared by every call site deliberately: copies drift.
 */

function metaApiMajorVersion(apiVersion: string | undefined): number | undefined {
  const match = /^v(\d+)(?:\.|$)/i.exec(apiVersion ?? 'v25.0');
  return match === null ? undefined : Number(match[1]);
}

export function supportsMediaSourcingSpec(apiVersion: string | undefined): boolean {
  const major = metaApiMajorVersion(apiVersion);
  return major !== undefined && major >= 23;
}

export function supportsThreadsUserIdField(apiVersion: string | undefined): boolean {
  const major = metaApiMajorVersion(apiVersion);
  return major !== undefined && major >= 23;
}
