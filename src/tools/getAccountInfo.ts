import type { MetaClient } from '../metaClient.js';
import { normalizeAccountId } from '../utils/normalizeAccountId.js';
import type { AccountInfoResult } from '../broker/types.js';

export interface GetAccountInfoOptions {
  adAccountId: string;
}

interface AccountInfoRaw {
  id: string;
  name: string;
  currency: string;
  timezone_name: string;
  timezone_offset_hours_utc: number;
  account_status: number;
  balance: number;
  amount_spent: number;
  spend_cap?: number | null;
  business_name?: string;
  business_city?: string;
  business_country_code?: string;
  min_daily_budget?: number;
  disable_reason?: number;
}

const ACCOUNT_STATUS_LABELS: Record<number, string> = {
  1: 'ACTIVE',
  2: 'DISABLED',
  3: 'UNSETTLED',
  7: 'PENDING_RISK_REVIEW',
  9: 'IN_GRACE_PERIOD',
  100: 'PENDING_CLOSURE',
  101: 'CLOSED',
  201: 'ANY_ACTIVE',
  202: 'ANY_CLOSED',
};

export async function getAccountInfo(
  client: MetaClient,
  options: GetAccountInfoOptions
): Promise<AccountInfoResult> {
  const adAccountId = normalizeAccountId(options.adAccountId);

  const fields = [
    'id',
    'name',
    'currency',
    'timezone_name',
    'timezone_offset_hours_utc',
    'account_status',
    'balance',
    'amount_spent',
    'spend_cap',
    'business_name',
    'business_city',
    'business_country_code',
    'min_daily_budget',
    'disable_reason',
  ];

  const raw = await client.metaGetObject<AccountInfoRaw>(`/act_${adAccountId}`, {
    fields: fields.join(','),
  });

  return {
    id: raw.id,
    name: raw.name,
    currency: raw.currency,
    timezone_name: raw.timezone_name,
    timezone_offset: raw.timezone_offset_hours_utc,
    account_status: raw.account_status,
    account_status_label: ACCOUNT_STATUS_LABELS[raw.account_status] ?? `UNKNOWN_${raw.account_status}`,
    balance: raw.balance,
    amount_spent: raw.amount_spent,
    spending_limit: raw.spend_cap ?? null,
    business_name: raw.business_name,
    business_city: raw.business_city,
    business_country: raw.business_country_code,
    min_daily_budget: raw.min_daily_budget,
    disable_reason: raw.disable_reason,
  };
}
