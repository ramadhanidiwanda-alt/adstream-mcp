# Meta CPAS Catalog Live Validation

Tanggal validasi: 22 September 2026.

## Ruang lingkup dan keselamatan

Validasi dilakukan pada akun Meta CPAS menggunakan entity baru berlabel `[TEST ONLY]`. Tidak ada campaign, ad set, creative, atau ad existing yang diubah, dinonaktifkan, atau diaktifkan. Seluruh entity delivery dibuat dan dipertahankan dalam status `PAUSED`.

Entity test:

- Campaign `120252127745910071` — `PAUSED`.
- Ad set `120252127747370071` — `PAUSED`.
- Creative `1060254726622894`.
- Ad `120252127785790071` — `PAUSED`.

Jangan mengaktifkan, mengarsipkan, atau menghapus entity tersebut tanpa persetujuan eksplisit. Archive/delete bersifat permanen pada Meta API.

## Hasil yang berhasil diverifikasi

- Campaign dan ad set CPAS dapat dibuat dalam status `PAUSED`.
- Ad set mempertahankan product set, pixel, aplikasi retailer, object-store URLs, event `PURCHASE`, `advantage_audience=0`, dan `is_dynamic_creative=false`.
- Creative catalog collaborative berhasil membawa CTA `SHOP_NOW`, app deep-link configuration, `applink_treatment`, dan `omnichannel_link_spec`.
- Read-back creative mempertahankan enhancement opt-out, termasuk `media_type_automation=OPT_OUT`.
- Ad berhasil dibuat dalam status `PAUSED`, terhubung ke creative yang benar, dan preview `INSTAGRAM_STANDARD` berhasil dibuat.

## Gap yang ditemukan

### `template_url` ditolak untuk catalog single-image

Bundle `catalog_single_image` meneruskan `templateUrl` menjadi `object_story_spec.template_data.template_url`. Meta menolak creative dengan subcode `1443050`: field `template_url` tidak didukung pada `template_data` untuk payload tersebut.

Bundle berhenti pada tahap creative setelah campaign dan ad set berhasil dibuat. Hasil gagal tetap mengembalikan kedua ID sehingga partial creation dapat dilacak dengan aman.

### Public creative schema belum mengekspos `presentation`

Builder internal mendukung presentasi `single_image`, `carousel`, dan `video_carousel`, tetapi schema public `ads_create_adcreative` menolak field `creativeSpec.presentation` sebagai field yang tidak dikenali.

Creative koreksi tanpa `presentation` diterima Meta, tetapi read-back menunjukkan:

```json
{
  "asset_feed_spec": {
    "optimization_type": "FORMAT_AUTOMATION",
    "ad_formats": ["CAROUSEL", "COLLECTION"]
  }
}
```

Dengan demikian, live test membuktikan jalur catalog collaborative umum, tetapi belum membuktikan output single-image murni.

## Tindak lanjut

1. Jangan kirim `template_url` untuk payload catalog single-image yang tidak mendukungnya.
2. Tambahkan field typed `presentation` ke schema MCP public dan teruskan ke builder internal.
3. Tambahkan regression test untuk subcode `1443050` dan parity schema public/internal.
4. Jalankan build, typecheck, lint, serta seluruh test.
5. Retest hanya creative dan ad pada ad set test yang sama; keduanya wajib tetap `PAUSED`. Jangan membuat campaign atau ad set tambahan untuk retest ini.

