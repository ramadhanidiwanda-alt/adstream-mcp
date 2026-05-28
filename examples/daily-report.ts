import 'dotenv/config';
import { MetaClient, loadConfig, generateDailyReport } from '../src/index.js';

async function main() {
  try {
    const config = loadConfig();
    const client = new MetaClient(config);

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const since = yesterday.toISOString().split('T')[0];
    const until = today.toISOString().split('T')[0];

    console.log(`Generating daily report for ${since} to ${until}...\n`);

    const report = await generateDailyReport(client, {
      adAccountId: config.adAccountId,
      since,
      until,
    });

    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error('Error generating daily report:', error);
    process.exit(1);
  }
}

main();
