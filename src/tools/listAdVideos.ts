import type { MetaClient } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import type { AdVideoResult } from '../broker/types.js';

export interface ListAdVideosOptions {
  adAccountId: string;
  limit?: number;
  cursor?: string;
}

interface AdVideoRaw {
  id: string;
  title?: string;
  source?: string;
  status?: string;
  file_size?: number;
  created_time?: string;
  thumbnails?: { uri?: string };
}

interface AdVideosResponse {
  data: AdVideoRaw[];
  paging?: {
    cursors?: {
      after?: string;
      before?: string;
    };
  };
}

export async function listAdVideos(
  client: MetaClient,
  options: ListAdVideosOptions
): Promise<AdVideoResult[]> {
  const adAccountId = normalizeAccountId(options.adAccountId);

  const fields = ['id', 'title', 'source', 'status', 'file_size', 'created_time', 'thumbnails{uri}'];

  const response = await client.metaGet<AdVideosResponse>(
    `/act_${adAccountId}/advideos`,
    {
      fields: fields.join(','),
      limit: options.limit ?? 25,
      after: options.cursor,
    }
  );

  return (response.data ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    source: item.source,
    status: item.status,
    file_size: item.file_size,
    created_time: item.created_time,
    thumbnail: item.thumbnails?.uri,
  }));
}
