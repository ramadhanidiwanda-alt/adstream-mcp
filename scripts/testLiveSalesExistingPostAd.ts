/**
 * Live verification that Meta accepts an existing_post creative under the SALES
 * objective — the one claim our unit tests cannot prove.
 *
 * The launch matrix used to reject existing_post for OUTCOME_SALES client-side.
 * Removing that block is only correct if Meta itself allows the combination, and
 * the decisive moment is NOT the creative create: POST /adcreatives is
 * objective-agnostic and happily stores a boosted post regardless. Meta only
 * gets to weigh objective against creative when the AD binds the creative to an
 * ad set whose campaign carries the objective. So this script builds the whole
 * chain and treats the ad create as the verdict.
 *
 * Drives the BROKER surface (handleAdsMcpToolCall), not the tool functions —
 * same reasoning as testLiveExistingPostCreative.ts: PR #105 shipped a live test
 * that called src/tools/* directly and passed while the field stayed unreachable
 * through the adapter.
 *
 * Everything is created PAUSED, so nothing can deliver and nothing can spend,
 * and every object is deleted again in reverse order on the way out.
 *
 * Local-only: needs real Meta credentials and writes to a live ad account.
 *
 *   npx tsx --env-file=.env scripts/testLiveSalesExistingPostAd.ts
 *   npx tsx --env-file=.env scripts/testLiveSalesExistingPostAd.ts --execute
 *
 * Without --execute it stops after the dry-runs and writes nothing.
 */
import { MetaClient, loadConfig } from '../src/index.js';
import { handleAdsMcpToolCall } from '../src/broker/mcpTools.js';
import { createAdsBrokerFromConfig } from '../src/broker/factory.js';
import { parseBrokerConfigFromEnv } from '../src/broker/config.js';

const EXECUTE = process.argv.includes('--execute');

/** Supplied by the account owner; see the conversation that introduced this script. */
const ACCOUNT_ID = argValue('account-id') ?? 'act_2326988574277142';
const PAGE_ID = argValue('page-id') ?? '100338525395228';
const PIXEL_ID = argValue('pixel-id') ?? '210003073678732';
/**
 * Any photo, video, carousel or reel post works, matching Meta's documented
 * range for using posts as ads. Pass --ig-media-id to try another; both a photo
 * (18111117658948536) and a Reel (18108738530070830) are verified against v25.0.
 */
const IG_MEDIA_ID = argValue('ig-media-id') ?? '18111117658948536';
/**
 * Mandatory in practice, and the whole reason IG video looked unusable. Meta
 * rejects a REELS/video source_instagram_media_id with (#100) subcode 1815279,
 * whose message insists the video "must be uploaded to Facebook" — it must not.
 * The real problem is that Meta cannot tell which IG account owns the media, and
 * naming instagram_user_id makes the identical create succeed. IMAGE media is
 * inferred, which is why photo posts worked without it and hid the gap.
 */
const IG_USER_ID = argValue('ig-user-id') ?? '17841421517309865';

const LANDING_PAGE = 'https://pnpbeautyindonesia.com/';
const CTA = 'SHOP_NOW';
/** IDR has no minor unit, so this is Rp 50.000 — irrelevant while PAUSED. */
const DAILY_BUDGET = 50000;
const STAMP = Date.now();

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function section(title: string): void {
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);
}

/**
 * The broker nests the tool result under `data`; `status`, `preview` and the new
 * object's `id` all live there, not at the top level.
 */
interface BrokerPayload {
  ok?: boolean;
  error?: string;
  data?: {
    id?: string;
    status?: string;
    error?: string;
    structuredError?: unknown;
    preview?: Record<string, unknown>;
  };
}

type AdsMcpToolName = Parameters<typeof handleAdsMcpToolCall>[1];

async function call(
  broker: ReturnType<typeof createAdsBrokerFromConfig>,
  tool: AdsMcpToolName,
  args: Record<string, unknown>,
  live: boolean
): Promise<BrokerPayload> {
  const response = await handleAdsMcpToolCall(broker, tool, {
    ...args,
    ...(live ? { dryRun: false, confirmed: true } : { dryRun: true }),
  });
  return JSON.parse(response.content[0].text as string) as BrokerPayload;
}

/** MetaClient has no delete verb; the token goes in the header, never the URL. */
async function deleteObject(id: string, label: string): Promise<void> {
  const config = loadConfig();
  try {
    const response = await fetch(`https://graph.facebook.com/${config.apiVersion}/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    const body = (await response.json()) as unknown;
    console.log(
      `  ${response.ok ? 'deleted' : 'DELETE FAILED'} ${label} ${id}: ${JSON.stringify(body)}`
    );
  } catch (error) {
    console.log(
      `  DELETE THREW for ${label} ${id}: ${error instanceof Error ? error.message : error}`
    );
  }
}

function idOf(payload: BrokerPayload): string | undefined {
  return payload.data?.id;
}

function report(label: string, payload: BrokerPayload): void {
  console.log(
    `\n  ${label}: ok=${payload.ok} status=${payload.data?.status ?? '(none)'} id=${idOf(payload) ?? '(none)'}`
  );
  const error = payload.error ?? payload.data?.error;
  if (error) console.log(`    error: ${error}`);
  if (payload.data?.structuredError) {
    console.log(`    structuredError: ${JSON.stringify(payload.data.structuredError)}`);
  }
  if (payload.data?.preview) {
    console.log(`    preview: ${JSON.stringify(payload.data.preview)}`);
  }
}

async function main(): Promise<void> {
  const broker = createAdsBrokerFromConfig(parseBrokerConfigFromEnv());
  const client = new MetaClient(loadConfig());

  const campaignArgs = {
    accountId: ACCOUNT_ID,
    name: `LIVE VERIFY sales+existing_post campaign ${STAMP}`,
    objective: 'OUTCOME_SALES',
    status: 'PAUSED',
    specialAdCategories: [],
  };
  const adSetArgs = (campaignId: string) => ({
    accountId: ACCOUNT_ID,
    campaignId,
    name: `LIVE VERIFY sales+existing_post adset ${STAMP}`,
    status: 'PAUSED',
    dailyBudget: DAILY_BUDGET,
    // Whether bidAmount is required follows from the bid strategy in effect, not
    // from ABO vs CBO: per Meta's bid-strategy docs, COST_CAP and
    // LOWEST_COST_WITH_BID_CAP require bid_amount, while LOWEST_COST_WITHOUT_CAP
    // must not carry one and LOWEST_COST_WITH_MIN_ROAS uses
    // bid_constraints.roas_average_floor instead. Naming the uncapped strategy is
    // what makes bidAmount unnecessary here.
    //
    // It is set on the ad set rather than the campaign because bid_strategy is an
    // ad-set field that may also be set campaign-wide, and the campaign-level form
    // needs a campaign budget — this campaign has none, so Meta rejects it with
    // (#100) subcode 1885737. Omitting the strategy on both levels left an implicit
    // capped strategy in force and produced (#100) subcode 2490487; the campaigns
    // read back with no bid_strategy at all, so where that default came from is
    // unresolved.
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
    conversionLocation: 'WEBSITE',
    // The point of the exercise: the ad set validates this format too, because
    // createAdSet resolves the launch spec from the campaign's objective.
    creativeFormat: 'existing_post',
    pixelId: PIXEL_ID,
    pageId: PAGE_ID,
    // geoLocations is a top-level broker param. Passing `targeting` instead makes
    // the adapter treat it as a raw Meta override and forward it verbatim, so the
    // camelCase never becomes geo_locations and Meta rejects the ad set with
    // (#100) subcode 1885364 "Lokasi tidak ada".
    geoLocations: { countries: ['ID'] },
  });
  const creativeArgs = {
    accountId: ACCOUNT_ID,
    name: `LIVE VERIFY sales+existing_post creative ${STAMP}`,
    pageId: PAGE_ID,
    instagramUserId: IG_USER_ID,
    objective: 'OUTCOME_SALES',
    conversionLocation: 'WEBSITE',
    creativeFormat: 'existing_post',
    creativeSpec: {
      sourceInstagramMediaId: IG_MEDIA_ID,
      destinationUrl: LANDING_PAGE,
      callToAction: CTA,
    },
  };

  section('1. Dry-run the whole chain (writes nothing)');
  const dryCampaign = await call(broker, 'ads_create_campaign', campaignArgs, false);
  report('campaign', dryCampaign);
  const dryAdSet = await call(broker, 'ads_create_adset', adSetArgs('<campaign-id>'), false);
  report('adset', dryAdSet);
  const dryCreative = await call(broker, 'ads_create_adcreative', creativeArgs, false);
  report('creative', dryCreative);

  if (!EXECUTE) {
    section('Stopped after dry-run. Re-run with --execute to ask Meta for real.');
    return;
  }

  const created: { id: string; label: string }[] = [];
  try {
    section('2. Create for real (all PAUSED)');
    const campaign = await call(broker, 'ads_create_campaign', campaignArgs, true);
    report('campaign', campaign);
    const campaignId = idOf(campaign);
    if (!campaignId) throw new Error('campaign create returned no id');
    created.unshift({ id: campaignId, label: 'campaign' });

    const adSet = await call(broker, 'ads_create_adset', adSetArgs(campaignId), true);
    report('adset', adSet);
    const adSetId = idOf(adSet);
    if (!adSetId) throw new Error('adset create returned no id');
    created.unshift({ id: adSetId, label: 'adset' });

    const creative = await call(broker, 'ads_create_adcreative', creativeArgs, true);
    report('creative', creative);
    const creativeId = idOf(creative);
    if (!creativeId) throw new Error('adcreative create returned no id');
    created.unshift({ id: creativeId, label: 'creative' });

    section('3. THE VERDICT: bind the boosted post to the Sales ad set');
    const ad = await call(
      broker,
      'ads_create_ad',
      {
        accountId: ACCOUNT_ID,
        name: `LIVE VERIFY sales+existing_post ad ${STAMP}`,
        adSetId,
        creativeId,
        status: 'PAUSED',
      },
      true
    );
    report('ad', ad);
    const adId = idOf(ad);
    if (adId) created.unshift({ id: adId, label: 'ad' });

    if (!adId) {
      console.log(
        '\n  RESULT: Meta REJECTED the ad. existing_post is NOT usable under OUTCOME_SALES.'
      );
      process.exitCode = 1;
      return;
    }

    section('4. Read back what Meta actually stored');
    const readBack = await client.metaGetObject<Record<string, unknown>>(`/${adId}`, {
      fields:
        'id,name,effective_status,campaign{id,objective},adset{id,destination_type,optimization_goal,promoted_object},creative{id,object_type,object_story_id,source_instagram_media_id,call_to_action}',
    });
    console.log(JSON.stringify(readBack, null, 2));

    const campaignRead = readBack.campaign as Record<string, unknown> | undefined;
    const adSetRead = readBack.adset as Record<string, unknown> | undefined;
    const creativeRead = readBack.creative as Record<string, unknown> | undefined;
    const ctaRead = creativeRead?.call_to_action as Record<string, unknown> | undefined;
    const promoted = adSetRead?.promoted_object as Record<string, unknown> | undefined;

    const checks: [string, boolean][] = [
      ['ad exists under OUTCOME_SALES', campaignRead?.objective === 'OUTCOME_SALES'],
      [
        'ad set optimizes OFFSITE_CONVERSIONS',
        adSetRead?.optimization_goal === 'OFFSITE_CONVERSIONS',
      ],
      ['promoted_object carries the pixel', promoted?.pixel_id === PIXEL_ID],
      ['promoted_object custom_event_type = PURCHASE', promoted?.custom_event_type === 'PURCHASE'],
      ['creative is the boosted IG post', creativeRead?.source_instagram_media_id === IG_MEDIA_ID],
      [
        'call_to_action.value.link = landing page',
        (ctaRead?.value as Record<string, unknown> | undefined)?.link === LANDING_PAGE,
      ],
      ['ad is PAUSED (never delivered)', readBack.effective_status !== 'ACTIVE'],
    ];

    section('5. Verdict');
    for (const [label, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
    if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
  } finally {
    section('6. Cleanup (reverse creation order)');
    for (const { id, label } of created) await deleteObject(id, label);
  }
}

main().catch((error) => {
  console.error('\nFAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
