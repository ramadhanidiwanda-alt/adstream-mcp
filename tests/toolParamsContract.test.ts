import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  RESERVED_REQUEST_KEYS,
  TOOL_PARAM_HINTS,
  deriveAllowedParamKeys,
  findUnknownParamKeys,
  formatUnknownParamsMessage,
} from '../src/broker/toolParamContract.js';
import {
  ADS_MCP_TOOL_DEFINITIONS,
  findUnknownToolParams,
  handleAdsMcpToolCall,
} from '../src/broker/mcpTools.js';
import type { AdsBroker } from '../src/broker/AdsBroker.js';

describe('toolParamContract helpers', () => {
  it('derives the allowed key set from a schema properties object', () => {
    const allowed = deriveAllowedParamKeys({
      properties: { provider: {}, accountId: {}, params: {}, adsetId: {} },
    });

    expect([...allowed].sort()).toEqual(['accountId', 'adsetId', 'params', 'provider']);
  });

  it('returns an empty set for a schema with no properties', () => {
    expect(deriveAllowedParamKeys({}).size).toBe(0);
  });

  it('reports only the keys outside the allowed set, preserving caller order', () => {
    const unknown = findUnknownParamKeys(
      { adsetId: '1', fields: 'id,name', limit: 5, effective_status: 'ACTIVE' },
      new Set(['adsetId', 'limit'])
    );

    expect(unknown).toEqual(['fields', 'effective_status']);
  });

  it('formats the message with a hint arrow where a hint exists and bare key where it does not', () => {
    const message = formatUnknownParamsMessage(['image_hash', 'nonsense'], {
      image_hash: 'imageHash',
    });

    expect(message).toBe(
      'Field berikut tidak dikenali dan TIDAK dikirim ke Meta: image_hash → imageHash; nonsense. params bukan passthrough mentah ke Graph API — pakai field bertipe yang sesuai, atau hapus field ini.'
    );
  });

  it('reserves exactly the keys extractParams never merges into params', () => {
    expect([...RESERVED_REQUEST_KEYS].sort()).toEqual([
      '_oauthAuthContext',
      'accountId',
      'params',
      'provider',
      'providers',
      'since',
      'until',
    ]);
  });

  it('maps the raw Graph API spellings callers reach for to the typed option', () => {
    expect(TOOL_PARAM_HINTS.ads_create_adcreative?.image_hash).toBe('imageHash');
    expect(TOOL_PARAM_HINTS.ads_read_creative_full?.creative_id).toBe('creativeId');
    expect(TOOL_PARAM_HINTS.ads_read_adset_full?.adset_id).toBe('adsetId');
  });
});

const STRICT_TOOL_DEFINITIONS = ADS_MCP_TOOL_DEFINITIONS.filter(
  (tool) => 'strictParams' in tool && tool.strictParams === true
);

function schemaPropertyNames(inputSchema: { properties?: unknown }): string[] {
  return Object.keys((inputSchema.properties ?? {}) as Record<string, unknown>);
}

function createAlwaysSucceedsBrokerStub(): { broker: AdsBroker; calls: string[] } {
  const calls: string[] = [];
  const broker = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === 'getCapabilities') {
          return () => {
            calls.push(String(prop));
            return { ok: true, provider: 'meta', data: {} };
          };
        }
        return async () => {
          calls.push(String(prop));
          return { ok: true, provider: 'meta', data: {} };
        };
      },
    }
  ) as AdsBroker;

  return { broker, calls };
}

function parseBody(response: Awaited<ReturnType<typeof handleAdsMcpToolCall>>): {
  ok?: boolean;
  errors?: Array<{ code?: string; message?: string }>;
} {
  return JSON.parse(response.content[0]!.text) as {
    ok?: boolean;
    errors?: Array<{ code?: string; message?: string }>;
  };
}

describe('strict params enrollment', () => {
  const originalEnableWrites = process.env.ADSTREAM_ENABLE_WRITES;

  beforeEach(() => {
    process.env.ADSTREAM_ENABLE_WRITES = 'true';
  });

  afterEach(() => {
    if (originalEnableWrites === undefined) {
      delete process.env.ADSTREAM_ENABLE_WRITES;
    } else {
      process.env.ADSTREAM_ENABLE_WRITES = originalEnableWrites;
    }
  });

  it('enrolls exactly the three tools this change covers', () => {
    expect(STRICT_TOOL_DEFINITIONS.map((tool) => tool.name).sort()).toEqual([
      'ads_create_adcreative',
      'ads_read_adset_full',
      'ads_read_creative_full',
    ]);
  });

  // The dominant risk here is over-rejection, so this is the load-bearing test:
  // every property a strict tool declares must survive, whether the caller sends
  // it nested under params or as a top-level argument. It grows automatically as
  // more tools are enrolled.
  it('accepts every property a strict tool declares in its own schema, nested under params', () => {
    for (const tool of STRICT_TOOL_DEFINITIONS) {
      const declared = schemaPropertyNames(tool.inputSchema).filter((key) => key !== 'params');
      const params = Object.fromEntries(declared.map((key) => [key, 'value']));

      expect(findUnknownToolParams(tool.name, { params }), tool.name).toEqual([]);
    }
  });

  it('accepts every property a strict tool declares when sent as top-level arguments', () => {
    for (const tool of STRICT_TOOL_DEFINITIONS) {
      const declared = schemaPropertyNames(tool.inputSchema).filter((key) => key !== 'params');
      const args = Object.fromEntries(declared.map((key) => [key, 'value']));

      expect(findUnknownToolParams(tool.name, args), tool.name).toEqual([]);
    }
  });

  it('ignores the internal oauth context rather than rejecting it', () => {
    expect(
      findUnknownToolParams('ads_read_adset_full', {
        adsetId: '123',
        _oauthAuthContext: { token: 'secret' },
      })
    ).toEqual([]);
  });

  it('leaves tools without strictParams fully permissive', () => {
    expect(
      findUnknownToolParams('ads_list_campaigns', { params: { limit: 50, fields: 'id,name' } })
    ).toEqual([]);
  });

  it('still lets a non-enrolled tool reach the broker with arbitrary params', async () => {
    const { broker, calls } = createAlwaysSucceedsBrokerStub();

    const response = await handleAdsMcpToolCall(broker, 'ads_list_campaigns', {
      accountId: 'act_123',
      params: { limit: 50, fields: 'id,name' },
    });

    expect(response.isError).not.toBe(true);
    expect(parseBody(response).ok).toBe(true);
    expect(calls).toEqual(['listCampaigns']);
  });

  it('rejects an unknown params key on ads_read_adset_full without calling the broker', async () => {
    const { broker, calls } = createAlwaysSucceedsBrokerStub();

    const response = await handleAdsMcpToolCall(broker, 'ads_read_adset_full', {
      accountId: 'act_123',
      params: { adsetId: '123', fields: 'id,name' },
    });

    const body = parseBody(response);
    expect(response.isError).toBe(true);
    expect(body.ok).toBe(false);
    expect(body.errors?.[0]?.code).toBe('UNKNOWN_PARAM');
    expect(body.errors?.[0]?.message).toContain('fields');
    expect(calls).toEqual([]);
  });

  it('names the typed option for a raw Graph API spelling on ads_create_adcreative', async () => {
    const { broker } = createAlwaysSucceedsBrokerStub();

    const response = await handleAdsMcpToolCall(broker, 'ads_create_adcreative', {
      accountId: 'act_123',
      name: 'Creative',
      params: { image_hash: 'abc123' },
    });

    const body = parseBody(response);
    expect(body.errors?.[0]?.code).toBe('UNKNOWN_PARAM');
    expect(body.errors?.[0]?.message).toContain('image_hash → imageHash');
  });

  it('keeps the ads_read_creative_full message identical to the adapter-side guard', async () => {
    const { broker } = createAlwaysSucceedsBrokerStub();

    const response = await handleAdsMcpToolCall(broker, 'ads_read_creative_full', {
      creativeId: '123',
      params: { fields: 'id,name' },
    });

    const body = parseBody(response);
    expect(body.errors?.[0]?.message).toBe(
      'Field berikut tidak dikenali dan TIDAK dikirim ke Meta: fields → tool ini selalu membaca seluruh field yang didukung; tidak ada override fields. Lihat AD_CREATIVE_FULL_FIELDS di src/tools/readAdCreativeFull.ts. params bukan passthrough mentah ke Graph API — pakai field bertipe yang sesuai, atau hapus field ini.'
    );
  });
});
