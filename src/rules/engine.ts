import type { CampaignInsight } from '../types.js';
import type {
  Rule,
  Condition,
  RuleResult,
  MatchedCondition,
  RuleEvaluationResult,
} from './types.js';

export class RuleEngine {
  /**
   * Get metric value from campaign insight
   */
  private getMetricValue(insight: CampaignInsight, metric: string): number {
    const metricMap: Record<string, () => number> = {
      spend: () => parseFloat(insight.spend) || 0,
      impressions: () => parseFloat(insight.impressions) || 0,
      reach: () => parseFloat(insight.reach) || 0,
      clicks: () => parseFloat(insight.clicks) || 0,
      inline_link_clicks: () => parseFloat(insight.inline_link_clicks) || 0,
      ctr: () => parseFloat(insight.ctr) || 0,
      cpc: () => parseFloat(insight.cpc) || 0,
      cpm: () => parseFloat(insight.cpm) || 0,
    };

    const getter = metricMap[metric];
    if (!getter) {
      throw new Error(`Unknown metric: ${metric}`);
    }

    return getter();
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    insight: CampaignInsight,
    condition: Condition
  ): MatchedCondition {
    const actualValue = this.getMetricValue(insight, condition.metric);
    let matched = false;

    switch (condition.operator) {
      case '>':
        matched = actualValue > condition.value;
        break;
      case '<':
        matched = actualValue < condition.value;
        break;
      case '=':
        matched = actualValue === condition.value;
        break;
      case '>=':
        matched = actualValue >= condition.value;
        break;
      case '<=':
        matched = actualValue <= condition.value;
        break;
      case '!=':
        matched = actualValue !== condition.value;
        break;
    }

    const description = `${condition.metric} ${condition.operator} ${condition.value} (actual: ${actualValue})`;

    return {
      condition,
      actualValue,
      matched,
      description,
    };
  }

  /**
   * Evaluate a rule against campaign insight
   */
  evaluateRule(insight: CampaignInsight, rule: Rule): RuleResult {
    if (!rule.enabled) {
      return {
        rule,
        matched: false,
        matchedConditions: [],
        timestamp: new Date().toISOString(),
      };
    }

    const matchedConditions = rule.conditions.map((condition) =>
      this.evaluateCondition(insight, condition)
    );

    let matched = false;

    if (rule.logic === 'AND') {
      matched = matchedConditions.every((mc) => mc.matched);
    } else if (rule.logic === 'OR') {
      matched = matchedConditions.some((mc) => mc.matched);
    }

    return {
      rule,
      matched,
      matchedConditions,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Apply multiple rules to a single campaign insight
   */
  applyRules(insight: CampaignInsight, rules: Rule[]): RuleResult[] {
    return rules
      .map((rule) => this.evaluateRule(insight, rule))
      .filter((result) => result.matched);
  }

  /**
   * Apply rules to multiple campaign insights
   */
  applyRulesToInsights(
    insights: CampaignInsight[],
    rules: Rule[]
  ): RuleEvaluationResult[] {
    return insights.map((insight) => {
      const triggeredRules = this.applyRules(insight, rules);

      let overallStatus: RuleEvaluationResult['overallStatus'] = 'good';
      const recommendedActions: string[] = [];

      if (triggeredRules.length > 0) {
        const hasHighPriority = triggeredRules.some(
          (r) => r.rule.priority === 'high'
        );
        const hasMediumPriority = triggeredRules.some(
          (r) => r.rule.priority === 'medium'
        );

        if (hasHighPriority) {
          overallStatus = 'warning';
        } else if (hasMediumPriority) {
          overallStatus = 'watch';
        }

        triggeredRules.forEach((result) => {
          const priorityLabel = result.rule.priority.toUpperCase();
          recommendedActions.push(
            `[${priorityLabel}] ${result.rule.action}`
          );
        });
      }

      return {
        campaignId: insight.campaign_id,
        campaignName: insight.campaign_name,
        triggeredRules,
        overallStatus,
        recommendedActions,
      };
    });
  }
}
