/**
 * Live probe: does Meta accept an asset_feed_spec carrying MULTIPLE titles/bodies
 * on a NON-Dynamic-Creative ad, i.e. Ads Manager's "Add text options"?
 *
 * Why this exists. `ads_create_adcreative` rejects every asset_feed_spec text
 * variation as Dynamic Creative. A bug report claims that block is too broad.
 * Meta's own docs are ambiguous:
 *
 *   - Dynamic Creative: multiple titles/bodies, NO customization rules, and the
 *     ad set must carry is_dynamic_creative: true.
 *   - Asset Customization Rules: "All ads using asset_feed_spec must contain at
 *     least two target customization rules", and the ad set must be
 *     is_dynamic_creative: false.
 *
 * Neither describes a third path — yet `optimization_type` accepts REGULAR
 * alongside ASSET_CUSTOMIZATION / LANGUAGE / PLACEMENT, and a read-back example
 * in the docs shows `optimization_type: "REGULAR"`. If REGULAR is accepted with
 * no customization rules, the block is too broad and the report is right.
 *
 * This probe answers exactly that question and nothing else. It creates ad
 * CREATIVES only — never ads, never ad sets, never campaigns — so nothing can
 * deliver and nothing can spend. Creatives not attached to an ad are inert.
 *
 * Local-only (gitignored): needs real Meta credentials and writes to a live ad
 * account.
 *
 *   npx tsx --env-file=.env scripts/testLiveMultipleTextOptions.ts --account-id=act_... --image-hash=...
 *
 * Without --execute it prints the payloads and writes nothing.
 */
import { MetaClient, loadConfig } from '../src/index.js';

const EXECUTE = process.argv.includes('--execute');

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function section(title: string): void {
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);
}

interface Probe {
  name: string;
  question: string;
  assetFeedSpec: Record<string, unknown>;
}

async function main(): Promise<void> {
  const accountId = argValue('account-id');
  const imageHash = argValue('image-hash');
  const pageId = argValue('page-id');
  const instagramUserId = argValue('instagram-user-id');
  const link = argValue('link') ?? 'https://example.com/';

  if (!accountId || !imageHash || !pageId) {
    console.error(
      'Required: --account-id=act_... --image-hash=... --page-id=...\n' +
        'Optional: --instagram-user-id=... --link=... --execute'
    );
    process.exit(1);
  }

  const client = new MetaClient(loadConfig());

  const baseFeed = {
    images: [{ hash: imageHash }],
    bodies: [{ text: 'Varian caption A untuk tes text options' }, { text: 'Varian caption B untuk tes text options' }],
    titles: [{ text: 'Varian headline A' }, { text: 'Varian headline B' }],
    ad_formats: ['SINGLE_IMAGE'],
    call_to_action_types: ['SHOP_NOW'],
    link_urls: [{ website_url: link }],
  };

  const probes: Probe[] = [
    {
      name: 'A. REGULAR, no customization rules',
      question:
        'Is there a third path — plain multi-text on a standard ad? If this is accepted, the MCP block is too broad.',
      assetFeedSpec: { ...baseFeed, optimization_type: 'REGULAR' },
    },
    {
      name: 'B. no optimization_type, no customization rules',
      question:
        'Does Meta silently treat bare multi-text as Dynamic Creative, or reject it outright?',
      assetFeedSpec: { ...baseFeed },
    },
  ];

  const objectStorySpec: Record<string, unknown> = { page_id: pageId };
  if (instagramUserId) objectStorySpec.instagram_user_id = instagramUserId;

  for (const probe of probes) {
    section(probe.name);
    console.log(probe.question);
    console.log('\nasset_feed_spec:');
    console.log(JSON.stringify(probe.assetFeedSpec, null, 2));

    if (!EXECUTE) {
      console.log('\n(dry run — pass --execute to send this to Meta)');
      continue;
    }

    const payload = {
      name: `PROBE_MultiText_${probe.name.slice(0, 1)}_${Date.now()}`,
      object_story_spec: objectStorySpec,
      asset_feed_spec: probe.assetFeedSpec,
    };

    try {
      const created = await client.metaPost<{ id?: string }>(
        `/${accountId}/adcreatives`,
        payload,
        0
      );
      console.log(`\nACCEPTED — creative ${created.id}`);

      const readBack = await client.metaGetObject<Record<string, unknown>>(
        `/${created.id}`,
        { fields: 'id,name,asset_feed_spec,object_type' },
        0
      );
      console.log('read-back:');
      console.log(JSON.stringify(readBack, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`\nREJECTED — ${message}`);
    }
  }

  section('Interpretation');
  console.log(
    'A accepted  -> optimization_type REGULAR is a real non-DCO path; loosen the MCP block for it.\n' +
      'A rejected, B accepted -> bare multi-text is silently Dynamic Creative; the block is correct.\n' +
      'Both rejected -> multi-text genuinely requires a DCO ad set; the block is correct and the report is wrong.\n' +
      '\nNOTE: acceptance at /adcreatives is necessary but NOT sufficient. A creative that is\n' +
      'accepted here can still be refused when attached to an ad in a non-DCO ad set. Confirm\n' +
      'the winning shape against a PAUSED ad set before changing any tool behaviour.'
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
