import type { MetaClient } from '../metaClient.js';
import type {
  MetaAdsMode,
  MetaCollaborativeCatalogContext,
  StructuredMutationError,
} from '../types.js';
import { normalizeAccountPath } from '../utils/normalizeAccountId.js';
import { MetaApiError } from '../utils/metaError.js';
import {
  formatMetaWriteError,
  formatStructuredMetaWriteError,
} from '../utils/formatMetaWriteError.js';

export type AdSetStatus = 'ACTIVE' | 'PAUSED';

export type BillingEvent =
  | 'IMPRESSIONS'
  | 'LINK_CLICKS'
  | 'PAGE_LIKES'
  | 'POST_ENGAGEMENT'
  | 'VIDEO_VIEWS'
  | 'LEADS'
  | 'APP_INSTALLS'
  | 'MESSAGE_RESPONSES'
  | 'RSVP'
  | 'THRUPLAY'
  | 'PURCHASE'
  | 'LISTING_INTERACTION'
  | 'OFFSITE_CONVERSIONS'
  | 'ON_INSTALL'
  | 'ONSITE_CONVERSIONS'
  | 'QUALITY_CALL'
  | 'REACH'
  | 'SOCIAL_IMPRESSIONS'
  | 'VALUE'
  | 'LANDING_PAGE_VIEWS';

export type OptimizationGoal =
  | 'NONE'
  | 'APP_INSTALLS'
  | 'APP_INSTALLS_AND_OFFSITE_CONVERSIONS'
  | 'CONVERSATIONS'
  | 'DERIVED_EVENTS'
  | 'ENGAGED_USERS'
  | 'EVENT_RESPONSES'
  | 'IMPRESSIONS'
  | 'LANDING_PAGE_VIEWS'
  | 'LEAD_GENERATION'
  | 'LINK_CLICKS'
  | 'OFFSITE_CONVERSIONS'
  | 'ONSITE_CONVERSIONS'
  | 'PAGE_LIKES'
  | 'POST_ENGAGEMENT'
  | 'QUALITY_CALL'
  | 'REACH'
  | 'SOCIAL_IMPRESSIONS'
  | 'THRUPLAY'
  | 'VALUE'
  | 'VISIT_INSTAGRAM_PROFILE';

export interface AdSetTargeting {
  geoLocations?: {
    countries?: string[];
    regions?: Array<{ key: string; name?: string }>;
    cities?: Array<{ key: string; name?: string }>;
    zips?: Array<{ key: string }>;
    locationTypes?: Array<'home' | 'recent' | 'travel_in' | 'traveling'>;
  };
  ageMin?: number;
  ageMax?: number;
  genders?: number[];
  interests?: Array<{ id: string; name?: string }>;
  behaviors?: Array<{ id: string; name?: string }>;
  customAudiences?: Array<{ id: string }>;
  excludedCustomAudiences?: Array<{ id: string }>;
  publisherPlatforms?: string[];
  facebookPositions?: string[];
  instagramPositions?: string[];
  threadsPositions?: string[];
  messengerPositions?: string[];
  marketplacePositions?: string[];
  devicePlatforms?: string[];
  flexibleSpec?: Array<Record<string, unknown>>;
  exclusions?: Record<string, unknown>;
  targetingOptimization?: string;
  targetingAutomation?: Record<string, unknown>;
  /** Raw targeting override merged in as the base of the outgoing payload; explicit typed fields above win on key conflicts. */
  metaTargetingOverride?: Record<string, unknown>;
}

export interface CreateAdSetOptions {
  adAccountId: string;
  campaignId: string;
  name: string;
  mode?: MetaAdsMode;
  collaborativeCatalog?: MetaCollaborativeCatalogContext;
  status?: AdSetStatus;
  dailyBudget?: number;
  lifetimeBudget?: number;
  billingEvent?: BillingEvent;
  optimizationGoal?: OptimizationGoal;
  bidStrategy?: string;
  /** Bid amount in account currency cents. Required when campaign uses COST_CAP or LOWEST_COST_WITH_BID_CAP. */
  bidAmount?: number;
  /** Bid constraints for LOWEST_COST_WITH_MIN_ROAS. Shape: { roas_average_floor: number } */
  bidConstraints?: Record<string, unknown>;
  targeting?: AdSetTargeting;
  promotedObject?: Record<string, unknown>;
  startTime?: string;
  endTime?: string;
  /** Where users go: WEBSITE, APP, MESSENGER, WHATSAPP, INSTAGRAM_DIRECT, etc. */
  destinationType?: string;
  /** Attribution window spec. Example: [{ event_type: 'CLICK_THROUGH', window_days: 7 }] */
  attributionSpec?: Array<Record<string, unknown>>;
  /** Frequency cap specs. Example: [{ event: 'IMPRESSIONS', interval_days: 7, max_frequency: 3 }] */
  frequencyControlSpecs?: Array<Record<string, unknown>>;
  /** Legacy Meta API compatibility flag; avoid for normal new ads. */
  isDynamicCreative?: boolean;
  /** DSA beneficiary for European compliance (person/org that benefits from ads). Required for EU-targeted ad sets. */
  dsaBeneficiary?: string;
  /** DSA payor for European compliance (person/org paying for the ads). Required for EU-targeted ad sets. */
  dsaPayor?: string;
  /** Multi-Advertiser Ads opt-in (1) or opt-out (0). */
  multiAdvertiserAds?: number;
  dedupeByName?: boolean;
  externalReference?: string;
}

export type CreateAdSetStatus =
  | 'dry_run'
  | 'pending_confirmation'
  | 'executed'
  | 'failed'
  | 'deduped';

export interface CreateAdSetResult {
  operation: 'create_adset';
  status: CreateAdSetStatus;
  executed: boolean;
  preview: Record<string, unknown>;
  id?: string;
  response?: Record<string, unknown>;
  error?: string;
  structuredError?: StructuredMutationError;
}

interface MetaIdResponse extends Record<string, unknown> {
  id?: string;
}

interface CampaignInfo {
  id: string;
  bid_strategy?: string;
  daily_budget?: number;
  lifetime_budget?: number;
}

interface CollaborativeProductSetInfo {
  id?: string;
  name?: string;
  product_catalog?: unknown;
  product_count?: number | string;
}

/** Bid strategies that require bid_amount */
const STRATEGIES_REQUIRING_BID_AMOUNT = ['COST_CAP', 'LOWEST_COST_WITH_BID_CAP', 'TARGET_COST'];

/** Map known Meta error subcodes to human-readable messages */
function mapSubcodeError(subcode: number | undefined, bidStrategy?: string): string | null {
  if (subcode === undefined) return null;
  switch (subcode) {
    case 1815857:
      return `Bid amount required. The campaign uses bid strategy '${bidStrategy || 'LOWEST_COST_WITH_BID_CAP'}' which requires a bidAmount. Add bidAmount (in cents) or remove the ad set-level bid_strategy.`;
    case 1885621:
      return 'bid_amount value is invalid or too low. Ensure bidAmount is a positive integer in account currency cents (e.g., 500000 = Rp5.000).';
    case 2446149:
      return 'Unsupported bid_strategy and bid_amount combination. Try using COST_CAP instead of LOWEST_COST_WITH_BID_CAP.';
    case 2446404:
      return 'Missing required parameter. Ensure billing_event and optimization_goal are set correctly for this campaign objective.';
    default:
      return null;
  }
}

/**
 * Create a Meta ad set under an existing campaign.
 *
 * Dry-run by default: returns preview without calling the API.
 * Set dryRun=false + confirmed=true to execute.
 *
 * Includes pre-flight checks to catch common Meta API errors:
 * - Invalid bid_strategy values (e.g., 'LOWEST_COST')
 * - Missing bidAmount for strategies that require it
 * - Missing bidConstraints for LOWEST_COST_WITH_MIN_ROAS
 * - CBO budget conflict (budget at both campaign and ad set level)
 * - Missing bid_amount when campaign uses a bid strategy that requires it
 *
 * POST /act_{ad_account_id}/adsets
 *
 * Returns ad set ID on success.
 */
export async function createAdSet(
  client: MetaClient,
  options: CreateAdSetOptions,
  execOptions: { dryRun?: boolean; confirmed?: boolean; maxRetries?: number } = {}
): Promise<CreateAdSetResult> {
  const { dryRun = true, confirmed = false, maxRetries = 3 } = execOptions;

  const preview = buildAdSetPayload(options);
  if (options.externalReference) {
    preview.external_reference = options.externalReference;
  }
  const baseResult: CreateAdSetResult = {
    operation: 'create_adset',
    status: 'dry_run',
    executed: false,
    preview,
  };

  const collaborativeProductSetId = options.collaborativeCatalog?.productSetId.trim();
  if (options.mode === 'collaborative_ads' && !collaborativeProductSetId) {
    return {
      ...baseResult,
      status: 'failed',
      error: 'Product set Collaborative Ads wajib diisi.',
      structuredError: validationError(
        'MISSING_COLLABORATIVE_PRODUCT_SET',
        'Product set Collaborative Ads wajib diisi.'
      ),
    };
  }

  const legacyProductSetId = options.promotedObject?.product_set_id;
  if (
    collaborativeProductSetId &&
    typeof legacyProductSetId === 'string' &&
    legacyProductSetId.trim() !== collaborativeProductSetId
  ) {
    return {
      ...baseResult,
      status: 'failed',
      error: 'Product set collaborativeCatalog dan promotedObject harus sama.',
      structuredError: validationError(
        'MISMATCHED_COLLABORATIVE_PRODUCT_SET',
        'Product set collaborativeCatalog dan promotedObject harus sama.'
      ),
    };
  }

  if (!dryRun && !confirmed) {
    return {
      ...baseResult,
      status: 'pending_confirmation',
      error: 'Explicit confirmation is required after reviewing the dry-run preview.',
    };
  }

  // --- CLIENT-SIDE BID STRATEGY VALIDATION ---
  // These checks don't require an API call

  // Check: Invalid 'LOWEST_COST' value (common mistake)
  if (options.bidStrategy === 'LOWEST_COST') {
    return {
      ...baseResult,
      status: 'failed',
      error: `'LOWEST_COST' is not a valid bid_strategy. Use 'LOWEST_COST_WITHOUT_CAP' instead (no bidAmount required).`,
      structuredError: validationError(
        'INVALID_BID_STRATEGY',
        `'LOWEST_COST' is not a valid bid_strategy. Use 'LOWEST_COST_WITHOUT_CAP' instead.`
      ),
    };
  }

  // Check: bid_strategy requiring bid_amount but no bidAmount provided
  if (
    options.bidStrategy &&
    STRATEGIES_REQUIRING_BID_AMOUNT.includes(options.bidStrategy) &&
    options.bidAmount === undefined
  ) {
    return {
      ...baseResult,
      status: 'failed',
      error: `bidAmount is required when bidStrategy is '${options.bidStrategy}'. Add bidAmount (in cents), or change bidStrategy to 'LOWEST_COST_WITHOUT_CAP'.`,
      structuredError: validationError(
        'MISSING_BID_AMOUNT',
        `bidAmount is required when bidStrategy is '${options.bidStrategy}'.`
      ),
    };
  }

  // Check: LOWEST_COST_WITH_MIN_ROAS requires bidConstraints
  if (options.bidStrategy === 'LOWEST_COST_WITH_MIN_ROAS' && options.bidConstraints === undefined) {
    return {
      ...baseResult,
      status: 'failed',
      error: `bidConstraints is required when bidStrategy is 'LOWEST_COST_WITH_MIN_ROAS'. Provide bidConstraints with roas_average_floor (target ROAS × 10000). Example: { roas_average_floor: 20000 } for 2.0x ROAS.`,
      structuredError: validationError(
        'MISSING_BID_CONSTRAINTS',
        `bidConstraints is required when bidStrategy is 'LOWEST_COST_WITH_MIN_ROAS'.`
      ),
    };
  }

  // --- PRE-FLIGHT CHECK: prove the shared retailer product set is readable ---
  if (options.mode === 'collaborative_ads' && collaborativeProductSetId) {
    let productSet: CollaborativeProductSetInfo | undefined;
    try {
      productSet = await client.metaGetObject<CollaborativeProductSetInfo>(
        `/${collaborativeProductSetId}`,
        { fields: 'id,name,product_catalog,product_count' },
        maxRetries
      );
    } catch (error) {
      if (isRetailerProductSetReadPermissionError(error)) {
        productSet = undefined;
      } else {
        const detail = formatMetaWriteError(error);
        const structuredError = formatStructuredMetaWriteError(error);
        return {
          ...baseResult,
          status: 'failed',
          error:
            `Product set Collaborative Ads tidak dapat diakses. ` +
            `Pastikan retailer sudah membagikan product set ini ke akun iklan. Detail Meta: ${detail}`,
          structuredError: {
            ...structuredError,
            provider: 'meta',
            code: 'COLLABORATIVE_PRODUCT_SET_UNAVAILABLE',
            actionableFix:
              'Pastikan product set retailer sudah dibagikan ke akun iklan dan dapat dibaca oleh koneksi Meta ini.',
          },
        };
      }
    }

    if (productSet && productSet.id?.trim() !== collaborativeProductSetId) {
      const message = 'Product set Collaborative Ads tidak dapat diverifikasi dari respons Meta.';
      return {
        ...baseResult,
        status: 'failed',
        error: message,
        structuredError: {
          provider: 'meta',
          code: 'COLLABORATIVE_PRODUCT_SET_UNAVAILABLE',
          message,
          actionableFix:
            'Pastikan product set retailer sudah dibagikan ke akun iklan dan gunakan ID product set yang benar.',
        },
      };
    }

    const productCount = parseOptionalProductCount(productSet?.product_count);
    if (productCount !== undefined && productCount <= 0) {
      const message =
        'Product set Collaborative Ads tidak memiliki produk aktif untuk dipromosikan.';
      return {
        ...baseResult,
        status: 'failed',
        error: message,
        structuredError: {
          provider: 'meta',
          code: 'COLLABORATIVE_PRODUCT_SET_INELIGIBLE',
          message,
          actionableFix:
            'Pastikan product set retailer memiliki minimal satu produk aktif sebelum membuat ad set.',
        },
      };
    }
  }

  // --- PRE-FLIGHT CHECK: fetch campaign data ---
  try {
    const campaign = await client.metaGetObject<CampaignInfo>(
      `/${options.campaignId}`,
      { fields: 'id,bid_strategy,daily_budget,lifetime_budget' },
      maxRetries
    );

    // Check 1: CBO budget conflict
    // Meta doesn't allow budgets at both campaign and ad set level
    const campaignHasBudget = campaign.daily_budget || campaign.lifetime_budget;
    if (
      campaignHasBudget &&
      (options.dailyBudget !== undefined || options.lifetimeBudget !== undefined)
    ) {
      return {
        ...baseResult,
        status: 'failed',
        error: `Budget conflict: campaign '${options.campaignId}' already has a budget (CBO mode). Meta does not allow budgets at both campaign and ad set level. Remove dailyBudget/lifetimeBudget from your ad set — it will automatically use the campaign budget.`,
        structuredError: validationError(
          'BUDGET_CONFLICT',
          `Campaign '${options.campaignId}' already has a budget, so ad-set-level budget is not allowed.`
        ),
      };
    }

    // Check 2: Campaign's bid strategy requires bid_amount on ad set
    const campaignBidStrategy = campaign.bid_strategy;
    if (campaignBidStrategy && STRATEGIES_REQUIRING_BID_AMOUNT.includes(campaignBidStrategy)) {
      if (options.bidAmount === undefined) {
        return {
          ...baseResult,
          status: 'failed',
          error: `bidAmount is required because the parent campaign uses bid_strategy '${campaignBidStrategy}'. Add bidAmount (in account currency cents) to your ad set, or change the campaign's bid_strategy to 'LOWEST_COST_WITHOUT_CAP'.`,
          structuredError: validationError(
            'MISSING_BID_AMOUNT',
            `bidAmount is required because the parent campaign uses bid_strategy '${campaignBidStrategy}'.`
          ),
        };
      }
      // Auto-set bid_strategy to match campaign if user only provided bidAmount
      if (options.bidStrategy === undefined) {
        preview.bid_strategy = campaignBidStrategy;
      }
    }
  } catch (error) {
    return {
      ...baseResult,
      status: 'failed',
      error: formatMetaWriteError(error),
      structuredError: formatStructuredMetaWriteError(error),
    };
  }

  if (dryRun) return baseResult;

  const accountPath = normalizeAccountPath(options.adAccountId);

  if (options.dedupeByName) {
    const existing = await findExistingAdSetByName(
      client,
      options.campaignId,
      options.name,
      maxRetries
    );
    if (existing) {
      return {
        ...baseResult,
        status: 'deduped',
        executed: false,
        id: existing.id,
        response: { deduped: true, existing },
      };
    }
  }

  try {
    const response = await client.metaPost<MetaIdResponse>(
      `${accountPath}/adsets`,
      preview,
      maxRetries
    );

    if (!response.id || typeof response.id !== 'string') {
      return {
        ...baseResult,
        status: 'failed',
        error: 'Meta did not return an id for created ad set',
      };
    }

    return {
      ...baseResult,
      status: 'executed',
      executed: true,
      id: response.id,
      response,
    };
  } catch (error) {
    // Try to extract subcode for better error message
    let errorMsg = formatMetaWriteError(error);
    if (error instanceof MetaApiError) {
      const mapped = mapSubcodeError(error.subcode, preview.bid_strategy as string | undefined);
      if (mapped) {
        errorMsg = `${mapped} (Meta error: ${errorMsg})`;
      }
    }
    return {
      ...baseResult,
      status: 'failed',
      error: errorMsg,
      structuredError: formatStructuredMetaWriteError(error),
    };
  }
}

interface ExistingNamedAdSet extends Record<string, unknown> {
  id: string;
  name?: string;
  status?: string;
}

async function findExistingAdSetByName(
  client: MetaClient,
  campaignId: string,
  name: string,
  maxRetries: number
): Promise<ExistingNamedAdSet | null> {
  const response = await client.metaGet<{ data?: ExistingNamedAdSet[] }>(
    `/${campaignId}/adsets`,
    {
      fields: 'id,name,status',
      limit: 100,
    },
    { maxRetries, paginate: true, maxPages: 20 }
  );

  return response.data?.find((adSet) => adSet.name === name.trim()) ?? null;
}

function validationError(code: string, message: string): StructuredMutationError {
  return {
    code,
    message,
    provider: 'meta',
    actionableFix:
      'Review the dry-run preview and update the invalid ad set input before executing.',
  };
}

function parseOptionalProductCount(value: number | string | undefined): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isRetailerProductSetReadPermissionError(error: unknown): boolean {
  return (
    error instanceof MetaApiError &&
    error.code === 100 &&
    /application has not been approved to use this api/i.test(error.message)
  );
}

function buildAdSetPayload(options: CreateAdSetOptions): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: options.name.trim(),
    campaign_id: options.campaignId,
    status: options.status ?? 'PAUSED',
    billing_event: options.billingEvent ?? 'IMPRESSIONS',
    optimization_goal: options.optimizationGoal ?? 'REACH',
  };

  // Only send bid_strategy if user explicitly specified it
  // Otherwise let Meta inherit from the campaign
  if (options.bidStrategy !== undefined) {
    payload.bid_strategy = options.bidStrategy;
  }

  // Send bid_amount if provided
  if (options.bidAmount !== undefined) {
    payload.bid_amount = options.bidAmount;
  }

  // Send bid_constraints if provided (for LOWEST_COST_WITH_MIN_ROAS)
  if (options.bidConstraints !== undefined) {
    payload.bid_constraints = options.bidConstraints;
  }

  if (options.dailyBudget !== undefined) {
    payload.daily_budget = options.dailyBudget;
  }

  if (options.lifetimeBudget !== undefined) {
    payload.lifetime_budget = options.lifetimeBudget;
  }

  if (options.targeting) {
    payload.targeting = buildTargetingPayload(options.targeting);
  }

  const collaborativePromotedObject = options.collaborativeCatalog
    ? buildCollaborativePromotedObject(options.collaborativeCatalog)
    : undefined;

  if (collaborativePromotedObject || options.promotedObject) {
    payload.promoted_object = collaborativePromotedObject ?? options.promotedObject;
  }

  if (options.startTime) {
    payload.start_time = options.startTime;
  }

  if (options.endTime) {
    payload.end_time = options.endTime;
  }

  // New fields
  if (options.destinationType) {
    payload.destination_type = options.destinationType;
  }

  if (options.attributionSpec) {
    payload.attribution_spec = options.attributionSpec;
  }

  if (options.frequencyControlSpecs) {
    payload.frequency_control_specs = options.frequencyControlSpecs;
  }

  if (options.isDynamicCreative !== undefined) {
    payload.is_dynamic_creative = options.isDynamicCreative;
  }

  if (options.dsaBeneficiary) {
    payload.dsa_beneficiary = options.dsaBeneficiary;
  }

  if (options.dsaPayor) {
    payload.dsa_payor = options.dsaPayor;
  }

  if (options.multiAdvertiserAds !== undefined) {
    payload.multi_advertiser_ads = options.multiAdvertiserAds;
  }

  return payload;
}

function buildCollaborativePromotedObject(
  catalog: MetaCollaborativeCatalogContext
): Record<string, unknown> {
  const productSetId = catalog.productSetId.trim();
  const pixelId = catalog.pixelId?.trim();
  const customEventType = catalog.customEventType?.trim();
  const applicationId = catalog.applicationId?.trim();
  const objectStoreUrls = (catalog.objectStoreUrls ?? []).map((url) => url.trim()).filter(Boolean);

  if (!applicationId) {
    return {
      product_set_id: productSetId,
      ...(pixelId ? { pixel_id: pixelId } : {}),
      ...(customEventType ? { custom_event_type: customEventType } : {}),
    };
  }

  const eventType = customEventType || 'PURCHASE';
  return {
    product_set_id: productSetId,
    smart_pse_enabled: false,
    omnichannel_object: {
      app: [
        {
          application_id: applicationId,
          custom_event_type: eventType,
          ...(objectStoreUrls.length > 0 ? { object_store_urls: objectStoreUrls } : {}),
        },
      ],
      ...(pixelId ? { pixel: [{ pixel_id: pixelId, custom_event_type: eventType }] } : {}),
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Recursively merges `override` on top of `base`. Nested plain objects are merged key-by-key; arrays and primitives in `override` fully replace the corresponding value in `base`. */
function deepMergeTargeting(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = result[key];
    result[key] =
      isPlainObject(baseValue) && isPlainObject(value)
        ? deepMergeTargeting(baseValue, value)
        : value;
  }
  return result;
}

function buildTargetingPayload(targeting: AdSetTargeting): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (targeting.geoLocations) {
    result.geo_locations = targeting.geoLocations;
  }

  if (targeting.ageMin !== undefined) result.age_min = targeting.ageMin;
  if (targeting.ageMax !== undefined) result.age_max = targeting.ageMax;
  if (targeting.genders !== undefined) result.genders = targeting.genders;

  if (targeting.interests !== undefined) result.interests = targeting.interests;
  if (targeting.behaviors !== undefined) result.behaviors = targeting.behaviors;
  if (targeting.customAudiences !== undefined) result.custom_audiences = targeting.customAudiences;
  if (targeting.excludedCustomAudiences !== undefined)
    result.excluded_custom_audiences = targeting.excludedCustomAudiences;
  if (targeting.publisherPlatforms !== undefined)
    result.publisher_platforms = targeting.publisherPlatforms;
  if (targeting.facebookPositions !== undefined)
    result.facebook_positions = targeting.facebookPositions;
  if (targeting.instagramPositions !== undefined)
    result.instagram_positions = targeting.instagramPositions;
  if (targeting.threadsPositions !== undefined)
    result.threads_positions = targeting.threadsPositions;
  if (targeting.messengerPositions !== undefined)
    result.messenger_positions = targeting.messengerPositions;
  if (targeting.marketplacePositions !== undefined)
    result.marketplace_positions = targeting.marketplacePositions;
  if (targeting.devicePlatforms !== undefined) result.device_platforms = targeting.devicePlatforms;
  if (targeting.flexibleSpec !== undefined) result.flexible_spec = targeting.flexibleSpec;
  if (targeting.exclusions !== undefined) result.exclusions = targeting.exclusions;
  if (targeting.targetingOptimization !== undefined)
    result.targeting_optimization = targeting.targetingOptimization;

  if (targeting.targetingAutomation !== undefined) {
    result.targeting_automation = targeting.targetingAutomation;
  }

  // Meta API v24+ requires targeting_automation.advantage_audience
  // Default to 0 (disabled) when user provides custom targeting
  if (!('targeting_automation' in result)) {
    result.targeting_automation = { advantage_audience: 0 };
  }

  if (targeting.metaTargetingOverride) {
    return deepMergeTargeting(targeting.metaTargetingOverride, result);
  }

  return result;
}
