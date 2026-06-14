import 'dotenv/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMetaAdsMcpServer } from '../mcp-server/src/createServer.js';

function redact(value: string): string {
  return value.replace(/EA[A-Za-z0-9_-]+/g, '[REDACTED]').replace(/act_\d+/g, 'act_[REDACTED]');
}

function summarizeRows(rows: unknown[]) {
  return rows.slice(0, 10).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      campaign_id: record.campaign_id,
      campaign_name: record.campaign_name,
      country: record.country,
      region: record.region,
      dma: record.dma,
      spend: record.spend,
      impressions: record.impressions,
      clicks: record.clicks,
    };
  });
}

async function main() {
  if (!process.env.META_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN === 'EAA...') {
    console.log(JSON.stringify({ ok: false, error: 'Fill META_ACCESS_TOKEN in .env first.' }, null, 2));
    return;
  }

  if (!process.env.META_AD_ACCOUNT_ID || process.env.META_AD_ACCOUNT_ID === 'act_') {
    console.log(JSON.stringify({ ok: false, error: 'Fill META_AD_ACCOUNT_ID in .env first.' }, null, 2));
    return;
  }

  const since = process.env.META_TEST_SINCE ?? '2026-06-07';
  const until = process.env.META_TEST_UNTIL ?? '2026-06-14';
  const level = process.env.META_TEST_LEVEL ?? 'campaign';
  const breakdownRaw = process.env.META_TEST_BREAKDOWN ?? 'country';
  const breakdowns = breakdownRaw.split(',').map((b) => b.trim()).filter(Boolean);

  const server = createMetaAdsMcpServer();
  const client = new Client({ name: 'local-meta-breakdown-test', version: '1.0.0' }, { capabilities: {} });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  try {
    const response = await client.callTool({
      name: 'meta_get_location_insights',
      arguments: {
        adAccountId: process.env.META_AD_ACCOUNT_ID,
        since,
        until,
        level,
        breakdowns,
        limit: 10,
      },
    });

    const text = response.content?.[0]?.text ?? '';
    if (response.isError || !text.trim().startsWith('{')) {
      console.log(redact(JSON.stringify({ ok: false, error: text }, null, 2)));
      return;
    }

    const summary = JSON.parse(text) as { top_locations?: unknown[] };
    console.log(JSON.stringify({ ok: true, summary, sample: summarizeRows(summary.top_locations ?? []) }, null, 2));
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
}

main().catch((error) => {
  console.error(redact(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
