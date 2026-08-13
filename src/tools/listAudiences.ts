import type { MetaClient } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import type { MetaAudienceResult } from '../broker/types.js';

export interface ListAudiencesOptions {
  adAccountId: string;
  limit?: number;
}

interface MetaStatus {
  code?: number;
  description?: string;
}

interface MetaAudienceRaw {
  id: string;
  name?: string;
  subtype?: string;
  approximate_count_lower_bound?: number;
  approximate_count_upper_bound?: number;
  delivery_status?: MetaStatus | string;
  operation_status?: MetaStatus | string;
}

const AUDIENCE_FIELDS =
  'id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status,operation_status';

export async function listAudiences(
  client: MetaClient,
  options: ListAudiencesOptions
): Promise<MetaAudienceResult[]> {
  const adAccountId = normalizeAccountId(options.adAccountId);
  const response = await client.metaGet<{ data?: MetaAudienceRaw[] }>(
    `/act_${adAccountId}/customaudiences`,
    { fields: AUDIENCE_FIELDS, limit: options.limit ?? 100 }
  );

  return (response.data ?? []).map((audience) => ({
    id: audience.id,
    name: audience.name,
    subtype: audience.subtype,
    approximate_count_lower_bound: audience.approximate_count_lower_bound,
    approximate_count_upper_bound: audience.approximate_count_upper_bound,
    delivery_status: describeStatus(audience.delivery_status),
    operation_status: describeStatus(audience.operation_status),
  }));
}

function describeStatus(value: MetaStatus | string | undefined): string | undefined {
  if (typeof value === 'string') return value;
  return value?.description;
}
