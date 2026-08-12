import { describe, expect, it } from 'vitest';
import {
  buildPartnershipFields,
  getPartnershipNotes,
} from '../src/providers/meta/buildPartnershipFields.js';

describe('buildPartnershipFields', () => {
  it('menempatkan brand sebagai identitas primer dan kreator sebagai sponsor', () => {
    const result = buildPartnershipFields({
      partnership: {
        partnerPageId: 'creator-page-1',
        partnerInstagramId: 'creator-ig-1',
      },
      creativeFormat: 'single_image',
      pageId: 'brand-page-1',
    });

    expect(result.primaryPageId).toBe('brand-page-1');
    expect(result.payload).toEqual({
      facebook_branded_content: { sponsor_page_id: 'creator-page-1' },
      instagram_branded_content: { sponsor_id: 'creator-ig-1' },
    });
  });

  it('membalik identitas ketika primaryIdentity creator', () => {
    const result = buildPartnershipFields({
      partnership: {
        partnerPageId: 'creator-page-1',
        partnerInstagramId: 'creator-ig-1',
        primaryIdentity: 'creator',
      },
      creativeFormat: 'video',
      pageId: 'brand-page-1',
    });

    expect(result.primaryPageId).toBe('creator-page-1');
    expect(result.payload).toMatchObject({
      facebook_branded_content: { sponsor_page_id: 'brand-page-1' },
      instagram_branded_content: { sponsor_id: 'creator-ig-1' },
    });
  });

  it('menambahkan object_id pada existing_post karena tidak ada object_story_spec', () => {
    const result = buildPartnershipFields({
      partnership: { partnerInstagramId: 'creator-ig-1' },
      creativeFormat: 'existing_post',
      pageId: 'brand-page-1',
      sourceInstagramMediaId: 'ig-media-1',
    });

    expect(result.payload).toMatchObject({
      object_id: 'brand-page-1',
      instagram_branded_content: { sponsor_id: 'creator-ig-1' },
    });
    expect(result.payload).not.toHaveProperty('facebook_branded_content');
  });

  it('mengirim branded_content pada jalur ad code', () => {
    const result = buildPartnershipFields({
      partnership: {
        partnerInstagramId: 'creator-ig-1',
        adCode: 'AD-CODE-XYZ',
        adFormat: 'REELS',
      },
      creativeFormat: 'existing_post',
      pageId: 'brand-page-1',
    });

    expect(result.payload).toMatchObject({
      object_id: 'brand-page-1',
      branded_content: {
        instagram_boost_post_access_token: 'AD-CODE-XYZ',
        ad_format: 'REELS',
      },
    });
  });

  it('menolak pageId kosong', () => {
    expect(() =>
      buildPartnershipFields({
        partnership: { partnerInstagramId: 'creator-ig-1' },
        creativeFormat: 'single_image',
        pageId: '   ',
      })
    ).toThrow(/pageId wajib diisi saat partnership dipakai/);
  });

  it('menolak partnership tanpa identitas partner sama sekali', () => {
    expect(() =>
      buildPartnershipFields({
        partnership: {},
        creativeFormat: 'single_image',
        pageId: 'brand-page-1',
      })
    ).toThrow(/partnerPageId atau partnerInstagramId/);
  });

  it('menolak adCode tanpa adFormat', () => {
    expect(() =>
      buildPartnershipFields({
        partnership: { partnerInstagramId: 'creator-ig-1', adCode: 'AD-CODE-XYZ' },
        creativeFormat: 'existing_post',
        pageId: 'brand-page-1',
      })
    ).toThrow(/adFormat wajib diisi bila adCode diisi/);
  });

  it('menolak adCode bersamaan dengan sourceInstagramMediaId', () => {
    expect(() =>
      buildPartnershipFields({
        partnership: {
          partnerInstagramId: 'creator-ig-1',
          adCode: 'AD-CODE-XYZ',
          adFormat: 'REELS',
        },
        creativeFormat: 'existing_post',
        pageId: 'brand-page-1',
        sourceInstagramMediaId: 'ig-media-1',
      })
    ).toThrow(/adCode dan creativeSpec.sourceInstagramMediaId/);
  });

  it('menolak primaryIdentity creator tanpa partnerPageId', () => {
    expect(() =>
      buildPartnershipFields({
        partnership: { partnerInstagramId: 'creator-ig-1', primaryIdentity: 'creator' },
        creativeFormat: 'video',
        pageId: 'brand-page-1',
      })
    ).toThrow(/primaryIdentity 'creator' membutuhkan partnerPageId/);
  });

  it('menolak format yang tidak mendukung partnership dan menyebut nama formatnya', () => {
    expect(() =>
      buildPartnershipFields({
        partnership: { partnerInstagramId: 'creator-ig-1' },
        creativeFormat: 'catalog',
        pageId: 'brand-page-1',
      })
    ).toThrow(/Format catalog tidak mendukung partnership/);
  });
});

describe('getPartnershipNotes', () => {
  it('selalu memuat catatan pending delivery', () => {
    const notes = getPartnershipNotes({ partnerPageId: 'creator-page-1' });
    expect(notes.join(' ')).toMatch(/pending delivery/i);
  });

  it('menambahkan catatan tautan akun bila hanya identitas Instagram yang diisi', () => {
    const notes = getPartnershipNotes({ partnerInstagramId: 'creator-ig-1' });
    expect(notes.join(' ')).toMatch(/tidak ter-link/i);
  });

  it('tidak menambahkan catatan tautan akun bila Page kreator diisi', () => {
    const notes = getPartnershipNotes({
      partnerPageId: 'creator-page-1',
      partnerInstagramId: 'creator-ig-1',
    });
    expect(notes.join(' ')).not.toMatch(/tidak ter-link/i);
  });
});
