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
        primaryIdentity: 'creator',
      },
      creativeFormat: 'video',
      pageId: 'brand-page-1',
    });

    expect(result.primaryPageId).toBe('creator-page-1');
    expect(result.payload).toMatchObject({
      facebook_branded_content: { sponsor_page_id: 'brand-page-1' },
    });
    expect(result.payload).not.toHaveProperty('instagram_branded_content');
  });

  it('memakai brandInstagramId sebagai sponsor_id ketika primaryIdentity creator', () => {
    const result = buildPartnershipFields({
      partnership: {
        partnerPageId: 'creator-page-1',
        brandInstagramId: 'brand-ig-1',
        primaryIdentity: 'creator',
      },
      creativeFormat: 'video',
      pageId: 'brand-page-1',
    });

    expect(result.primaryPageId).toBe('creator-page-1');
    expect(result.payload).toEqual({
      facebook_branded_content: { sponsor_page_id: 'brand-page-1' },
      instagram_branded_content: { sponsor_id: 'brand-ig-1' },
    });
  });

  it('menolak partnerInstagramId bersama primaryIdentity creator', () => {
    expect(() =>
      buildPartnershipFields({
        partnership: {
          partnerPageId: 'creator-page-1',
          partnerInstagramId: 'creator-ig-1',
          primaryIdentity: 'creator',
        },
        creativeFormat: 'video',
        pageId: 'brand-page-1',
      })
    ).toThrow(/partnerInstagramId.*primaryIdentity 'creator'/s);
  });

  it('menolak brandInstagramId pada primaryIdentity advertiser', () => {
    expect(() =>
      buildPartnershipFields({
        partnership: {
          partnerPageId: 'creator-page-1',
          partnerInstagramId: 'creator-ig-1',
          brandInstagramId: 'brand-ig-1',
        },
        creativeFormat: 'video',
        pageId: 'brand-page-1',
      })
    ).toThrow(/brandInstagramId.*primaryIdentity 'advertiser'/s);
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

  it('mengirim branded_content.ad_format pada jalur media ID tanpa adCode', () => {
    const result = buildPartnershipFields({
      partnership: {
        partnerInstagramId: 'creator-ig-1',
        adFormat: '1',
      },
      creativeFormat: 'existing_post',
      pageId: 'brand-page-1',
      sourceInstagramMediaId: 'ig-media-1',
    });

    expect(result.payload).toMatchObject({
      object_id: 'brand-page-1',
      branded_content: { ad_format: '1' },
    });
    expect(result.payload.branded_content).not.toHaveProperty('instagram_boost_post_access_token');
  });

  it('tidak mengirim object_id ketika objectStoryId sudah meng-anchor Page', () => {
    const result = buildPartnershipFields({
      partnership: { partnerPageId: 'creator-page-1' },
      creativeFormat: 'existing_post',
      pageId: 'brand-page-1',
      objectStoryId: 'creator-page-1_123',
    });

    expect(result.payload).not.toHaveProperty('object_id');
    expect(result.payload).toMatchObject({
      facebook_branded_content: { sponsor_page_id: 'creator-page-1' },
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

  it('menambahkan catatan bila primaryIdentity creator dipakai tanpa brandInstagramId', () => {
    const notes = getPartnershipNotes({
      partnerPageId: 'creator-page-1',
      primaryIdentity: 'creator',
    });
    expect(notes.join(' ')).toMatch(/brandInstagramId/);
  });

  it('tidak menambahkan catatan brandInstagramId bila field itu diisi', () => {
    const notes = getPartnershipNotes({
      partnerPageId: 'creator-page-1',
      primaryIdentity: 'creator',
      brandInstagramId: 'brand-ig-1',
    });
    expect(notes.join(' ')).not.toMatch(/brandInstagramId/);
  });

  it('tidak menambahkan catatan tautan akun bila Page kreator diisi', () => {
    const notes = getPartnershipNotes({
      partnerPageId: 'creator-page-1',
      partnerInstagramId: 'creator-ig-1',
    });
    expect(notes.join(' ')).not.toMatch(/tidak ter-link/i);
  });
});
