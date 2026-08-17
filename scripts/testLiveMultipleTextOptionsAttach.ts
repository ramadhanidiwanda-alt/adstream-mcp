/**
 * Live probe stage 2: can a multi-text asset_feed_spec creative actually be
 * ATTACHED to an ad in a NON-Dynamic-Creative ad set?
 *
 * Stage 1 (testLiveMultipleTextOptions.ts) proved Meta ACCEPTS such a creative at
 * /adcreatives, and that Meta stamps optimization_type: REGULAR on it even when the
 * caller sends no optimization_type at all. That is necessary but not sufficient:
 * Meta routinely accepts creatives it later refuses to attach. This stage closes
 * that gap, which is the only thing that justifies changing tool behaviour.
 *
 * Everything it creates is PAUSED at every level — campaign, ad set, and ad — so
 * nothing can deliver and nothing can spend. The ad set carries
 * is_dynamic_creative: false, which is the whole point of the test.
 *
 * Local-only (gitignored): needs real Meta credentials and writes to a live ad
 * account.
 *
 *   npx tsx --env-file=.env scripts/testLiveMultipleTextOptionsAttach.ts \
 *     --account-id=act_... --creative-id=... [--execute]
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

async function main(): Promise<void> {
  const accountId = argValue('account-id');
  const creativeId = argValue('creative-id');

  if (!accountId || !creativeId) {
    console.error('Required: --account-id=act_... --creative-id=...   Optional: --execute');
    process.exit(1);
  }

  const client = new MetaClient(loadConfig());
  const stamp = Date.now();

  const campaignPayload = {
    name: `PROBE_MultiText_Campaign_${stamp}`,
    objective: 'OUTCOME_TRAFFIC',
    status: 'PAUSED',
    special_ad_categories: JSON.stringify([]),
    // ABO without a campaign budget: Meta rejects the create with (#100)
    // subcode 4834011 unless this is stated explicitly. The MCP exposes it as
    // isAdSetBudgetSharingEnabled; this raw probe has to set it itself.
    is_adset_budget_sharing_enabled: false,
  };

  section('Step 1 — PAUSED campaign');
  console.log(JSON.stringify(campaignPayload, null, 2));
  if (!EXECUTE) {
    console.log('\n(dry run — pass --execute to write)');
    return;
  }

  const campaign = await client.metaPost<{ id?: string }>(
    `/${accountId}/campaigns`,
    campaignPayload,
    0
  );
  console.log(`campaign ${campaign.id}`);

  section('Step 2 — PAUSED ad set, is_dynamic_creative: false');
  const adSetPayload = {
    name: `PROBE_MultiText_AdSet_${stamp}`,
    campaign_id: campaign.id,
    status: 'PAUSED',
    is_dynamic_creative: false,
    optimization_goal: 'LINK_CLICKS',
    billing_event: 'IMPRESSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    daily_budget: 20000,
    targeting: JSON.stringify({
      geo_locations: { countries: ['ID'] },
      targeting_automation: { advantage_audience: 0 },
    }),
  };
  console.log(JSON.stringify(adSetPayload, null, 2));
  const adSet = await client.metaPost<{ id?: string }>(`/${accountId}/adsets`, adSetPayload, 0);
  console.log(`ad set ${adSet.id}`);

  section('Step 3 — PAUSED ad using the multi-text creative');
  const adPayload = {
    name: `PROBE_MultiText_Ad_${stamp}`,
    adset_id: adSet.id,
    status: 'PAUSED',
    creative: JSON.stringify({ creative_id: creativeId }),
  };
  console.log(JSON.stringify(adPayload, null, 2));

  try {
    const ad = await client.metaPost<{ id?: string }>(`/${accountId}/ads`, adPayload, 0);
    console.log(`\nATTACH ACCEPTED — ad ${ad.id}`);

    const readBack = await client.metaGetObject<Record<string, unknown>>(
      `/${ad.id}`,
      { fields: 'id,name,status,effective_status,creative{id,asset_feed_spec}' },
      0
    );
    console.log('read-back:');
    console.log(JSON.stringify(readBack, null, 2));
    console.log(
      '\nCONCLUSIVE: multi-text asset_feed_spec works on a non-DCO ad set. The MCP block is too broad.'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`\nATTACH REJECTED — ${message}`);
    console.log(
      '\nCONCLUSIVE the other way: the creative is only accepted in isolation, not attachable\n' +
        'to a standard ad set. The MCP block is correct and the bug report should be closed.'
    );
  }

  section('Cleanup handles');
  console.log(`campaign_id=${campaign.id}  adset_id=${adSet.id}`);
  console.log('All objects are PAUSED. Delete the campaign to remove the whole tree.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
