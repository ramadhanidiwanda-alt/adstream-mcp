import type { MetaClient } from '../metaClient.js';

export type TargetingOptionType =
  | 'interests' | 'behaviors' | 'demographics' | 'industries'
  | 'life_events' | 'family_statuses' | 'education_statuses'
  | 'college_years' | 'income' | 'relationship_statuses'
  | 'work_employers' | 'work_positions' | 'work_job_titles';

export interface GetTargetingOptionsOptions {
  adAccountId: string;
  type: TargetingOptionType;
  query?: string;
  limit?: number;
  cursor?: string;
}

export interface TargetingOption {
  id: string;
  name: string;
  type: string;
  path?: string[];
  audience_size_lower_bound?: number;
  audience_size_upper_bound?: number;
  description?: string;
  topic?: string;
}

export interface GetTargetingOptionsResult {
  operation: 'get_targeting_options';
  data: TargetingOption[];
  paging: {
    nextCursor: string | null;
  };
}

/**
 * Search Meta targeting options (interests, behaviors, demographics).
 *
 * GET /search?type=adinterest&q={query}
 * GET /act_{id}/targetingbrowse
 *
 * Returns matching targeting options.
 */
export async function getTargetingOptions(
  client: MetaClient,
  options: GetTargetingOptionsOptions
): Promise<GetTargetingOptionsResult> {
  const { adAccountId, type, query, limit = 25 } = options;

  const params: Record<string, unknown> = {
    type: mapTargetingType(type),
    limit,
  };

  if (query?.trim()) {
    params.q = query.trim();
  }

  try {
    const response = await client.metaGet<{
      data: TargetingOption[];
      paging?: { cursors?: { after?: string }; next?: string };
    }>('/search', params);

    return {
      operation: 'get_targeting_options',
      data: response.data ?? [],
      paging: {
        nextCursor: response.paging?.cursors?.after ?? null,
      },
    };
  } catch (error) {
    return {
      operation: 'get_targeting_options',
      data: [],
      paging: { nextCursor: null },
    };
  }
}

function mapTargetingType(type: TargetingOptionType): string {
  const map: Record<TargetingOptionType, string> = {
    interests: 'adinterest',
    behaviors: 'adbehavior',
    demographics: 'addemographic',
    industries: 'adinterest',
    life_events: 'adinterest',
    family_statuses: 'addemographic',
    education_statuses: 'addemographic',
    college_years: 'addemographic',
    income: 'addemographic',
    relationship_statuses: 'addemographic',
    work_employers: 'adinterest',
    work_positions: 'adinterest',
    work_job_titles: 'adinterest',
  };
  return map[type] ?? 'adinterest';
}
