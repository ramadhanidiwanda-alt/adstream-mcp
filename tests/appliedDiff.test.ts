import { describe, it, expect } from 'vitest';
import { computeAppliedDrops } from '../src/providers/meta/appliedDiff.js';

describe('computeAppliedDrops', () => {
  it('reports an array element Meta silently dropped', () => {
    const drops = computeAppliedDrops(
      {
        targeting: {
          publisher_platforms: [
            'facebook',
            'instagram',
            'threads',
            'messenger',
            'audience_network',
          ],
        },
      },
      { targeting: { publisher_platforms: ['facebook', 'instagram', 'messenger', 'threads'] } }
    );
    expect(drops).toEqual([
      {
        field: 'targeting.publisher_platforms',
        requested: ['facebook', 'instagram', 'threads', 'messenger', 'audience_network'],
        applied: ['facebook', 'instagram', 'messenger', 'threads'],
      },
    ]);
  });

  it('treats a reordered array as applied', () => {
    const drops = computeAppliedDrops(
      { targeting: { publisher_platforms: ['threads', 'facebook'] } },
      { targeting: { publisher_platforms: ['facebook', 'threads'] } }
    );
    expect(drops).toEqual([]);
  });

  it('treats a numeric string read-back as applied', () => {
    expect(computeAppliedDrops({ daily_budget: 19789 }, { daily_budget: '19789' })).toEqual([]);
  });

  it('reports a top-level field Meta omitted entirely', () => {
    expect(computeAppliedDrops({ name: 'New Name' }, {})).toEqual([
      { field: 'name', requested: 'New Name', applied: null },
    ]);
  });

  it('returns no drops when everything matches', () => {
    expect(
      computeAppliedDrops(
        { name: 'A', targeting: { device_platforms: ['mobile'] } },
        { name: 'A', targeting: { device_platforms: ['mobile'] }, extra: 'ignored' }
      )
    ).toEqual([]);
  });
});
