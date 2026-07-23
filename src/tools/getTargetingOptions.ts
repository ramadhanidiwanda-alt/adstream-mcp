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

/** Types Meta exposes directly via /search?type=X (no `class` param). */
const DIRECT_SEARCH_TYPES: Partial<Record<TargetingOptionType, string>> = {
  interests: 'adinterest',
  work_employers: 'adworkemployer',
  work_positions: 'adworkposition',
  // Meta has no separate "job title" search type; work_positions covers it.
  work_job_titles: 'adworkposition',
};

/** Types Meta exposes via /search?type=adTargetingCategory&class=X. */
const CLASS_SEARCH_TYPES: Partial<Record<TargetingOptionType, string>> = {
  behaviors: 'behaviors',
  demographics: 'demographics',
  industries: 'industries',
  life_events: 'life_events',
  family_statuses: 'family_statuses',
  income: 'income',
};

/**
 * Types that aren't searchable at all: Meta represents them as a fixed set of
 * integer codes directly on the targeting spec (e.g. targeting.relationship_statuses),
 * not as an id/name lookup via the targeting search endpoint.
 */
const NOT_SEARCHABLE_TYPES: Partial<Record<TargetingOptionType, string>> = {
  relationship_statuses:
    'relationship_statuses is a fixed set of integer codes set directly on the targeting spec, not searchable via the Meta targeting search API. See Meta Marketing API "Advanced Targeting" docs for the code list.',
  education_statuses:
    'education_statuses is a fixed set of integer codes set directly on the targeting spec, not searchable via the Meta targeting search API. See Meta Marketing API "Advanced Targeting" docs for the code list.',
  college_years:
    'college_years is a fixed set of integer codes set directly on the targeting spec, not searchable via the Meta targeting search API. See Meta Marketing API "Advanced Targeting" docs for the code list.',
};

/**
 * Search Meta targeting options (interests, behaviors, demographics, etc).
 *
 * GET /search?type=adinterest&q={query}
 * GET /search?type=adTargetingCategory&class={class}&q={query}
 * GET /search?type=adworkemployer|adworkposition&q={query}
 *
 * Returns matching targeting options.
 */
export async function getTargetingOptions(
  client: MetaClient,
  options: GetTargetingOptionsOptions
): Promise<GetTargetingOptionsResult> {
  const { type, query, limit = 25 } = options;

  const notSearchableReason = NOT_SEARCHABLE_TYPES[type];
  if (notSearchableReason) {
    throw new Error(notSearchableReason);
  }

  const params: Record<string, unknown> = { limit };
  if (query?.trim()) {
    params.q = query.trim();
  }

  const classValue = CLASS_SEARCH_TYPES[type];
  if (classValue) {
    params.type = 'adTargetingCategory';
    params.class = classValue;
  } else {
    params.type = DIRECT_SEARCH_TYPES[type] ?? 'adinterest';
  }

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
}
