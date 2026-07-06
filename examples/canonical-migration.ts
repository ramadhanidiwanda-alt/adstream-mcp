import 'dotenv/config';
import {
  createDefaultAdsBroker,
  handleAdsMcpToolCall,
  type AdsPerformanceEnvelope,
} from '../src/index.js';

async function main() {
  const broker = createDefaultAdsBroker();
  const today = new Date();
  const last7Days = new Date(today);
  last7Days.setDate(last7Days.getDate() - 7);

  const since = last7Days.toISOString().split('T')[0];
  const until = today.toISOString().split('T')[0];

  const response = await handleAdsMcpToolCall(broker, 'ads_get_performance', {
    provider: 'meta',
    accountId: process.env.META_AD_ACCOUNT_ID,
    since,
    until,
    level: 'campaign',
    metrics: ['spend', 'impressions', 'clicks', 'purchase_value', 'purchase_roas'],
    dimensions: ['campaign'],
    limit: 100,
  });

  const parsed = JSON.parse(response.content[0]?.text ?? '{}') as {
    ok: boolean;
    data?: AdsPerformanceEnvelope;
    errors?: unknown[];
  };

  if (!parsed.ok) {
    console.error(JSON.stringify(parsed.errors, null, 2));
    process.exit(1);
  }

  console.log('Canonical ads_get_performance envelope:');
  console.log(JSON.stringify({
    provider: parsed.data?.provider,
    dateRange: parsed.data?.dateRange,
    level: parsed.data?.level,
    metrics: parsed.data?.metrics,
    rows: parsed.data?.rows.length,
    warnings: parsed.data?.warnings,
    nextCursor: parsed.data?.paging.nextCursor,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
