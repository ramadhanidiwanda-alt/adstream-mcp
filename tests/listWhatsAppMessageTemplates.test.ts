import { describe, it, expect, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { listWhatsAppMessageTemplates } from '../src/tools/listWhatsAppMessageTemplates.js';

type MetaGetMock = ReturnType<typeof vi.fn>;

describe('listWhatsAppMessageTemplates', () => {
  const mockMetaGet: MetaGetMock = vi.fn();
  const mockClient = {
    metaGet: mockMetaGet,
  } as unknown as MetaClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleTemplates = {
    data: [
      {
        id: 'tpl_111',
        name: 'welcome_message',
        status: 'APPROVED',
        category: 'MARKETING',
        language: 'id',
        components: [
          { type: 'BODY', text: 'Halo {{1}}, selamat datang!' },
          { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Lihat' }] },
        ],
      },
      {
        id: 'tpl_222',
        name: 'order_confirmation',
        status: 'APPROVED',
        category: 'UTILITY',
        language: 'id',
        components: [{ type: 'BODY', text: 'Pesanan {{1}} telah dikonfirmasi.' }],
      },
    ],
  };

  it('returns all templates for a WABA', async () => {
    mockMetaGet.mockResolvedValueOnce(sampleTemplates);

    const result = await listWhatsAppMessageTemplates(mockClient, { wabaId: 'waba_123' });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'tpl_111',
      name: 'welcome_message',
      status: 'APPROVED',
      category: 'MARKETING',
      language: 'id',
    });
    expect(result[0].components).toHaveLength(2);
    expect(result[1].name).toBe('order_confirmation');
  });

  it('filters by name when provided', async () => {
    mockMetaGet.mockResolvedValueOnce({
      data: [sampleTemplates.data[0]], // Only welcome_message
    });

    const result = await listWhatsAppMessageTemplates(mockClient, {
      wabaId: 'waba_123',
      name: 'welcome_message',
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('welcome_message');
    expect(mockMetaGet.mock.calls[0][1].name).toBe('welcome_message');
  });

  it('filters by status when provided', async () => {
    mockMetaGet.mockResolvedValueOnce({ data: [sampleTemplates.data[0]] });

    await listWhatsAppMessageTemplates(mockClient, { wabaId: 'waba_123', status: 'APPROVED' });

    expect(mockMetaGet.mock.calls[0][1].status).toBe('APPROVED');
  });

  it('handles empty response', async () => {
    mockMetaGet.mockResolvedValueOnce({ data: [] });
    const result = await listWhatsAppMessageTemplates(mockClient, { wabaId: 'waba_empty' });
    expect(result).toHaveLength(0);
  });

  it('skips entries without id', async () => {
    mockMetaGet.mockResolvedValueOnce({ data: [{ name: 'no_id' }] });
    const result = await listWhatsAppMessageTemplates(mockClient, { wabaId: 'waba_skip' });
    expect(result).toHaveLength(0);
  });

  it('passes limit parameter', async () => {
    mockMetaGet.mockResolvedValueOnce({ data: [] });
    await listWhatsAppMessageTemplates(mockClient, { wabaId: 'waba_123', limit: 50 });
    expect(mockMetaGet.mock.calls[0][1].limit).toBe(50);
  });
});
