import fs from 'node:fs';
import pathModule from 'node:path';
import type { MetaClient } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';

const MAX_IMAGE_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

export interface UploadImageOptions {
  adAccountId: string;
  filePath: string;
  maxRetries?: number;
}

export interface UploadImageResult {
  operation: 'upload_image';
  status: 'executed' | 'failed';
  image_hash?: string;
  url?: string;
  filename?: string;
  error?: string;
}

/**
 * Upload a local image file to Meta Ads Image Library.
 *
 * POST /act_{ad_account_id}/adimages with multipart/form-data
 *
 * Meta response:
 * { "images": { "filename.jpg": { "hash": "...", "url": "..." } } }
 *
 * Returns image_hash and url on success.
 * Throws on file validation errors or Meta API errors.
 */
export async function uploadImage(
  client: MetaClient,
  options: UploadImageOptions
): Promise<UploadImageResult> {
  const { adAccountId, filePath, maxRetries = 3 } = options;

  // Basic file validation
  const validationError = validateImageFile(filePath);
  if (validationError) {
    return {
      operation: 'upload_image',
      status: 'failed',
      error: validationError,
    };
  }

  try {
    const response = await client.metaUploadMultipart<{
      images?: Record<string, { hash?: string; url?: string }>;
    }>(
      `/act_${normalizeAccountId(adAccountId)}/adimages`,
      filePath,
      'filename',
      undefined,
      maxRetries
    );

    const images = response?.images;
    if (!images) {
      return {
        operation: 'upload_image',
        status: 'failed',
        error: 'Meta API did not return images payload',
      };
    }

    // Meta returns images keyed by filename
    const filenames = Object.keys(images);
    if (filenames.length === 0) {
      return {
        operation: 'upload_image',
        status: 'failed',
        error: 'Meta API returned empty images payload',
      };
    }

    const firstImage = images[filenames[0]];
    if (!firstImage?.hash) {
      return {
        operation: 'upload_image',
        status: 'failed',
        error: 'Meta API did not return image_hash',
      };
    }

    return {
      operation: 'upload_image',
      status: 'executed',
      image_hash: firstImage.hash,
      url: firstImage.url,
      filename: filenames[0],
    };
  } catch (error) {
    return {
      operation: 'upload_image',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function validateImageFile(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return `File not found: ${filePath}`;
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return `Path is not a file: ${filePath}`;
  }

  if (stat.size === 0) {
    return `File is empty: ${filePath}`;
  }

  if (stat.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
    return `File too large (${sizeMB} MB). Maximum is 30 MB.`;
  }

  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return `Unsupported file extension: ${ext}. Allowed: .jpg, .jpeg, .png`;
  }

  return null;
}
