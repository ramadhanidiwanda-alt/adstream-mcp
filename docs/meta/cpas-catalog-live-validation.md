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

## Resolution

Perbaikan kode diterapkan pada branch `codex/document-cpas-live-validation` setelah membandingkan payload dengan contoh catalog creative pada koleksi resmi Meta Marketing API:

- `template_url` tidak lagi dikirim pada `object_story_spec.template_data`; `destinationUrl` tetap menjadi `template_data.link`.
- Public adapter menerima dan meneruskan `creativeSpec.presentation` secara typed: `single_image`, `carousel`, atau `video_carousel`.
- `hybridVideo` ikut diteruskan untuk presentasi `video_carousel`.
- `templateUrl` dipertahankan sementara sebagai input legacy untuk kompatibilitas, tetapi tidak dikirim ke Meta.
- Regression tests ditambahkan untuk payload catalog dan parity public adapter/internal builder.

Live retest single-image dilakukan pada 22 September 2026. Entity test di atas tetap `PAUSED`.

## Remaining-gap implementation

Perbaikan lanjutan melengkapi public `ads_create_adcreative` untuk meneruskan opsi katalog yang sebelumnya hanya tersedia pada builder/bundle: `showMultipleImages`, `preferredImageTags`, `formatOption`, dan `categorizationCriteria`. Kombinasi `showMultipleImages` dengan `formatOption` tetap ditolak saat preflight karena Meta menolaknya sebagai redundant object-story configuration.

Bundle CPAS sekarang menerima `resumeFrom` berjenjang (`campaignId`, `adSetId`, `creativeId`, `adId`). Ketika eksekusi gagal di tengah, response menyertakan `resumeFrom` berisi seluruh parent ID yang sudah berhasil dibuat. Retry dapat melanjutkan dari tahap yang hilang tanpa membuat ulang parent, tanpa auto-delete, dan tanpa auto-archive. Seluruh objek yang dibuat tetap `PAUSED`.

## Live validation lanjutan, 23 September 2026

Campaign dummy `120252133196790071` dan ad set `120252133197320071` dibuat dalam status `PAUSED`. Kegagalan awal pada creative (`omnichannel_link_spec.app.platform_specs` wajib, lalu aset kategori tidak cukup, lalu fallback image manual tidak didukung) tidak menduplikasi parent: retry memakai `resumeFrom` dengan ID yang sama.

Empat ad berikut berhasil dibuat dalam status konfigurasi `PAUSED`, dan preview `INSTAGRAM_STANDARD` masing-masing dapat dirender:

| Format                 | Creative           | Ad                   | Readback utama                                                              |
| ---------------------- | ------------------ | -------------------- | --------------------------------------------------------------------------- |
| Catalog single-image   | `1045134915011851` | `120252133231950071` | `show_multiple_images=false`, tanpa `template_url`                          |
| Catalog carousel       | `928986159856718`  | `120252133263230071` | `show_multiple_images=true`, `asset_feed_spec.ad_formats` memuat `CAROUSEL` |
| Catalog video-carousel | `3375675706065319` | `120252133301680071` | static video card dan dynamic product card tersimpan                        |
| Catalog `formatOption` | `1413026514357563` | `120252133360180071` | `format_option=carousel_slideshows` tersimpan                               |

Collection memakai Instant Experience published `1338190030512984` dari Page pemilik `145397668657125`. Creative awal `2513389592490210` berhasil dibuat, tetapi ad ditolak Meta dengan subcode `1990065`: `product_set_id` tidak boleh dipakai tanpa template produk pada creative Collection yang memakai `link_data` statis. Perbaikan builder menghilangkan `product_set_id` dari creative Collection sambil mempertahankan product set di ad set dan omnichannel link.

Audit terakhir menunjukkan campaign dan ad set berstatus `PAUSED` dengan `effective_status=PAUSED`. Keempat ad berstatus konfigurasi `PAUSED`; `effective_status=PENDING_REVIEW` saat audit dan tidak ada aktivasi yang dilakukan. Creative Meta bisa terbaca `ACTIVE` tanpa mengubah status delivery ad/ad set.

Catatan keamanan: satu respons paging Meta yang dicetak saat inspeksi read-only memuat access token pada URL paging. Jangan salin URL paging mentah ke log atau laporan; token yang sempat tampil perlu dirotasi setelah retest yang diminta user.

## Live retest Collection, 23 September 2026

Atas instruksi user, retest dilakukan dengan token lokal yang sama. Preflight memverifikasi campaign `120252133196790071` dan ad set `120252133197320071` masih `PAUSED`, product set `400359918054556` berisi 8 produk, serta Instant Experience `1338190030512984` published dan dimiliki Page `145397668657125`. Dry-run melalui public bundle menunjukkan creative Collection memiliki `link_data` statis tanpa `product_set_id`.

Eksekusi memakai `resumeFrom` untuk dua parent yang sama; tidak ada campaign atau ad set baru. Meta menerima creative `2086017392305661` dan ad `120252139242860071`. Readback memverifikasi creative tanpa `product_set_id`, tautan Instant Experience dan app ID Shopee benar, `media_type_automation=OPT_OUT`, serta preview `INSTAGRAM_STANDARD` dapat dirender. Campaign dan ad set memiliki `status=PAUSED` dan `effective_status=PAUSED`. Ad memiliki `status=PAUSED`; `effective_status=IN_PROCESS` saat audit segera setelah pembuatan. Tidak ada objek yang diaktifkan.

Token tidak dicetak lagi dalam retest. Karena pernah tampil di output terminal sebelumnya, token tersebut tetap perlu dirotasi sesudah pengujian.
