import type { MetaClient } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import type { AdImageResult } from '../broker/types.js';

export interface ListAdImagesOptions {
  adAccountId: string;
}

interface AdImageRaw {
  hash: string;
  url: string;
  width: number;
  height: number;
  name?: string;
  creatives_count?: number;
}

interface AdImagesResponse {
  data: AdImageRaw[];
}

export async function listAdImages(
  client: MetaClient,
  options: ListAdImagesOptions
): Promise<AdImageResult[]> {
  const adAccountId = normalizeAccountId(options.adAccountId);

  const fields = ['hash', 'url', 'width', 'height', 'name', 'creatives_count'];

  const response = await client.metaGet<AdImagesResponse>(
    `/act_${adAccountId}/adimages`,
    { fields: fields.join(',') }
  );

  return (response.data ?? []).map((item) => ({
    hash: item.hash,
    url: item.url,
    width: item.width,
    height: item.height,
    name: item.name,
    creatives_count: item.creatives_count,
  }));
}
