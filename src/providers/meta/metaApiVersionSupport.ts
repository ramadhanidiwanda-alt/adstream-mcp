/**
 * Version gates for creative fields requested on a combined Graph read.
 *
 * Every read path that asks for these — getMetaCreativeFields in MetaAdsAdapter
 * and getCreativeReadBackFields in tools/createAdCreative — builds ONE combined
 * Graph request, so an unsupported field 400s (code 100) the entire call rather
 * than failing in isolation the way readAdCreativeFull's FIELD_BATCHES does.
 *
 * Losing a read-back field on an old version is a minor degradation; 400-ing the
 * whole call is an outage — and on createAdCreative's strict paths
 * (placement_image, video CTWA) that outage is reported as status 'failed' for a
 * creative that was in fact created.
 *
 * The >= 23 floor is not researched, and probing the live Graph API on
 * 2026-08-16 established that it cannot be researched by version-pinning a
 * request. Findings, each from a GET against a real AdCreative node:
 *
 * - Meta does NOT serve the version in the path when that version is below the
 *   calling app's floor. Requests for v18.0 through v24.0 all came back with
 *   `facebook-api-version: v25.0`; only v26.0 was served as itself. So setting
 *   META_API_VERSION=v22.0 does not produce v22.0 behavior — it silently gets
 *   v25.0. Read the response header, never the requested version, when
 *   reasoning about which version actually ran.
 * - The 400 hazard is real and detectable: an invented field name returns
 *   status 400 code 100 ("Tried accessing nonexisting field"). Both gated
 *   fields are accepted at v25.0, so neither is bogus there.
 * - `?metadata=1` on an AdCreative node returns no field list at all, so
 *   per-version field enumeration is not available as a bisect method either.
 * - Meta's own docs record no minimum version: the AdCreative reference lists
 *   threads_user_id with no version note, neither the v22.0 nor the v23.0
 *   changelog mentions Threads, and version-pinned reference URLs redirect to
 *   the current version. Marketing API Threads support expanded 2025-05-19,
 *   inside v23.0's release window — consistent with >= 23, but not proof.
 *
 * The floor therefore stays. It is inert on every version this app can reach
 * (v25.0+ satisfies it), it cannot be falsified from here, and it remains the
 * conservative side of an asymmetric risk: too low costs one read-back field,
 * too high costs the whole call. A deployment whose app has an older floor is
 * the only case where it does work, and that case cannot be ruled out from a
 * single app.
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
