import type { MetaClient } from '../metaClient.js';

export interface ReadAdCreativeFullOptions {
  /** Meta Ad Creative ID (numeric, e.g. '120330899389530268') */
  creativeId: string;
}

/**
 * Full raw response from Meta Graph API for a single AdCreative.
 * Uses `Record<string, unknown>` for dynamic fields so no data is lost.
 */
export type AdCreativeFull = Record<string, unknown>;

export interface UnreadableAdCreativeFields {
  fields: string[];
  reason: string;
}

// ── Field groups ─────────────────────────────────────────────────
// Fields are grouped into small batches so if one batch fails
// (e.g. field not applicable to this creative type), the others still succeed.
// Each batch is attempted independently and merged.

const FIELD_BATCHES: string[][] = [
  // Batch 0: Absolute core — always available
  ['id', 'name', 'status', 'object_type'],

  // Batch 1: IDs & references
  ['object_story_id', 'effective_object_story_id', 'actor_id'],

  // Batch 2: Instagram
  ['instagram_actor_id', 'instagram_permalink_url'],

  // Batch 3: Compliance & type
  ['authorization_category', 'destination_type'],

  // Batch 4: Visual assets
  ['thumbnail_url', 'image_hash', 'image_url', 'video_id'],

  // Batch 5: Text fields (may fail for some creative types)
  ['title', 'body'],

  // Batch 6-7: URL fields. Keep url_tags separate so Meta rejecting link
  // for a creative type does not hide configured URL parameters.
  ['link'],
  ['url_tags'],

  // Batch 8: Object story spec (core structured data)
  ['object_story_spec'],

  // Batch 9: Asset feed spec (Dynamic Creative)
  ['asset_feed_spec'],

  // Batch 10: CTA & Welcome Message (CTWA)
  ['call_to_action', 'page_welcome_message'],

  // Batch 11: Dynamic Creative internals
  ['degrees_of_freedom_spec', 'asset_customization_rules'],

  // Batch 12: Tracking & Context
  ['tracking_specs', 'contextual_multi_ads'],

  // Batch 13: Branded content
  ['branded_content'],

  // Batch 14: Template/raw data
  ['template_data', 'link_data', 'photo_data', 'video_data'],

  // Batch 15: Placement customization fields used by Ads Manager for mixed placements
  ['platform_customizations', 'portrait_customizations'],

  // Batch 16: Capability-gated creative/media sourcing fields
  ['media_sourcing_spec', 'creative_sourcing_spec'],
];

/**
 * Read the full configuration of a Meta Ad Creative.
 *
 * Uses the Graph API endpoint `GET /{creative_id}?fields=...`
 * Fields are requested in small independent batches so that if a field
 * is not applicable to the creative type, it silently fails instead of
 * blocking the entire read.
 *
 * Returns ALL fields returned by Meta — no filtering, no loss.
 */
export async function readAdCreativeFull(
  client: MetaClient,
  options: ReadAdCreativeFullOptions
): Promise<AdCreativeFull> {
  const { creativeId } = options;

  const results: Record<string, unknown> = {};
  const unreadableFields: UnreadableAdCreativeFields[] = [];

  // Try each batch independently
  for (const batch of FIELD_BATCHES) {
    try {
      const fields = batch.join(',');
      const partial = await client.metaGetObject<Record<string, unknown>>(`/${creativeId}`, {
        fields,
      });
      // Merge successful fields into result
      for (const key of batch) {
        if (partial[key] !== undefined) {
          results[key] = partial[key];
        }
      }
    } catch (error) {
      unreadableFields.push({
        fields: batch,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (unreadableFields.length > 0) {
    results.unreadable_fields = unreadableFields;
  }

  return results;
}
