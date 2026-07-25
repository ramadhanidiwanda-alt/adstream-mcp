import fs from 'node:fs';
import type { TikTokApiClient } from '../../tiktokClient.js';

const MAX_IMAGE_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB, matches Meta's cap for parity
const MAX_VIDEO_SIZE_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);
const ALLOWED_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov']);

export interface UploadTikTokImageOptions {
  advertiserId: string;
  filePath: string;
}

export interface UploadTikTokImageResult {
  operation: 'upload_image';
  status: 'executed' | 'failed';
  image_id?: string;
  image_url?: string;
  filename?: string;
  error?: string;
}

export interface UploadTikTokVideoOptions {
  advertiserId: string;
  filePath: string;
}

export interface UploadTikTokVideoResult {
  operation: 'upload_video';
  status: 'executed' | 'failed';
  video_id?: string;
  filename?: string;
  error?: string;
}

/**
 * Upload a local image file to TikTok's ad account.
 * POST /file/image/ad/upload/ (multipart/form-data)
 */
export async function uploadTikTokImage(
  client: TikTokApiClient,
  options: UploadTikTokImageOptions
): Promise<UploadTikTokImageResult> {
  const validationError = validateFile(
    options.filePath,
    ALLOWED_IMAGE_EXTENSIONS,
    MAX_IMAGE_SIZE_BYTES
  );
  if (validationError) {
    return { operation: 'upload_image', status: 'failed', error: validationError };
  }

  try {
    const data = await client.postMultipart<{ image_id?: string; image_url?: string }>(
      '/file/image/ad/upload/',
      { advertiser_id: options.advertiserId, upload_type: 'UPLOAD_BY_FILE' },
      { fieldName: 'image_file', filePath: options.filePath, signatureFieldName: 'image_signature' }
    );

    if (!data.image_id) {
      return {
        operation: 'upload_image',
        status: 'failed',
        error: 'TikTok API did not return image_id',
      };
    }

    return {
      operation: 'upload_image',
      status: 'executed',
      image_id: data.image_id,
      image_url: data.image_url,
      filename: options.filePath.split('/').pop(),
    };
  } catch (error) {
    return {
      operation: 'upload_image',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Upload a local video file to TikTok's ad account.
 * POST /file/video/ad/upload/ (multipart/form-data)
 */
export async function uploadTikTokVideo(
  client: TikTokApiClient,
  options: UploadTikTokVideoOptions
): Promise<UploadTikTokVideoResult> {
  const validationError = validateFile(
    options.filePath,
    ALLOWED_VIDEO_EXTENSIONS,
    MAX_VIDEO_SIZE_BYTES
  );
  if (validationError) {
    return { operation: 'upload_video', status: 'failed', error: validationError };
  }

  try {
    const data = await client.postMultipart<{ video_id?: string }>(
      '/file/video/ad/upload/',
      { advertiser_id: options.advertiserId, upload_type: 'UPLOAD_BY_FILE' },
      { fieldName: 'video_file', filePath: options.filePath, signatureFieldName: 'video_signature' }
    );

    if (!data.video_id) {
      return {
        operation: 'upload_video',
        status: 'failed',
        error: 'TikTok API did not return video_id',
      };
    }

    return {
      operation: 'upload_video',
      status: 'executed',
      video_id: data.video_id,
      filename: options.filePath.split('/').pop(),
    };
  } catch (error) {
    return {
      operation: 'upload_video',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function validateFile(
  filePath: string,
  allowedExtensions: Set<string>,
  maxSizeBytes: number
): string | null {
  if (!fs.existsSync(filePath)) return `File not found: ${filePath}`;

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) return `Path is not a file: ${filePath}`;
  if (stat.size === 0) return `File is empty: ${filePath}`;
  if (stat.size > maxSizeBytes) {
    const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
    return `File too large (${sizeMB} MB).`;
  }

  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
  if (!allowedExtensions.has(ext)) {
    return `Unsupported file extension: ${ext}. Allowed: ${[...allowedExtensions].join(', ')}`;
  }

  return null;
}
