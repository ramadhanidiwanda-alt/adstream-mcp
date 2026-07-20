import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { uploadImage } from '../src/tools/uploadImage.js';
import { uploadVideo } from '../src/tools/uploadVideo.js';

// Regression test: passing accountId with an already-present `act_` prefix
// (the format every list/read tool in this project returns, e.g.
// `act_2086409658377471`) must not produce a doubled `act_act_...` path.

describe('upload account id normalization', () => {
  let tempDir: string;
  let imagePath: string;
  let videoPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adstream-upload-'));
    imagePath = path.join(tempDir, 'poster.png');
    videoPath = path.join(tempDir, 'clip.mp4');
    fs.writeFileSync(imagePath, 'image-fixture');
    fs.writeFileSync(videoPath, 'video-fixture');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('uploadImage does not double-prefix an accountId that already has act_', async () => {
    const metaUploadMultipart = vi
      .fn()
      .mockResolvedValue({ images: { 'poster.png': { hash: 'hash-1', url: 'https://example.com' } } });
    const client = { metaUploadMultipart } as unknown as MetaClient;

    await uploadImage(client, { adAccountId: 'act_2086409658377471', filePath: imagePath });

    expect(metaUploadMultipart).toHaveBeenCalledWith(
      '/act_2086409658377471/adimages',
      imagePath,
      'filename',
      undefined,
      3
    );
  });

  it('uploadImage prepends act_ when given a bare numeric accountId', async () => {
    const metaUploadMultipart = vi
      .fn()
      .mockResolvedValue({ images: { 'poster.png': { hash: 'hash-1', url: 'https://example.com' } } });
    const client = { metaUploadMultipart } as unknown as MetaClient;

    await uploadImage(client, { adAccountId: '2086409658377471', filePath: imagePath });

    expect(metaUploadMultipart).toHaveBeenCalledWith(
      '/act_2086409658377471/adimages',
      imagePath,
      'filename',
      undefined,
      3
    );
  });

  it('uploadVideo does not double-prefix an accountId that already has act_', async () => {
    const metaUploadMultipart = vi.fn().mockResolvedValue({ id: 'video-1' });
    const client = { metaUploadMultipart } as unknown as MetaClient;

    await uploadVideo(client, { adAccountId: 'act_593081075980481', filePath: videoPath });

    expect(metaUploadMultipart).toHaveBeenCalledWith(
      '/act_593081075980481/advideos',
      videoPath,
      'source',
      undefined,
      3
    );
  });
});
