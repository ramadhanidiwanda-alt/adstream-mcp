import type { MetaClient } from '../metaClient.js';
import { listPages } from './listPages.js';
import { MetaApiError } from '../utils/metaError.js';

export interface ThreadsProfileResult {
  threadsId: string;
  username: string;
  name: string;
  profilePic?: string;
  pageId: string;
  pageName: string;
}

export interface ThreadsProfileListResult {
  profiles: ThreadsProfileResult[];
  /**
   * Non-fatal problems encountered while enumerating. A permission failure and a
   * genuine absence both produce an empty profile list, and only this field tells
   * them apart.
   */
  warnings: string[];
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
): Promise<ThreadsProfileListResult> {
  const pages = await listPages(client, { limit: options.limit });
  const results: ThreadsProfileResult[] = [];
  const warnings: string[] = [];
  let warnedForPermission = false;

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
    } catch (error) {
      // A page with no Threads profile and a token that cannot see Threads
      // profiles both land here. Only the first is a genuine "none". A missing
      // scope applies identically to every page, so warn once rather than once
      // per page (30 pages with the same missing scope should read as ONE
      // problem, not 30 copies of the same message).
      if (isThreadsPermissionError(error) && !warnedForPermission) {
        warnedForPermission = true;
        warnings.push(
          `Page ${page.id} (${page.name}): Meta menolak pembacaan threads_profile — token kemungkinan belum punya scope threads_business_basic. Hasil kosong di sini BUKAN berarti tidak ada Threads profile.`
        );
      }
      continue;
    }
  }

  return { profiles: results, warnings };
}

function isThreadsPermissionError(error: unknown): boolean {
  if (!(error instanceof MetaApiError)) return false;
  return (
    [3, 10, 200].includes(error.code) ||
    error.type === 'OAuthException' ||
    /permission|scope|not authorized|threads_business/i.test(
      [error.message, error.userTitle, error.userMessage].filter(Boolean).join(' ')
    )
  );
}
