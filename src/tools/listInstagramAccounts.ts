import type { MetaClient } from '../metaClient.js';
import { listPages } from './listPages.js';

export interface InstagramAccountResult {
  igId: string;
  username: string;
  name: string;
  profilePic?: string;
  pageId: string;
  pageName: string;
}

/**
 * List Instagram Business Accounts connected to the user's Facebook Pages.
 *
 * Calls GET /me/accounts → for each page GET /{page-id}?fields=instagram_business_account
 *
 * Returns IG accounts with their connected Page info.
 */
export async function listInstagramAccounts(
  client: MetaClient,
  options: { limit?: number } = {}
): Promise<InstagramAccountResult[]> {
  const pages = await listPages(client, { limit: options.limit });
  const results: InstagramAccountResult[] = [];

  for (const page of pages) {
    try {
      const igResponse = await client.metaGetObject<{
        instagram_business_account?: {
          id: string;
          username?: string;
          name?: string;
          profile_picture_url?: string;
        };
      }>(`/${page.id}`, {
        fields: 'instagram_business_account{id,username,name,profile_picture_url}',
      });

      const igAccount = igResponse?.instagram_business_account;
      if (igAccount?.id) {
        results.push({
          igId: igAccount.id,
          username: igAccount.username ?? '',
          name: igAccount.name ?? igAccount.username ?? '',
          profilePic: igAccount.profile_picture_url,
          pageId: page.id,
          pageName: page.name,
        });
      }
    } catch {
      // Skip pages that don't have a connected IG account
      continue;
    }
  }

  return results;
}
