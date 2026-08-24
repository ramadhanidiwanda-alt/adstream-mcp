/**
 * Live verification for the click-to-message guard and the status read-back
 * fields — READ ONLY.
 *
 * Unit tests cannot prove that Meta accepts a field shape, and two of the fixes
 * in this area added new Graph reads. This script exercises exactly those reads
 * against live objects and writes NOTHING: no POST, no mutation, no object
 * created or deleted. Every call here is a GET.
 *
 * What it proves:
 *
 *  1. `getMessagingDestinationCompatibilityError` — the pre-flight `ads_create_ad`
 *     runs — blocks a real creative that carries no call_to_action against a real
 *     ad set whose `destination_type` is a messaging inbox, and stays silent for a
 *     creative that does carry the right CTA.
 *  2. `fields=status,effective_status,issues_info` is accepted by Graph API on all
 *     three levels (ad, ad set, campaign), because pause/resume share one read-back.
 *  3. The parent field expansions are accepted and come back in the shape the
 *     read-back parser expects.
 *
 * Field strings below must stay identical to the ones in
 * src/providers/meta/statusMutationReadBack.ts.
 *
 * Local-only: needs real Meta credentials and real object ids. No defaults — the
 * ids name live objects in someone's ad account, which is not something to keep in
 * version control. Discover them with ads_list_campaigns, ads_read_adset_full and
 * ads_get_ad_destinations.
 *
 *   MESSAGING_ADSET_ID=...          ad set whose destination_type is WHATSAPP,
 *                                   MESSENGER, INSTAGRAM_DIRECT or MESSAGING_*
 *   CREATIVE_WITHOUT_CTA_ID=...     creative carrying no call_to_action
 *   CREATIVE_WITH_CTA_ID=...        creative whose CTA matches that inbox
 *   AD_ID=...                       any ad under that ad set
 *   CAMPAIGN_ID=...                 that ad set's campaign
 *
 *   npx tsx --env-file=.env scripts/verifyLiveReadPaths.ts
 */
import { MetaClient, loadConfig } from '../src/index.js';
import { getMessagingDestinationCompatibilityError } from '../src/providers/meta/messagingDestinationCompatibility.js';

/** Mirrors readStatusFields() in statusMutationReadBack.ts. */
const STATUS_FIELDS = 'status,effective_status,issues_info';
/** Mirrors PARENT_FIELDS in statusMutationReadBack.ts. */
const AD_PARENT_FIELDS = 'adset{id,name,status},campaign{id,name,status}';
const ADSET_PARENT_FIELDS = 'campaign{id,name,status}';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is required. See the header of this file for what each id means.`);
    process.exit(1);
  }
  return value;
}

function redact(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .replace(/EA[A-Za-z0-9_-]{20,}/g, '[REDACTED]')
    .replace(/"access_token":\s*"[^"]*"/g, '"access_token": "[REDACTED]"');
}

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

function record(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      ${detail}\n`);
}

async function readOrError(
  client: MetaClient,
  path: string,
  fields: string
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const data = await client.metaGetObject<Record<string, unknown>>(path, { fields }, 3);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main(): Promise<void> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token || token.startsWith('EAA...')) {
    console.error('META_ACCESS_TOKEN is not set. Run with --env-file=.env');
    process.exit(1);
  }

  const ids = {
    adSetId: required('MESSAGING_ADSET_ID'),
    campaignId: required('CAMPAIGN_ID'),
    adId: required('AD_ID'),
    creativeWithoutCta: required('CREATIVE_WITHOUT_CTA_ID'),
    creativeWithCta: required('CREATIVE_WITH_CTA_ID'),
  };

  const client = new MetaClient(loadConfig());
  console.log(`Graph API ${client.apiVersion} — READ ONLY, not a single POST.\n`);

  // ── 1. The messaging pre-flight, on real creatives ───────────────────────────
  const blockedError = await getMessagingDestinationCompatibilityError(
    client,
    ids.adSetId,
    ids.creativeWithoutCta,
    3
  );
  record(
    'a creative with no call_to_action is blocked on a messaging ad set',
    typeof blockedError === 'string' && blockedError.includes('call_to_action'),
    blockedError ?? 'no error returned — the guard stayed silent, which is the failure'
  );

  const allowedError = await getMessagingDestinationCompatibilityError(
    client,
    ids.adSetId,
    ids.creativeWithCta,
    3
  );
  record(
    'a creative with the matching CTA still passes (no false positive)',
    allowedError === undefined,
    allowedError ?? 'guard stayed silent, as expected'
  );

  // ── 2. issues_info across all three levels ───────────────────────────────────
  for (const [label, id] of [
    ['ad', ids.adId],
    ['ad set', ids.adSetId],
    ['campaign', ids.campaignId],
  ] as const) {
    const result = await readOrError(client, `/${id}`, STATUS_FIELDS);
    record(
      `Graph accepts "${STATUS_FIELDS}" on ${label}`,
      result.ok,
      result.ok ? redact(result.data) : result.error
    );
  }

  // ── 3. Parent field expansion ────────────────────────────────────────────────
  const adParents = await readOrError(client, `/${ids.adId}`, AD_PARENT_FIELDS);
  record(
    `Graph accepts "${AD_PARENT_FIELDS}" on an ad`,
    adParents.ok &&
      typeof adParents.data.adset === 'object' &&
      typeof adParents.data.campaign === 'object',
    adParents.ok ? redact(adParents.data) : adParents.error
  );

  const adSetParents = await readOrError(client, `/${ids.adSetId}`, ADSET_PARENT_FIELDS);
  record(
    `Graph accepts "${ADSET_PARENT_FIELDS}" on an ad set`,
    adSetParents.ok && typeof adSetParents.data.campaign === 'object',
    adSetParents.ok ? redact(adSetParents.data) : adSetParents.error
  );

  const failed = checks.filter((check) => !check.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
  if (failed.length > 0) {
    console.log(`Failed: ${failed.map((check) => check.name).join('; ')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
