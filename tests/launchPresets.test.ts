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

  it('keeps legacy workflow aliases compatible and marks deprecated aliases', () => {
    expect(getLaunchPreset('website_sales')).toMatchObject({ workflow: 'sales_website' });
    expect(checkLaunchReadiness({ workflow: 'whatsapp_sales' }).warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('deprecated')])
    );
  });

  it('infers canonical workflows from plain-language user intent', () => {
    expect(inferLaunchWorkflow('buat campaign awareness untuk brand baru')).toBe('awareness');
    expect(inferLaunchWorkflow('boost postingan existing')).toBe('engagement_post');
    expect(inferLaunchWorkflow('jualan ke website')).toBe('sales_website');
  });
});
