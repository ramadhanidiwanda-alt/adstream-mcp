import { RuleEngine } from '../src/rules/engine.js';
import {
  ecommerceRules,
  leadGenRules,
  brandAwarenessRules,
  generalRules,
  allRuleTemplates,
  getRulesByCategory,
} from '../src/rules/templates/index.js';
import type { CampaignInsight } from '../src/types.js';

// Sample campaigns for different use cases
const campaigns: CampaignInsight[] = [
  // E-commerce campaign
  {
    campaign_id: '1',
    campaign_name: 'E-commerce: Summer Sale',
    spend: '120000',
    impressions: '400000',
    reach: '300000',
    clicks: '3000',
    inline_link_clicks: '2800',
    ctr: '0.75',
    cpc: '40',
    cpm: '300',
  },
  // Lead gen campaign
  {
    campaign_id: '2',
    campaign_name: 'Lead Gen: Free Consultation',
    spend: '80000',
    impressions: '200000',
    reach: '150000',
    clicks: '2500',
    inline_link_clicks: '2300',
    ctr: '1.25',
    cpc: '32',
    cpm: '400',
  },
  // Brand awareness campaign
  {
    campaign_id: '3',
    campaign_name: 'Brand: Product Launch',
    spend: '150000',
    impressions: '2000000',
    reach: '1500000',
    clicks: '8000',
    inline_link_clicks: '7500',
    ctr: '0.4',
    cpc: '18.75',
    cpm: '75',
  },
];

const engine = new RuleEngine();

console.log('=== Rule Templates Demo ===\n');

// Demo 1: E-commerce rules
console.log('📦 E-commerce Rules');
console.log(`   Total rules: ${ecommerceRules.length}`);
const ecomResults = engine.applyRulesToInsights([campaigns[0]], ecommerceRules);
console.log(`   Triggered: ${ecomResults[0].triggeredRules.length} rules`);
if (ecomResults[0].triggeredRules.length > 0) {
  ecomResults[0].triggeredRules.forEach((r) => {
    console.log(`   • ${r.rule.name} [${r.rule.priority.toUpperCase()}]`);
  });
}
console.log('');

// Demo 2: Lead gen rules
console.log('📋 Lead Generation Rules');
console.log(`   Total rules: ${leadGenRules.length}`);
const leadResults = engine.applyRulesToInsights([campaigns[1]], leadGenRules);
console.log(`   Triggered: ${leadResults[0].triggeredRules.length} rules`);
if (leadResults[0].triggeredRules.length > 0) {
  leadResults[0].triggeredRules.forEach((r) => {
    console.log(`   • ${r.rule.name} [${r.rule.priority.toUpperCase()}]`);
  });
}
console.log('');

// Demo 3: Brand awareness rules
console.log('🎯 Brand Awareness Rules');
console.log(`   Total rules: ${brandAwarenessRules.length}`);
const brandResults = engine.applyRulesToInsights([campaigns[2]], brandAwarenessRules);
console.log(`   Triggered: ${brandResults[0].triggeredRules.length} rules`);
if (brandResults[0].triggeredRules.length > 0) {
  brandResults[0].triggeredRules.forEach((r) => {
    console.log(`   • ${r.rule.name} [${r.rule.priority.toUpperCase()}]`);
  });
}
console.log('');

// Demo 4: General rules
console.log('⚙️  General Performance Rules');
console.log(`   Total rules: ${generalRules.length}`);
const generalResults = engine.applyRulesToInsights(campaigns, generalRules);
const totalTriggered = generalResults.reduce((sum, r) => sum + r.triggeredRules.length, 0);
console.log(`   Triggered: ${totalTriggered} rules across ${campaigns.length} campaigns`);
console.log('');

// Demo 5: All templates combined
console.log('🎨 All Rule Templates Combined');
console.log(`   Total rules: ${allRuleTemplates.length}`);
const allResults = engine.applyRulesToInsights(campaigns, allRuleTemplates);
console.log('');

allResults.forEach((result, index) => {
  console.log(`📊 Campaign ${index + 1}: ${result.campaignName}`);
  console.log(`   Status: ${result.overallStatus.toUpperCase()}`);
  console.log(`   Triggered rules: ${result.triggeredRules.length}`);
  
  if (result.triggeredRules.length > 0) {
    console.log(`   Top recommendations:`);
    result.recommendedActions.slice(0, 3).forEach((action) => {
      console.log(`      ${action}`);
    });
  }
  console.log('');
});

// Demo 6: Get rules by category
console.log('📂 Get Rules by Category');
console.log(`   E-commerce: ${getRulesByCategory('ecommerce').length} rules`);
console.log(`   Lead Gen: ${getRulesByCategory('leadgen').length} rules`);
console.log(`   Brand: ${getRulesByCategory('brand').length} rules`);
console.log(`   General: ${getRulesByCategory('general').length} rules`);
console.log('');

console.log('✅ Rule Templates Demo Complete!\n');
