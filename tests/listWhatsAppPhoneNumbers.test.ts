import { describe, it, expect, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { listWhatsAppPhoneNumbers } from '../src/tools/listWhatsAppPhoneNumbers.js';

type MetaGetMock = ReturnType<typeof vi.fn>;

describe('listWhatsAppPhoneNumbers', () => {
  const mockMetaGet: MetaGetMock = vi.fn();
  const mockClient = {
    metaGet: mockMetaGet,
  } as unknown as MetaClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns normalized phone numbers for a WABA', async () => {
    mockMetaGet.mockResolvedValueOnce({
      data: [
        {
          id: 'phone_111',
          display_phone_number: '+628123456789',
          verified_name: 'My Business',
          quality_rating: 'GREEN',
          code_verification_status: 'VERIFIED',
        },
        {
          id: 'phone_222',
          display_phone_number: '+628987654321',
          verified_name: 'My Business 2',
          quality_rating: 'YELLOW',
          code_verification_status: 'VERIFIED',
        },
      ],
    });

    const result = await listWhatsAppPhoneNumbers(mockClient, { wabaId: 'waba_123' });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      phone_number_id: 'phone_111',
      display_phone_number: '+628123456789',
      verified_name: 'My Business',
      quality_rating: 'GREEN',
      code_verification_status: 'VERIFIED',
    });
    expect(result[1].phone_number_id).toBe('phone_222');
  });

  it('requires wabaId', async () => {
    // Should fail gracefully - function expects non-empty wabaId
    mockMetaGet.mockRejectedValueOnce(new Error('metaGet error without wabaId'));
    await expect(listWhatsAppPhoneNumbers(mockClient, { wabaId: '' })).rejects.toThrow();
  });

  it('handles empty response', async () => {
    mockMetaGet.mockResolvedValueOnce({ data: [] });
    const result = await listWhatsAppPhoneNumbers(mockClient, { wabaId: 'waba_empty' });
    expect(result).toHaveLength(0);
  });

  it('skips entries without id', async () => {
    mockMetaGet.mockResolvedValueOnce({ data: [{ display_phone_number: '+628111' }] });
    const result = await listWhatsAppPhoneNumbers(mockClient, { wabaId: 'waba_skip' });
    expect(result).toHaveLength(0);
  });

  it('passes limit parameter', async () => {
    mockMetaGet.mockResolvedValueOnce({ data: [] });
    await listWhatsAppPhoneNumbers(mockClient, { wabaId: 'waba_123', limit: 5 });
    expect(mockMetaGet.mock.calls[0][1].limit).toBe(5);
  });
});
