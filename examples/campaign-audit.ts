import 'dotenv/config';
import { MetaClient, loadConfig, getCampaigns, getCampaignInsights, analyzeCampaignPerformance, recommendActions } from '../src/index.js';

async function main() {
  try {
    const config = loadConfig();
    const client = new MetaClient(config);

    console.log('Fetching campaigns...\n');
    const campaigns = await getCampaigns(client, {
      adAccountId: config.adAccountId,
      limit: 50,
    });

    console.log(`Found ${campaigns.length} campaigns\n`);

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const since = last7Days.toISOString().split('T')[0];
    const until = new Date().toISOString().split('T')[0];

    console.log(`Fetching insights from ${since} to ${until}...\n`);
    const insights = await getCampaignInsights(client, {
      adAccountId: config.adAccountId,
      since,
      until,
    });

    console.log(`Analyzing ${insights.length} campaign insights...\n`);
    const analyses = analyzeCampaignPerformance(insights);
    const actions = recommendActions(analyses);

    console.log('=== Campaign Audit Report ===\n');
    console.log(JSON.stringify({ campaigns, analyses, actions }, null, 2));
  } catch (error) {
    console.error('Error running campaign audit:', error);
    process.exit(1);
  }
}

main();
