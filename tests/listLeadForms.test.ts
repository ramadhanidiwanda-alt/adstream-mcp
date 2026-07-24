import { describe, expect, it, vi } from 'vitest';
import { listLeadForms } from '../src/tools/listLeadForms.js';

describe('listLeadForms', () => {
  it('lists active Instant Forms for a Page without returning sensitive fields', async () => {
    const metaGet = vi.fn().mockResolvedValue({
      data: [
        { id: 'form-1', name: 'Consultation', status: 'ACTIVE', locale: 'en_US' },
        { id: 'form-2', name: 'Old form', status: 'ARCHIVED', locale: 'en_US' },
      ],
    });

    const result = await listLeadForms({ metaGet } as never, {
      pageId: 'page-1',
      status: ['ACTIVE'],
    });

    expect(metaGet).toHaveBeenCalledWith('/page-1/leadgen_forms', {
      fields: 'id,name,status,locale,created_time',
      filtering: JSON.stringify([{ field: 'status', operator: 'IN', value: ['ACTIVE'] }]),
      limit: 50,
    });
    expect(result).toEqual([
      {
        lead_form_id: 'form-1',
        name: 'Consultation',
        status: 'ACTIVE',
        locale: 'en_US',
        created_time: undefined,
      },
    ]);
  });
});
