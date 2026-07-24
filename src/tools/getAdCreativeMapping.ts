import type { MetaClient } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import {
  buildMetaIdFilteringRules,
  mergeMetaFilteringRules,
  resolveAdsEdgeScope,
  filterAdsByEntityScope,
  type MetaFilteringRule,
} from '../utils/metaFiltering.js';

export interface AdCreativeMappingOptions {
  adAccountId: string;
  /** Optional: filter by specific ad IDs */
  adIds?: string[];
  /** Optional: restrict results to a specific campaign (server-side filter). */
  campaignId?: string | string[];
  /** Optional: restrict results to a specific ad set (server-side filter). */
  adSetId?: string | string[];
  /** Caller-supplied Meta filtering rules, merged with campaignId/adSetId. */
  explicitFilters?: MetaFilteringRule[];
  limit?: number;
  cursor?: string;
}

export interface AdCreativeMapping {
  ad_id: string;
  ad_name?: string;
  creative_id?: string;
}

export type AdCreativeMappingPage = AdCreativeMapping[] & {
  paging?: { cursors?: { after?: string } };
};

interface MetaAdWithCreative {
  id?: string;
  name?: string;
  campaign_id?: string;
  adset_id?: string;
  creative?: { id?: string };
}

/**
 * Fetch ad → creative_id mapping from Meta Ads API.
 * Uses `/act_{id}/ads` — or the nested `/{campaign_id}/ads` / `/{adset_id}/ads`
 * edge when scoped to a single campaign or ad set, since Meta does not
 * support scoping the account-level `/ads` edge via `filtering` (see
 * `resolveAdsEdgeScope`) — with `fields=id,name,creative{id}`. This is a
 * metadata endpoint, NOT the insights endpoint, so it doesn't need
 * `creative_id` at level=ad.
 */
export async function getAdCreativeMapping(
  client: MetaClient,
  options: AdCreativeMappingOptions
): Promise<AdCreativeMappingPage> {
  const { adIds, campaignId, adSetId, explicitFilters, limit = 100, cursor } = options;
  const adAccountId = normalizeAccountId(options.adAccountId);

  const fields = 'id,name,campaign_id,adset_id,creative{id}';
  const { path, needsPostFilter } = resolveAdsEdgeScope(adAccountId, campaignId, adSetId);
  const params: Record<string, string | number> = {
    fields,
    limit,
  };

  const filtering = mergeMetaFilteringRules(
    buildMetaIdFilteringRules([{ field: 'id', value: adIds }]),
    explicitFilters
  );
  if (filtering) {
    params.filtering = JSON.stringify(filtering);
  }

  if (cursor) {
    params.after = cursor;
  }

  const response = await client.metaGet<{
    data: MetaAdWithCreative[];
    paging?: { cursors?: { after?: string } };
  }>(path, params);

  const rawAds = response.data || [];
  const ads = needsPostFilter
    ? filterAdsByEntityScope(
        rawAds,
        campaignId,
        adSetId,
        (ad) => ad.campaign_id,
        (ad) => ad.adset_id
      )
    : rawAds;

  const result: AdCreativeMapping[] = ads.map((ad) => ({
    ad_id: ad.id ?? '',
    ad_name: ad.name,
    creative_id: ad.creative?.id,
  }));

  return Object.assign(result, { paging: response.paging }) as AdCreativeMappingPage;
}
