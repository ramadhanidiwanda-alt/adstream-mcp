import type { MetaClient } from '../metaClient.js';
import { listPages } from './listPages.js';

export interface ThreadsProfileResult {
  threadsId: string;
  username: string;
  name: string;
  profilePic?: string;
  pageId: string;
  pageName: string;
}

/**
 * List Threads profiles connected to the user's Facebook Pages.
 *
 * Calls GET /me/accounts → for each page GET /{page-id}?fields=threads_profile
 *
 * Returns Threads profiles with their connected Page info.
 */
export async function listThreadsProfiles(
  client: MetaClient,
  options: { limit?: number } = {}
): Promise<ThreadsProfileResult[]> {
  const pages = await listPages(client, { limit: options.limit });
  const results: ThreadsProfileResult[] = [];

  for (const page of pages) {
    try {
      const threadsResponse = await client.metaGetObject<{
        threads_profile?: {
          id: string;
          username?: string;
          name?: string;
          profile_picture_url?: string;
        };
      }>(`/${page.id}`, {
        fields: 'threads_profile{id,username,name,profile_picture_url}',
      });

      const tp = threadsResponse?.threads_profile;
      if (tp?.id) {
        results.push({
          threadsId: tp.id,
          username: tp.username ?? '',
          name: tp.name ?? tp.username ?? '',
          profilePic: tp.profile_picture_url,
          pageId: page.id,
          pageName: page.name,
        });
      }
    } catch {
      // Skip pages that don't have a connected Threads profile
      continue;
    }
  }

  return results;
}
