import { describe, expect, it } from 'vitest';
import { ADS_MCP_TOOL_DEFINITIONS } from '../src/broker/mcpTools.js';
import { createAdCreativeInputSchema } from '../src/mcp/createServer.js';
import { CREATE_AD_CREATIVE_PARAMS } from '../src/providers/meta/MetaAdsAdapter.js';

// Keys toAdsBrokerRequest lifts out of args before building request.params, so
// they never reach the adapter and must never appear in the allowlist.
const RESERVED = new Set(['provider', 'providers', 'accountId', 'since', 'until', 'params']);

function declaredParams(keys: string[]): string[] {
  return keys.filter((key) => !RESERVED.has(key)).sort();
}

describe('ads_create_adcreative param parity', () => {
  const allowed = [...CREATE_AD_CREATIVE_PARAMS].sort();

  it('accepts exactly the params declared on the broker JSON Schema surface', () => {
    const definition = ADS_MCP_TOOL_DEFINITIONS.find(
      (tool) => tool.name === 'ads_create_adcreative'
    );
    const properties = definition?.inputSchema.properties as Record<string, unknown>;

    expect(declaredParams(Object.keys(properties))).toEqual(allowed);
  });

  it('accepts exactly the params declared on the MCP Zod surface', () => {
    expect(declaredParams(Object.keys(createAdCreativeInputSchema))).toEqual(allowed);
  });
});
