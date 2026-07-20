import fs from 'node:fs';
import type { MetaClient } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';

const MAX_VIDEO_SIZE_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB
const LARGE_VIDEO_WARN_BYTES = 100 * 1024 * 1024; // 100 MB
const ALLOWED_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.wmv']);

export interface UploadVideoOptions {
  adAccountId: string;
  filePath: string;
  title?: string;
  description?: string;
  maxRetries?: number;
}

export interface UploadVideoResult {
  operation: 'upload_video';
  status: 'uploading' | 'executed' | 'failed';
  video_id?: string;
  title?: string;
  error?: string;
  warnings?: string[];
}

/**
 * Upload a local video file to Meta Ads Video Library.
 *
 * POST /act_{ad_account_id}/advideos with multipart/form-data
 *
 * Meta response:
 * { "id": "video_id" }
 *
 * Returns video_id on success.
 * Meta processes videos asynchronously; status 'uploading' means
 * upload succeeded but video may still be processing.
 * Throws on file validation errors or Meta API errors.
 */
export async function uploadVideo(
  client: MetaClient,
  options: UploadVideoOptions
): Promise<UploadVideoResult> {
  const { adAccountId, filePath, title, description, maxRetries = 3 } = options;

  // Basic file validation
  const validation = validateVideoFile(filePath);
  if (validation.error) {
    return {
      operation: 'upload_video',
      status: 'failed',
      error: validation.error,
    };
  }

  // Build additional fields
  const additionalFields: Record<string, string> = {};
  if (title?.trim()) additionalFields.title = title.trim();
  if (description?.trim()) additionalFields.description = description.trim();

  try {
    const response = await client.metaUploadMultipart<{ id?: string }>(
      `/act_${normalizeAccountId(adAccountId)}/advideos`,
      filePath,
      'source',
      Object.keys(additionalFields).length > 0 ? additionalFields : undefined,
      maxRetries
    );

    if (!response?.id) {
      return {
        operation: 'upload_video',
        status: 'failed',
        error: 'Meta API did not return video_id',
      };
    }

    const result: UploadVideoResult = {
      operation: 'upload_video',
      status: 'uploading',
      video_id: response.id,
      title: title?.trim(),
    };

    if (validation.warning) {
      result.warnings = [validation.warning];
    }

    return result;
  } catch (error) {
    return {
      operation: 'upload_video',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

interface VideoValidationResult {
  error: string | null;
  warning: string | null;
}

function validateVideoFile(filePath: string): VideoValidationResult {
  if (!fs.existsSync(filePath)) {
    return { error: `File not found: ${filePath}`, warning: null };
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return { error: `Path is not a file: ${filePath}`, warning: null };
  }

  if (stat.size === 0) {
    return { error: `File is empty: ${filePath}`, warning: null };
  }

  if (stat.size > MAX_VIDEO_SIZE_BYTES) {
    const sizeGB = (stat.size / (1024 * 1024 * 1024)).toFixed(1);
    return { error: `File too large (${sizeGB} GB). Maximum is 1 GB.`, warning: null };
  }

  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
  if (!ALLOWED_VIDEO_EXTENSIONS.has(ext)) {
    return { error: `Unsupported file extension: ${ext}. Allowed: .mp4, .mov, .avi, .wmv`, warning: null };
  }

  let warning: string | null = null;
  if (stat.size > LARGE_VIDEO_WARN_BYTES) {
    const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
    warning = `File is large (${sizeMB} MB). Upload may take a while and video processing is async.`;
  }

  return { error: null, warning };
}
