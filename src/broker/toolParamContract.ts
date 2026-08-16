/**
 * params is not a raw Graph API passthrough — a tool reads a fixed set of typed
 * fields and would otherwise ignore the rest without a word, so a caller sees a
 * clean-looking result missing exactly the field they cared about. Reject unknown
 * keys instead, naming the typed field where one exists.
 *
 * The allowed keys are derived from each tool's own inputSchema rather than kept
 * in a parallel list, so the contract cannot drift from what the tool publicly
 * declares. This module imports nothing from the broker or the adapters, so both
 * sides can depend on it without forming a module cycle.
 */

export interface ToolParamContract {
  allowed: ReadonlySet<string>;
  hints: Record<string, string>;
}

/**
 * Keys extractParams never merges into request.params: the shared envelope plus
 * the internal oauth context. Single source of truth for both extractParams and
 * the drift check that compares adapter-side allowlists against derived ones.
 */
export const RESERVED_REQUEST_KEYS: ReadonlySet<string> = new Set([
  'provider',
  'providers',
  'accountId',
  'since',
  'until',
  'params',
  '_oauthAuthContext',
]);

export function deriveAllowedParamKeys(inputSchema: { properties?: unknown }): Set<string> {
  const properties = inputSchema.properties;
  if (!properties || typeof properties !== 'object') return new Set<string>();
  return new Set(Object.keys(properties as Record<string, unknown>));
}

export function findUnknownParamKeys(
  params: Record<string, unknown>,
  allowed: ReadonlySet<string>
): string[] {
  return Object.keys(params).filter((key) => !allowed.has(key));
}

export function formatUnknownParamsMessage(
  unknownKeys: readonly string[],
  hints: Record<string, string>
): string {
  const detail = unknownKeys.map((key) => (hints[key] ? `${key} → ${hints[key]}` : key)).join('; ');
  return `Field berikut tidak dikenali dan TIDAK dikirim ke Meta: ${detail}. params bukan passthrough mentah ke Graph API — pakai field bertipe yang sesuai, atau hapus field ini.`;
}

// Field names callers reach for that a tool does not accept — raw Graph API
// spellings, plus fields that belong on a different entity. Mapping them back to
// the right place turns a dead end into a fix. Hints only enrich the message; a
// missing hint costs clarity, never correctness.
export const TOOL_PARAM_HINTS: Record<string, Record<string, string>> = {
  ads_create_adcreative: {
    whatsappPhoneNumberId:
      'destinasi WhatsApp diatur di ad set (ads_create_adset destinationType/promotedObject), bukan di creative — creative hanya membawa CTA WHATSAPP_MESSAGE',
    source_instagram_media_id: 'creativeSpec.sourceInstagramMediaId (creativeFormat: existing_post)',
    object_story_id: 'creativeSpec.objectStoryId (creativeFormat: existing_post)',
    object_story_spec: 'objectStorySpec',
    asset_feed_spec: 'assetFeedSpec',
    url_tags: 'urlTags',
    page_id: 'pageId',
    image_hash: 'imageHash',
    video_id: 'videoId',
    call_to_action_type: 'callToActionType',
    instagram_user_id: 'instagramUserId',
    threads_user_id: 'threadsProfileId',
    threads_profile_id:
      'threadsProfileId (catatan: threads_profile_id bukan field Graph API — nama yang benar adalah threads_user_id)',
    degrees_of_freedom_spec: 'optOutEnhancements',
  },
  ads_read_creative_full: {
    fields:
      'tool ini selalu membaca seluruh field yang didukung; tidak ada override fields. Lihat AD_CREATIVE_FULL_FIELDS di src/tools/readAdCreativeFull.ts',
    creative_id: 'creativeId',
    id: 'creativeId',
  },
  ads_read_adset_full: {
    fields: 'tool ini selalu membaca seluruh field ad set yang didukung; tidak ada override fields',
    adset_id: 'adsetId',
    ad_set_id: 'adsetId',
    adSetId: 'adsetId',
    campaign_id: 'campaignId',
    id: 'adsetId',
    after: 'cursor',
  },
};
