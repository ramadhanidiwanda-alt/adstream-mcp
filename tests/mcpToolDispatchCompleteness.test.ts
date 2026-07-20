import { afterEach, describe, expect, it } from 'vitest';
import type { AdsBroker } from '../src/broker/AdsBroker.js';
import {
  getAdsMcpToolDefinitions,
  handleAdsMcpToolCall,
  type AdsMcpToolName,
} from '../src/broker/mcpTools.js';

/**
 * Regression coverage for a whole class of bug found in this project:
 * a tool name can be fully registered (present in ADS_MCP_TOOL_NAMES,
 * has a real definition object with schema/description, shows up in
 * tools/list and ads_get_capabilities) while having NO `case` in the
 * dispatch switch — every call silently falls through to `default` and
 * returns UNSUPPORTED_OPERATION. This happened twice already
 * (ads_list_adimages/ads_list_advideos, ads_pause_adset/ads_resume_adset)
 * despite the underlying broker/adapter implementations being complete and
 * correct — the only thing missing was the dispatch wiring itself, and
 * nothing caught it because every other layer looked fine in isolation.
 *
 * This test exercises every currently *registered* tool name through the
 * real handleAdsMcpToolCall dispatch path with a broker stub that trivially
 * succeeds for any method call, so the only way a tool can fail here is if
 * the dispatch switch itself doesn't route it anywhere.
 */

const originalEnableWrites = process.env.ADSTREAM_ENABLE_WRITES;

afterEach(() => {
  if (originalEnableWrites === undefined) {
    delete process.env.ADSTREAM_ENABLE_WRITES;
  } else {
    process.env.ADSTREAM_ENABLE_WRITES = originalEnableWrites;
  }
});

function createAlwaysSucceedsBrokerStub(): AdsBroker {
  const asyncOk = async () => ({ ok: true, provider: 'meta', data: {} });
  // getCapabilities is the one broker method that's synchronous (not
  // Promise-returning) — the dispatch switch calls it without awaiting.
  const syncOk = () => ({ ok: true, provider: 'meta', data: {} });
  return new Proxy(
    {},
    {
      get: (_target, prop) => (prop === 'getCapabilities' ? syncOk : asyncOk),
    }
  ) as AdsBroker;
}

describe('MCP tool dispatch completeness', () => {
  it('routes every registered tool name to a real broker call, never falling through to UNSUPPORTED_OPERATION', async () => {
    process.env.ADSTREAM_ENABLE_WRITES = 'true';
    const broker = createAlwaysSucceedsBrokerStub();
    const toolNames = getAdsMcpToolDefinitions({ includeWrites: true }).map(
      (tool) => tool.name as AdsMcpToolName
    );

    expect(toolNames.length).toBeGreaterThan(0);

    for (const name of toolNames) {
      const result = await handleAdsMcpToolCall(
        broker,
        name,
        { accountId: 'act_123', since: '2026-05-01', until: '2026-05-07' },
        'test-connection'
      );
      const parsed = JSON.parse(result.content[0]!.text) as {
        errors?: Array<{ code?: string; message?: string }>;
      };

      expect(
        parsed.errors?.[0]?.code,
        `${name} fell through to the dispatch switch's default case: ${parsed.errors?.[0]?.message}`
      ).not.toBe('UNSUPPORTED_OPERATION');
    }
  });
});
