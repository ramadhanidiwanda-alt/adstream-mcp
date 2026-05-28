import { z } from 'zod';
import type { MetaConfig } from './types.js';

const configSchema = z.object({
  accessToken: z.string().min(1, 'META_ACCESS_TOKEN is required'),
  adAccountId: z.string().min(1, 'META_AD_ACCOUNT_ID is required'),
  apiVersion: z.string().default('v20.0'),
});

export function loadConfig(): MetaConfig {
  const config = {
    accessToken: process.env.META_ACCESS_TOKEN || '',
    adAccountId: process.env.META_AD_ACCOUNT_ID || '',
    apiVersion: process.env.META_API_VERSION || 'v20.0',
  };

  return configSchema.parse(config);
}
