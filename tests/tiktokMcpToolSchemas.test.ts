import { describe, expect, it } from 'vitest';
import { ADS_MCP_TOOL_DEFINITIONS } from '../src/broker/mcpTools.js';

function schemaFor(name: string) {
  const def = ADS_MCP_TOOL_DEFINITIONS.find((d) => d.name === name);
  if (!def) throw new Error(`tool ${name} not found`);
  return def.inputSchema as { properties: Record<string, unknown>; required: string[] };
}

describe('TikTok-aware MCP tool schemas', () => {
  it('ads_create_campaign exposes objectiveType for TikTok without requiring it', () => {
    const schema = schemaFor('ads_create_campaign');
    expect(schema.properties).toHaveProperty('objectiveType');
    expect(schema.required).not.toContain('objectiveType');
  });

  it('ads_create_adset exposes TikTok-only fields', () => {
    const schema = schemaFor('ads_create_adset');
    for (const field of ['bidType', 'bidPrice', 'placementType', 'identityType', 'identityId', 'appId', 'promotionType', 'optimizationEvent', 'catalogId', 'storeId', 'productSource']) {
      expect(schema.properties).toHaveProperty(field);
    }
  });

  it('ads_create_ad exposes creatives[] and does not hard-require creativeId', () => {
    const schema = schemaFor('ads_create_ad');
    expect(schema.properties).toHaveProperty('creatives');
    expect(schema.required).not.toContain('creativeId');
  });

  it('ads_check_launch_readiness exposes tiktokObjectiveType', () => {
    const schema = schemaFor('ads_check_launch_readiness');
    expect(schema.properties).toHaveProperty('tiktokObjectiveType');
  });
});
