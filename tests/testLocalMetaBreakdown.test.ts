import { afterEach, describe, expect, it } from 'vitest';
import { resolveMetaAdAccountId } from '../scripts/testLocalMetaBreakdown.js';

const originalMetaAdAccountId = process.env.META_AD_ACCOUNT_ID;
const originalMetaTestAdAccountId = process.env.META_TEST_AD_ACCOUNT_ID;

afterEach(() => {
  if (originalMetaAdAccountId === undefined) delete process.env.META_AD_ACCOUNT_ID;
  else process.env.META_AD_ACCOUNT_ID = originalMetaAdAccountId;

  if (originalMetaTestAdAccountId === undefined) delete process.env.META_TEST_AD_ACCOUNT_ID;
  else process.env.META_TEST_AD_ACCOUNT_ID = originalMetaTestAdAccountId;
});

describe('testLocalMetaBreakdown env resolution', () => {
  it('uses META_AD_ACCOUNT_ID when present', () => {
    process.env.META_AD_ACCOUNT_ID = 'act_primary';
    process.env.META_TEST_AD_ACCOUNT_ID = 'act_test';

    expect(resolveMetaAdAccountId()).toBe('act_primary');
  });

  it('falls back to META_TEST_AD_ACCOUNT_ID for local smoke tests', () => {
    delete process.env.META_AD_ACCOUNT_ID;
    process.env.META_TEST_AD_ACCOUNT_ID = 'act_test';

    expect(resolveMetaAdAccountId()).toBe('act_test');
  });

  it('returns undefined when neither account env is usable', () => {
    process.env.META_AD_ACCOUNT_ID = 'act_';
    process.env.META_TEST_AD_ACCOUNT_ID = '';

    expect(resolveMetaAdAccountId()).toBeUndefined();
  });
});
