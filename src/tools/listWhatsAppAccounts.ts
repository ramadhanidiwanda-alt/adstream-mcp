import type { MetaClient } from '../metaClient.js';

export interface WhatsAppAccountResult {
  waba_id: string;
  name: string;
  currency?: string;
  timezone_id?: string;
  owner_business_id?: string;
  owner_type: 'owned' | 'client';
  account_status?: string;
}

interface MetaWabaEntry {
  id?: string;
  name?: string;
  currency?: string;
  timezone_id?: string;
  owner_business?: { id?: string };
  account_status?: string;
}

interface MetaBusinessEntry {
  id: string;
  name?: string;
}

/**
 * Discover WhatsApp Business Accounts owned by or shared to the user.
 *
 * Flow:
 * 1. Get user's businesses: GET /me/businesses
 * 2. For each business: GET /{businessId}/owned_whatsapp_business_accounts
 *                       GET /{businessId}/client_whatsapp_business_accounts
 *
 * If businessId is provided directly, skip step 1.
 */
export async function listWhatsAppAccounts(
  client: MetaClient,
  options: { businessId?: string; limit?: number } = {}
): Promise<WhatsAppAccountResult[]> {
  const limit = options.limit ?? 100;
  const results: WhatsAppAccountResult[] = [];

  // Resolve business IDs
  let businessIds: string[];
  if (options.businessId) {
    businessIds = [options.businessId];
  } else {
    const businesses = await client.metaGet<{ data: MetaBusinessEntry[] }>('/me/businesses', {
      fields: 'id,name',
      limit,
    });
    businessIds = (businesses.data || []).map((b) => b.id);
  }

  for (const businessId of businessIds) {
    // Owned WABAs
    const owned = await client.metaGet<{ data: MetaWabaEntry[] }>(
      `/${businessId}/owned_whatsapp_business_accounts`,
      { fields: 'id,name,currency,timezone_id,owner_business,account_status', limit }
    );
    for (const waba of owned.data || []) {
      if (waba.id) {
        results.push({
          waba_id: waba.id,
          name: waba.name || '',
          currency: waba.currency,
          timezone_id: waba.timezone_id,
          owner_business_id: waba.owner_business?.id,
          owner_type: 'owned',
          account_status: waba.account_status,
        });
      }
    }

    // Client WABAs (shared by clients)
    const clientWabas = await client.metaGet<{ data: MetaWabaEntry[] }>(
      `/${businessId}/client_whatsapp_business_accounts`,
      { fields: 'id,name,currency,timezone_id,owner_business,account_status', limit }
    );
    for (const waba of clientWabas.data || []) {
      if (waba.id) {
        results.push({
          waba_id: waba.id,
          name: waba.name || '',
          currency: waba.currency,
          timezone_id: waba.timezone_id,
          owner_business_id: waba.owner_business?.id,
          owner_type: 'client',
          account_status: waba.account_status,
        });
      }
    }
  }

  return results;
}
