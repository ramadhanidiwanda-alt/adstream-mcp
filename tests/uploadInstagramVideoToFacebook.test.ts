import { describe, it, expect, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import {
  uploadInstagramVideoToFacebook,
} from '../src/tools/uploadInstagramVideoToFacebook.js';
import { MetaApiError } from '../src/utils/metaError.js';

function createMockClient(response: unknown, error?: Error): MetaClient {
  return {
    metaPost: vi.fn().mockImplementation(() => {
      if (error) return Promise.reject(error);
      return Promise.resolve(response);
    }),
  } as unknown as MetaClient;
}

describe('uploadInstagramVideoToFacebook', () => {
  it('mengembalikan video_id saat upload sukses', async () => {
    const client = createMockClient({ id: 'video-123' });
    const r = await uploadInstagramVideoToFacebook(client, {
      adAccountId: 'act_123',
      sourceInstagramMediaId: '17912345678901234',
      partnershipAdCode: 'abc-123',
    });

    expect(r.status).toBe('uploading');
    expect(r.video_id).toBe('video-123');
    expect(r.source_instagram_media_id).toBe('17912345678901234');
  });

  it('mengembalikan error kalau sourceInstagramMediaId kosong', async () => {
    const client = createMockClient({ id: 'video-123' });
    const r = await uploadInstagramVideoToFacebook(client, {
      adAccountId: 'act_123',
      sourceInstagramMediaId: '',
    });

    expect(r.status).toBe('failed');
    expect(r.error).toMatch(/sourceInstagramMediaId/);
  });

  it('mengembalikan error kalau Meta tidak kembalikan id', async () => {
    const client = createMockClient({});
    const r = await uploadInstagramVideoToFacebook(client, {
      adAccountId: 'act_123',
      sourceInstagramMediaId: '17912345678901234',
    });

    expect(r.status).toBe('failed');
    expect(r.error).toMatch(/video_id/);
  });

  it('memberi hint scope saat error 403', async () => {
    const client = createMockClient(
      {},
      new MetaApiError({ message: 'Permissions error', code: 403, type: 'OAuthException' })
    );
    const r = await uploadInstagramVideoToFacebook(client, {
      adAccountId: 'act_123',
      sourceInstagramMediaId: '17912345678901234',
      partnershipAdCode: 'abc-123',
    });

    expect(r.status).toBe('failed');
    expect(r.error).toMatch(/scope/);
  });

  it('memanggil endpoint advideos dengan parameter yang benar', async () => {
    const metaPost = vi.fn().mockResolvedValue({ id: 'video-456' });
    const client = { metaPost } as unknown as MetaClient;

    await uploadInstagramVideoToFacebook(client, {
      adAccountId: 'act_123',
      sourceInstagramMediaId: '17912345678901234',
      partnershipAdCode: 'abc-123',
    });

    expect(metaPost).toHaveBeenCalledWith(
      '/act_123/advideos',
      {
        source_instagram_media_id: '17912345678901234',
        is_partnership_ad: true,
        partnership_ad_ad_code: 'abc-123',
      },
      3
    );
  });
});
