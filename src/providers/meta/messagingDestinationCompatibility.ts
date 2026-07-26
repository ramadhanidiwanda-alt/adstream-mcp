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
 * built formats, and as asset_feed_spec.call_to_action_types for asset-feed creatives.
 * Collect from all of them so the check is not fooled by format.
 */
function collectCallToActions(creative: Record<string, unknown>): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];

  if (isRecord(creative.call_to_action)) found.push(creative.call_to_action);

  const storySpec = isRecord(creative.object_story_spec) ? creative.object_story_spec : undefined;
  for (const key of ['link_data', 'video_data', 'photo_data']) {
    const data = storySpec && isRecord(storySpec[key]) ? storySpec[key] : undefined;
    if (data && isRecord(data.call_to_action)) found.push(data.call_to_action);
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
 * A creative with no discoverable CTA gets no opinion rather than an error: the read
 * may simply not have surfaced it, and a false block here would be worse than the
 * mismatch this exists to catch.
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
  const ctaTypes = callToActions
    .map((callToAction) => readString(callToAction.type))
    .filter((type): type is string => type !== undefined);
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
