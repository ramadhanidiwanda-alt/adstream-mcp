import { MetaClient, loadConfig } from '../src/index.js';
import { listInstagramAccounts } from '../src/tools/listInstagramAccounts.js';
import { listInstagramMedia } from '../src/tools/listInstagramMedia.js';

// Live, read-only verification for ads_list_instagram_media against a fixed
// test account. Requires META_ACCESS_TOKEN and META_TEST_IG_USER_ID (plus
// META_TEST_PAGE_ID for the page-token fallback check) in .env — never commit
// real values there, .env is gitignored.

function redact(value: string): string {
  return value.replace(/EA[A-Za-z0-9_-]+/g, '[REDACTED]').replace(/act_\d+/g, 'act_[REDACTED]');
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Set ${name} in .env before running this script.`);
  }
  return value;
}

async function main() {
  const config = loadConfig();
  const igUserId = requireEnv('META_TEST_IG_USER_ID');
  const pageId = process.env.META_TEST_PAGE_ID;

  const client = new MetaClient(config);

  console.log(`--- listInstagramAccounts (confirming igUserId=${igUserId} is reachable) ---`);
  const accounts = await listInstagramAccounts(client, { limit: 25 });
  const account = accounts.find((a) => a.igId === igUserId);
  console.log(
    account
      ? `Found: @${account.username} (page: ${account.pageName}, pageId: ${account.pageId})`
      : `WARNING: igUserId ${igUserId} not found among ${accounts.length} connected IG accounts on this token.`
  );

  console.log(`\n--- listInstagramMedia for igUserId=${igUserId} ---`);
  try {
    const media = await listInstagramMedia(client, { igUserId, limit: 10 });
    console.log(`SUCCESS. Fetched ${media.length} media items:`);
    console.log(
      JSON.stringify(
        media.map((m) => ({ id: m.id, permalink: m.permalink, mediaType: m.mediaType })),
        null,
        2
      )
    );
  } catch (error) {
    console.log('FAILED: ' + redact(error instanceof Error ? error.message : String(error)));

    if (pageId) {
      console.log(`\n--- Fallback: retry with page-scoped token for pageId=${pageId} ---`);
      const pages = await import('../src/tools/listPages.js').then((m) =>
        m.listPages(client, { limit: 25 })
      );
      const page = pages.find((p) => p.id === pageId);
      if (!page?.access_token) {
        console.log('No access_token available for this page on the current user token.');
        return;
      }
      try {
        const pageClient = new MetaClient({
          accessToken: page.access_token,
          apiVersion: config.apiVersion,
        });
        const media = await listInstagramMedia(pageClient, { igUserId, limit: 10 });
        console.log(`SUCCESS with page-scoped token. Fetched ${media.length} media items:`);
        console.log(
          JSON.stringify(
            media.map((m) => ({ id: m.id, permalink: m.permalink, mediaType: m.mediaType })),
            null,
            2
          )
        );
      } catch (pageError) {
        console.log(
          'STILL FAILED with page-scoped token: ' +
            redact(pageError instanceof Error ? pageError.message : String(pageError))
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(redact(error instanceof Error ? error.stack ?? error.message : String(error)));
  process.exit(1);
});
