import { RuleEngine } from '../src/rules/engine.js';
import type { CampaignInsight } from '../src/types.js';
import type { Rule } from '../src/rules/types.js';

// Sample campaign insights
const insights: CampaignInsight[] = [
  {
    campaign_id: '123',
    campaign_name: 'Summer Sale Campaign',
    spend: '150000',
    impressions: '500000',
    reach: '400000',
    clicks: '2500',
    inline_link_clicks: '2000',
    ctr: '0.5',
    cpc: '60',
    cpm: '300',
  },
  {
    campaign_id: '456',
    campaign_name: 'Product Launch Campaign',
    spend: '80000',
    impressions: '300000',
    reach: '250000',
    clicks: '6000',
    inline_link_clicks: '5500',
    ctr: '2.0',
    cpc: '13.33',
    cpm: '266.67',
  },
  {
    campaign_id: '789',
    campaign_name: 'Brand Awareness Campaign',
    spend: '50000',
    impressions: '1000000',
    reach: '800000',
    clicks: '5000',
    inline_link_clicks: '4500',
    ctr: '0.5',
    cpc: '10',
    cpm: '50',
  },
];

// Define custom rules
const customRules: Rule[] = [
  {
    id: 'rule-1',
    name: 'High Spend Low CTR',
    description: 'Campaigns with high spend but low CTR need creative refresh',
    conditions: [
      { metric: 'spend', operator: '>', value: 100000 },
      { metric: 'ctr', operator: '<', value: 1.0 },
    ],
    logic: 'AND',
    action: 'Test new ad creatives or adjust targeting',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'rule-2',
    name: 'Good Performance',
    description: 'Campaigns performing well with good CTR and reasonable CPC',
    conditions: [
      { metric: 'ctr', operator: '>=', value: 1.5 },
      { metric: 'cpc', operator: '<', value: 20 },
    ],
    logic: 'AND',
    action: 'Consider scaling budget by 20%',
    priority: 'medium',
    enabled: true,
  },
  {
    id: 'rule-3',
    name: 'Expensive Clicks',
    description: 'CPC is too high, needs optimization',
    conditions: [{ metric: 'cpc', operator: '>', value: 50 }],
    logic: 'AND',
    action: 'Review targeting and bid strategy',
    priority: 'high',
    enabled: true,
  },
  {
    id: 'rule-4',
    name: 'Low CPM Opportunity',
    description: 'Very low CPM indicates good reach efficiency',
    conditions: [{ metric: 'cpm', operator: '<', value: 100 }],
    logic: 'AND',
    action: 'Good reach efficiency, maintain current strategy',
    priority: 'low',
    enabled: true,
  },
];

// Run rule engine
const engine = new RuleEngine();
const results = engine.applyRulesToInsights(insights, customRules);

// Display results
console.log('=== Rule Engine Demo ===\n');

results.forEach((result, index) => {
  console.log(`\n📊 Campaign ${index + 1}: ${result.campaignName}`);
  console.log(`   ID: ${result.campaignId}`);
  console.log(`   Status: ${result.overallStatus.toUpperCase()}`);

  if (result.triggeredRules.length > 0) {
    console.log(`\n   🚨 Triggered Rules (${result.triggeredRules.length}):`);
    result.triggeredRules.forEach((ruleResult) => {
      console.log(`\n   • ${ruleResult.rule.name} [${ruleResult.rule.priority.toUpperCase()}]`);
      console.log(`     ${ruleResult.rule.description}`);
      console.log(`     Matched conditions:`);
      ruleResult.matchedConditions
        .filter((mc) => mc.matched)
        .forEach((mc) => {
          console.log(`       - ${mc.description}`);
        });
    });

    console.log(`\n   💡 Recommended Actions:`);
    result.recommendedActions.forEach((action) => {
      console.log(`      ${action}`);
    });
  } else {
    console.log(`   ✅ No issues detected - campaign performing normally`);
  }

  console.log('\n' + '─'.repeat(80));
});

console.log('\n✅ Rule Engine Demo Complete!\n');
