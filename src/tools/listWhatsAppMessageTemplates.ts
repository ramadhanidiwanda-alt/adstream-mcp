import type { MetaClient } from '../metaClient.js';

export interface WhatsAppTemplateComponent {
  type: string;
  text?: string;
  buttons?: Array<{ type: string; text?: string }>;
}

export interface WhatsAppTemplateResult {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components?: WhatsAppTemplateComponent[];
}

interface MetaTemplateEntry {
  id?: string;
  name?: string;
  status?: string;
  category?: string;
  language?: string;
  components?: WhatsAppTemplateComponent[];
}

/**
 * List WhatsApp message templates for a WABA.
 *
 * GET /{wabaId}/message_templates
 *
 * Optional filters:
 * - name: filter by template name (partial match)
 * - status: filter by status (APPROVED, PENDING, REJECTED, etc.)
 */
export async function listWhatsAppMessageTemplates(
  client: MetaClient,
  options: { wabaId: string; name?: string; status?: string; limit?: number }
): Promise<WhatsAppTemplateResult[]> {
  const limit = options.limit ?? 100;
  const params: Record<string, any> = {
    fields: 'id,name,status,category,language,components',
    limit,
  };
  if (options.name) params.name = options.name;
  if (options.status) params.status = options.status;

  const response = await client.metaGet<{ data: MetaTemplateEntry[] }>(
    `/${options.wabaId}/message_templates`,
    params
  );

  return (response.data || [])
    .filter((t) => t.id)
    .map((t) => ({
      id: t.id!,
      name: t.name || '',
      status: t.status || '',
      category: t.category || '',
      language: t.language || '',
      components: t.components,
    }));
}
