/**
 * Live verification for existing_post ad creatives built from an Instagram-only post.
 *
 * Asserts the payload shape Meta actually accepts: source_instagram_media_id plus
 * url_tags and nothing else. A custom destination is not available on a boosted post —
 * object_story_spec alongside it is (#100) subcode 1487929, and an explicit
 * call_to_action_type is (#3) capability.
 *
 * Deliberately drives the BROKER surface (handleAdsMcpToolCall), not the tool
 * functions directly. PR #105 shipped source_instagram_media_id with a live test
 * that called src/tools/* straight — it passed while the field stayed unreachable
 * through the adapter, because parseMetaCreativeSpec never read it. A live test
 * that skips the adapter cannot catch adapter bugs.
 *
 *   npm run test:live-existing-post-creative              # dry-run only, no writes
 *   npm run test:live-existing-post-creative -- --execute # creates + deletes for real
 */
import { MetaClient, loadConfig } from '../src/index.js';
import { listInstagramAccounts } from '../src/tools/listInstagramAccounts.js';
import { handleAdsMcpToolCall } from '../src/broker/mcpTools.js';
import { createAdsBrokerFromConfig } from '../src/broker/factory.js';
import { parseBrokerConfigFromEnv } from '../src/broker/config.js';

const EXECUTE = process.argv.includes('--execute');
const URL_TAGS = 'gcn={{campaign.name}}&utm_source=ig&utm_medium=paid';

function section(title: string): void {
  console.log(`\n${'='.repeat(70)}\n${title}\n${'='.repeat(70)}`);
}

/**
 * MetaClient has no delete verb; this script needs one only to clean up after itself.
 * Token goes in the Authorization header, never the URL — a rejected fetch puts the
 * URL in its error message, and that message ends up in logs.
 */
async function deleteCreative(creativeId: string): Promise<void> {
  const config = loadConfig();
  const response = await fetch(
    `https://graph.facebook.com/${config.apiVersion}/${creativeId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${config.accessToken}` } }
  );
  const body = await response.json();
  if (!response.ok) throw new Error(`DELETE gagal: ${JSON.stringify(body)}`);
  console.log('  delete response:', JSON.stringify(body));
}

async function main(): Promise<void> {
  const adAccountId = process.env.META_LIVE_CREATIVE_AD_ACCOUNT_ID;
  const igUsername = process.env.META_LIVE_CREATIVE_IG_USERNAME;
  if (!adAccountId || !igUsername) {
    throw new Error(
      'Set META_LIVE_CREATIVE_AD_ACCOUNT_ID and META_LIVE_CREATIVE_IG_USERNAME before running.'
    );
  }

  const client = new MetaClient(loadConfig());

  section('1. Resolve an Instagram-only post');
  const igAccounts = await listInstagramAccounts(client, { limit: 50 });
  const igAccount = igAccounts.find((account) => account.username === igUsername);
  if (!igAccount) throw new Error(`IG account @${igUsername} tidak ditemukan.`);

  const media = await client.metaGet<{ data?: Record<string, unknown>[] }>(
    `/${igAccount.igId}/media`,
    { fields: 'id,media_type,permalink', limit: 1 }
  );
  const post = media.data?.[0];
  if (!post) throw new Error(`@${igUsername} tidak punya media.`);

  console.log(`  ig      : ${igAccount.igId} (@${igAccount.username})`);
  console.log(`  page    : ${igAccount.pageId} (${igAccount.pageName})`);
  console.log(`  media   : ${post.id} (${post.media_type})`);
  console.log(`  permalink: ${post.permalink}`);

  const broker = createAdsBrokerFromConfig(parseBrokerConfigFromEnv());
  const baseArgs = {
    accountId: adAccountId,
    name: `LIVE VERIFY existing_post ${Date.now()}`,
    pageId: igAccount.pageId,
    urlTags: URL_TAGS,
    creativeFormat: 'existing_post',
    creativeSpec: { sourceInstagramMediaId: String(post.id) },
  };

  section('2. Dry-run through the broker (no writes)');
  const dryRun = await handleAdsMcpToolCall(broker, 'ads_create_adcreative', {
    ...baseArgs,
    dryRun: true,
  });
  console.log(JSON.stringify(JSON.parse(dryRun.content[0].text as string), null, 2));

  if (!EXECUTE) {
    section('Selesai (dry-run). Jalankan dengan --execute untuk verifikasi ke Meta.');
    return;
  }

  section('3. Create for real');
  const created = await handleAdsMcpToolCall(broker, 'ads_create_adcreative', {
    ...baseArgs,
    dryRun: false,
    confirmed: true,
  });
  const createdPayload = JSON.parse(created.content[0].text as string);
  console.log(JSON.stringify(createdPayload, null, 2));

  const creativeId: string | undefined = createdPayload?.data?.id;
  if (!creativeId) throw new Error('Meta tidak mengembalikan creative id — lihat error di atas.');

  try {
    section('4. Read back what Meta actually stored');
    const readBack = await client.metaGetObject<Record<string, unknown>>(`/${creativeId}`, {
      fields:
        'id,name,source_instagram_media_id,instagram_user_id,object_story_spec,call_to_action_type,url_tags',
    });
    console.log(JSON.stringify(readBack, null, 2));

    const checks: [string, boolean][] = [
      ['source_instagram_media_id tersimpan', readBack.source_instagram_media_id === post.id],
      ['instagram_user_id diisi Meta', readBack.instagram_user_id === igAccount.igId],
      ['url_tags tersimpan (UTM tetap jalan)', readBack.url_tags === URL_TAGS],
      ['object_story_spec TIDAK ikut terkirim', readBack.object_story_spec === undefined],
    ];
    section('5. Verdict');
    for (const [label, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
    if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
  } finally {
    section('6. Cleanup');
    console.log(`  deleting ${creativeId} ...`);
    await deleteCreative(creativeId);
  }
}

main().catch((error) => {
  console.error('\nFAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
