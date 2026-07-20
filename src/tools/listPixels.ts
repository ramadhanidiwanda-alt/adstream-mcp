import type { MetaClient } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import type { MetaPixelResult } from '../broker/types.js';

export interface ListPixelsOptions {
  adAccountId: string;
  limit?: number;
}

interface MetaPixelRaw {
  id: string;
  name?: string;
  last_fired_time?: string;
}

export async function listPixels(
  client: MetaClient,
  options: ListPixelsOptions
): Promise<MetaPixelResult[]> {
  const adAccountId = normalizeAccountId(options.adAccountId);
  const response = await client.metaGet<{ data: MetaPixelRaw[] }>(`/act_${adAccountId}/adspixels`, {
    fields: 'id,name,last_fired_time',
    limit: options.limit ?? 100,
  });

  return (response.data ?? []).map((pixel) => ({
    id: pixel.id,
    name: pixel.name,
    last_fired_time: pixel.last_fired_time,
  }));
}
