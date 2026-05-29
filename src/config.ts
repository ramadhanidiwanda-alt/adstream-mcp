import { z, ZodError } from 'zod';
import type { MetaConfig } from './types.js';

const configSchema = z.object({
  accessToken: z
    .string()
    .min(1, 'META_ACCESS_TOKEN is required')
    .refine(
      (token) => token.startsWith('EAA') || token.startsWith('EAAG'),
      'Invalid Meta access token format. Token should start with "EAA" or "EAAG"'
    ),
  adAccountId: z
    .string()
    .min(1, 'META_AD_ACCOUNT_ID is required')
    .refine(
      (id) => id.startsWith('act_'),
      'Invalid ad account ID format. ID should start with "act_"'
    ),
  apiVersion: z.string().default('v20.0'),
});

export function loadConfig(): MetaConfig {
  const config = {
    accessToken: process.env.META_ACCESS_TOKEN || '',
    adAccountId: process.env.META_AD_ACCOUNT_ID || '',
    apiVersion: process.env.META_API_VERSION || 'v20.0',
  };

  try {
    return configSchema.parse(config);
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.issues.map((e) => `  - ${e.message}`).join('\n');
      throw new Error(
        `Meta Ads configuration error:\n${messages}\n\n` +
          `Please set the following environment variables:\n` +
          `  export META_ACCESS_TOKEN="EAAxxxxxxxxxx"\n` +
          `  export META_AD_ACCOUNT_ID="act_123456789"\n\n` +
          `Get your access token from:\n` +
          `  https://developers.facebook.com/tools/explorer\n`
      );
    }
    throw error;
  }
}

/**
 * Validate token format without making API call
 */
export function validateTokenFormat(token: string): boolean {
  return token.startsWith('EAA') || token.startsWith('EAAG');
}

/**
 * Validate ad account ID format
 */
export function validateAdAccountId(accountId: string): boolean {
  return accountId.startsWith('act_') && accountId.length > 4;
}

/**
 * Mask access token for logging (show first 10 chars only)
 */
export function maskToken(token: string): string {
  if (token.length <= 10) return '***';
  return token.substring(0, 10) + '...';
}
