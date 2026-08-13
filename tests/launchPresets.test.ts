import { describe, expect, it } from 'vitest';
import { checkLaunchReadiness } from '../src/tools/checkLaunchReadiness.js';
import { getLaunchPreset, inferLaunchWorkflow } from '../src/tools/launchPresets.js';

const CANONICAL_WORKFLOWS = [
  ['awareness', 'OUTCOME_AWARENESS', 'AWARENESS'],
  ['traffic_website', 'OUTCOME_TRAFFIC', 'WEBSITE'],
  ['engagement_post', 'OUTCOME_ENGAGEMENT', 'POST'],
  ['engagement_video', 'OUTCOME_ENGAGEMENT', 'VIDEO'],
  ['leads_website', 'OUTCOME_LEADS', 'WEBSITE'],
  ['leads_instant_form', 'OUTCOME_LEADS', 'INSTANT_FORM'],
  ['app_installs', 'OUTCOME_APP_PROMOTION', 'APP'],
  ['sales_website', 'OUTCOME_SALES', 'WEBSITE'],
  ['sales_messaging', 'OUTCOME_SALES', 'MESSAGING'],
  ['sales_catalog', 'OUTCOME_SALES', 'CATALOG'],
] as const;

const REQUIRED_INPUTS = {
  awareness: [
    'pageId',
    'dailyBudget',
    'countries',
    'creativeAsset',
    'primaryText',
    'specialAdCategories',
  ],
  traffic_website: [
    'pageId',
    'destinationUrl',
    'dailyBudget',
    'countries',
    'creativeAsset',
    'primaryText',
    'headline',
    'specialAdCategories',
  ],
  engagement_post: ['pageId', 'existingPostId', 'dailyBudget', 'countries', 'specialAdCategories'],
  engagement_video: [
    'pageId',
    'videoId',
    'dailyBudget',
    'countries',
    'primaryText',
    'specialAdCategories',
  ],
  leads_website: [
    'pageId',
    'pixelId',
    'destinationUrl',
    'dailyBudget',
    'countries',
    'creativeAsset',
    'primaryText',
    'headline',
    'specialAdCategories',
  ],
  leads_instant_form: [
    'pageId',
    'leadFormId',
    'dailyBudget',
    'countries',
    'creativeAsset',
    'primaryText',
    'headline',
    'specialAdCategories',
  ],
  app_installs: [
    'pageId',
    'applicationId',
    'objectStoreUrl',
    'dailyBudget',
    'countries',
    'creativeAsset',
    'primaryText',
    'headline',
    'specialAdCategories',
  ],
  sales_website: [
    'pageId',
    'pixelId',
    'destinationUrl',
    'dailyBudget',
    'countries',
    'creativeAsset',
    'primaryText',
    'headline',
    'specialAdCategories',
  ],
  sales_messaging: [
    'pageId',
    'messagingDestination',
    'whatsappPhoneNumber',
    'pixelId',
    'destinationUrl',
    'dailyBudget',
    'countries',
    'creativeAsset',
    'primaryText',
    'specialAdCategories',
  ],
  sales_catalog: [
    'businessId',
    'catalogId',
    'productSetId',
    'pageId',
    'dailyBudget',
    'countries',
    'creativeAsset',
    'primaryText',
    'headline',
    'specialAdCategories',
  ],
} as const;

describe('launch presets', () => {
  it.each(CANONICAL_WORKFLOWS)(
    'maps %s to its objective and conversion location',
    (workflow, objective, conversionLocation) => {
      expect(getLaunchPreset(workflow)).toMatchObject({ workflow, objective, conversionLocation });
    }
  );

  it.each(CANONICAL_WORKFLOWS)(
    'reports only the resolved required input IDs for an incomplete %s launch',
    (workflow) => {
      const result = checkLaunchReadiness({ workflow, writesEnabled: true });

      expect(result.missing).toEqual(REQUIRED_INPUTS[workflow]);
      expect(result.resolvedSpec).toMatchObject({ key: workflow });
    }
  );

  it('does not require a pixel or URL for awareness', () => {
    const result = checkLaunchReadiness({
      workflow: 'awareness',
      pageId: 'page-1',
      dailyBudget: 1000,
      countries: ['ID'],
      imageHash: 'image-1',
      primaryText: 'Introduce the brand',
      specialAdCategories: [],
      writesEnabled: true,
    });

    expect(result).toMatchObject({ ready: true, missing: [] });
  });

  it('warns that headline and caption options default to manual creative testing', () => {
    const result = checkLaunchReadiness({ workflow: 'sales_website', writesEnabled: true });

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/opsi.*headline.*caption.*manual/i),
        expect.stringMatching(/image\/video/i),
        expect.stringMatching(/Dynamic Creative.*disabled/i),
      ])
    );
  });

  it('captures the objective-specific dependencies for every workflow', () => {
    expect(
      checkLaunchReadiness({ workflow: 'traffic_website', writesEnabled: true }).missing
    ).toContain('destinationUrl');
    expect(
      checkLaunchReadiness({ workflow: 'engagement_post', writesEnabled: true }).missing
    ).toContain('existingPostId');
    expect(
      checkLaunchReadiness({ workflow: 'engagement_video', writesEnabled: true }).missing
    ).toContain('videoId');
    expect(
      checkLaunchReadiness({ workflow: 'leads_website', writesEnabled: true }).missing
    ).toEqual(expect.arrayContaining(['pixelId', 'destinationUrl']));
    expect(
      checkLaunchReadiness({ workflow: 'leads_instant_form', writesEnabled: true }).missing
    ).toEqual(expect.arrayContaining(['pageId', 'leadFormId']));
    expect(checkLaunchReadiness({ workflow: 'app_installs', writesEnabled: true }).missing).toEqual(
      expect.arrayContaining(['applicationId', 'objectStoreUrl'])
    );
    expect(
      checkLaunchReadiness({
        workflow: 'app_installs',
        writesEnabled: true,
        pageId: 'page-1',
        applicationId: 'app-1',
        objectStoreUrl: 'https://apps.apple.com/app/id123',
        dailyBudget: 100,
        countries: ['ID'],
        primaryText: 'Install now',
        headline: 'Get the app',
        videoId: 'video-1',
        specialAdCategories: [],
      }).warnings
    ).toEqual(expect.arrayContaining([expect.stringMatching(/SDK\/MMP.*app-event/i)]));
    expect(
      checkLaunchReadiness({ workflow: 'sales_website', writesEnabled: true }).missing
    ).toEqual(expect.arrayContaining(['pixelId', 'destinationUrl']));
    expect(
      checkLaunchReadiness({ workflow: 'sales_catalog', writesEnabled: true }).missing
    ).toEqual(expect.arrayContaining(['productSetId', 'catalogId']));
  });

  const BOOSTABLE_WEBSITE_WORKFLOWS = [
    { workflow: 'sales_website' as const, pixelId: 'pixel-1' },
    { workflow: 'traffic_website' as const, pixelId: undefined },
    { workflow: 'leads_website' as const, pixelId: 'pixel-1' },
  ];

  it.each(BOOSTABLE_WEBSITE_WORKFLOWS)(
    'asks for the post instead of fresh assets when boosting a post for $workflow',
    ({ workflow }) => {
      const result = checkLaunchReadiness({
        workflow,
        creativeFormat: 'existing_post',
        writesEnabled: true,
      });

      expect(result.missing).toEqual(expect.arrayContaining(['existingPostId', 'destinationUrl']));
      expect(result.missing).toEqual(
        expect.not.arrayContaining(['creativeAsset', 'primaryText', 'headline'])
      );
      expect(result.resolvedSpec?.supportedCreativeFormats).toContain('existing_post');
    }
  );

  it.each(BOOSTABLE_WEBSITE_WORKFLOWS)(
    'is ready to boost an existing post for $workflow once the post is known',
    ({ workflow, pixelId }) => {
      expect(
        checkLaunchReadiness({
          workflow,
          creativeFormat: 'existing_post',
          pageId: 'page-1',
          pixelId,
          existingPostId: 'page-1_post-1',
          destinationUrl: 'https://shop.example.com/product',
          dailyBudget: 100000,
          countries: ['ID'],
          specialAdCategories: [],
          writesEnabled: true,
        })
      ).toMatchObject({ ready: true, missing: [] });
    }
  );

  it('keeps legacy workflow aliases compatible and marks deprecated aliases', () => {
    expect(getLaunchPreset('website_sales')).toMatchObject({ workflow: 'sales_website' });
    expect(getLaunchPreset('whatsapp_sales')).toMatchObject({ workflow: 'sales_messaging' });
  });

  it('infers canonical workflows from plain-language user intent', () => {
    expect(inferLaunchWorkflow('buat campaign awareness untuk brand baru')).toBe('awareness');
    expect(inferLaunchWorkflow('boost postingan existing')).toBe('engagement_post');
    expect(inferLaunchWorkflow('jualan ke website')).toBe('sales_website');
    expect(inferLaunchWorkflow('iklan click to instagram direct message')).toBe(
      'engagement_messaging'
    );
    expect(inferLaunchWorkflow('bikin CTWA biar orang chat whatsapp')).toBe('engagement_messaging');
    expect(inferLaunchWorkflow('bikin CTWA sales objective biar orang purchase via WA')).toBe(
      'sales_messaging'
    );
  });

  // Before this workflow existed, OUTCOME_ENGAGEMENT only reached engagement_post, so a
  // click-to-message launch was steered to destinationType ON_POST — boosting likes
  // instead of opening a conversation.
  it.each([
    { messagingDestination: 'INSTAGRAM_DIRECT', callToAction: 'INSTAGRAM_MESSAGE' },
    { messagingDestination: 'MESSENGER', callToAction: 'MESSAGE_PAGE' },
    { messagingDestination: 'WHATSAPP', callToAction: 'WHATSAPP_MESSAGE' },
    {
      messagingDestination: 'MESSAGING_INSTAGRAM_DIRECT_WHATSAPP',
      callToAction: 'INSTAGRAM_MESSAGE',
    },
  ] as const)(
    'resolves $messagingDestination to its own destination type and CTA',
    ({ messagingDestination, callToAction }) => {
      const result = checkLaunchReadiness({
        workflow: 'engagement_messaging',
        creativeFormat: 'existing_post',
        messagingDestination,
        pageId: 'page-1',
        existingPostId: 'page-1_post-1',
        dailyBudget: 100000,
        countries: ['ID'],
        specialAdCategories: [],
        writesEnabled: true,
      });

      expect(result).toMatchObject({
        ready: true,
        missing: [],
        workflow: 'engagement_messaging',
        resolvedSpec: {
          objective: 'OUTCOME_ENGAGEMENT',
          conversionLocation: 'MESSAGING',
          optimizationGoal: 'CONVERSATIONS',
          destinationType: messagingDestination,
          defaultCallToAction: callToAction,
        },
      });
    }
  );

  it('asks which inbox a click-to-message launch should open', () => {
    const result = checkLaunchReadiness({
      workflow: 'engagement_messaging',
      creativeFormat: 'existing_post',
      pageId: 'page-1',
      existingPostId: 'page-1_post-1',
      dailyBudget: 100000,
      countries: ['ID'],
      specialAdCategories: [],
      writesEnabled: true,
    });

    expect(result.ready).toBe(false);
    expect(result.missing).toContain('messagingDestination');
  });

  // An existing post carries its own media and copy, and a messaging CTA carries no
  // link, so neither creativeAsset nor destinationUrl belongs on this path.
  it('does not ask for a destination URL or creative asset on a messaging existing_post launch', () => {
    const result = checkLaunchReadiness({
      workflow: 'engagement_messaging',
      creativeFormat: 'existing_post',
      messagingDestination: 'INSTAGRAM_DIRECT',
      pageId: 'page-1',
      existingPostId: 'page-1_post-1',
      dailyBudget: 100000,
      countries: ['ID'],
      specialAdCategories: [],
      writesEnabled: true,
    });

    expect(result.missing).not.toContain('destinationUrl');
    expect(result.missing).not.toContain('creativeAsset');
  });

  it('warns that CONVERSATIONS needs a one-day attribution window', () => {
    const result = checkLaunchReadiness({
      workflow: 'engagement_messaging',
      messagingDestination: 'INSTAGRAM_DIRECT',
    });

    expect(result.warnings.join(' ')).toMatch(/1 hari|window_days/i);
  });

  it('recommends the UI-clone path for click-to-message launches', () => {
    expect(getLaunchPreset('engagement_messaging').recommendedTools).toContain('ads_clone_ui_ad');
  });

  it('points the whatsapp_sales alias at the Sales messaging workflow, not website sales', () => {
    expect(getLaunchPreset('whatsapp_sales')).toMatchObject({
      workflow: 'sales_messaging',
      objective: 'OUTCOME_SALES',
      conversionLocation: 'MESSAGING',
      optimizationGoal: 'CONVERSATIONS',
    });
  });

  it('resolves Sales CTWA to WhatsApp destination and CTA', () => {
    const result = checkLaunchReadiness({
      workflow: 'sales_messaging',
      creativeFormat: 'single_image',
      messagingDestination: 'WHATSAPP',
      whatsappPhoneNumber: '6285156583372',
      pixelId: '607249154118091',
      pageId: 'page-1',
      destinationUrl: 'https://wa.me/6281234567890',
      dailyBudget: 100000,
      countries: ['ID'],
      imageHash: 'image-1',
      primaryText: 'Chat admin untuk beli',
      specialAdCategories: [],
      writesEnabled: true,
    });

    expect(result).toMatchObject({
      ready: true,
      missing: [],
      workflow: 'sales_messaging',
      resolvedSpec: {
        objective: 'OUTCOME_SALES',
        conversionLocation: 'MESSAGING',
        optimizationGoal: 'CONVERSATIONS',
        destinationType: 'WHATSAPP',
        defaultCallToAction: 'WHATSAPP_MESSAGE',
      },
    });
  });

  it('marks Sales CTWA existing-post ready without destinationUrl', () => {
    const result = checkLaunchReadiness({
      workflow: 'sales_messaging',
      creativeFormat: 'existing_post',
      messagingDestination: 'WHATSAPP',
      whatsappPhoneNumber: '6285156583372',
      pixelId: '607249154118091',
      pageId: '330290916841848',
      existingPostId: '18571075747064659',
      dailyBudget: 175000,
      countries: ['ID'],
      specialAdCategories: [],
      writesEnabled: true,
    });

    expect(result).toMatchObject({
      ready: true,
      missing: [],
      workflow: 'sales_messaging',
      resolvedSpec: {
        optimizationGoal: 'CONVERSATIONS',
        destinationType: 'WHATSAPP',
        defaultCallToAction: 'WHATSAPP_MESSAGE',
      },
    });
  });
});

describe('checkLaunchReadiness — jalur partnership ad code', () => {
  const baseOptions = {
    workflow: 'traffic_website',
    creativeFormat: 'existing_post',
    pageId: 'page-1',
    destinationUrl: 'https://example.com',
    dailyBudget: 50000,
    countries: ['ID'],
    specialAdCategories: [],
    writesEnabled: true,
  } as const;

  it('menerima partnershipAdCode sebagai pengganti existingPostId', () => {
    const result = checkLaunchReadiness({ ...baseOptions, partnershipAdCode: 'AD-CODE-XYZ' });

    expect(result.missing).toEqual([]);
    expect(result.ready).toBe(true);
  });

  it('tetap menerima existingPostId seperti sebelumnya', () => {
    const result = checkLaunchReadiness({ ...baseOptions, existingPostId: 'page-1_123' });

    expect(result.missing).toEqual([]);
    expect(result.ready).toBe(true);
  });

  it('tetap menandai kurang input bila tidak ada keduanya', () => {
    const result = checkLaunchReadiness(baseOptions);

    expect(result.missing).toEqual(['existingPostId']);
    expect(result.nextQuestions.join(' ')).toMatch(/ad code/i);
  });
});
