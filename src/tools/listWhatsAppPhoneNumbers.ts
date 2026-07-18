import type { MetaClient } from '../metaClient.js';

export interface WhatsAppPhoneNumberResult {
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating?: string;
  code_verification_status?: string;
}

interface MetaPhoneEntry {
  id?: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
}

/**
 * List all phone numbers associated with a WhatsApp Business Account.
 *
 * GET /{wabaId}/phone_numbers
 *
 * Returns phone_number_id (not wa_id) — use this ID for CTWA creative setup.
 */
export async function listWhatsAppPhoneNumbers(
  client: MetaClient,
  options: { wabaId: string; limit?: number }
): Promise<WhatsAppPhoneNumberResult[]> {
  const limit = options.limit ?? 100;
  const response = await client.metaGet<{ data: MetaPhoneEntry[] }>(
    `/${options.wabaId}/phone_numbers`,
    { fields: 'id,display_phone_number,verified_name,quality_rating,code_verification_status', limit }
  );

  return (response.data || [])
    .filter((p) => p.id)
    .map((p) => ({
      phone_number_id: p.id!,
      display_phone_number: p.display_phone_number || '',
      verified_name: p.verified_name || '',
      quality_rating: p.quality_rating,
      code_verification_status: p.code_verification_status,
    }));
}
