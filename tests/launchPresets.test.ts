import { describe, expect, it } from 'vitest';
import { getLaunchPreset, inferLaunchWorkflow } from '../src/tools/launchPresets.js';

describe('launch presets', () => {
  it('maps whatsapp_sales to non-coding requirements and Meta setup defaults', () => {
    expect(getLaunchPreset('whatsapp_sales')).toMatchObject({
      workflow: 'whatsapp_sales',
      label: 'Jualan ke WhatsApp',
      objective: 'OUTCOME_SALES',
      destinationType: 'WHATSAPP',
      defaultCallToAction: 'WHATSAPP_MESSAGE',
      requiredInputs: expect.arrayContaining(['pageId', 'whatsappPhoneNumberId', 'creativeAsset']),
      recommendedTools: expect.arrayContaining([
        'ads_check_launch_readiness',
        'ads_list_whatsapp_accounts',
        'ads_create_adcreative',
      ]),
    });
  });

  it('maps cpas_catalog_sales to catalog discovery and collaborative ads setup', () => {
    expect(getLaunchPreset('cpas_catalog_sales')).toMatchObject({
      workflow: 'cpas_catalog_sales',
      mode: 'collaborative_ads',
      objective: 'OUTCOME_SALES',
      requiredInputs: expect.arrayContaining([
        'businessId',
        'catalogId',
        'productSetId',
        'pixelId',
      ]),
      recommendedTools: expect.arrayContaining([
        'ads_list_catalogs',
        'ads_list_product_sets',
        'ads_create_adset',
      ]),
    });
  });

  it('infers a workflow from plain-language user intent', () => {
    expect(inferLaunchWorkflow('bikin iklan ke whatsapp untuk skincare')).toBe('whatsapp_sales');
    expect(inferLaunchWorkflow('buat CPAS katalog product set sepatu')).toBe('cpas_catalog_sales');
    expect(inferLaunchWorkflow('boost postingan existing')).toBe('existing_post');
    expect(inferLaunchWorkflow('jualan ke website')).toBe('website_sales');
  });
});
