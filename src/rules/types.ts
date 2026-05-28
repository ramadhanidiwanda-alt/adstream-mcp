export type RuleOperator = '>' | '<' | '=' | '>=' | '<=' | '!=';

export type RuleLogic = 'AND' | 'OR';

export type RulePriority = 'high' | 'medium' | 'low';

export interface Condition {
  metric: string;
  operator: RuleOperator;
  value: number;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  conditions: Condition[];
  logic: RuleLogic;
  action: string;
  priority: RulePriority;
  enabled: boolean;
}

export interface MatchedCondition {
  condition: Condition;
  actualValue: number;
  matched: boolean;
  description: string;
}

export interface RuleResult {
  rule: Rule;
  matched: boolean;
  matchedConditions: MatchedCondition[];
  timestamp: string;
}

export interface RuleEvaluationResult {
  campaignId: string;
  campaignName: string;
  triggeredRules: RuleResult[];
  overallStatus: 'good' | 'watch' | 'warning';
  recommendedActions: string[];
}
