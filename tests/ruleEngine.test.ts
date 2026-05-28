import { describe, it, expect } from 'vitest';
import { RuleEngine } from '../src/rules/engine.js';
import type { CampaignInsight } from '../src/types.js';
import type { Rule } from '../src/rules/types.js';

describe('RuleEngine', () => {
  const engine = new RuleEngine();

  const sampleInsight: CampaignInsight = {
    campaign_id: '123',
    campaign_name: 'Test Campaign',
    spend: '100000',
    impressions: '500000',
    reach: '400000',
    clicks: '5000',
    inline_link_clicks: '4500',
    ctr: '1.0',
    cpc: '20',
    cpm: '200',
  };

  describe('evaluateRule', () => {
    it('should match rule with single condition (greater than)', () => {
      const rule: Rule = {
        id: 'test-1',
        name: 'High Spend',
        description: 'Detect high spend campaigns',
        conditions: [{ metric: 'spend', operator: '>', value: 50000 }],
        logic: 'AND',
        action: 'Review budget',
        priority: 'high',
        enabled: true,
      };

      const result = engine.evaluateRule(sampleInsight, rule);

      expect(result.matched).toBe(true);
      expect(result.matchedConditions).toHaveLength(1);
      expect(result.matchedConditions[0].matched).toBe(true);
      expect(result.matchedConditions[0].actualValue).toBe(100000);
    });

    it('should not match rule when condition fails', () => {
      const rule: Rule = {
        id: 'test-2',
        name: 'Low Spend',
        description: 'Detect low spend campaigns',
        conditions: [{ metric: 'spend', operator: '<', value: 50000 }],
        logic: 'AND',
        action: 'Increase budget',
        priority: 'low',
        enabled: true,
      };

      const result = engine.evaluateRule(sampleInsight, rule);

      expect(result.matched).toBe(false);
      expect(result.matchedConditions[0].matched).toBe(false);
    });

    it('should match rule with AND logic when all conditions pass', () => {
      const rule: Rule = {
        id: 'test-3',
        name: 'High Spend Low CTR',
        description: 'High spend with low CTR',
        conditions: [
          { metric: 'spend', operator: '>', value: 50000 },
          { metric: 'ctr', operator: '<', value: 2.0 },
        ],
        logic: 'AND',
        action: 'Optimize creative',
        priority: 'high',
        enabled: true,
      };

      const result = engine.evaluateRule(sampleInsight, rule);

      expect(result.matched).toBe(true);
      expect(result.matchedConditions).toHaveLength(2);
      expect(result.matchedConditions.every((mc) => mc.matched)).toBe(true);
    });

    it('should not match rule with AND logic when one condition fails', () => {
      const rule: Rule = {
        id: 'test-4',
        name: 'High Spend High CTR',
        description: 'High spend with high CTR',
        conditions: [
          { metric: 'spend', operator: '>', value: 50000 },
          { metric: 'ctr', operator: '>', value: 5.0 },
        ],
        logic: 'AND',
        action: 'Scale campaign',
        priority: 'medium',
        enabled: true,
      };

      const result = engine.evaluateRule(sampleInsight, rule);

      expect(result.matched).toBe(false);
    });

    it('should match rule with OR logic when at least one condition passes', () => {
      const rule: Rule = {
        id: 'test-5',
        name: 'High Spend OR High CTR',
        description: 'Either high spend or high CTR',
        conditions: [
          { metric: 'spend', operator: '>', value: 50000 },
          { metric: 'ctr', operator: '>', value: 5.0 },
        ],
        logic: 'OR',
        action: 'Review performance',
        priority: 'medium',
        enabled: true,
      };

      const result = engine.evaluateRule(sampleInsight, rule);

      expect(result.matched).toBe(true);
    });

    it('should not match disabled rule', () => {
      const rule: Rule = {
        id: 'test-6',
        name: 'Disabled Rule',
        description: 'This rule is disabled',
        conditions: [{ metric: 'spend', operator: '>', value: 0 }],
        logic: 'AND',
        action: 'Do nothing',
        priority: 'low',
        enabled: false,
      };

      const result = engine.evaluateRule(sampleInsight, rule);

      expect(result.matched).toBe(false);
    });

    it('should handle all operators correctly', () => {
      const testCases = [
        { operator: '>' as const, value: 50000, expected: true },
        { operator: '<' as const, value: 50000, expected: false },
        { operator: '=' as const, value: 100000, expected: true },
        { operator: '>=' as const, value: 100000, expected: true },
        { operator: '<=' as const, value: 100000, expected: true },
        { operator: '!=' as const, value: 50000, expected: true },
      ];

      testCases.forEach(({ operator, value, expected }) => {
        const rule: Rule = {
          id: `test-op-${operator}`,
          name: `Test ${operator}`,
          description: `Test operator ${operator}`,
          conditions: [{ metric: 'spend', operator, value }],
          logic: 'AND',
          action: 'Test action',
          priority: 'low',
          enabled: true,
        };

        const result = engine.evaluateRule(sampleInsight, rule);
        expect(result.matched).toBe(expected);
      });
    });
  });

  describe('applyRules', () => {
    it('should return only matched rules', () => {
      const rules: Rule[] = [
        {
          id: 'rule-1',
          name: 'High Spend',
          description: 'High spend rule',
          conditions: [{ metric: 'spend', operator: '>', value: 50000 }],
          logic: 'AND',
          action: 'Review budget',
          priority: 'high',
          enabled: true,
        },
        {
          id: 'rule-2',
          name: 'Low Spend',
          description: 'Low spend rule',
          conditions: [{ metric: 'spend', operator: '<', value: 50000 }],
          logic: 'AND',
          action: 'Increase budget',
          priority: 'low',
          enabled: true,
        },
      ];

      const results = engine.applyRules(sampleInsight, rules);

      expect(results).toHaveLength(1);
      expect(results[0].rule.id).toBe('rule-1');
      expect(results[0].matched).toBe(true);
    });
  });

  describe('applyRulesToInsights', () => {
    it('should evaluate multiple insights with multiple rules', () => {
      const insights: CampaignInsight[] = [
        {
          campaign_id: '1',
          campaign_name: 'Campaign 1',
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
          campaign_id: '2',
          campaign_name: 'Campaign 2',
          spend: '50000',
          impressions: '200000',
          reach: '150000',
          clicks: '4000',
          inline_link_clicks: '3500',
          ctr: '2.0',
          cpc: '12.5',
          cpm: '250',
        },
      ];

      const rules: Rule[] = [
        {
          id: 'rule-1',
          name: 'High Spend Low CTR',
          description: 'Warning for high spend with low CTR',
          conditions: [
            { metric: 'spend', operator: '>', value: 100000 },
            { metric: 'ctr', operator: '<', value: 1.0 },
          ],
          logic: 'AND',
          action: 'Fix creative or targeting',
          priority: 'high',
          enabled: true,
        },
        {
          id: 'rule-2',
          name: 'Good Performance',
          description: 'Good CTR and reasonable CPC',
          conditions: [
            { metric: 'ctr', operator: '>', value: 1.5 },
            { metric: 'cpc', operator: '<', value: 20 },
          ],
          logic: 'AND',
          action: 'Consider scaling',
          priority: 'medium',
          enabled: true,
        },
      ];

      const results = engine.applyRulesToInsights(insights, rules);

      expect(results).toHaveLength(2);

      // Campaign 1 should trigger high priority rule
      expect(results[0].campaignId).toBe('1');
      expect(results[0].triggeredRules).toHaveLength(1);
      expect(results[0].overallStatus).toBe('warning');
      expect(results[0].recommendedActions).toContain(
        '[HIGH] Fix creative or targeting'
      );

      // Campaign 2 should trigger medium priority rule
      expect(results[1].campaignId).toBe('2');
      expect(results[1].triggeredRules).toHaveLength(1);
      expect(results[1].overallStatus).toBe('watch');
      expect(results[1].recommendedActions).toContain('[MEDIUM] Consider scaling');
    });

    it('should return good status when no rules triggered', () => {
      const insights: CampaignInsight[] = [
        {
          campaign_id: '1',
          campaign_name: 'Campaign 1',
          spend: '10000',
          impressions: '50000',
          reach: '40000',
          clicks: '500',
          inline_link_clicks: '450',
          ctr: '1.0',
          cpc: '20',
          cpm: '200',
        },
      ];

      const rules: Rule[] = [
        {
          id: 'rule-1',
          name: 'High Spend',
          description: 'Very high spend',
          conditions: [{ metric: 'spend', operator: '>', value: 1000000 }],
          logic: 'AND',
          action: 'Review',
          priority: 'high',
          enabled: true,
        },
      ];

      const results = engine.applyRulesToInsights(insights, rules);

      expect(results).toHaveLength(1);
      expect(results[0].triggeredRules).toHaveLength(0);
      expect(results[0].overallStatus).toBe('good');
      expect(results[0].recommendedActions).toHaveLength(0);
    });
  });
});
