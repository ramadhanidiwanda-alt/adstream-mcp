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

  it('keeps messaging purchase conversion as the requested Sales CTWA performance goal', () => {
    expect(
      resolveMetaObjectiveLaunchSpec({
        objective: 'OUTCOME_SALES',
        conversionLocation: 'MESSAGING',
        messagingDestination: 'WHATSAPP',
        optimizationGoal: 'MESSAGING_PURCHASE_CONVERSION',
        creativeFormat: 'single_image',
        apiVersion: 'v25.0',
      })
    ).toMatchObject({
      key: 'sales_messaging',
      optimizationGoal: 'MESSAGING_PURCHASE_CONVERSION',
      allowedOptimizationGoals: expect.arrayContaining(['MESSAGING_PURCHASE_CONVERSION']),
      destinationType: 'WHATSAPP',
    });
  });

  // Meta's ODAX mapping routes Sales + WhatsApp purchase conversions to
  // OFFSITE_CONVERSIONS with a Purchase conversion event, not to
  // MESSAGING_PURCHASE_CONVERSION — the latter is refused by the API with subcode
  // 2490408 while this combination validates. Verified against a live account 2026-08-07.
  it('allows OFFSITE_CONVERSIONS for Sales CTWA purchase optimization', () => {
    expect(
      resolveMetaObjectiveLaunchSpec({
        objective: 'OUTCOME_SALES',
        conversionLocation: 'MESSAGING',
        messagingDestination: 'WHATSAPP',
        optimizationGoal: 'OFFSITE_CONVERSIONS',
        apiVersion: 'v25.0',
      })
    ).toMatchObject({
      key: 'sales_messaging',
      optimizationGoal: 'OFFSITE_CONVERSIONS',
      destinationType: 'WHATSAPP',
    });
  });

  it('carries the purchase pixel signal in promoted_object for Sales CTWA conversions', () => {
    const spec = resolveMetaObjectiveLaunchSpec({
      objective: 'OUTCOME_SALES',
      conversionLocation: 'MESSAGING',
      messagingDestination: 'WHATSAPP',
      optimizationGoal: 'OFFSITE_CONVERSIONS',
      apiVersion: 'v25.0',
    });

    expect(
      buildMetaPromotedObject(spec, {
        pageId: '330290916841848',
        whatsappPhoneNumber: '6285156583372',
        pixelId: '607249154118091',
      })
    ).toEqual({
      page_id: '330290916841848',
      whatsapp_phone_number: '6285156583372',
      pixel_id: '607249154118091',
      custom_event_type: 'PURCHASE',
    });
  });

  it('keeps conversation-goal Sales CTWA promoted_object free of the pixel', () => {
    const spec = resolveMetaObjectiveLaunchSpec({
      objective: 'OUTCOME_SALES',
      conversionLocation: 'MESSAGING',
      messagingDestination: 'WHATSAPP',
      optimizationGoal: 'CONVERSATIONS',
      apiVersion: 'v25.0',
    });

    expect(
      buildMetaPromotedObject(spec, {
        pageId: '330290916841848',
        whatsappPhoneNumber: '6285156583372',
        pixelId: '607249154118091',
      })
    ).toEqual({
      page_id: '330290916841848',
      whatsapp_phone_number: '6285156583372',
    });
  });

  it('does not offer flexible Dynamic Creative for website launch workflows', () => {
    const salesSpec = resolveMetaObjectiveLaunchSpec({
      objective: 'OUTCOME_SALES',
      conversionLocation: 'WEBSITE',
      apiVersion: 'v25.0',
    });
    const trafficSpec = resolveMetaObjectiveLaunchSpec({
      objective: 'OUTCOME_TRAFFIC',
      conversionLocation: 'WEBSITE',
      apiVersion: 'v25.0',
    });

    expect(salesSpec.supportedCreativeFormats).not.toContain('flexible');
    expect(trafficSpec.supportedCreativeFormats).not.toContain('flexible');
    expect(() =>
      resolveMetaObjectiveLaunchSpec({
        objective: 'OUTCOME_SALES',
        conversionLocation: 'WEBSITE',
        creativeFormat: 'flexible',
        apiVersion: 'v25.0',
      })
    ).toThrowError(
      expect.objectContaining<Partial<MetaObjectiveLaunchValidationError>>({
        code: 'UNSUPPORTED_CREATIVE_FORMAT',
      })
    );
  });

  // An existing post is a creative choice, not a conversion location: every
  // Website row keeps its own optimization goal and promoted object and swaps
  // only the creative for the post.
  const WEBSITE_EXISTING_POST_CASES = [
    {
      label: 'Website Sales',
      objective: 'OUTCOME_SALES' as const,
      expected: {
        key: 'sales_website',
        optimizationGoal: 'OFFSITE_CONVERSIONS',
        destinationType: 'WEBSITE',
        destinationMode: 'EXTERNAL_URL',
        promotedObjectKind: 'pixel_purchase',
      },
      promotedObject: { pixel_id: 'pixel-1', custom_event_type: 'PURCHASE' },
      alsoRequires: ['pixelId'],
    },
    {
      label: 'Website Traffic',
      objective: 'OUTCOME_TRAFFIC' as const,
      expected: {
        key: 'traffic_website',
        optimizationGoal: 'LANDING_PAGE_VIEWS',
        destinationType: 'WEBSITE',
        destinationMode: 'EXTERNAL_URL',
        promotedObjectKind: 'none',
      },
      promotedObject: undefined,
      alsoRequires: [],
    },
    {
      label: 'Website Leads',
      objective: 'OUTCOME_LEADS' as const,
      expected: {
        key: 'leads_website',
        optimizationGoal: 'OFFSITE_CONVERSIONS',
        destinationType: 'WEBSITE',
        destinationMode: 'EXTERNAL_URL',
        promotedObjectKind: 'pixel_lead',
      },
      promotedObject: { pixel_id: 'pixel-1', custom_event_type: 'LEAD' },
      alsoRequires: ['pixelId'],
    },
  ];

  it.each(WEBSITE_EXISTING_POST_CASES)(
    'accepts an existing post as $label creative and swaps its required inputs',
    (testCase) => {
      const spec = resolveMetaObjectiveLaunchSpec({
        objective: testCase.objective,
        conversionLocation: 'WEBSITE',
        creativeFormat: 'existing_post',
        apiVersion: 'v25.0',
      });

      expect(spec).toMatchObject(testCase.expected);
      expect(buildMetaPromotedObject(spec, { pixelId: 'pixel-1' })).toEqual(
        testCase.promotedObject
      );
      // The boosted post supplies its own media and copy; the tracked landing
      // page still has to come from destinationUrl.
      expect(spec.requiredInputs).toEqual(
        expect.arrayContaining([
          'pageId',
          'existingPostId',
          'destinationUrl',
          ...testCase.alsoRequires,
        ])
      );
      expect(spec.requiredInputs).toEqual(
        expect.not.arrayContaining(['creativeAsset', 'primaryText', 'headline'])
      );
    }
  );

  it.each(WEBSITE_EXISTING_POST_CASES)(
    'keeps asset-based required inputs for $label when no creative format is given',
    (testCase) => {
      const spec = resolveMetaObjectiveLaunchSpec({
        objective: testCase.objective,
        conversionLocation: 'WEBSITE',
        apiVersion: 'v25.0',
      });

      expect(spec.requiredInputs).toEqual(
        expect.arrayContaining(['creativeAsset', 'primaryText', 'headline'])
      );
      expect(spec.requiredInputs).toEqual(expect.not.arrayContaining(['existingPostId']));
    }
  );

  // engagement_post owns conversionLocation POST with destinationMode NONE and
  // needs no override: existing_post is its only supported format already.
  it('leaves the Engagement post row untouched by the Website overrides', () => {
    const spec = resolveMetaObjectiveLaunchSpec({
      objective: 'OUTCOME_ENGAGEMENT',
      conversionLocation: 'POST',
      creativeFormat: 'existing_post',
      apiVersion: 'v25.0',
    });

    expect(spec).toMatchObject({
      key: 'engagement_post',
      optimizationGoal: 'POST_ENGAGEMENT',
      destinationType: 'ON_POST',
      destinationMode: 'NONE',
      promotedObjectKind: 'none',
    });
    expect(spec.requiredInputs).toEqual([
      'pageId',
      'existingPostId',
      'dailyBudget',
      'countries',
      'specialAdCategories',
    ]);
  });

  it('does not require destinationUrl for Sales CTWA existing-post creatives', () => {
    const spec = resolveMetaObjectiveLaunchSpec({
      objective: 'OUTCOME_SALES',
      conversionLocation: 'MESSAGING',
      messagingDestination: 'WHATSAPP',
      creativeFormat: 'existing_post',
      apiVersion: 'v25.0',
    });

    expect(spec).toMatchObject({
      key: 'sales_messaging',
      optimizationGoal: 'CONVERSATIONS',
      destinationType: 'WHATSAPP',
      defaultCallToAction: 'WHATSAPP_MESSAGE',
    });
    expect(spec.requiredInputs).toEqual(
      expect.arrayContaining([
        'pageId',
        'messagingDestination',
        'whatsappPhoneNumber',
        'pixelId',
        'existingPostId',
        'dailyBudget',
        'countries',
        'specialAdCategories',
      ])
    );
    expect(spec.requiredInputs).toEqual(expect.not.arrayContaining(['destinationUrl']));
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
