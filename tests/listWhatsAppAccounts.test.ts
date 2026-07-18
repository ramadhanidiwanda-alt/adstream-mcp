import { describe, it, expect, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { listWhatsAppAccounts } from '../src/tools/listWhatsAppAccounts.js';

type MetaGetMock = ReturnType<typeof vi.fn>;

describe('listWhatsAppAccounts', () => {
  const mockMetaGet: MetaGetMock = vi.fn();
  const mockClient = {
    metaGet: mockMetaGet,
  } as unknown as MetaClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns owned + client WABAs from given businessId', async () => {
    mockMetaGet
      // First call: owned_whatsapp_business_accounts
      .mockResolvedValueOnce({
        data: [
          {
            id: 'waba_111',
            name: 'My WABA',
            currency: 'USD',
            timezone_id: '1',
            owner_business: { id: 'bus_123' },
            account_status: 'ACTIVE',
          },
        ],
      })
      // Second call: client_whatsapp_business_accounts
      .mockResolvedValueOnce({
        data: [
          {
            id: 'waba_222',
            name: 'Client WABA',
            currency: 'IDR',
            timezone_id: '7',
            owner_business: { id: 'bus_456' },
            account_status: 'ACTIVE',
          },
        ],
      });

    const result = await listWhatsAppAccounts(mockClient, { businessId: 'bus_123' });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      waba_id: 'waba_111',
      name: 'My WABA',
      owner_type: 'owned',
    });
    expect(result[1]).toMatchObject({
      waba_id: 'waba_222',
      name: 'Client WABA',
      owner_type: 'client',
    });
  });

  it('auto-discovers businessId from /me/businesses if not provided', async () => {
    mockMetaGet
      // /me/businesses
      .mockResolvedValueOnce({ data: [{ id: 'bus_789' }] })
      // owned_whatsapp_business_accounts for bus_789
      .mockResolvedValueOnce({ data: [{ id: 'waba_333', name: 'Auto WABA', owner_business: { id: 'bus_789' } }] })
      // client_whatsapp_business_accounts for bus_789
      .mockResolvedValueOnce({ data: [] });

    const result = await listWhatsAppAccounts(mockClient);

    expect(result).toHaveLength(1);
    expect(result[0].waba_id).toBe('waba_333');
    expect(result[0].owner_type).toBe('owned');
    // Should have called /me/businesses first
    expect(mockMetaGet.mock.calls[0][0]).toBe('/me/businesses');
  });

  it('handles empty responses', async () => {
    mockMetaGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });

    const result = await listWhatsAppAccounts(mockClient, { businessId: 'bus_empty' });
    expect(result).toHaveLength(0);
  });

  it('handles no businesses found', async () => {
    mockMetaGet.mockResolvedValueOnce({ data: [] });

    const result = await listWhatsAppAccounts(mockClient);
    expect(result).toHaveLength(0);
  });

  it('skips entries without id', async () => {
    mockMetaGet
      .mockResolvedValueOnce({ data: [{ id: null, name: 'No ID' }] })
      .mockResolvedValueOnce({ data: [] });

    const result = await listWhatsAppAccounts(mockClient, { businessId: 'bus_123' });
    expect(result).toHaveLength(0);
  });
});
