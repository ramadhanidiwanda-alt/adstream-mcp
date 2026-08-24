import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetaClient } from '../src/metaClient.js';
import { resumeAd } from '../src/tools/resumeAd.js';

function createMockClient(): MetaClient {
  return {
    metaPost: vi.fn().mockResolvedValue({ success: true }),
    metaGet: vi.fn(),
    metaGetObject: vi.fn(),
    lastRateLimitInfo: null,
  } as unknown as MetaClient;
}

/** Balas per path supaya read status dan read parent bisa dibedakan. */
function respondByPath(client: MetaClient, byPath: Record<string, Record<string, unknown>>): void {
  (client.metaGetObject as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
    const found = byPath[path];
    if (!found) throw new Error(`(#100) Tried accessing nonexisting field on ${path}`);
    return found;
  });
}

describe('read-back status: issues Meta', () => {
  let client: MetaClient;

  beforeEach(() => {
    client = createMockClient();
  });

  // Insiden 2026-08-24: ad ditolak Meta dengan HARD_ERROR 1487891, tetapi read-back
  // hanya membaca status+effective_status sehingga error itu tidak pernah terlihat.
  it('membawa issues_info ke read-back saat effective_status menandakan masalah', async () => {
    respondByPath(client, {
      '/ad-1': {
        status: 'ACTIVE',
        effective_status: 'WITH_ISSUES',
        issues_info: [
          {
            level: 'AD',
            error_code: 1487891,
            error_type: 'HARD_ERROR',
            error_summary: 'Materi Iklan Tidak Valid untuk Tujuan',
          },
        ],
      },
    });

    const result = await resumeAd(client, 'ad-1');
    const readBack = (result.response as Record<string, unknown>).read_back as Record<
      string,
      unknown
    >;

    expect(readBack.issues).toEqual([
      {
        level: 'AD',
        error_code: 1487891,
        error_type: 'HARD_ERROR',
        error_summary: 'Materi Iklan Tidak Valid untuk Tujuan',
      },
    ]);
    expect(String(readBack.note)).toContain('1487891');
    expect(String(readBack.note)).toContain('Materi Iklan Tidak Valid untuk Tujuan');
  });

  it('tetap terverifikasi saat objek tidak punya field issues_info sama sekali', async () => {
    respondByPath(client, {
      '/ad-2': { status: 'ACTIVE', effective_status: 'ACTIVE' },
    });

    const result = await resumeAd(client, 'ad-2');
    const readBack = (result.response as Record<string, unknown>).read_back as Record<
      string,
      unknown
    >;

    expect(result.success).toBe(true);
    expect(readBack.applied).toBe(true);
    expect(readBack.unverified).toBeUndefined();
    expect(readBack.issues).toBeUndefined();
  });
});

/** Balas berdasarkan kombinasi path + fields, supaya read status dan read parent terpisah. */
function respondByFields(client: MetaClient, byKey: Record<string, Record<string, unknown>>): void {
  (client.metaGetObject as ReturnType<typeof vi.fn>).mockImplementation(
    async (path: string, params: { fields?: string }) => {
      const found = byKey[`${path}|${params?.fields ?? ''}`];
      if (!found) throw new Error(`(#100) Tried accessing nonexisting field on ${path}`);
      return found;
    }
  );
}

const AD_STATUS_FIELDS = 'status,effective_status,issues_info';
const AD_PARENT_FIELDS = 'adset{id,name,status},campaign{id,name,status}';

describe('read-back status: penyebab effective_status', () => {
  let client: MetaClient;

  beforeEach(() => {
    client = createMockClient();
  });

  // Insiden 2026-08-24: note menuduh parent masih paused padahal ad set dan
  // campaign dua-duanya ACTIVE. Note itu tidak pernah membaca parent-nya.
  it('tidak menyalahkan parent saat ad set dan campaign sama-sama ACTIVE', async () => {
    respondByFields(client, {
      [`/ad-3|${AD_STATUS_FIELDS}`]: { status: 'ACTIVE', effective_status: 'IN_PROCESS' },
      [`/ad-3|${AD_PARENT_FIELDS}`]: {
        adset: { id: 'as-1', name: 'Ad Set Satu', status: 'ACTIVE' },
        campaign: { id: 'cmp-1', name: 'Campaign Satu', status: 'ACTIVE' },
      },
    });

    const result = await resumeAd(client, 'ad-3');
    const note = String(
      ((result.response as Record<string, unknown>).read_back as Record<string, unknown>).note
    );

    expect(note).not.toMatch(/masih paused/i);
    expect(note).toMatch(/Ad Set Satu/);
    expect(note).toMatch(/Campaign Satu/);
    expect(note).toMatch(/sudah ACTIVE/i);
  });

  it('menyebut parent yang benar-benar paused beserta namanya', async () => {
    respondByFields(client, {
      [`/ad-4|${AD_STATUS_FIELDS}`]: { status: 'ACTIVE', effective_status: 'ADSET_PAUSED' },
      [`/ad-4|${AD_PARENT_FIELDS}`]: {
        adset: { id: 'as-2', name: 'Ad Set Satu', status: 'PAUSED' },
        campaign: { id: 'cmp-2', name: 'Campaign Satu', status: 'ACTIVE' },
      },
    });

    const result = await resumeAd(client, 'ad-4');
    const note = String(
      ((result.response as Record<string, unknown>).read_back as Record<string, unknown>).note
    );

    expect(note).toMatch(/ad set/i);
    expect(note).toMatch(/Ad Set Satu/);
    expect(note).toMatch(/PAUSED/);
    expect(note).not.toMatch(/Campaign Satu/);
  });

  it('mengaku tidak tahu saat status parent gagal dibaca', async () => {
    respondByFields(client, {
      [`/ad-5|${AD_STATUS_FIELDS}`]: { status: 'ACTIVE', effective_status: 'IN_PROCESS' },
    });

    const result = await resumeAd(client, 'ad-5');
    const note = String(
      ((result.response as Record<string, unknown>).read_back as Record<string, unknown>).note
    );

    expect(result.success).toBe(true);
    expect(note).toMatch(/tidak berhasil dibaca/i);
  });
});
