import type { MetaClient } from '../metaClient.js';

export interface MetaLeadFormResult {
  lead_form_id: string;
  name: string;
  status?: string;
  locale?: string;
  created_time?: string;
}

interface MetaLeadFormResponse {
  id: string;
  name: string;
  status?: string;
  locale?: string;
  created_time?: string;
}

export async function listLeadForms(
  client: MetaClient,
  options: { pageId: string; status?: string[]; limit?: number }
): Promise<MetaLeadFormResult[]> {
  const status = options.status?.filter((value) => value.trim().length > 0);
  const response = await client.metaGet<{ data: MetaLeadFormResponse[] }>(
    `/${options.pageId}/leadgen_forms`,
    {
      fields: 'id,name,status,locale,created_time',
      ...(status?.length
        ? {
            filtering: JSON.stringify([{ field: 'status', operator: 'IN', value: status }]),
          }
        : {}),
      limit: options.limit ?? 50,
    }
  );

  return (response.data ?? [])
    .filter(
      (form) => !status?.length || (form.status !== undefined && status.includes(form.status))
    )
    .map((form) => ({
      lead_form_id: form.id,
      name: form.name,
      status: form.status,
      locale: form.locale,
      created_time: form.created_time,
    }));
}
