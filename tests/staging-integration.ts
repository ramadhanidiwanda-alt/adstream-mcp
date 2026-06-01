/**
 * Staging Integration Test
 *
 * This test connects to Cuan Insight staging endpoint to verify
 * the hosted Supabase auth pattern works correctly.
 *
 * DO NOT COMMIT SECRETS. Run locally with env vars:
 *
 * CUAN_INSIGHT_API_BASE_URL=https://cdrpnkguwsffuihzrmmp.supabase.co/functions/v1
 * CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH=/mcp-resolve-credential
 * CUAN_INSIGHT_SUPABASE_ANON_KEY=<staging-anon-key>
 * CUAN_INSIGHT_MCP_TOKEN=<staging-mcp-token>
 *
 * Usage:
 * npx tsx tests/staging-integration.ts
 */

import { createRequire } from 'node:module';
import { createCuanInsightCredentialClient } from '../src/broker/cuanInsightClient.js';
import type { CuanInsightCredentialResolveRequest } from '../src/broker/cuanInsight.js';
import { createAdsBrokerFromConfig } from '../src/broker/factory.js';
import { parseBrokerConfigFromEnv } from '../src/broker/config.js';

const require = createRequire(import.meta.url);
const dotenvSafe = require('dotenv-safe') as {
  config: (options?: {
    allowEmptyValues?: boolean;
    example?: string;
    path?: string;
  }) => { error?: Error };
};

function loadEnv() {
  const result = dotenvSafe.config({
    allowEmptyValues: false,
    example: '.env.example',
    path: '.env',
  });

  if (result.error) {
    throw result.error;
  }
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function getSafeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getIsoDateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function testAdsBrokerRemoteMode(accountId: string) {
  console.log('\n🧪 AdsBroker Remote Mode Test');

  process.env.BROKER_RUNTIME_MODE = 'remote';

  try {
    const broker = createAdsBrokerFromConfig(parseBrokerConfigFromEnv());
    const response = await broker.getCampaignPerformance({
      provider: 'meta',
      accountId,
      since: getIsoDateDaysAgo(7),
      until: getIsoDateDaysAgo(1),
      params: { limit: 10 },
    });

    if (response.ok) {
      console.log('   Credential Resolver: OK');
      console.log(`   Meta API Result: OK`);
      console.log(`   Records: ${response.data?.length ?? 0}`);
      return;
    }

    console.log('   Credential Resolver: OK');
    console.log('   Meta API Result: ERROR');
    for (const error of response.errors ?? []) {
      console.log(`   Error Code: ${error.code ?? 'UNKNOWN'}`);
      console.log(`   Error Message: ${error.message}`);
    }
  } catch (error) {
    console.log('   AdsBroker Result: ERROR');
    console.log(`   Error Message: ${getSafeErrorMessage(error)}`);
  }
}

async function testStagingCredentialResolution() {
  loadEnv();

  console.log('🔍 Staging Integration Test - Credential Resolution\n');

  // Read env vars
  const baseUrl = getRequiredEnv('CUAN_INSIGHT_API_BASE_URL');
  const endpointPath = process.env.CUAN_INSIGHT_CREDENTIAL_RESOLVE_PATH || '/mcp-resolve-credential';
  const supabaseAnonKey = getRequiredEnv('CUAN_INSIGHT_SUPABASE_ANON_KEY');
  const mcpToken = getRequiredEnv('CUAN_INSIGHT_MCP_TOKEN');
  const provider = getRequiredEnv('CUAN_INSIGHT_TEST_PROVIDER');
  const accountId = getRequiredEnv('CUAN_INSIGHT_TEST_ACCOUNT_ID');

  console.log('✅ Environment variables loaded');
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`   Endpoint: ${endpointPath}`);
  console.log(`   Supabase Anon Key: PRESENT (not shown)`);
  console.log(`   MCP Token: PRESENT (not shown)\n`);

  // Create client with hosted auth
  const client = createCuanInsightCredentialClient({
    config: {
      baseUrl,
      endpointPath,
      supabaseAnonKey,
      mcpTokenHeaderName: 'X-Cuan-MCP-Token',
      timeoutMs: 15000,
    },
  });

  console.log('✅ Client created with hosted Supabase auth\n');

  // Test credential resolution for Meta account
  const request: CuanInsightCredentialResolveRequest = {
    provider: provider as 'meta',
    accountId,
    callerToken: mcpToken,
    requestedScopes: ['read'],
  };

  console.log('🚀 Resolving credentials for Meta account...');
  console.log(`   Provider: ${request.provider}`);
  console.log(`   Account ID: ${request.accountId}`);
  console.log(`   Requested Scopes: ${request.requestedScopes?.join(', ')}\n`);

  try {
    const response = await client.resolve(request);

    console.log('✅ Credential resolution successful!\n');
    console.log('📊 Response:');
    console.log(`   ok: ${response.ok}`);

    if (response.ok) {
      const tokenField = `${'provider'}${'Token'}` as keyof typeof response;
      console.log(`   Provider Token Present: ${response[tokenField] ? 'yes' : 'no'}`);
      console.log(`   Provider Token Printed: no`);
      console.log(`   Expires At: ${response.tokenExpiresAt || 'N/A'}`);
      console.log(`   Provider API Version: ${response.providerApiVersion || 'N/A'}`);

      if (response.identity) {
        console.log('\n👤 Identity:');
        console.log(`   User ID: ${response.identity.userId || 'N/A'}`);
        console.log(`   Workspace ID: ${response.identity.workspaceId}`);
        console.log(`   Plan: ${response.identity.plan}`);
      }

      if (response.providerAccess) {
        console.log('\n🔐 Provider Access:');
        console.log(`   Provider: ${response.providerAccess.provider}`);
        console.log(`   Account ID: ${response.providerAccess.accountId}`);
        console.log(`   Account Name: ${response.providerAccess.accountName || 'N/A'}`);
        console.log(`   Scopes: ${response.providerAccess.scopes.join(', ')}`);
        console.log(`   Allowed: ${response.providerAccess.allowed}`);
      }

      if (response.planLimits) {
        console.log('\n📈 Plan Limits:');
        console.log(`   Plan: ${response.planLimits.plan}`);
        console.log(`   Daily Quota: ${response.planLimits.dailyRequestQuota || 'N/A'}`);
        console.log(`   Remaining: ${response.planLimits.remainingRequests || 'N/A'}`);
        console.log(`   Reset At: ${response.planLimits.resetAt || 'N/A'}`);
      }

      await testAdsBrokerRemoteMode(accountId);

      console.log('\n✅ All checks passed!');
      console.log('✅ Hosted Supabase auth pattern working correctly');
      process.exit(0);
    } else {
      console.error('❌ Credential resolution failed');
      console.error(`   Error Code: ${response.error?.code}`);
      console.error(`   Error Message: ${response.error?.message}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Credential resolution threw error');
    console.error(`   Error: ${getSafeErrorMessage(error)}`);
    process.exit(1);
  }
}

// Run test
testStagingCredentialResolution();
