import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TikTokApiClient } from '../src/tiktokClient.js';
import { uploadTikTokImage, uploadTikTokVideo } from '../src/tools/tiktok/uploadTikTokMedia.js';

describe('TikTokApiClient.postMultipart', () => {
  let tmpFile: string;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `tiktok-upload-test-${Date.now()}.jpg`);
    fs.writeFileSync(tmpFile, Buffer.from('fake-image-bytes'));
  });

  afterEach(() => {
    fs.rmSync(tmpFile, { force: true });
  });

  it('sends multipart form data with the file, signature, and advertiser_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        code: 0,
        message: 'OK',
        data: { image_id: 'img_1', image_url: 'https://example.com/img_1' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new TikTokApiClient({ accessToken: 'token_123' });
    const result = await client.postMultipart(
      '/file/image/ad/upload/',
      {
        advertiser_id: 'adv_1',
        upload_type: 'UPLOAD_BY_FILE',
      },
      { fieldName: 'image_file', filePath: tmpFile, signatureFieldName: 'image_signature' }
    );

    expect(result).toEqual({ image_id: 'img_1', image_url: 'https://example.com/img_1' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    const formData = init.body as FormData;
    expect(formData.get('advertiser_id')).toBe('adv_1');
    expect(formData.get('upload_type')).toBe('UPLOAD_BY_FILE');
    expect(formData.get('image_signature')).toBeTruthy();
    expect(formData.get('image_file')).toBeTruthy();

    vi.unstubAllGlobals();
  });

  it('throws TikTokApiError when the API returns a non-zero code', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ code: 40001, message: 'Invalid advertiser_id' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new TikTokApiClient({ accessToken: 'token_123' });
    await expect(
      client.postMultipart(
        '/file/image/ad/upload/',
        { advertiser_id: 'bad' },
        { fieldName: 'image_file', filePath: tmpFile, signatureFieldName: 'image_signature' }
      )
    ).rejects.toThrow('TikTok API error 40001');

    vi.unstubAllGlobals();
  });
});

describe('uploadTikTokImage / uploadTikTokVideo', () => {
  let tmpFile: string;
  let tmpVideoFile: string;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `tiktok-upload-media-test-${Date.now()}.jpg`);
    fs.writeFileSync(tmpFile, Buffer.from('fake-image-bytes'));
    tmpVideoFile = path.join(os.tmpdir(), `tiktok-upload-media-test-${Date.now()}.mp4`);
    fs.writeFileSync(tmpVideoFile, Buffer.from('fake-video-bytes'));
  });

  afterEach(() => {
    fs.rmSync(tmpFile, { force: true });
    fs.rmSync(tmpVideoFile, { force: true });
  });

  it('uploadTikTokImage returns image_id on success', async () => {
    const client = {
      postMultipart: vi
        .fn()
        .mockResolvedValue({ image_id: 'img_1', image_url: 'https://example.com/img_1' }),
    } as unknown as TikTokApiClient;

    const result = await uploadTikTokImage(client, { advertiserId: 'adv_1', filePath: tmpFile });
    expect(result.status).toBe('executed');
    expect(result.image_id).toBe('img_1');
  });

  it('uploadTikTokImage fails validation for a missing file', async () => {
    const client = { postMultipart: vi.fn() } as unknown as TikTokApiClient;
    const result = await uploadTikTokImage(client, {
      advertiserId: 'adv_1',
      filePath: '/nonexistent/file.jpg',
    });
    expect(result.status).toBe('failed');
    expect(client.postMultipart).not.toHaveBeenCalled();
  });

  it('uploadTikTokVideo returns video_id on success', async () => {
    const client = {
      postMultipart: vi.fn().mockResolvedValue({ video_id: 'vid_1' }),
    } as unknown as TikTokApiClient;

    const result = await uploadTikTokVideo(client, {
      advertiserId: 'adv_1',
      filePath: tmpVideoFile,
    });
    expect(result.status).toBe('executed');
    expect(result.video_id).toBe('vid_1');
  });
});
