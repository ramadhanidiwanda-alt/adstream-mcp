import type { MetaClient } from '../../metaClient.js';

/**
 * Result of checking whether a creative satisfies the requirements of an
 * omnichannel (cross-channel / CPAS) ad set.
 */
export interface OmnichannelCompatibility {
  /** True when the target ad set optimizes across channels (has an omnichannel_object). */
  omnichannelAdSet: boolean;
  /** Omnichannel creative components that are required but absent. Empty when compatible. */
  missing: string[];
}

/** Components Meta requires on a creative attached to an omnichannel ad set. */
const REQUIRED_COMPONENTS = [
  'applink_treatment',
  'omnichannel_link_spec',
  'object_store_urls',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when an ad set's promoted_object opts into cross-channel (omnichannel) delivery. */
function isOmnichannelAdSet(adSet: Record<string, unknown>): boolean {
  const promoted = adSet.promoted_object;
  return isRecord(promoted) && isRecord(promoted.omnichannel_object);
}

/** Recursively search a creative for a non-empty object_store_urls array. */
function hasObjectStoreUrls(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasObjectStoreUrls(item));
  }
  if (isRecord(value)) {
    const urls = value.object_store_urls;
    if (Array.isArray(urls) && urls.length > 0) return true;
    return Object.values(value).some((entry) => hasObjectStoreUrls(entry));
  }
  return false;
}

/**
 * Evaluate whether a creative is compatible with an omnichannel ad set.
 *
 * A creative attached to an omnichannel ad set must carry an applink treatment,
 * an omnichannel link spec, and app store URLs in its call-to-action; otherwise
 * Meta rejects the ad with a hard error at creation time.
 */
export function evaluateOmnichannelCompatibility(
  adSet: Record<string, unknown>,
  creative: Record<string, unknown>
): OmnichannelCompatibility {
  if (!isOmnichannelAdSet(adSet)) {
    return { omnichannelAdSet: false, missing: [] };
  }

  const missing: string[] = [];
  if (!creative.applink_treatment) missing.push('applink_treatment');
  if (!creative.omnichannel_link_spec) missing.push('omnichannel_link_spec');
  if (!hasObjectStoreUrls(creative)) missing.push('object_store_urls');

  return { omnichannelAdSet: true, missing };
}

/**
 * Fetch the ad set and creative and, if the pairing is an omnichannel ad set
 * with a non-compliant creative, return an actionable error message. Returns
 * undefined when the pairing is compatible (or the ad set is not omnichannel).
 */
export async function getOmnichannelCompatibilityError(
  client: MetaClient,
  adSetId: string,
  creativeId: string,
  maxRetries: number
): Promise<string | undefined> {
  const [adSet, creative] = await Promise.all([
    client.metaGetObject<Record<string, unknown>>(
      `/${adSetId}`,
      { fields: 'promoted_object' },
      maxRetries
    ),
    client.metaGetObject<Record<string, unknown>>(
      `/${creativeId}`,
      {
        fields:
          'applink_treatment,omnichannel_link_spec,object_story_spec,asset_feed_spec,call_to_action',
      },
      maxRetries
    ),
  ]);

  const { omnichannelAdSet, missing } = evaluateOmnichannelCompatibility(adSet, creative);
  if (!omnichannelAdSet || missing.length === 0) return undefined;

  return (
    `Ad set ini optimasi lintas saluran (omnichannel/CPAS), tetapi materi iklan ${creativeId} ` +
    `belum memenuhi syarat. Komponen yang hilang: ${missing.join(', ')}. ` +
    `Materi omnichannel wajib punya applink_treatment, omnichannel_link_spec, dan object_store_urls ` +
    `(URL Play Store + App Store) di call-to-action. Perbaiki materi lalu ulangi dry-run, ` +
    `atau gunakan materi single_image omnichannel yang sudah lengkap.`
  );
}
