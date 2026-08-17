import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { updateAdSet } from '../src/tools/updateAdSet.js';

type Mock = ReturnType<typeof vi.fn>;

describe('updateAdSet', () => {
  const mockMetaPost: Mock = vi.fn();
  const mockMetaGetObject: Mock = vi.fn();
  const mockMetaGet: Mock = vi.fn();
  const mockClient = {
    metaPost: mockMetaPost,
    metaGetObject: mockMetaGetObject,
    metaGet: mockMetaGet,
  } as unknown as MetaClient;

  const baseOpts = { adSetId: 'as789' };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: ad set currently has no remote targeting, so merge-with-empty-base
    // behaves like the pre-merge diff-only payload for tests that don't care about
    // remote state.
    mockMetaGetObject.mockResolvedValue({ targeting: {} });
    mockMetaGet.mockResolvedValue({ data: [] });
  });

  it('returns dry_run without calling API', async () => {
    const r = await updateAdSet(mockClient, { ...baseOpts, name: 'New Name' });
    expect(r.status).toBe('dry_run');
    expect(r.preview.name).toBe('New Name');
    expect(r.mode).toBe('patch');
  });

  it('does not fetch remote targeting when targeting is not touched', async () => {
    await updateAdSet(mockClient, { ...baseOpts, name: 'New Name' });
    expect(mockMetaGetObject).not.toHaveBeenCalled();
  });

  it('defaults nested targeting updates to patch mode', async () => {
    const r = await updateAdSet(mockClient, {
      ...baseOpts,
      targeting: { geoLocations: { countries: ['ID'] } },
    });
    expect(r.mode).toBe('patch');
    expect(r.preview.targeting).toEqual({ geo_locations: { countries: ['ID'] } });
    expect(mockMetaGetObject).toHaveBeenCalledWith(
      '/as789',
      { fields: 'targeting' },
      expect.any(Number)
    );
  });

  it('serializes granular placements and targeting_automation into the update payload', async () => {
    const r = await updateAdSet(mockClient, {
      ...baseOpts,
      targeting: {
        publisherPlatforms: ['instagram', 'threads'],
        instagramPositions: ['stream', 'reels'],
        threadsPositions: ['threads_stream'],
        devicePlatforms: ['mobile'],
        excludedCustomAudiences: [{ id: 'aud_excl' }],
        targetingAutomation: { advantage_audience: 1 },
      },
    });
    expect(r.preview.targeting).toEqual({
      publisher_platforms: ['instagram', 'threads'],
      instagram_positions: ['stream', 'reels'],
      threads_positions: ['threads_stream'],
      device_platforms: ['mobile'],
      excluded_custom_audiences: [{ id: 'aud_excl' }],
      targeting_automation: { advantage_audience: 1 },
    });
  });

  describe('patch-mode remote merge', () => {
    it('preserves untouched remote fields when only a subset is patched', async () => {
      mockMetaGetObject.mockResolvedValue({
        targeting: {
          geo_locations: { countries: ['ID'] },
          age_min: 21,
          age_max: 65,
          genders: [2],
          publisher_platforms: ['facebook', 'instagram'],
          targeting_automation: { advantage_audience: 1 },
        },
      });

      const r = await updateAdSet(mockClient, {
        ...baseOpts,
        targeting: { ageMin: 25 },
      });

      expect(r.preview.targeting).toEqual({
        geo_locations: { countries: ['ID'] },
        age_min: 25,
        age_max: 65,
        genders: [2],
        publisher_platforms: ['facebook', 'instagram'],
        targeting_automation: { advantage_audience: 1 },
      });
    });

    it('merges correctly when remote has fields the client diff does not mention, including age_range', async () => {
      mockMetaGetObject.mockResolvedValue({
        targeting: {
          geo_locations: { countries: ['ID'] },
          age_min: 25,
          age_max: 65,
          age_range: [35, 65],
          targeting_automation: { advantage_audience: 1 },
        },
      });

      const r = await updateAdSet(mockClient, {
        ...baseOpts,
        targeting: { genders: [1] },
      });

      expect(r.preview.targeting).toEqual({
        geo_locations: { countries: ['ID'] },
        age_min: 25,
        age_max: 65,
        age_range: [35, 65],
        targeting_automation: { advantage_audience: 1 },
        genders: [1],
      });
    });

    it('lets an explicit ageRange diff override the remote value', async () => {
      mockMetaGetObject.mockResolvedValue({
        targeting: {
          age_min: 25,
          age_max: 65,
          age_range: [35, 65],
          targeting_automation: { advantage_audience: 1 },
        },
      });

      const r = await updateAdSet(mockClient, {
        ...baseOpts,
        targeting: { ageRange: [30, 60] },
      });

      expect((r.preview.targeting as Record<string, unknown>).age_range).toEqual([30, 60]);
      expect((r.preview.targeting as Record<string, unknown>).age_min).toBe(25);
    });

    it('deep-merges nested geo_locations rather than replacing the whole object', async () => {
      mockMetaGetObject.mockResolvedValue({
        targeting: {
          geo_locations: { countries: ['ID'], location_types: ['home', 'recent'] },
        },
      });

      const r = await updateAdSet(mockClient, {
        ...baseOpts,
        targeting: { geoLocations: { countries: ['ID', 'SG'] } },
      });

      expect(r.preview.targeting).toEqual({
        geo_locations: { countries: ['ID', 'SG'], location_types: ['home', 'recent'] },
      });
    });

    it('applies metaTargetingOverride as a base layer under remote targeting and the explicit diff', async () => {
      mockMetaGetObject.mockResolvedValue({
        targeting: { age_min: 21, age_max: 65 },
      });

      const r = await updateAdSet(mockClient, {
        ...baseOpts,
        targeting: {
          ageMin: 25,
          metaTargetingOverride: { flexible_spec: [{ interests: [{ id: '123' }] }] },
        },
      });

      expect(r.preview.targeting).toEqual({
        age_min: 25,
        age_max: 65,
        flexible_spec: [{ interests: [{ id: '123' }] }],
      });
    });

    it('does not touch targeting at all when options.targeting has no set fields', async () => {
      const r = await updateAdSet(mockClient, {
        ...baseOpts,
        name: 'rename only',
        targeting: {},
      });
      expect(r.preview.targeting).toBeUndefined();
      expect(mockMetaGetObject).not.toHaveBeenCalled();
    });

    it('fails closed and never calls metaPost when the remote-targeting fetch fails', async () => {
      mockMetaGetObject.mockRejectedValueOnce(new Error('rate limited'));

      const r = await updateAdSet(
        mockClient,
        { ...baseOpts, targeting: { ageMin: 25 } },
        { dryRun: false, confirmed: true }
      );

      expect(r.status).toBe('failed');
      expect(r.structuredError?.code).toBe('TARGETING_MERGE_FETCH_FAILED');
      expect(mockMetaPost).not.toHaveBeenCalled();
    });
  });

  describe('replace mode', () => {
    it('requires explicit replace confirmation for targeting replacement', async () => {
      const r = await updateAdSet(
        mockClient,
        {
          ...baseOpts,
          mode: 'replace',
          targeting: { geoLocations: { countries: ['ID'] } },
        },
        { dryRun: false, confirmed: true }
      );
      expect(r.status).toBe('failed');
      expect(r.error).toContain('replaceTargetingConfirmed');
      expect(mockMetaPost).not.toHaveBeenCalled();
    });

    it('executes replace mode only with explicit replacement confirmation', async () => {
      mockMetaPost.mockResolvedValueOnce({ success: true });
      const r = await updateAdSet(
        mockClient,
        {
          ...baseOpts,
          mode: 'replace',
          replaceTargetingConfirmed: true,
          targeting: { geoLocations: { countries: ['ID'] } },
        },
        { dryRun: false, confirmed: true }
      );
      expect(r.status).toBe('executed');
      expect(r.mode).toBe('replace');
      expect(mockMetaPost).toHaveBeenCalled();
    });

    it('never fetches remote targeting before the write, and sends only what is explicitly given', async () => {
      mockMetaPost.mockResolvedValueOnce({ success: true });
      const r = await updateAdSet(
        mockClient,
        {
          ...baseOpts,
          mode: 'replace',
          replaceTargetingConfirmed: true,
          targeting: { ageMin: 25 },
        },
        { dryRun: false, confirmed: true }
      );
      // Replace mode must not merge remote targeting, so no read may precede
      // the write. The post-write verification read-back is a different call
      // with the same signature, so this asserts on ordering rather than args.
      const writeOrder = mockMetaPost.mock.invocationCallOrder[0];
      const readsBeforeWrite = mockMetaGetObject.mock.invocationCallOrder.filter(
        (order: number) => order < writeOrder
      );
      expect(readsBeforeWrite).toEqual([]);
      expect(r.preview.targeting).toEqual({ age_min: 25 });
    });
  });

  it('returns pending_confirmation when not confirmed', async () => {
    const r = await updateAdSet(mockClient, baseOpts, { dryRun: false, confirmed: false });
    expect(r.status).toBe('pending_confirmation');
  });

  it('executes update on success', async () => {
    mockMetaPost.mockResolvedValueOnce({ success: true });
    const r = await updateAdSet(
      mockClient,
      { ...baseOpts, name: 'New Name', dailyBudget: 50000 },
      { dryRun: false, confirmed: true }
    );
    expect(r.status).toBe('executed');
    expect(r.success).toBe(true);
    expect(r.id).toBe('as789');
    expect(mockMetaPost.mock.calls[0][0]).toBe('/as789');
    expect(mockMetaPost.mock.calls[0][1].daily_budget).toBe(50000);
  });

  it('rejects optimizationGoal updates that differ from active siblings', async () => {
    mockMetaGetObject.mockResolvedValueOnce({
      id: 'as789',
      campaign_id: 'cmp_1',
      optimization_goal: 'CONVERSATIONS',
    });
    mockMetaGet.mockResolvedValueOnce({
      data: [
        {
          id: 'as456',
          name: 'Sibling Purchase Messages',
          status: 'ACTIVE',
          effective_status: 'ACTIVE',
          optimization_goal: 'MESSAGING_PURCHASE_CONVERSION',
        },
      ],
    });

    const r = await updateAdSet(
      mockClient,
      { ...baseOpts, optimizationGoal: 'CONVERSATIONS' },
      { dryRun: false, confirmed: true }
    );

    expect(r.status).toBe('failed');
    expect(r.structuredError?.code).toBe('OPTIMIZATION_GOAL_MISMATCH');
    expect(r.error).toContain('MESSAGING_PURCHASE_CONVERSION');
    expect(mockMetaPost).not.toHaveBeenCalled();
  });

  it('returns failed on error', async () => {
    mockMetaPost.mockRejectedValueOnce(new Error('update error'));
    const r = await updateAdSet(
      mockClient,
      { ...baseOpts, name: 'Fail' },
      { dryRun: false, confirmed: true }
    );
    expect(r.status).toBe('failed');
  });

  it('reports fields Meta dropped by comparing the read-back against the request', async () => {
    mockMetaPost.mockResolvedValue({ success: true });
    mockMetaGetObject.mockReset();
    mockMetaGetObject
      .mockResolvedValueOnce({ targeting: {} })
      .mockResolvedValueOnce({
        targeting: { publisher_platforms: ['facebook', 'instagram', 'messenger', 'threads'] },
      });

    const r = await updateAdSet(
      mockClient,
      {
        ...baseOpts,
        targeting: {
          publisherPlatforms: ['facebook', 'instagram', 'threads', 'messenger', 'audience_network'],
        },
      },
      { dryRun: false, confirmed: true }
    );

    expect(r.status).toBe('executed');
    expect(r.success).toBe(true);
    expect(r.droppedFields).toEqual([
      {
        field: 'targeting.publisher_platforms',
        requested: ['facebook', 'instagram', 'threads', 'messenger', 'audience_network'],
        applied: ['facebook', 'instagram', 'messenger', 'threads'],
      },
    ]);
    expect(r.warning).toContain('targeting.publisher_platforms');
  });

  it('omits droppedFields and warning when Meta stored everything requested', async () => {
    mockMetaPost.mockResolvedValue({ success: true });
    mockMetaGetObject.mockReset();
    mockMetaGetObject
      .mockResolvedValueOnce({ targeting: {} })
      .mockResolvedValueOnce({ targeting: { device_platforms: ['mobile'] } });

    const r = await updateAdSet(
      mockClient,
      { ...baseOpts, targeting: { devicePlatforms: ['mobile'] } },
      { dryRun: false, confirmed: true }
    );

    expect(r.droppedFields).toBeUndefined();
    expect(r.warning).toBeUndefined();
    expect(r.applied).toEqual({ targeting: { device_platforms: ['mobile'] } });
  });

  it('still succeeds but warns when the verification read-back fails', async () => {
    mockMetaPost.mockResolvedValue({ success: true });
    mockMetaGetObject.mockReset();
    mockMetaGetObject
      .mockResolvedValueOnce({ targeting: {} })
      .mockRejectedValueOnce(new Error('read timeout'));

    const r = await updateAdSet(
      mockClient,
      { ...baseOpts, targeting: { devicePlatforms: ['mobile'] } },
      { dryRun: false, confirmed: true }
    );

    expect(r.status).toBe('executed');
    expect(r.success).toBe(true);
    expect(r.applied).toBeUndefined();
    expect(r.warning).toContain('read-back');
  });
});

describe('updateAdSet — ad set spend controls', () => {
  function spendControlClient(): MetaClient {
    return {
      metaGetObject: vi.fn().mockResolvedValue({ id: '120000000000000009', targeting: {} }),
      metaGet: vi.fn().mockResolvedValue({ data: [] }),
      metaPost: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as MetaClient;
  }

  it('emits all four spend control fields in the dry-run payload', async () => {
    const result = await updateAdSet(spendControlClient(), {
      adSetId: '120000000000000009',
      dailySpendCap: 5000000,
      dailyMinSpendTarget: 1000000,
      lifetimeSpendCap: 90000000,
      lifetimeMinSpendTarget: 20000000,
    });

    expect(result.preview).toMatchObject({
      daily_spend_cap: 5000000,
      daily_min_spend_target: 1000000,
      lifetime_spend_cap: 90000000,
      lifetime_min_spend_target: 20000000,
    });
  });

  it('omits spend control keys entirely when not supplied', async () => {
    const result = await updateAdSet(spendControlClient(), {
      adSetId: '120000000000000009',
      name: 'Renamed only',
    });

    expect(result.preview).toEqual({ name: 'Renamed only' });
  });
});
