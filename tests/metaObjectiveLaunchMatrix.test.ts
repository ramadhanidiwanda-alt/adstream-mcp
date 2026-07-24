import { describe, expect, it } from 'vitest';
import {
  META_ODAX_OBJECTIVES,
  MetaObjectiveLaunchValidationError,
  buildMetaPromotedObject,
  parseMetaApiMajor,
  resolveMetaObjectiveLaunchSpec,
} from '../src/providers/meta/objectiveLaunchMatrix.js';

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
