import type { MetaClient } from '../metaClient.js';
import { MetaApiError } from '../utils/metaError.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';

export interface UploadInstagramVideoToFacebookOptions {
  adAccountId: string;
  sourceInstagramMediaId: string;
  /** Partnership ad code dari kreator. Opsional tapi sangat direkomendasikan. */
  partnershipAdCode?: string;
  /** Tandai bahwa video ini untuk partnership ad. Default true. */
  isPartnershipAd?: boolean;
}

export interface UploadInstagramVideoToFacebookResult {
  operation: 'upload_instagram_video_to_facebook';
  status: 'uploading' | 'executed' | 'failed';
  video_id?: string;
  source_instagram_media_id: string;
  error?: string;
}

/**
 * Upload video Instagram yang sudah ada ke Facebook ad video library.
 *
 * Meta kadang mengharuskan video Instagram tersedia di Facebook library
 * sebelum bisa dipakai untuk iklan (terutama partnership ads / reels).
 *
 * Endpoint:
 *   POST /act_<AD_ACCOUNT_ID>/advideos
 *   - source_instagram_media_id
 *   - partnership_ad_ad_code (opsional, tapi direkomendasikan)
 *   - is_partnership_ad=true
 *
 * Kalau tidak punya ad code, upload bisa tetap jalan tapi lebih sering ditolak Meta.
 */
export async function uploadInstagramVideoToFacebook(
  client: MetaClient,
  options: UploadInstagramVideoToFacebookOptions
): Promise<UploadInstagramVideoToFacebookResult> {
  const {
    adAccountId,
    sourceInstagramMediaId,
    partnershipAdCode,
    isPartnershipAd = true,
  } = options;

  if (!sourceInstagramMediaId?.trim()) {
    return {
      operation: 'upload_instagram_video_to_facebook',
      status: 'failed',
      source_instagram_media_id: sourceInstagramMediaId ?? '',
      error: 'sourceInstagramMediaId wajib diisi (ID media Instagram yang mau diiklan).',
    };
  }

  const params: Record<string, unknown> = {
    source_instagram_media_id: sourceInstagramMediaId.trim(),
    is_partnership_ad: isPartnershipAd,
  };

  if (partnershipAdCode?.trim()) {
    params.partnership_ad_ad_code = partnershipAdCode.trim();
  }

  try {
    const response = await client.metaPost<{ id?: string }>(
      `/act_${normalizeAccountId(adAccountId)}/advideos`,
      params,
      3
    );

    if (!response?.id) {
      return {
        operation: 'upload_instagram_video_to_facebook',
        status: 'failed',
        source_instagram_media_id: sourceInstagramMediaId,
        error:
          'Meta API tidak mengembalikan video_id. Upload mungkin ditolak atau sedang diproses.',
      };
    }

    return {
      operation: 'upload_instagram_video_to_facebook',
      status: 'uploading',
      video_id: response.id,
      source_instagram_media_id: sourceInstagramMediaId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof MetaApiError) {
      const code = error.code;
      const subcode = error.subcode;
      const hint =
        code === 403 || code === 190
          ? ' Kemungkinan scope token kurang (butuh ads_management + instagram_branded_content_ads_brand + instagram_basic).'
          : code === 100 && subcode === 33
            ? ' Media ID Instagram tidak ditemukan atau sudah dihapus.'
            : '';

      return {
        operation: 'upload_instagram_video_to_facebook',
        status: 'failed',
        source_instagram_media_id: sourceInstagramMediaId,
        error: `${message}.${hint}`,
      };
    }

    return {
      operation: 'upload_instagram_video_to_facebook',
      status: 'failed',
      source_instagram_media_id: sourceInstagramMediaId,
      error: message,
    };
  }
}
