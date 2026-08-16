import { describe, expect, it } from 'vitest';
import {
  RESERVED_REQUEST_KEYS,
  TOOL_PARAM_HINTS,
  deriveAllowedParamKeys,
  findUnknownParamKeys,
  formatUnknownParamsMessage,
} from '../src/broker/toolParamContract.js';

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
