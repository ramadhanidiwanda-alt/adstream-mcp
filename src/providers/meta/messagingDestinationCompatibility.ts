import type { MetaClient } from '../../metaClient.js';

/**
 * An ad set's destination_type and its creative's call_to_action have to agree about
 * which inbox the ad opens. Meta accepts the mismatch at create time and the ad runs
 * with a button that leads nowhere useful — on 2026-07-26 an INSTAGRAM_DIRECT ad set
 * took a MESSAGE_PAGE (Messenger) creative without a word of complaint.
 *
 * Only messaging destinations are checked. A WEBSITE or catalog ad set has no rule
 * here worth enforcing on Meta's behalf.
 *
 * Values from https://developers.facebook.com/docs/marketing-api/adset/destination_type/
 */
const MESSAGING_DESTINATION_CTA_TYPES: Readonly<Record<string, readonly string[]>> = {
  INSTAGRAM_DIRECT: ['INSTAGRAM_MESSAGE'],
  MESSENGER: ['MESSAGE_PAGE'],
  WHATSAPP: ['WHATSAPP_MESSAGE'],
  MESSAGING_INSTAGRAM_DIRECT_MESSENGER: ['INSTAGRAM_MESSAGE', 'MESSAGE_PAGE'],
  MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP: [
    'INSTAGRAM_MESSAGE',
    'MESSAGE_PAGE',
    'WHATSAPP_MESSAGE',
  ],
  MESSAGING_INSTAGRAM_DIRECT_WHATSAPP: ['INSTAGRAM_MESSAGE', 'WHATSAPP_MESSAGE'],
  MESSAGING_MESSENGER_WHATSAPP: ['MESSAGE_PAGE', 'WHATSAPP_MESSAGE'],
};

/** call_to_action.value.app_destination values each destination_type can serve. */
const MESSAGING_DESTINATION_APP_DESTINATIONS: Readonly<Record<string, readonly string[]>> = {
  INSTAGRAM_DIRECT: ['INSTAGRAM_DIRECT'],
  MESSENGER: ['MESSENGER'],
  WHATSAPP: ['WHATSAPP'],
  MESSAGING_INSTAGRAM_DIRECT_MESSENGER: ['INSTAGRAM_DIRECT', 'MESSENGER'],
  MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP: ['INSTAGRAM_DIRECT', 'MESSENGER', 'WHATSAPP'],
  MESSAGING_INSTAGRAM_DIRECT_WHATSAPP: ['INSTAGRAM_DIRECT', 'WHATSAPP'],
  MESSAGING_MESSENGER_WHATSAPP: ['MESSENGER', 'WHATSAPP'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Where a CTA can live on a creative: at the root for existing-post creatives (the
 * shape Ads Manager writes), inside object_story_spec's link/video/photo data for the
 * built formats, inside template_data for catalog creatives, per card in
 * link_data.child_attachments for carousels, and as asset_feed_spec.call_to_action_types
 * for asset-feed creatives. Collect from all of them so the check is not fooled by
 * format — an empty result has to mean "this creative has no CTA", not "we looked in
 * the wrong place", because that emptiness is now what blocks a create.
 */
function collectCallToActions(creative: Record<string, unknown>): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];

  if (isRecord(creative.call_to_action)) found.push(creative.call_to_action);

  const storySpec = isRecord(creative.object_story_spec) ? creative.object_story_spec : undefined;
  for (const key of ['link_data', 'video_data', 'photo_data', 'template_data']) {
    const data = storySpec && isRecord(storySpec[key]) ? storySpec[key] : undefined;
    if (!data) continue;
    if (isRecord(data.call_to_action)) found.push(data.call_to_action);
    if (Array.isArray(data.child_attachments)) {
      for (const card of data.child_attachments) {
        if (isRecord(card) && isRecord(card.call_to_action)) found.push(card.call_to_action);
      }
    }
  }

  const feedSpec = isRecord(creative.asset_feed_spec) ? creative.asset_feed_spec : undefined;
  if (Array.isArray(feedSpec?.call_to_action_types)) {
    for (const type of feedSpec.call_to_action_types) {
      if (typeof type === 'string') found.push({ type });
    }
  }

  return found;
}

/**
 * Pure form of the check, so the rule can be exercised without a Meta client.
 * Returns undefined when the pairing is fine or when no rule applies.
 *
 * A creative with NO call_to_action anywhere is blocked, not excused. That used to be
 * the one case this check stayed silent on — the worry being that the read might not
 * have surfaced the CTA — and on 2026-08-24 it let an existing-post Reel creative into
 * a WHATSAPP ad set. Meta accepted the create, then rejected it asynchronously with
 * error_code 1487891 (HARD_ERROR, "Materi Iklan Tidak Valid untuk Tujuan"): the ad
 * flipped back to PAUSED / WITH_ISSUES and never ran. The read either returns all three
 * CTA-bearing fields or throws (and a throw is already treated as "no opinion"), so an
 * empty result is evidence, not a blind spot. `skipMessagingDestinationCheck: true`
 * remains the escape hatch if the rule ever misfires.
 */
export function getMessagingDestinationMismatch(
  adSet: Record<string, unknown>,
  creative: Record<string, unknown>
): string | undefined {
  const destinationType = readString(adSet.destination_type);
  if (!destinationType) return undefined;

  const allowedCtaTypes = MESSAGING_DESTINATION_CTA_TYPES[destinationType];
  if (!allowedCtaTypes) return undefined;

  const callToActions = collectCallToActions(creative);
  // Asset-feed creatives declare their CTAs in asset_feed_spec.call_to_action_types.
  // When that array is missing the creative is malformed as an asset feed, and the
  // dynamic-creative and placement pre-flights that run straight after this one
  // diagnose it far more precisely than "no CTA" would. Leave them to it.
  if (callToActions.length === 0 && !isRecord(creative.asset_feed_spec)) {
    const whatsappHint = allowedCtaTypes.includes('WHATSAPP_MESSAGE')
      ? ' Untuk WHATSAPP_MESSAGE pada creative existing_post, isi juga destinationUrl "https://api.whatsapp.com/send".'
      : '';
    return (
      `Ad set memakai destination_type ${destinationType} tetapi creative ini tidak punya call_to_action sama sekali. ` +
      `Iklan click-to-message wajib punya CTA yang membuka inbox tujuannya — pakai salah satu dari: ${allowedCtaTypes.join(', ')}.${whatsappHint} ` +
      'Meta menerima create-nya lalu menolak asinkron dengan error_code 1487891 ("Materi Iklan Tidak Valid untuk Tujuan"), dan ad-nya berhenti di effective_status WITH_ISSUES tanpa pernah tayang. ' +
      'Buat ulang creative dengan CTA tersebut. Bila creative ini memang sudah benar, ulangi dengan skipMessagingDestinationCheck: true.'
    );
  }

  const ctaTypes = callToActions
    .map((callToAction) => readString(callToAction.type))
    .filter((type): type is string => type !== undefined);
  if (ctaTypes.length === 0 && callToActions.length > 0) {
    return (
      `Ad set memakai destination_type ${destinationType} tetapi creative punya call_to_action tanpa field type. ` +
      `CTA tanpa type tidak bisa divalidasi — perbaiki creative supaya CTA-nya punya type yang cocok: ${allowedCtaTypes.join(', ')}.`
    );
  }
  if (ctaTypes.length === 0) return undefined;

  const mismatched = ctaTypes.filter((type) => !allowedCtaTypes.includes(type));
  if (mismatched.length > 0) {
    return `Ad set memakai destination_type ${destinationType} tetapi creative memakai callToAction ${[...new Set(mismatched)].join(', ')}. CTA yang cocok: ${allowedCtaTypes.join(', ')}. Kombinasi ini diterima Meta saat create tetapi iklannya tayang dengan tombol yang membuka tujuan yang salah.`;
  }

  const allowedAppDestinations = MESSAGING_DESTINATION_APP_DESTINATIONS[destinationType];
  for (const callToAction of callToActions) {
    const appDestination = isRecord(callToAction.value)
      ? readString(callToAction.value.app_destination)
      : undefined;
    if (appDestination && !allowedAppDestinations.includes(appDestination)) {
      return `Ad set memakai destination_type ${destinationType} tetapi creative memakai call_to_action.value.app_destination ${appDestination}. Nilai yang cocok: ${allowedAppDestinations.join(', ')}.`;
    }
  }

  return undefined;
}

/**
 * Read the ad set's destination_type and the creative's call_to_action, then report a
 * mismatch. Read failures are non-fatal: this is a pre-flight, and Meta's own error
 * path stays the source of truth for anything it can catch.
 */
export async function getMessagingDestinationCompatibilityError(
  client: MetaClient,
  adSetId: string,
  creativeId: string,
  maxRetries: number
): Promise<string | undefined> {
  try {
    const [adSet, creative] = await Promise.all([
      client.metaGetObject<Record<string, unknown>>(
        `/${adSetId}`,
        { fields: 'destination_type' },
        maxRetries
      ),
      client.metaGetObject<Record<string, unknown>>(
        `/${creativeId}`,
        { fields: 'call_to_action,object_story_spec,asset_feed_spec' },
        maxRetries
      ),
    ]);

    return getMessagingDestinationMismatch(adSet, creative);
  } catch {
    return undefined;
  }
}
