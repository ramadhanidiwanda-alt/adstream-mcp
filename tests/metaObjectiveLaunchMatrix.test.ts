import { describe, expect, it } from 'vitest';
import {
  META_ODAX_OBJECTIVES,
  MetaObjectiveLaunchValidationError,
  buildMetaPromotedObject,
  parseMetaApiMajor,
  resolveMetaObjectiveLaunchSpec,
} from '../src/providers/meta/objectiveLaunchMatrix.js';
import { getLaunchPreset } from '../src/tools/launchPresets.js';

describe('Meta objective launch matrix', () => {
  it('exposes exactly the six ODAX create objectives', () => {
    expect(META_ODAX_OBJECTIVES).toEqual([
      'OUTCOME_AWARENESS',
      'OUTCOME_TRAFFIC',
      'OUTCOME_ENGAGEMENT',
      'OUTCOME_LEADS',
      'OUTCOME_APP_PROMOTION',
      'OUTCOME_SALES',
    ]);
  });

  it('resolves website traffic to landing-page views by default', () => {
    expect(
      resolveMetaObjectiveLaunchSpec({
        objective: 'OUTCOME_TRAFFIC',
        conversionLocation: 'WEBSITE',
        creativeFormat: 'single_image',
        apiVersion: 'v25.0',
      })
    ).toMatchObject({
      key: 'traffic_website',
      optimizationGoal: 'LANDING_PAGE_VIEWS',
      billingEvent: 'IMPRESSIONS',
      destinationType: 'WEBSITE',
    });
  });

  it.each([
    {
      objective: 'OUTCOME_AWARENESS' as const,
      conversionLocation: 'AWARENESS' as const,
      optimizationGoal: undefined,
      expected: {
        optimizationGoal: 'REACH',
        billingEvent: 'IMPRESSIONS',
        destinationMode: 'NONE',
      },
    },
    {
      objective: 'OUTCOME_AWARENESS' as const,
      conversionLocation: 'AWARENESS' as const,
      optimizationGoal: 'IMPRESSIONS',
      expected: {
        optimizationGoal: 'IMPRESSIONS',
        billingEvent: 'IMPRESSIONS',
        destinationMode: 'NONE',
      },
    },
    {
      objective: 'OUTCOME_TRAFFIC' as const,
      conversionLocation: 'WEBSITE' as const,
      optimizationGoal: undefined,
      expected: {
        optimizationGoal: 'LANDING_PAGE_VIEWS',
        billingEvent: 'IMPRESSIONS',
        destinationType: 'WEBSITE',
        destinationMode: 'EXTERNAL_URL',
      },
    },
    {
      objective: 'OUTCOME_ENGAGEMENT' as const,
      conversionLocation: 'POST' as const,
      optimizationGoal: undefined,
      expected: {
        optimizationGoal: 'POST_ENGAGEMENT',
        billingEvent: 'IMPRESSIONS',
        destinationType: 'ON_POST',
        destinationMode: 'NONE',
      },
    },
    {
      objective: 'OUTCOME_ENGAGEMENT' as const,
      conversionLocation: 'VIDEO' as const,
      optimizationGoal: undefined,
      expected: {
        optimizationGoal: 'THRUPLAY',
        billingEvent: 'IMPRESSIONS',
        destinationType: 'ON_VIDEO',
        destinationMode: 'NONE',
      },
    },
  ])('resolves $objective at $conversionLocation to its canonical payload', (testCase) => {
    expect(
      resolveMetaObjectiveLaunchSpec({
        objective: testCase.objective,
        conversionLocation: testCase.conversionLocation,
        optimizationGoal: testCase.optimizationGoal,
        apiVersion: 'v25.0',
      })
    ).toMatchObject(testCase.expected);
  });

  it('rejects a sales/reach combination before any provider call', () => {
    expect(() =>
      resolveMetaObjectiveLaunchSpec({
        objective: 'OUTCOME_SALES',
        conversionLocation: 'WEBSITE',
        optimizationGoal: 'REACH',
        creativeFormat: 'single_image',
        apiVersion: 'v25.0',
      })
    ).toThrowError(
      expect.objectContaining<Partial<MetaObjectiveLaunchValidationError>>({
        code: 'INVALID_OBJECTIVE_GOAL_COMBINATION',
      })
    );
  });

  it('accepts an existing post as Website Sales creative and swaps its required inputs', () => {
    const spec = resolveMetaObjectiveLaunchSpec({
      objective: 'OUTCOME_SALES',
      conversionLocation: 'WEBSITE',
      creativeFormat: 'existing_post',
      apiVersion: 'v25.0',
    });

    expect(spec).toMatchObject({
      key: 'sales_website',
      optimizationGoal: 'OFFSITE_CONVERSIONS',
      destinationType: 'WEBSITE',
      destinationMode: 'EXTERNAL_URL',
      promotedObjectKind: 'pixel_purchase',
    });
    expect(buildMetaPromotedObject(spec, { pixelId: 'pixel-1' })).toEqual({
      pixel_id: 'pixel-1',
      custom_event_type: 'PURCHASE',
    });
    // The boosted post supplies its own media and copy; the pixel-tracked
    // landing page still has to come from destinationUrl.
    expect(spec.requiredInputs).toContain('existingPostId');
    expect(spec.requiredInputs).toContain('destinationUrl');
    expect(spec.requiredInputs).toEqual(
      expect.not.arrayContaining(['creativeAsset', 'primaryText', 'headline'])
    );
  });

  it('keeps asset-based required inputs for Website Sales when no creative format is given', () => {
    expect(
      resolveMetaObjectiveLaunchSpec({
        objective: 'OUTCOME_SALES',
        conversionLocation: 'WEBSITE',
        apiVersion: 'v25.0',
      }).requiredInputs
    ).toEqual(expect.arrayContaining(['creativeAsset', 'primaryText', 'headline']));
  });

  it('still rejects an existing post for Catalog Sales', () => {
    expect(() =>
      resolveMetaObjectiveLaunchSpec({
        objective: 'OUTCOME_SALES',
        conversionLocation: 'CATALOG',
        creativeFormat: 'existing_post',
        apiVersion: 'v25.0',
      })
    ).toThrowError(
      expect.objectContaining<Partial<MetaObjectiveLaunchValidationError>>({
        code: 'UNSUPPORTED_CREATIVE_FORMAT',
      })
    );
  });

  it('builds website lead and app-install promoted objects', () => {
    const lead = resolveMetaObjectiveLaunchSpec({
      objective: 'OUTCOME_LEADS',
      conversionLocation: 'WEBSITE',
      creativeFormat: 'single_image',
      apiVersion: 'v25.0',
    });
    expect(buildMetaPromotedObject(lead, { pixelId: 'pixel-1' })).toEqual({
      pixel_id: 'pixel-1',
      custom_event_type: 'LEAD',
    });

    const app = resolveMetaObjectiveLaunchSpec({
      objective: 'OUTCOME_APP_PROMOTION',
      conversionLocation: 'APP',
      creativeFormat: 'video',
      apiVersion: 'v25.0',
    });
    expect(
      buildMetaPromotedObject(app, {
        applicationId: 'app-1',
        objectStoreUrl: 'https://apps.apple.com/app/id123',
      })
    ).toEqual({
      application_id: 'app-1',
      object_store_url: 'https://apps.apple.com/app/id123',
    });
    expect(app).toMatchObject({
      optimizationGoal: 'APP_INSTALLS',
      billingEvent: 'IMPRESSIONS',
      destinationType: 'APP',
      promotedObjectKind: 'application',
    });
  });

  it('recommends lead-form discovery when preparing Instant Form Leads', () => {
    expect(getLaunchPreset('leads_instant_form').recommendedTools).toContain('ads_list_lead_forms');
  });

  it('parses supported versions and rejects unreviewed versions', () => {
    expect(parseMetaApiMajor('v25.0')).toBe(25);
    expect(parseMetaApiMajor('24')).toBe(24);
    expect(() =>
      resolveMetaObjectiveLaunchSpec({
        objective: 'OUTCOME_AWARENESS',
        conversionLocation: 'AWARENESS',
        creativeFormat: 'single_image',
        apiVersion: 'v26.0',
      })
    ).toThrowError(expect.objectContaining({ code: 'UNSUPPORTED_API_VERSION' }));
  });
});
