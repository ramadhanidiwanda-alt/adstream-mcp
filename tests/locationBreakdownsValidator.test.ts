import { describe, expect, it } from 'vitest';
import { assertLocationBreakdowns } from '../src/utils/locationBreakdowns.js';

describe('assertLocationBreakdowns', () => {
  it('accepts country and region', () => {
    expect(assertLocationBreakdowns(['country', 'region'])).toEqual(['country', 'region']);
  });

  it('rejects dma — Meta deprecated this breakdown Graph API-wide in favor of comscore_market', () => {
    // Confirmed live against a real ad account: Meta returns
    // "(#100) dma breakdown is no longer supported; to retrieve market-level
    // data, please instead use comscore_market breakdown." Keep this rejected
    // at our own validation layer so callers get a fast, clear error instead
    // of a raw Meta API failure — and so ads_get_capabilities (which derives
    // its advertised breakdowns from the same LOCATION_BREAKDOWNS constant)
    // never claims dma support again.
    expect(() => assertLocationBreakdowns(['dma'])).toThrow('Invalid location breakdown: dma');
  });

  it('rejects unknown breakdown values', () => {
    expect(() => assertLocationBreakdowns(['platform'])).toThrow(
      'Invalid location breakdown: platform'
    );
  });
});
