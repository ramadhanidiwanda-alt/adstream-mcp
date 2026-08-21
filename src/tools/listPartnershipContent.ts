import type { MetaClient } from '../metaClient.js';
import type {
  PartnershipContentAuthor,
  PartnershipContentInsights,
  PartnershipContentPartnerInfo,
  PartnershipContentResult,
} from '../broker/types.js';

export interface ListPartnershipContentOptions {
  /** Meta Business ID pemilik Page/akun IG brand. */
  businessId: string;
  fbPageId?: string;
  igUserId?: string;
  creatorUsername?: string;
  /** Maksimal 50 ad code. Direct lookup — tidak bisa digabung filter/cursor. */
  adCodes?: string[];
  /**
   * URL permalink Instagram/Facebook yang dikirim kreator atau klien, maksimal
   * 50. Direct lookup: Meta menolak bila digabung dengan filter, sort, atau
   * pagination cursor, dan hanya satu jenis direct lookup boleh per panggilan.
   */
  permalinks?: string[];
  platform?: string;
  mediaType?: string;
  postType?: string;
  /** 1-50, default 25. */
  limit?: number;
  cursor?: string;
  maxRetries?: number;
}

interface PartnershipContentRaw {
  content_id: string;
  platform?: string;
  media_type?: string;
  post_type?: string;
  caption?: string;
  permalink?: string;
  creation_time?: string;
  author?: {
    display_name?: string;
    ig_user_id?: string;
    fb_page_id?: string;
    profile_picture_url?: string;
  };
  is_recommended?: boolean;
  ad_usage?: string;
  partnership_info?: Array<{
    ad_eligibility?: string;
    tagged_partner?: Record<string, unknown>;
    permission_status?: string;
    permission_type?: string;
    ad_code?: string;
    content_types?: string[];
  }>;
  organic_insights?: {
    likes?: number | null;
    comments?: number | null;
    views?: number | null;
    reach?: number | null;
    shares?: number | null;
    interaction?: number | null;
    saves?: number | null;
  };
}

/**
 * Hanya content_id yang dikembalikan Meta secara default; semua field lain harus
 * diminta eksplisit lewat parameter fields, termasuk sub-field bersarang.
 */
const PARTNERSHIP_CONTENT_FIELDS = [
  'content_id',
  'platform',
  'media_type',
  'post_type',
  'caption',
  'permalink',
  'creation_time',
  'author{display_name,ig_user_id,fb_page_id,profile_picture_url}',
  'is_recommended',
  'ad_usage',
  'partnership_info{ad_eligibility,tagged_partner,permission_status,permission_type,ad_code,content_types}',
  'organic_insights{likes,comments,views,reach,shares,interaction,saves}',
].join(',');

const PERMALINK_PATTERN = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:instagram|facebook)\.com\//i;

function toAuthor(raw: PartnershipContentRaw['author']): PartnershipContentAuthor | undefined {
  if (!raw) return undefined;
  return {
    displayName: raw.display_name,
    igUserId: raw.ig_user_id,
    fbPageId: raw.fb_page_id,
    profilePictureUrl: raw.profile_picture_url,
  };
}

function toPartnershipInfo(
  raw: PartnershipContentRaw['partnership_info']
): PartnershipContentPartnerInfo[] | undefined {
  if (!raw) return undefined;
  return raw.map((entry) => ({
    adEligibility: entry.ad_eligibility,
    taggedPartner: entry.tagged_partner,
    permissionStatus: entry.permission_status,
    permissionType: entry.permission_type,
    adCode: entry.ad_code,
    contentTypes: entry.content_types,
  }));
}

function toInsights(
  raw: PartnershipContentRaw['organic_insights']
): PartnershipContentInsights | undefined {
  if (!raw) return undefined;
  return {
    likes: raw.likes,
    comments: raw.comments,
    views: raw.views,
    reach: raw.reach,
    shares: raw.shares,
    interaction: raw.interaction,
    saves: raw.saves,
  };
}

function toResult(raw: PartnershipContentRaw): PartnershipContentResult {
  const result: PartnershipContentResult = { contentId: raw.content_id };
  if (raw.platform !== undefined) result.platform = raw.platform;
  if (raw.media_type !== undefined) result.mediaType = raw.media_type;
  if (raw.post_type !== undefined) result.postType = raw.post_type;
  if (raw.caption !== undefined) result.caption = raw.caption;
  if (raw.permalink !== undefined) result.permalink = raw.permalink;
  if (raw.creation_time !== undefined) result.creationTime = raw.creation_time;
  if (raw.is_recommended !== undefined) result.isRecommended = raw.is_recommended;
  if (raw.ad_usage !== undefined) result.adUsage = raw.ad_usage;

  const author = toAuthor(raw.author);
  if (author) result.author = author;
  const partnershipInfo = toPartnershipInfo(raw.partnership_info);
  if (partnershipInfo) result.partnershipInfo = partnershipInfo;
  const organicInsights = toInsights(raw.organic_insights);
  if (organicInsights) result.organicInsights = organicInsights;

  return result;
}

/**
 * Discovery konten kemitraan (branded content, UGC, affiliate, Collab) lintas
 * Instagram dan Facebook lewat satu endpoint.
 *
 * Calls GET /{business-id}/partnership-ads-advertisable-content
 *
 * Endpoint ini menggantikan /{ig-user-id}/branded_content_advertisable_medias dan
 * /partnership-ads/{sponsor-page-id}/advertisable-posts, yang dihapus Meta pada
 * 1 Desember 2026.
 *
 * https://developers.facebook.com/documentation/ads-commerce/marketing-api/ad-creative/partnership-ads/content-discovery-api
 */
export async function listPartnershipContent(
  client: MetaClient,
  options: ListPartnershipContentOptions
): Promise<PartnershipContentResult[]> {
  const businessId = options.businessId?.trim();
  if (!businessId) throw new Error('businessId wajib diisi.');

  const fbPageId = options.fbPageId?.trim();
  const igUserId = options.igUserId?.trim();
  if (!fbPageId && !igUserId) {
    throw new Error(
      'Isi minimal satu dari fbPageId atau igUserId. Bila keduanya diisi, kedua akun harus sudah ter-link.'
    );
  }

  const adCodes = options.adCodes?.length ? options.adCodes : undefined;
  const permalinks = options.permalinks?.length ? options.permalinks : undefined;

  if (adCodes && adCodes.length > 50) {
    throw new Error('adCodes maksimal 50 entri per panggilan.');
  }
  if (permalinks && permalinks.length > 50) {
    throw new Error('permalinks maksimal 50 entri per panggilan.');
  }

  // Meta membagi parameter jadi dua mode yang tidak boleh dicampur: direct
  // lookup (content_ids / permalinks / ad_codes, maksimal satu jenis) dan search
  // query (filter + sort + pagination). Dicampur, Meta menolak permintaannya —
  // jadi ditahan di sini supaya pesannya jelas, bukan berupa error Graph mentah.
  if (adCodes && permalinks) {
    throw new Error(
      'adCodes dan permalinks adalah direct lookup; hanya satu yang boleh diisi per panggilan.'
    );
  }

  if (permalinks) {
    const invalid = permalinks.filter((url) => !PERMALINK_PATTERN.test(url.trim()));
    if (invalid.length) {
      throw new Error(
        `permalinks harus URL lengkap instagram.com atau facebook.com. Tidak valid: ${invalid.join(', ')}`
      );
    }

    const conflicting = [
      options.creatorUsername?.trim() ? 'creatorUsername' : undefined,
      options.platform ? 'platform' : undefined,
      options.mediaType ? 'mediaType' : undefined,
      options.postType ? 'postType' : undefined,
      options.cursor?.trim() ? 'cursor' : undefined,
    ].filter((name): name is string => Boolean(name));
    if (conflicting.length) {
      throw new Error(
        `permalinks tidak bisa digabung dengan filter atau pagination: ${conflicting.join(', ')}.`
      );
    }
  }

  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 50)
  ) {
    throw new Error('limit harus bilangan bulat 1-50.');
  }

  const directLookup = Boolean(permalinks);

  const response = await client.metaGet<{ data: PartnershipContentRaw[] }>(
    `/${businessId}/partnership-ads-advertisable-content`,
    {
      fields: PARTNERSHIP_CONTENT_FIELDS,
      fb_page_id: fbPageId,
      ig_user_id: igUserId,
      creator_username: options.creatorUsername?.trim() || undefined,
      ad_codes: adCodes?.join(','),
      permalinks: permalinks?.map((url) => url.trim()).join(','),
      platform: options.platform,
      media_type: options.mediaType,
      post_type: options.postType,
      limit: directLookup ? undefined : (options.limit ?? 25),
      after: directLookup ? undefined : options.cursor,
    },
    { maxRetries: options.maxRetries ?? 3 }
  );

  return (response.data ?? []).map(toResult);
}
