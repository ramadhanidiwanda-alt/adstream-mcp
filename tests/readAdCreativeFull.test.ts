import { describe, expect, it, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { readAdCreativeFull } from '../src/tools/readAdCreativeFull.js';

function createMockClient(results: Record<string, Record<string, unknown>> = {}): MetaClient {
  return {
    metaGetObject: vi.fn().mockImplementation(async (path: string, opts: { fields?: string }) => {
      // Return the first matching mock result; if none, return empty
      const key = Object.keys(results).find(k => (opts.fields ?? '').includes(k));
      return results[key] ?? {};
    }),
    metaGet: vi.fn(),
    metaPost: vi.fn(),
    metaDelete: vi.fn(),
  } as unknown as MetaClient;
}

describe('readAdCreativeFull', () => {
  it('returns creative payload by merging field batches', async () => {
    const mockResponses: Record<string, Record<string, unknown>> = {
      'id,name,status,object_type': {
        id: '120330899389530268',
        name: 'Test Creative',
        status: 'ACTIVE',
        object_type: 'SHARE',
      },
      'object_story_spec': {
        object_story_spec: {
          page_id: '123456789',
          link_data: { link: 'https://example.com' },
        },
      },
      'call_to_action,page_welcome_message': {
        call_to_action: { type: 'WHATSAPP_MESSAGE' },
        page_welcome_message: 'Halo, ada yang bisa dibantu?',
      },
    };

    const client = createMockClient(mockResponses);
    const result = await readAdCreativeFull(client, {
      creativeId: '120330899389530268',
    });

    expect(result.id).toBe('120330899389530268');
    expect(result.name).toBe('Test Creative');
    expect(result.status).toBe('ACTIVE');
    expect(result.object_type).toBe('SHARE');
    expect(result.object_story_spec).toBeDefined();
    expect(result.object_story_spec.link_data.link).toBe('https://example.com');
    expect(result.call_to_action.type).toBe('WHATSAPP_MESSAGE');
    expect(result.page_welcome_message).toBe('Halo, ada yang bisa dibantu?');
  });

  it('silently skips field batches that fail', async () => {
    const client = {
      metaGetObject: vi.fn().mockImplementation(async (path: string, opts: { fields?: string }) => {
        const fields = opts.fields ?? '';
        if (fields.includes('object_story_spec')) {
          throw new Error('(#100) Tried accessing nonexisting field (link)');
        }
        if (fields.includes('link')) {
          throw new Error('(#100) Tried accessing nonexisting field (link)');
        }
        // Return base fields
        return { id: 'cr_123', name: 'Test', status: 'ACTIVE', object_type: 'VIDEO' };
      }),
      metaGet: vi.fn(),
      metaPost: vi.fn(),
      metaDelete: vi.fn(),
    } as unknown as MetaClient;

    const result = await readAdCreativeFull(client, {
      creativeId: 'cr_123',
    });

    // Core fields should still be there
    expect(result.id).toBe('cr_123');
    expect(result.name).toBe('Test');
    expect(result.object_type).toBe('VIDEO');
    // Failed fields should be absent — not blocking the whole result
    expect(result.object_story_spec).toBeUndefined();
  });

  it('handles creative with asset_feed_spec (Dynamic Creative)', async () => {
    const client = {
      metaGetObject: vi.fn().mockImplementation(async (_path: string, opts: { fields?: string }) => {
        const fields = opts.fields ?? '';
        if (fields.includes('asset_feed_spec')) {
          return {
            asset_feed_spec: {
              ad_formats: ['AUTOMATIC_FORMAT'],
              bodies: [{ text: 'Test body' }],
              titles: [{ text: 'Headline' }],
              link_urls: [{ website_url: 'https://example.com' }],
              call_to_action_types: ['SHOP_NOW'],
            },
          };
        }
        if (fields.includes('degrees_of_freedom_spec')) {
          return {
            degrees_of_freedom_spec: {
              creative_feature_settings: { adaptive_assets: true, autoflow: true },
            },
          };
        }
        return { id: 'cr_dco', name: 'DCO Creative', status: 'ACTIVE', object_type: 'SHARE' };
      }),
      metaGet: vi.fn(),
      metaPost: vi.fn(),
      metaDelete: vi.fn(),
    } as unknown as MetaClient;

    const result = await readAdCreativeFull(client, {
      creativeId: 'cr_dco',
    });

    const feed = result.asset_feed_spec as Record<string, unknown> | undefined;
    expect(feed).toBeDefined();
    expect((feed!.ad_formats as string[])).toContain('AUTOMATIC_FORMAT');
    expect(result.degrees_of_freedom_spec).toBeDefined();
    expect(result.id).toBe('cr_dco');
  });

  it('handles partial response gracefully (missing fields)', async () => {
    const client = {
      metaGetObject: vi.fn().mockResolvedValue({ id: 'cr_min', name: 'Minimal' }),
      metaGet: vi.fn(),
      metaPost: vi.fn(),
      metaDelete: vi.fn(),
    } as unknown as MetaClient;

    const result = await readAdCreativeFull(client, {
      creativeId: 'cr_min',
    });

    expect(result.id).toBe('cr_min');
    expect(result.name).toBe('Minimal');
    // Other fields simply absent
  });

  it('handles all batches failing', async () => {
    const client = {
      metaGetObject: vi.fn().mockRejectedValue(new Error('API Error')),
      metaGet: vi.fn(),
      metaPost: vi.fn(),
      metaDelete: vi.fn(),
    } as unknown as MetaClient;

    const result = await readAdCreativeFull(client, {
      creativeId: 'cr_fail',
    });

    // Should return empty object — all batches failed silently
    expect(result).toEqual({});
  });

  it('reads multiple batch types: tracking_specs, branded_content, etc.', async () => {
    const client = {
      metaGetObject: vi.fn().mockImplementation(async (_path: string, opts: { fields?: string }) => {
        const fields = opts.fields ?? '';
        if (fields.includes('contextual_multi_ads')) {
          return {
            tracking_specs: { action_type: ['link_click'] },
            contextual_multi_ads: { enabled: true },
          };
        }
        if (fields.includes('branded_content')) {
          return { branded_content: { sponsor_id: 'page_1' } };
        }
        if (fields.includes('contextual_multi_ads')) {
          return { contextual_multi_ads: { enabled: true } };
        }
        return { id: 'cr_full', name: 'Full Creative', status: 'ACTIVE', object_type: 'SHARE' };
      }),
      metaGet: vi.fn(),
      metaPost: vi.fn(),
      metaDelete: vi.fn(),
    } as unknown as MetaClient;

    const result = await readAdCreativeFull(client, {
      creativeId: 'cr_full',
    });

    expect(result.tracking_specs).toBeDefined();
    expect(result.branded_content).toBeDefined();
    expect(result.contextual_multi_ads).toBeDefined();
    expect(result.id).toBe('cr_full');
  });
});
