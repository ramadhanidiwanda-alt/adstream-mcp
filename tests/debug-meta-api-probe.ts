/**
 * Safe Meta API Probe Script — Phase 9 Debug
 *
 * Tests Meta Graph API endpoints step-by-step using the providerToken
 * resolved from Cuan Insight. NEVER prints tokens.
 *
 * Usage:
 *   npx tsx tests/debug-meta-api-probe.ts
 *
 * Security:
 *   - No tokens are printed
 *   - No .env is committed
 *   - Read-only operations only
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dotenvSafe = require('dotenv-safe') as {
  config: (options?: { allowEmptyValues?: boolean; example?: string; path?: string }) => { error?: Error };
};

function loadEnv() {
  const result = dotenvSafe.config({ allowEmptyValues: false, example: '.env.example', path: '.env' });
  if (result.error) throw result.error;
}

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') throw new Error(`${name} is required`);
  return v.trim();
}

function getEnvOptional(name: string): string | undefined {
  const v = process.env[name];
  return v?.trim() || undefined;
}

function safeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function redactUrl(url: string): string {
  return url.replace(/access_token=[^&]+/gi, 'access_token=[REDACTED]');
}

interface ProbeResult {
  endpoint: string;
  status: number;
  ok: boolean;
  data?: unknown;
  error?: { type?: string; code?: number; message: string; fbtrace_id?: string };
}

async function probeMetaApi(accessToken: string, apiVersion: string): Promise<void> {
  const baseUrl = `https://graph.facebook.com/${apiVersion}`;
  const accountId = 'act_1417353822551653';
  const numericAccountId = '1417353822551653';

  console.log('\n🔍 Meta API Probe — Phase 9 Debug\n');
  console.log(`   API Version: ${apiVersion}`);
  console.log(`   Target Account: ${accountId}`);
  console.log(`   Token Present: yes (not shown)\n`);

  // ─── Probe A: /me/adaccounts ───
  console.log('━━━ Probe A: /me/adaccounts ━━━');
  const probeA = await safeFetch(baseUrl, '/me/adaccounts', accessToken, {
    fields: 'id,name,account_id,account_status,currency',
    limit: '10',
  });
  printResult(probeA);

  // Check if target account is in the list
  if (probeA.ok && Array.isArray(probeA.data)) {
    const accounts = probeA.data as Array<{ id: string; account_id: string; name: string }>;
    const found = accounts.some(
      (a) => a.id === accountId || a.id === numericAccountId || a.account_id === numericAccountId
    );
    console.log(`   Target account found in list: ${found ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Total accounts visible: ${accounts.length}`);
    for (const a of accounts) {
      console.log(`     - id=${a.id} account_id=${a.account_id} name="${a.name}"`);
    }
  }

  // ─── Probe B: Account metadata ───
  console.log('\n━━━ Probe B: Account metadata ━━━');
  const probeB = await safeFetch(baseUrl, `/${accountId}`, accessToken, {
    fields: 'id,name,account_status,currency,timezone_name',
  });
  printResult(probeB);

  // Also try without act_ prefix
  console.log('\n━━━ Probe B2: Account metadata (numeric ID only) ━━━');
  const probeB2 = await safeFetch(baseUrl, `/${numericAccountId}`, accessToken, {
    fields: 'id,name,account_status,currency,timezone_name',
  });
  printResult(probeB2);

  // ─── Probe C: Campaigns edge ───
  console.log('\n━━━ Probe C: Campaigns edge ━━━');
  const probeC = await safeFetch(baseUrl, `/${accountId}/campaigns`, accessToken, {
    fields: 'id,name,status',
    limit: '5',
  });
  printResult(probeC);

  // ─── Probe D: Insights minimal ───
  console.log('\n━━━ Probe D: Insights (last_7d) ━━━');
  const probeD = await safeFetch(baseUrl, `/${accountId}/insights`, accessToken, {
    fields: 'impressions,clicks,spend',
    date_preset: 'last_7d',
    limit: '5',
  });
  printResult(probeD);

  // ─── Probe D2: Insights with time_range ───
  console.log('\n━━━ Probe D2: Insights (time_range) ━━━');
  const since = '2026-05-26';
  const until = '2026-06-01';
  const probeD2 = await safeFetch(baseUrl, `/${accountId}/insights`, accessToken, {
    level: 'campaign',
    fields: 'campaign_id,campaign_name,spend,impressions,clicks',
    time_range: JSON.stringify({ since, until }),
    limit: '5',
  });
  printResult(probeD2);

  // ─── Probe E: Token permissions ───
  console.log('\n━━━ Probe E: Token permissions/debug ━━━');
  const probeE = await safeFetch(baseUrl, '/me/permissions', accessToken, {});
  printResult(probeE);

  // ─── Summary ───
  console.log('\n━━━ Summary ━━━');
  console.log(`   Probe A (adaccounts): ${probeA.ok ? '✅' : '❌'} (status ${probeA.status})`);
  console.log(`   Probe B (account metadata): ${probeB.ok ? '✅' : '❌'} (status ${probeB.status})`);
  console.log(`   Probe B2 (numeric ID): ${probeB2.ok ? '✅' : '❌'} (status ${probeB2.status})`);
  console.log(`   Probe C (campaigns): ${probeC.ok ? '✅' : '❌'} (status ${probeC.status})`);
  console.log(`   Probe D (insights last_7d): ${probeD.ok ? '✅' : '❌'} (status ${probeD.status})`);
  console.log(`   Probe D2 (insights time_range): ${probeD2.ok ? '✅' : '❌'} (status ${probeD2.status})`);
  console.log(`   Probe E (permissions): ${probeE.ok ? '✅' : '❌'} (status ${probeE.status})`);

  // Diagnose
  console.log('\n━━━ Diagnosis ━━━');
  if (!probeA.ok) {
    console.log('   ⚠️  Token cannot list ad accounts — likely missing ads_read permission or token invalid');
  } else if (!probeB.ok && !probeB2.ok) {
    console.log('   ⚠️  Token can list accounts but cannot access target account metadata');
    console.log('   → Check: Is the user associated with this token granted access to act_1417353822551653?');
  } else if (!probeC.ok) {
    console.log('   ⚠️  Account metadata accessible but campaigns edge failed');
    console.log('   → Check: Does the account have any campaigns? Is ads_read scope granted?');
  } else if (!probeD.ok && !probeD2.ok) {
    console.log('   ⚠️  Campaigns accessible but insights failed');
    console.log('   → Check: Insights API may require specific permissions or date ranges');
  } else if (probeD.ok || probeD2.ok) {
    console.log('   ✅ All probes passed — Meta API access is working');
    console.log('   → If AdsBroker still fails, the issue is in the adapter/broker code, not permissions');
  }
}

async function safeFetch(
  baseUrl: string,
  path: string,
  accessToken: string,
  params: Record<string, string>
): Promise<ProbeResult> {
  const url = new URL(`${baseUrl}${path}`);
  url.searchParams.append('access_token', accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }

  console.log(`   GET ${redactUrl(url.toString())}`);

  try {
    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      const metaError = data?.error;
      return {
        endpoint: path,
        status: response.status,
        ok: false,
        error: {
          type: metaError?.type,
          code: metaError?.code,
          message: metaError?.message ?? `HTTP ${response.status}`,
          fbtrace_id: metaError?.fbtrace_id,
        },
      };
    }

    // Check for Meta error in 200 response
    if (data?.error) {
      return {
        endpoint: path,
        status: response.status,
        ok: false,
        error: {
          type: data.error.type,
          code: data.error.code,
          message: data.error.message,
          fbtrace_id: data.error.fbtrace_id,
        },
      };
    }

    return {
      endpoint: path,
      status: response.status,
      ok: true,
      data: data?.data ?? data,
    };
  } catch (err) {
    return {
      endpoint: path,
      status: 0,
      ok: false,
      error: { message: safeError(err) },
    };
  }
}

function printResult(result: ProbeResult): void {
  if (result.ok) {
    const data = result.data;
    if (Array.isArray(data)) {
      console.log(`   ✅ OK (status ${result.status}) — ${data.length} records`);
    } else if (typeof data === 'object' && data !== null) {
      console.log(`   ✅ OK (status ${result.status}) — object returned`);
    } else {
      console.log(`   ✅ OK (status ${result.status})`);
    }
  } else {
    console.log(`   ❌ FAILED (status ${result.status})`);
    if (result.error) {
      console.log(`   Error type: ${result.error.type ?? 'N/A'}`);
      console.log(`   Error code: ${result.error.code ?? 'N/A'}`);
      console.log(`   Error message: ${result.error.message}`);
      if (result.error.fbtrace_id) {
        console.log(`   fbtrace_id: ${result.error.fbtrace_id}`);
      }
    }
  }
}

// ─── Main ───
async function main(): Promise<void> {
  loadEnv();

  // Step 1: Resolve credential from Cuan Insight
  console.log('━━━ Step 1: Resolve credential from Cuan Insight ━━━');
  const { createCuanInsightCredentialClient } = await import('../src/broker/cuanInsightClient.js');
  const { parseBrokerConfigFromEnv } = await import("../src/broker/config.js");

  const config = parseBrokerConfigFromEnv();
  console.log(`   Broker mode: ${config.mode}`);

  if (config.mode !== 'remote' || !config.cuanInsight) {
    throw new Error('BROKER_RUNTIME_MODE must be "remote" with cuanInsight config');
  }

  const client = createCuanInsightCredentialClient({
    config: {
      baseUrl: config.cuanInsight.cuanInsightBaseUrl,
      endpointPath: config.cuanInsight.cuanInsightEndpointPath,
      timeoutMs: config.cuanInsight.cuanInsightTimeoutMs,
      supabaseAnonKey: config.cuanInsight.cuanInsightSupabaseAnonKey,
      mcpTokenHeaderName: config.cuanInsight.cuanInsightMcpTokenHeaderName,
    },
  });

  const mcpToken = config.cuanInsight.cuanInsightMcpToken;
  if (!mcpToken) throw new Error('CUAN_INSIGHT_MCP_TOKEN is required');

  const resolveResult = await client.resolve({
    provider: 'meta',
    accountId: 'act_1417353822551653',
    callerToken: mcpToken,
    requestedScopes: ['read'],
  });

  console.log(`   Credential resolver ok: ${resolveResult.ok}`);

  if (!resolveResult.ok || !resolveResult.providerToken) {
    console.error('   ❌ Credential resolution failed — cannot proceed with probes');
    if (resolveResult.error) {
      console.error(`   Error code: ${resolveResult.error.code}`);
      console.error(`   Error message: ${resolveResult.error.message}`);
    }
    process.exit(1);
  }

  console.log(`   Provider token present: yes (not shown)`);
  console.log(`   Provider API version: ${resolveResult.providerApiVersion ?? 'not provided'}`);
  if (resolveResult.providerAccess) {
    console.log(`   Provider: ${resolveResult.providerAccess.provider}`);
    console.log(`   Account ID: ${resolveResult.providerAccess.accountId}`);
    console.log(`   Account Name: ${resolveResult.providerAccess.accountName ?? 'N/A'}`);
    console.log(`   Scopes: ${resolveResult.providerAccess.scopes.join(', ')}`);
    console.log(`   Allowed: ${resolveResult.providerAccess.allowed}`);
  }

  // Step 2: Run Meta API probes
  const apiVersion = resolveResult.providerApiVersion ?? 'v20.0';
  await probeMetaApi(resolveResult.providerToken, apiVersion);
}

main().catch((err) => {
  console.error('Fatal error:', safeError(err));
  process.exit(1);
});
